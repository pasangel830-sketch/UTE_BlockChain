import swaggerUi from 'swagger-ui-express';

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'UTE API',
    version: '0.9.0',
    description: 'Hitos, pagos (escrow), incidencias PDC, estado de obra, Explorer. JWT.',
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
    '/pagos/{id}/rechazar': { post: { responses: { '200': { description: 'RECHAZADO' } } } },
    '/incidencias': {
      get: { responses: { '200': { description: 'lista pública' } } },
      post: { responses: { '201': { description: 'ABIERTA + PDC' } } },
    },
    '/incidencias/{id}': { get: { responses: { '200': { description: 'incidencia' } } } },
    '/incidencias/{id}/privado': {
      get: { responses: { '200': { description: 'detalle PDC (miembros de colección)' } } },
    },
    '/incidencias/{id}/tratar': { post: { responses: { '200': { description: 'EN_TRATAMIENTO' } } } },
    '/incidencias/{id}/cerrar': { post: { responses: { '200': { description: 'CERRADA' } } } },
    '/incidencias/{id}/rechazar': { post: { responses: { '200': { description: 'RECHAZADA' } } } },
    '/estado': { get: { responses: { '200': { description: 'agregado' } } } },
    '/estado/recalcular': {
      post: { responses: { '200': { description: 'backend escribe EstadoObra' } } },
    },
    '/explorer': { get: { responses: { '200': { description: 'bloques recientes' } } } },
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
