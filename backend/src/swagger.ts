import swaggerUi from 'swagger-ui-express';

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'UTE API — hitos y pagos',
    version: '0.6.0',
    description: 'Rebanada vertical días 4–6. JWT, escrow, mock banco.',
  },
  servers: [{ url: 'http://localhost:4000' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: { security: [], responses: { '200': { description: 'ok' } } } },
    '/metrics': { get: { security: [], responses: { '200': { description: 'Prometheus' } } } },
    '/auth/login': {
      post: {
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { username: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: { '200': { description: 'token' } },
      },
    },
    '/hitos': {
      get: { responses: { '200': { description: 'lista' } } },
      post: { responses: { '201': { description: 'creado PENDIENTE' } } },
    },
    '/hitos/{id}': { get: { responses: { '200': { description: 'hito' } } } },
    '/hitos/{id}/iniciar': { post: { responses: { '200': { description: 'EN_EJECUCION' } } } },
    '/hitos/{id}/validar': { post: { responses: { '200': { description: 'VALIDACION' } } } },
    '/hitos/{id}/completar': {
      post: { responses: { '200': { description: 'COMPLETADO + CUSTODIA' } } },
    },
    '/hitos/{id}/rechazar': { post: { responses: { '200': { description: 'RECHAZADO' } } } },
    '/pagos': { get: { responses: { '200': { description: 'lista' } } } },
    '/pagos/{id}': { get: { responses: { '200': { description: 'pago' } } } },
    '/pagos/{id}/autorizar': {
      post: { responses: { '200': { description: 'AUTORIZADO + evento' } } },
    },
    '/mock/banco/pagos': {
      post: { security: [], responses: { '200': { description: 'ack webhook' } } },
      get: { security: [], responses: { '200': { description: 'log' } } },
    },
    '/evidencias': {
      post: { responses: { '201': { description: 'archivo local' } } },
    },
  },
};

export const swaggerMiddleware = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(openapi);
