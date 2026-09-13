import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { config, OrgMsp } from './config';
import { auth, login } from './auth';
import { submit, submitCommit, evaluate } from './fabric';
import { bloqueDeTx, getExplorerSnapshot, recordarBloqueTx } from './explorer';
import { agregarEstado } from './estado';
import {
  rechazoAdjuntoHitoEstado,
  rechazoAdjuntoIncidencia,
  rechazoCompletarSinEvidencia,
  rechazoEvidenciaNoSocio,
  rechazoSoloAdministracion,
  rechazoSoloConstructora,
  rechazoSoloCreadoraIncidencia,
  rechazoSoloEmpresaHito,
} from './errors';
import { endosantesDeHito, endosantesDeLote, endosantesDePago, esLote, perfilDe, PerfilOrg, sociosDe } from './orgs';
import {
  guardarEvidencia,
  listarEvidencias,
  listarIndiceEvidencias,
  rutaEvidencia,
  saveLocal,
  type EvidenciaPublica,
} from './storage';

export const bancoLog: unknown[] = [];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const router = Router();

function asyncH(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

type ConFecha = { createdAt?: string; at?: string };

function ordenarPorFechaDesc<T extends ConFecha>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.createdAt || b.at || '').localeCompare(a.createdAt || a.at || ''));
}

function listaOrdenada(raw: string): unknown {
  const parsed = JSON.parse(raw) as { items?: ConFecha[] };
  if (Array.isArray(parsed.items)) {
    parsed.items = ordenarPorFechaDesc(parsed.items);
  }
  return parsed;
}

type ConTx = { txId?: string; bloque?: number };

function conBloque<T extends ConTx>(hito: T): T {
  if (hito.bloque != null) {
    return hito;
  }
  const n = bloqueDeTx(hito.txId);
  if (n == null) {
    return hito;
  }
  return { ...hito, bloque: n };
}

function listaHitosConBloque(raw: string): unknown {
  const parsed = listaOrdenada(raw) as { items?: ConTx[] };
  if (Array.isArray(parsed.items)) {
    parsed.items = parsed.items.map(conBloque);
  }
  return parsed;
}

function orgOf(req: Request) {
  return req.user?.org ?? 'EmpresaAMSP';
}

function pid(req: Request): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

function peid(req: Request): string {
  const v = req.params.eid;
  return Array.isArray(v) ? v[0] : v;
}

type IncPublica = { id?: string; empresa?: string; lote?: string; estado?: string };

const ESTADOS_ADJUNTO = new Set(['ABIERTA', 'EN_TRATAMIENTO']);

function mimeEvidenciaOk(file: Express.Multer.File): boolean {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    return true;
  }
  return /\.(pdf|png|jpe?g|gif|webp)$/i.test(file.originalname || '');
}

async function leerIncidencia(req: Request): Promise<IncPublica> {
  const raw = await evaluate(
    orgOf(req),
    config.chaincodeIncidencia,
    'IncidenciaContract',
    'consultarIncidencia',
    [pid(req)],
  );
  const inc = JSON.parse(raw) as IncPublica;
  req.loteContexto = inc.lote;
  return inc;
}

/** Incidencias en red diaria (A+Admin). Los pagos usan `endosantesDePago`. */
const ENDORSE_DAILY = ['EmpresaAMSP', 'AdministracionMSP'];

function perfilConstructora(req: Request, res: Response, que: string): (PerfilOrg & { empresa: string }) | null {
  const perfil = perfilDe(orgOf(req));
  if (!perfil?.empresa) {
    res.status(403).json(rechazoSoloConstructora(req.user?.org, que));
    return null;
  }
  return perfil as PerfilOrg & { empresa: string };
}

function requireAdministracion(req: Request, res: Response): boolean {
  if (req.user?.org !== 'AdministracionMSP') {
    res.status(403).json(rechazoSoloAdministracion(req.user?.org));
    return false;
  }
  return true;
}

