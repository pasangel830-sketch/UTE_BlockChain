import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { config, OrgMsp } from './config';
import { auth, login } from './auth';
import { submit, evaluate } from './fabric';
import { saveLocal } from './storage';
import { getExplorerSnapshot } from './explorer';
import { agregarEstado } from './estado';

export const bancoLog: unknown[] = [];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
export const router = Router();

function asyncH(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

function orgOf(req: Request) {
  return req.user?.org ?? 'EmpresaAMSP';
}

function pid(req: Request): string {
  const v = req.params.id;
  return Array.isArray(v) ? v[0] : v;
}

const ENDORSE_DAILY = ['EmpresaAMSP', 'AdministracionMSP'];

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
      estado?: string;
    }[];
    const pagos = (await itemsOf(org, config.chaincodePago, 'PagoContract', 'listarPagos')) as {
      estado?: string;
      importeTotal?: number;
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
    ]);
  } catch (err) {
    console.error('estado obra', err);
  }
}

router.post(
  '/auth/login',
  asyncH(async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    try {
      const token = login(username || '', password || '');
      res.json({ token });
    } catch {
      res.status(401).json({ error: 'credenciales' });
    }
  }),
);

router.get(
  '/hitos',
  auth,
  asyncH(async (req, res) => {
    const page = String(req.query.pageSize || '20');
    const bookmark = String(req.query.bookmark || '');
    const raw = await evaluate(orgOf(req), config.chaincodeHito, 'HitoContract', 'listarHitos', [
      page,
      bookmark,
    ]);
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/hitos',
  auth,
  asyncH(async (req, res) => {
    const { id, titulo, descripcion, empresa, importe } = req.body as Record<string, string>;
    const hid = id || `H-${Date.now()}`;
    const raw = await submit(orgOf(req), config.chaincodeHito, 'HitoContract', 'crearHito', [
      hid,
      titulo,
      descripcion || '',
      empresa || 'EmpresaA',
      String(importe),
    ]);
    res.status(201).json(JSON.parse(raw));
  }),
);

router.get(
  '/hitos/:id',
  auth,
  asyncH(async (req, res) => {
    const raw = await evaluate(orgOf(req), config.chaincodeHito, 'HitoContract', 'consultarHito', [
      pid(req),
    ]);
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/hitos/:id/iniciar',
  auth,
  asyncH(async (req, res) => {
    const raw = await submit(orgOf(req), config.chaincodeHito, 'HitoContract', 'iniciarHito', [
      pid(req),
    ]);
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/hitos/:id/validar',
  auth,
  asyncH(async (req, res) => {
    const raw = await submit(orgOf(req), config.chaincodeHito, 'HitoContract', 'enviarValidacion', [
      pid(req),
    ]);
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/hitos/:id/completar',
  auth,
  asyncH(async (req, res) => {
    const org = orgOf(req);
    const hitoRaw = await submit(org, config.chaincodeHito, 'HitoContract', 'completarHito', [
      pid(req),
    ]);
    const hito = JSON.parse(hitoRaw) as { id: string; empresa: string; importe: number };
    const pagoId = `pago-${hito.id}`;
    const pagoRaw = await submit(
      org,
      config.chaincodePago,
      'PagoContract',
      'ponerEnCustodia',
      [pagoId, hito.id, hito.empresa, String(hito.importe)],
      ['EmpresaAMSP', 'AdministracionMSP'],
    );
    res.json({ hito: JSON.parse(hitoRaw), pago: JSON.parse(pagoRaw) });
    void refreshEstado(org);
  }),
);

router.post(
  '/hitos/:id/rechazar',
  auth,
  asyncH(async (req, res) => {
    const motivo = (req.body as { motivo?: string }).motivo || 'rechazado';
    const raw = await submit(orgOf(req), config.chaincodeHito, 'HitoContract', 'rechazarHito', [
      pid(req),
      motivo,
    ]);
    res.json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.get(
  '/pagos',
  auth,
  asyncH(async (req, res) => {
    const page = String(req.query.pageSize || '20');
    const bookmark = String(req.query.bookmark || '');
    const raw = await evaluate(orgOf(req), config.chaincodePago, 'PagoContract', 'listarPagos', [
      page,
      bookmark,
    ]);
    res.json(JSON.parse(raw));
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
    const raw = await submit(
      'AdministracionMSP',
      config.chaincodePago,
      'PagoContract',
      'autorizarPago',
      [pid(req)],
      ENDORSE_DAILY,
    );
    res.json(JSON.parse(raw));
    void refreshEstado('AdministracionMSP');
  }),
);

router.post(
  '/pagos/:id/rechazar',
  auth,
  asyncH(async (req, res) => {
    const motivo = (req.body as { motivo?: string }).motivo || 'rechazado';
    const raw = await submit(
      orgOf(req),
      config.chaincodePago,
      'PagoContract',
      'rechazarPago',
      [pid(req), motivo],
      ENDORSE_DAILY,
    );
    res.json(JSON.parse(raw));
    void refreshEstado(orgOf(req));
  }),
);

router.get(
  '/incidencias',
  auth,
  asyncH(async (req, res) => {
    const page = String(req.query.pageSize || '20');
    const bookmark = String(req.query.bookmark || '');
    const raw = await evaluate(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'listarIncidencias',
      [page, bookmark],
    );
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/incidencias',
  auth,
  asyncH(async (req, res) => {
    const { id, titulo, empresa, lote, detalle, costeEstimado, notasTecnicas } = req.body as Record<
      string,
      string | number
    >;
    const iid = String(id || `I-${Date.now()}`);
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
      [iid, String(titulo || ''), String(empresa || 'EmpresaA'), String(lote || 'obra-gruesa-solar')],
      ENDORSE_DAILY,
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
    const raw = await evaluate(
      orgOf(req),
      config.chaincodeIncidencia,
      'IncidenciaContract',
      'consultarDetallePrivado',
      [pid(req)],
    );
    res.json(JSON.parse(raw));
  }),
);

router.post(
  '/incidencias/:id/tratar',
  auth,
  asyncH(async (req, res) => {
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

router.post(
  '/evidencias',
  auth,
  upload.single('file'),
  asyncH(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'file' });
      return;
    }
    const stored = await saveLocal(
      `${Date.now()}-${req.file.originalname}`,
      req.file.buffer,
    );
    res.status(201).json({ driver: config.storageDriver, path: stored });
  }),
);
