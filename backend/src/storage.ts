import { promises as fs } from 'fs';
import path from 'path';
import { config } from './config';

export async function saveLocal(filename: string, buf: Buffer): Promise<string> {
  if (config.storageDriver !== 'local') {
    throw new Error(`STORAGE_DRIVER no soportado: ${config.storageDriver}`);
  }
  await fs.mkdir(config.uploadDir, { recursive: true });
  const dest = path.join(config.uploadDir, filename);
  await fs.writeFile(dest, buf);
  return dest;
}
