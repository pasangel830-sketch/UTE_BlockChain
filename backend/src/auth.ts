import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config, OrgMsp } from './config';

export interface AuthUser {
  sub: string;
  org: OrgMsp;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      /** Lote implicado en la operación, para que el traductor de errores sepa de qué PDC habla. */
      loteContexto?: string;
    }
  }
}

function users(): { username: string; password: string; org: OrgMsp }[] {
  return config.authUsers.split(',').map((entry) => {
    const [username, password, org] = entry.split(':');
    return { username, password, org: org as OrgMsp };
  });
}

export function login(username: string, password: string): string {
  const u = users().find((x) => x.username === username && x.password === password);
  if (!u) {
    throw new Error('credenciales');
  }
  return jwt.sign({ sub: u.username, org: u.org }, config.jwtSecret, {
    expiresIn: config.jwtExpires as jwt.SignOptions['expiresIn'],
  });
}

export function auth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'No has iniciado sesión. Entra con uno de los usuarios de la UTE.',
      detalle: 'falta la cabecera Authorization: Bearer <jwt>',
      codigo: 'SIN_SESION',
    });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch (err) {
    const caducado = err instanceof Error && err.name === 'TokenExpiredError';
    res.status(401).json({
      error: caducado
        ? 'Tu sesión ha caducado (duran 8 horas). Vuelve a entrar.'
        : 'Tu sesión no es válida. Vuelve a entrar.',
      detalle: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      codigo: 'SESION_CADUCADA',
    });
  }
}