async function requireEmpresaHito(
  req: Request,
  res: Response,
  que: string,
): Promise<{ empresa: string; estado?: string } | null> {
  const perfil = perfilConstructora(req, res, que);
  if (!perfil) return null;
  const raw = await evaluate(orgOf(req), config.chaincodeHito, 'HitoContract', 'consultarHito', [
    pid(req),
  ]);
  const hito = JSON.parse(raw) as { empresa?: string; estado?: string };
  if (hito.empresa !== perfil.empresa) {
    res.status(403).json(rechazoSoloEmpresaHito(req.user?.org, hito.empresa));
    return null;
  }
  return { empresa: hito.empresa, estado: hito.estado };
}

async function requireAdjuntoHito(req: Request, res: Response): Promise<{ empresa: string } | null> {
  const dueño = await requireEmpresaHito(req, res, 'una evidencia de hito');
  if (!dueño) return null;
  if (dueño.estado !== 'VALIDACION') {
    res.status(400).json(rechazoAdjuntoHitoEstado(dueño.estado));
    return null;
  }
  return dueño;
}

function rechazoMimeEvidencia(file: Express.Multer.File) {
  return {
    error: 'Solo se admiten fotos (jpg, png, gif, webp) o PDF.',
    detalle: `mime=${file.mimetype} nombre=${file.originalname}`,
    codigo: 'DATO_INVALIDO' as const,
  };
}

async function requireCreadoraIncidencia(req: Request, res: Response, que: string): Promise<boolean> {
  const perfil = perfilConstructora(req, res, que);
  if (!perfil) return false;
  const inc = await leerIncidencia(req);
  if (inc.empresa !== perfil.empresa) {
    res.status(403).json(rechazoSoloCreadoraIncidencia(req.user?.org, inc.empresa));
    return false;
  }
  return true;
}

async function requireAdjuntoIncidencia(req: Request, res: Response): Promise<IncPublica | null> {
  const perfil = perfilConstructora(req, res, 'una evidencia de incidencia');
  if (!perfil) return null;
  const inc = await leerIncidencia(req);
  if (inc.empresa !== perfil.empresa) {
    res.status(403).json(rechazoAdjuntoIncidencia(req.user?.org, inc.empresa));
    return null;
  }
  if (!ESTADOS_ADJUNTO.has(inc.estado || '')) {
    res.status(400).json({
      error: 'Esta incidencia ya está cerrada o rechazada: no se pueden adjuntar evidencias.',
      detalle: `estado=${inc.estado ?? 'desconocido'}`,
      codigo: 'DATO_INVALIDO',
    });
    return null;
  }
  return inc;
}

async function requireSocioEvidencia(req: Request, res: Response): Promise<IncPublica | null> {
  const inc = await leerIncidencia(req);
  const org = orgOf(req);
  if (!esLote(inc.lote) || !sociosDe(inc.lote).includes(org as OrgMsp)) {
    res.status(403).json(rechazoEvidenciaNoSocio(req.user?.org, inc.lote));
    return null;
  }
  return inc;
}

/** Escribir en la PDC de un lote exige el endoso de un socio de esa colección. */
function endosantesIncidencia(lote: string): string[] {
  return esLote(lote) ? endosantesDeLote(lote) : ENDORSE_DAILY;
}

async function itemsOf(org: OrgMsp, chaincode: string, contract: string, fn: string): Promise<unknown[]> {
  try {
    const raw = await evaluate(org, chaincode, contract, fn, ['100', '']);
    const parsed = JSON.parse(raw) as { items?: unknown[] };
    return parsed.items || [];
  } catch {
    return [];
  }
}

async function refreshEstado(org: OrgMsp): Promise<void> {
  try {
    const hitos = (await itemsOf(org, config.chaincodeHito, 'HitoContract', 'listarHitos')) as {
      id?: string;
      estado?: string;
    }[];
    const pagos = (await itemsOf(org, config.chaincodePago, 'PagoContract', 'listarPagos')) as {
      estado?: string;
      importeTotal?: number;
      hitoId?: string;
    }[];
    const incidencias = (await itemsOf(
      org,
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'listarIncidencias',
    )) as { estado?: string }[];
    const agg = agregarEstado(hitos, pagos, incidencias);
    await submit(org, config.chaincodeEstado, 'EstadoObraContract', 'escribirEstado', [
      JSON.stringify(agg),
    ], [org]);
  } catch (err) {
    console.error('estado obra', err);
  }
}

type PagoLedger = { id?: string; empresa?: string; estado?: string };

