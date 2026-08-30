import path from 'path';

function env(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: parseInt(env('PORT', '4000'), 10),
  jwtSecret: env('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpires: env('JWT_EXPIRES', '8h'),
  authUsers: env(
    'AUTH_USERS',
    'empresaA:empresaA:EmpresaAMSP,administracion:administracion:AdministracionMSP',
  ),
  peerEndpoint: env('PEER_ENDPOINT', 'localhost:7051'),
  peerHostAlias: env('PEER_HOST_ALIAS', 'peer0.empresaa.ute.local'),
  cryptoPath: env(
    'CRYPTO_PATH',
    path.resolve(__dirname, '../../network/organizations'),
  ),
  channelName: env('CHANNEL_NAME', 'channel-obra'),
  chaincodeHito: env('CHAINCODE_HITO', 'hito'),
  chaincodePago: env('CHAINCODE_PAGO', 'pago'),
  storageDriver: env('STORAGE_DRIVER', 'local'),
  uploadDir: env('UPLOAD_DIR', path.resolve(__dirname, '../uploads')),
  mockBancoUrl: env('MOCK_BANCO_URL', 'http://127.0.0.1:4000/mock/banco/pagos'),
  keepaliveTime: parseInt(env('GRPC_KEEPALIVE_TIME_MS', '120000'), 10),
  keepaliveTimeout: parseInt(env('GRPC_KEEPALIVE_TIMEOUT_MS', '20000'), 10),
};

export type OrgMsp = 'EmpresaAMSP' | 'AdministracionMSP';
