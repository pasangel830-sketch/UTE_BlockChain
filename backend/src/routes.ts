import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { config } from './config';
import { auth, login } from './auth';
import { submit, evaluate } from './fabric';
import { saveLocal } from './storage';

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
      ['EmpresaAMSP', 'AdministracionMSP'],
    );
    res.json(JSON.parse(raw));
  }),
);

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