const pagoLocks = new Map<string, Promise<unknown>>();

function withPagoLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const prev = pagoLocks.get(id) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  pagoLocks.set(id, next);
  return next.finally(() => {
    if (pagoLocks.get(id) === next) pagoLocks.delete(id);
  });
}

async function leerPagoAdmin(id: string): Promise<PagoLedger> {
  const raw = await evaluate(
    'AdministracionMSP',
    config.chaincodePago,
    'PagoContract',
    'consultarPago',
    [id],
  );
  return JSON.parse(raw) as PagoLedger;
}

router.post(
  '/auth/login',
  asyncH(async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    try {
      const token = login(username || '', password || '');
      res.json({ token });
    } catch {
      res.status(401).json({
        error: 'Usuario o contraseña incorrectos. Las cuentas de la demo aparecen bajo el título.',
        detalle: `usuario rechazado: ${username || '(vacío)'}`,
        codigo: 'CREDENCIALES',
      });
    }
  }),
);

router.get(
  '/hitos',
  auth,
  asyncH(async (req, res) => {
    const page = String(req.query.pageSize || '100');
    const bookmark = String(req.query.bookmark || '');
    const raw = await evaluate(orgOf(req), config.chaincodeHito, 'HitoContract', 'listarHitos', [
      page,
      bookmark,
    ]);
    res.json(listaHitosConBloque(raw));
  }),
);

