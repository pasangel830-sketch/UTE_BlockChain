import 'dotenv/config';
import { config } from './config';
import { createApp } from './app';
import { startPagoListener } from './events';
import { closeAll } from './fabric';

async function main() {
  if (config.storageDriver !== 'local') {
    throw new Error('STORAGE_DRIVER=local obligatorio en diario');
  }
  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`UTE API :${config.port}`);
  });
  await startPagoListener();
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
