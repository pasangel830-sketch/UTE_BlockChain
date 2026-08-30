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
    res.status(401).json({ error: 'no token' });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'token inválido' });
  }
}
