import swaggerUi from 'swagger-ui-express';

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'UTE API',
    version: '0.9.0',
    description:
      'Hitos, pagos (escrow), incidencias PDC, estado de obra, Explorer. JWT. Cuentas: empresaA, empresaB, empresaC, empresaD, administracion (contraseña = usuario). Errores con esquema Error.',
  },
  servers: [{ url: 'http://localhost:4000' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        description:
          'Toda respuesta de error usa esta forma. `error` es el texto humano, `detalle` el mensaje crudo de Fabric y `codigo` distingue rechazo por regla de negocio (PDC_NO_SOCIO, PDC_SIN_ACCESO, ROL_NO_AUTORIZADO, TRANSICION_INVALIDA, DUPLICADO) de indisponibilidad de infraestructura (PDC_SIN_PEER, RED_NO_DISPONIBLE, ENDOSO_INSUFICIENTE).',
        properties: {
          error: { type: 'string' },
          detalle: { type: 'string' },
          codigo: { type: 'string' },
          nota: { type: 'string' },
        },
      },
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
      post: {
        description:
          'empresa y lote se toman del perfil de la sesión si no se envían. Administración no crea hitos.',
        responses: {
          '201': { description: 'creado PENDIENTE' },
          '403': { description: 'AdministracionMSP no registra obra propia' },
        },
      },
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
      post: {
        responses: {
          '200': { description: 'AUTORIZADO + evento' },
          '403': { description: 'solo AdministracionMSP puede autorizar' },
        },
      },
    },
    '/pagos/{id}/rechazar': { post: { responses: { '200': { description: 'RECHAZADO' } } } },
    '/incidencias': {
      get: { responses: { '200': { description: 'lista pública' } } },
      post: {
        description:
          'lote por defecto = el del perfil de sesión (A/C obra-gruesa-solar, B/D quirofanos-tech). El endoso se pide a un socio del lote; en la red diaria quirofanos-tech falla con 503 PDC_SIN_PEER hasta make pdc-up.',
        responses: {
          '201': { description: 'ABIERTA + PDC' },
          '403': { description: 'MSP no socio del lote (PDC_NO_SOCIO)' },
          '503': { description: 'sin nodo socio para endosar (PDC_SIN_PEER)' },
        },
      },
    },
    '/incidencias/{id}': { get: { responses: { '200': { description: 'incidencia' } } } },
    '/incidencias/{id}/privado': {
      get: {
        responses: {
          '200': { description: 'detalle PDC (miembros de colección)' },
          '403': { description: 'no socio: su nodo solo guarda el hash (PDC_SIN_ACCESO)' },
        },
      },
    },
    '/incidencias/{id}/tratar': { post: { responses: { '200': { description: 'EN_TRATAMIENTO' } } } },
    '/incidencias/{id}/cerrar': { post: { responses: { '200': { description: 'CERRADA' } } } },
    '/incidencias/{id}/rechazar': { post: { responses: { '200': { description: 'RECHAZADA' } } } },
    '/estado': { get: { responses: { '200': { description: 'agregado' } } } },
    '/estado/recalcular': {
      post: { responses: { '200': { description: 'backend escribe EstadoObra' } } },
    },
    '/explorer': {
      get: {
        responses: {
          '200': {
            description:
              'bloques recientes: number, txCount, receivedAt, previousHash, dataHash y txs (txId, chaincode, fn, creatorMsp, endorsers, timestamp)',
          },
        },
      },
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