router.post(
  '/hitos',
  auth,
  asyncH(async (req, res) => {
    const perfil = perfilConstructora(req, res, 'un hito de obra');
    if (!perfil) return;
    const { id, titulo, descripcion, empresa, importe } = req.body as Record<string, string>;
    const hid = id || `H-${Date.now()}`;
    const empresaHito = empresa || perfil.empresa;
    const raw = await submit(
      orgOf(req),
      config.chaincodeHito,
      'HitoContract',
      'crearHito',
      [hid, titulo, descripcion || '', empresaHito, String(importe)],
      endosantesDeHito(empresaHito),
    );
    res.status(201).json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.get(
  '/hitos/:id',
  auth,
  asyncH(async (req, res) => {
    const raw = await evaluate(orgOf(req), config.chaincodeHito, 'HitoContract', 'consultarHito', [
      pid(req),
    ]);
    res.json(conBloque(JSON.parse(raw) as ConTx));
  }),
);

router.get(
  '/hitos/:id/evidencias',
  auth,
  asyncH(async (req, res) => {
    await evaluate(orgOf(req), config.chaincodeHito, 'HitoContract', 'consultarHito', [pid(req)]);
    const items = await listarEvidencias(pid(req));
    res.json({ items });
  }),
);

router.post(
  '/hitos/:id/evidencias',
  auth,
  upload.single('file'),
  asyncH(async (req, res) => {
    if (!(await requireAdjuntoHito(req, res))) return;
    if (!req.file) {
      res.status(400).json({
        error: 'No has adjuntado ningún archivo. Selecciona la evidencia y vuelve a enviar.',
        detalle: 'campo multipart "file" ausente',
        codigo: 'DATO_INVALIDO',
      });
      return;
    }
    if (!mimeEvidenciaOk(req.file)) {
      res.status(400).json(rechazoMimeEvidencia(req.file));
      return;
    }
    const meta = await guardarEvidencia(
      pid(req),
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype,
      orgOf(req),
    );
    res.status(201).json(meta);
  }),
);

router.get(
  '/hitos/:id/evidencias/:eid',
  auth,
  asyncH(async (req, res) => {
    const found = await rutaEvidencia(pid(req), peid(req));
    if (!found) {
      res.status(404).json({
        error: 'No hay ninguna evidencia con ese identificador en este hito.',
        detalle: `hito=${pid(req)} evidencia=${peid(req)}`,
        codigo: 'NO_ENCONTRADO',
      });
      return;
    }
    res.setHeader('Content-Type', found.meta.mime);
    res.setHeader('Content-Disposition', `inline; filename="${found.meta.nombre}"`);
    res.sendFile(found.abs);
  }),
);

router.post(
  '/hitos/:id/iniciar',
  auth,
  asyncH(async (req, res) => {
    const hito = await requireEmpresaHito(req, res, 'el avance de un hito');
    if (!hito) return;
    const raw = await submit(
      orgOf(req),
      config.chaincodeHito,
      'HitoContract',
      'iniciarHito',
      [pid(req)],
      endosantesDeHito(hito.empresa),
    );
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/hitos/:id/validar',
  auth,
  asyncH(async (req, res) => {
    const hito = await requireEmpresaHito(req, res, 'el avance de un hito');
    if (!hito) return;
    const raw = await submit(
      orgOf(req),
      config.chaincodeHito,
      'HitoContract',
      'enviarValidacion',
      [pid(req)],
      endosantesDeHito(hito.empresa),
    );
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/hitos/:id/completar',
  auth,
  upload.single('file'),
  asyncH(async (req, res) => {
    const dueño = await requireEmpresaHito(req, res, 'el avance de un hito');
    if (!dueño) return;
    if (dueño.estado !== 'VALIDACION') {
      res.status(400).json(rechazoAdjuntoHitoEstado(dueño.estado));
      return;
    }
    let meta: EvidenciaPublica | undefined;
    if (req.file) {
      if (!mimeEvidenciaOk(req.file)) {
        res.status(400).json(rechazoMimeEvidencia(req.file));
        return;
      }
      meta = await guardarEvidencia(
        pid(req),
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype,
        orgOf(req),
      );
    } else {
      const previas = await listarEvidencias(pid(req));
      meta = previas[0];
    }
    if (!meta) {
      res.status(400).json(rechazoCompletarSinEvidencia());
      return;
    }
    const org = orgOf(req);
    const committed = await submitCommit(
      org,
      config.chaincodeHito,
      'HitoContract',
      'completarHito',
      [pid(req), meta.sha256],
      endosantesDePago(dueño.empresa),
    );
    const parsed = JSON.parse(committed.payload) as { hito?: ConTx; pago?: unknown };
    if (!parsed.hito || !parsed.pago) {
      throw new Error('completarHito no devolvió hito y pago en la misma transacción');
    }
    recordarBloqueTx(parsed.hito.txId || committed.txId, committed.blockNumber);
    res.json({
      hito: conBloque({ ...parsed.hito, bloque: committed.blockNumber }),
      pago: parsed.pago,
      evidencia: meta,
    });
    void refreshEstado(org);
  }),
);

router.post(
  '/hitos/:id/rechazar',
  auth,
  asyncH(async (req, res) => {
    const hito = await requireEmpresaHito(req, res, 'el avance de un hito');
    if (!hito) return;
    const motivo = (req.body as { motivo?: string }).motivo || 'rechazado';
    const raw = await submit(
      orgOf(req),
      config.chaincodeHito,
      'HitoContract',
      'rechazarHito',
      [pid(req), motivo],
      endosantesDeHito(hito.empresa),
    );
    res.json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.get(
  '/pagos',
  auth,
  asyncH(async (req, res) => {
    const page = String(req.query.pageSize || '100');
    const bookmark = String(req.query.bookmark || '');
    const raw = await evaluate(orgOf(req), config.chaincodePago, 'PagoContract', 'listarPagos', [
      page,
      bookmark,
    ]);
    res.json(listaOrdenada(raw));
  }),
);

router.get(
  '/pagos/:id',
  auth,
  asyncH(async (req, res) => {
    const raw = await evaluate(orgOf(req), config.chaincodePago, 'PagoContract', 'consultarPago', [
      pid(req),
    ]);
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/pagos/:id/autorizar',
  auth,
  asyncH(async (req, res) => {
    if (!requireAdministracion(req, res)) return;
    const id = pid(req);
    const raw = await withPagoLock(id, async () => {
      const pago = await leerPagoAdmin(id);
      if (pago.estado === 'AUTORIZADO') {
        return JSON.stringify(pago);
      }
      return submit(
        'AdministracionMSP',
        config.chaincodePago,
        'PagoContract',
        'autorizarPago',
        [id],
        endosantesDePago(pago.empresa),
      );
    });
    const parsed = JSON.parse(raw) as PagoLedger;
    res.json(parsed);
    if (parsed.estado === 'AUTORIZADO') void refreshEstado('AdministracionMSP');
  }),
);

router.post(
  '/pagos/:id/rechazar',
  auth,
  asyncH(async (req, res) => {
    if (!requireAdministracion(req, res)) return;
    const id = pid(req);
    const motivo = (req.body as { motivo?: string }).motivo || 'rechazado';
    const raw = await withPagoLock(id, async () => {
      const pago = await leerPagoAdmin(id);
      if (pago.estado === 'RECHAZADO') {
        return JSON.stringify(pago);
      }
      return submit(
        'AdministracionMSP',
        config.chaincodePago,
        'PagoContract',
        'rechazarPago',
        [id, motivo],
        endosantesDePago(pago.empresa),
      );
    });
    const parsed = JSON.parse(raw) as PagoLedger;
    res.json(parsed);
    if (parsed.estado === 'RECHAZADO') void refreshEstado('AdministracionMSP');
  }),
);

router.get(
  '/incidencias',
  auth,
  asyncH(async (req, res) => {
    const page = String(req.query.pageSize || '100');
    const bookmark = String(req.query.bookmark || '');
    const raw = await evaluate(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'listarIncidencias',
      [page, bookmark],
    );
    res.json(listaOrdenada(raw));
  }),
);

router.post(
  '/incidencias',
  auth,
  asyncH(async (req, res) => {
    const perfil = perfilDe(orgOf(req));
    if (!perfil?.empresa || !perfil.lote) {
      res.status(403).json(rechazoSoloConstructora(req.user?.org, 'una incidencia de lote'));
      return;
    }
    const { id, titulo, lote, detalle, costeEstimado, notasTecnicas } = req.body as Record<
      string,
      string | number
    >;
    const iid = String(id || `I-${Date.now()}`);
    const loteFinal = String(lote || perfil.lote);
    req.loteContexto = loteFinal;
    const transient = {
      detalle: JSON.stringify({
        detalle: detalle || '',
        costeEstimado: Number(costeEstimado || 0),
        notasTecnicas: notasTecnicas || '',
      }),
    };
    const raw = await submit(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'crearIncidencia',
      [iid, String(titulo || ''), perfil.empresa, loteFinal],
      endosantesIncidencia(loteFinal),
      transient,
    );
    res.status(201).json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.get(
  '/incidencias/:id',
  auth,
  asyncH(async (req, res) => {
    const raw = await evaluate(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'consultarIncidencia',
      [pid(req)],
    );
    res.json(JSON.parse(raw));
  }),
);

router.get(
  '/incidencias/:id/privado',
  auth,
  asyncH(async (req, res) => {
    const org = orgOf(req);
    // El detalle solo lo tiene un peer socio de la colección: peer A únicamente guarda el hash
    // de quirofanos-tech, así que hay que dirigir la consulta a los socios del lote.
    const publica = JSON.parse(
      await evaluate(org, config.chaincodeIncidencia, 'IncidenciaContract', 'consultarIncidencia', [
        pid(req),
      ]),
    ) as { lote?: string };
    req.loteContexto = publica.lote;
    const raw = await evaluate(
      org,
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'consultarDetallePrivado',
      [pid(req)],
      esLote(publica.lote) ? sociosDe(publica.lote) : undefined,
    );
    res.json(JSON.parse(raw));
  }),
);

router.get(
  '/incidencias/:id/evidencias',
  auth,
  asyncH(async (req, res) => {
    if (!(await requireSocioEvidencia(req, res))) return;
    const items = await listarEvidencias(pid(req));
    res.json({ items });
  }),
);

router.post(
  '/incidencias/:id/evidencias',
  auth,
  upload.single('file'),
  asyncH(async (req, res) => {
    if (!(await requireAdjuntoIncidencia(req, res))) return;
    if (!req.file) {
      res.status(400).json({
        error: 'No has adjuntado ningún archivo. Selecciona la evidencia y vuelve a enviar.',
        detalle: 'campo multipart "file" ausente',
        codigo: 'DATO_INVALIDO',
      });
      return;
    }
    if (!mimeEvidenciaOk(req.file)) {
      res.status(400).json({
        error: 'Solo se admiten fotos (jpg, png, gif, webp) o PDF.',
        detalle: `mime=${req.file.mimetype} nombre=${req.file.originalname}`,
        codigo: 'DATO_INVALIDO',
      });
      return;
    }
    const meta = await guardarEvidencia(
      pid(req),
      req.file.originalname,
      req.file.buffer,
      req.file.mimetype,
      orgOf(req),
    );
    res.status(201).json(meta);
  }),
);

router.get(
  '/incidencias/:id/evidencias/:eid',
  auth,
  asyncH(async (req, res) => {
    if (!(await requireSocioEvidencia(req, res))) return;
    const found = await rutaEvidencia(pid(req), peid(req));
    if (!found) {
      res.status(404).json({
        error: 'No hay ninguna evidencia con ese identificador en esta incidencia.',
        detalle: `incidencia=${pid(req)} evidencia=${peid(req)}`,
        codigo: 'NO_ENCONTRADO',
      });
      return;
    }
    res.setHeader('Content-Type', found.meta.mime);
    res.setHeader('Content-Disposition', `inline; filename="${found.meta.nombre}"`);
    res.sendFile(found.abs);
  }),
);

router.post(
  '/incidencias/:id/tratar',
  auth,
  asyncH(async (req, res) => {
    if (!(await requireCreadoraIncidencia(req, res, 'el tratamiento de una incidencia'))) return;
    const raw = await submit(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'tratarIncidencia',
      [pid(req)],
      ENDORSE_DAILY,
    );
    res.json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.post(
  '/incidencias/:id/cerrar',
  auth,
  asyncH(async (req, res) => {
    if (!(await requireCreadoraIncidencia(req, res, 'el cierre de una incidencia'))) return;
    const raw = await submit(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'cerrarIncidencia',
      [pid(req)],
      ENDORSE_DAILY,
    );
    res.json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.post(
  '/incidencias/:id/rechazar',
  auth,
  asyncH(async (req, res) => {
    if (!(await requireCreadoraIncidencia(req, res, 'el rechazo de una incidencia'))) return;
    const motivo = (req.body as { motivo?: string }).motivo || 'rechazado';
    const raw = await submit(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'rechazarIncidencia',
      [pid(req), motivo],
      ENDORSE_DAILY,
    );
    res.json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.get(
  '/estado',
  auth,
  asyncH(async (req, res) => {
    const raw = await evaluate(
      orgOf(req),
      config.chaincodeEstado,
      'EstadoObraContract',
      'consultarEstado',
      [],
    );
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/estado/recalcular',
  auth,
  asyncH(async (req, res) => {
    await refreshEstado(orgOf(req));
    const raw = await evaluate(
      orgOf(req),
      config.chaincodeEstado,
      'EstadoObraContract',
      'consultarEstado',
      [],
    );
    res.json(JSON.parse(raw));
  }),
);

router.get('/explorer', auth, (_req, res) => {
  res.json(getExplorerSnapshot());
});

router.post(
  '/mock/banco/pagos',
  asyncH(async (req, res) => {
    const body = req.body;
    console.log('mock banco recibido', body);
    bancoLog.push({ at: new Date().toISOString(), body });
    res.status(200).json({ ok: true, recibido: body });
  }),
);

router.get('/mock/banco/pagos', (_req, res) => {
  res.json({ eventos: bancoLog });
});

router.get(
  '/evidencias',
  auth,
  asyncH(async (req, res) => {
    const porPadre = await listarIndiceEvidencias();
    const org = orgOf(req);
    const incs = (await itemsOf(
      org,
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'listarIncidencias',
    )) as { id?: string; lote?: string }[];
    for (const inc of incs) {
      if (!inc.id) continue;
      if (!esLote(inc.lote) || !sociosDe(inc.lote).includes(org as OrgMsp)) {
        delete porPadre[inc.id];
      }
    }
    res.json({ porPadre });
  }),
);

router.post(
  '/evidencias',
  auth,
  upload.single('file'),
  asyncH(async (req, res) => {
    if (!req.file) {
      res.status(400).json({
        error: 'No has adjuntado ningún archivo. Selecciona la evidencia y vuelve a enviar.',
        detalle: 'campo multipart "file" ausente',
        codigo: 'DATO_INVALIDO',
      });
      return;
    }
    const stored = await saveLocal(
      `${Date.now()}-${req.file.originalname}`,
      req.file.buffer,
    );
    res.status(201).json({ driver: config.storageDriver, path: stored });
  }),
);
