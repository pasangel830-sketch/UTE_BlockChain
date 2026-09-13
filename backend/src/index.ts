import 'dotenv/config';
import { config } from './config';
import { createApp } from './app';
import { startPagoListener } from './events';
import { startBlockListener } from './explorer';
import { closeAll, peersLevantados } from './fabric';

async function main() {
  if (config.storageDriver !== 'local' && config.storageDriver !== 'gcs') {
    throw new Error(`STORAGE_DRIVER no soportado: ${config.storageDriver}`);
  }
  if (config.storageDriver === 'gcs' && !config.gcsBucket) {
    throw new Error('GCS_BUCKET obligatorio con STORAGE_DRIVER=gcs');
  }
  if (process.env.NODE_ENV === 'production' && config.jwtSecret === 'dev-secret-change-me') {
    throw new Error('JWT_SECRET fuerte obligatorio en producción');
  }
  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`UTE API :${config.port}`);
    void peersLevantados();
  });
  await startPagoListener();
  await startBlockListener();
  const stop = async () => {
    server.close();
    await closeAll();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
