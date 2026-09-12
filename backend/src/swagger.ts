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
    '/red': {
      get: {
        security: [],
        responses: {
          '200': {
            description: 'peers vivos por MSP (TCP al puerto gRPC; B/C/D false hasta make pdc-up)',
          },
        },
      },
    },
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
    '/hitos/{id}/iniciar': {
      post: {
        responses: {
          '200': { description: 'EN_EJECUCION' },
          '403': { description: 'solo la empresa del hito avanza su obra' },
        },
      },
    },
    '/hitos/{id}/validar': {
      post: {
        responses: {
          '200': { description: 'VALIDACION' },
          '403': { description: 'solo la empresa del hito avanza su obra' },
        },
      },
    },
    '/hitos/{id}/completar': {
      post: {
        description:
          'Guarda el acta (foto o PDF) fuera de cadena, calcula SHA-256 del buffer y llama completarHito(id, hash). COMPLETADO + CUSTODIA + txId Fabric en la misma transacción; el número de bloque se añade al commit. Solo en VALIDACION. Multipart campo file, o evidencia ya subida con POST /hitos/{id}/evidencias.',
        requestBody: {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'COMPLETADO + CUSTODIA + evidencia' },
          '400': { description: 'sin archivo, tipo no admitido o hito no en VALIDACION' },
          '403': { description: 'solo la empresa del hito avanza su obra' },
        },
      },
    },
    '/hitos/{id}/evidencias': {
      get: {
        description:
          'Metadatos (nombre, sha256, tamaño). El binario no está en Fabric. Cualquier sesión autenticada: el hito es público.',
        responses: {
          '200': { description: 'lista de evidencias' },
          '404': { description: 'hito no encontrado' },
        },
      },
      post: {
        description:
          'Adjunta foto o PDF (máx. 5 MB) a un hito en VALIDACION. Solo la empresa dueña. El archivo queda en disco; el hash se escribe en el hito al completar.',
        responses: {
          '201': { description: 'metadatos con sha256' },
          '400': { description: 'sin archivo, tipo no admitido o hito no en VALIDACION' },
          '403': { description: 'solo la empresa del hito puede adjuntar' },
        },
      },
    },
    '/hitos/{id}/evidencias/{eid}': {
      get: {
        description: 'Descarga el archivo. Cualquier sesión autenticada.',
        responses: {
          '200': { description: 'binario' },
          '404': { description: 'evidencia no encontrada' },
        },
      },
    },
    '/hitos/{id}/rechazar': {
      post: {
        responses: {
          '200': { description: 'RECHAZADO' },
          '403': { description: 'solo la empresa del hito avanza su obra' },
        },
      },
    },
    '/pagos': { get: { responses: { '200': { description: 'lista' } } } },
    '/pagos/{id}': { get: { responses: { '200': { description: 'pago' } } } },
    '/pagos/{id}/autorizar': {
      post: {
        responses: {
          '200': { description: 'AUTORIZADO + evento' },
          '403': { description: 'solo AdministracionMSP puede autorizar o rechazar' },
        },
      },
    },
    '/pagos/{id}/rechazar': {
      post: {
        responses: {
          '200': { description: 'RECHAZADO' },
          '403': { description: 'solo AdministracionMSP puede autorizar o rechazar' },
        },
      },
    },
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
    '/incidencias/{id}/evidencias': {
      get: {
        description:
          'Metadatos (nombre, sha256, tamaño). El binario no está en Fabric. Solo socios del lote.',
        responses: {
          '200': { description: 'lista de evidencias' },
          '403': { description: 'no socio del lote (PDC_SIN_ACCESO)' },
        },
      },
      post: {
        description:
          'Adjunta foto o PDF (máx. 5 MB) a una incidencia ABIERTA o EN_TRATAMIENTO. Solo la creadora. El archivo queda en disco local; el hash se muestra en la UI y, al crear, en notasTecnicas del PDC.',
        responses: {
          '201': { description: 'metadatos con sha256' },
          '400': { description: 'sin archivo, tipo no admitido o incidencia cerrada' },
          '403': { description: 'solo la empresa que la abrió puede adjuntar' },
        },
      },
    },
    '/incidencias/{id}/evidencias/{eid}': {
      get: {
        description: 'Descarga el archivo. Solo socios del lote.',
        responses: {
          '200': { description: 'binario' },
          '403': { description: 'no socio del lote' },
          '404': { description: 'evidencia no encontrada' },
        },
      },
    },
    '/incidencias/{id}/tratar': {
      post: {
        responses: {
          '200': { description: 'EN_TRATAMIENTO' },
          '403': { description: 'solo la empresa que la abrió puede tramitarla' },
        },
      },
    },
    '/incidencias/{id}/cerrar': {
      post: {
        responses: {
          '200': { description: 'CERRADA' },
          '403': { description: 'solo la empresa que la abrió puede tramitarla' },
        },
      },
    },
    '/incidencias/{id}/rechazar': {
      post: {
        responses: {
          '200': { description: 'RECHAZADA' },
          '403': { description: 'solo la empresa que la abrió puede tramitarla' },
        },
      },
    },
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
      get: {
        description:
          'Índice local de evidencias agrupadas por padre (hito o incidencia). Omite incidencias cuyo lote no es del llamante.',
        responses: { '200': { description: '{ porPadre: { [id]: Evidencia[] } }' } },
      },
      post: {
        description:
          'Subida suelta (compatibilidad). Preferir POST /incidencias/{id}/evidencias para anclar a una incidencia.',
        responses: { '201': { description: 'archivo local' } },
      },
    },
  },
};

export const swaggerMiddleware = swaggerUi.serve;
export const swaggerSetup = swaggerUi.setup(openapi);
