import { config } from './config';
import {
  LOTES,
  Lote,
  RESUMEN_SOCIOS,
  esLote,
  etiquetaOrg,
  etiquetaSocios,
  loteSinPeerDiario,
  sociosDe,
} from './orgs';

export type CodigoError =
  | 'ROL_NO_AUTORIZADO'
  | 'PDC_NO_SOCIO'
  | 'PDC_SIN_ACCESO'
  | 'PDC_SIN_PEER'
  | 'RED_NO_DISPONIBLE'
  | 'ENDOSO_INSUFICIENTE'
  | 'TRANSICION_INVALIDA'
  | 'DUPLICADO'
  | 'NO_ENCONTRADO'
  | 'SESION_CADUCADA'
  | 'SIN_SESION'
  | 'CREDENCIALES'
  | 'CONFLICTO_CONCURRENCIA'
  | 'DATO_INVALIDO'
  | 'ERROR_INTERNO';

/** `error` es el texto humano; `detalle` el mensaje crudo de Fabric; `nota` la línea en gris. */
export type RespuestaError = {
  error: string;
  detalle: string;
  codigo: CodigoError;
  nota?: string;
};

export type ContextoError = {
  org?: string;
  ruta?: string;
  lote?: unknown;
};

const NOTA_AISLAMIENTO = 'Comportamiento esperado: aislamiento de datos privados.';

const TRANSICIONES: Record<string, string[]> = {
  PENDIENTE: ['EN_EJECUCION'],
  EN_EJECUCION: ['VALIDACION'],
  VALIDACION: ['COMPLETADO', 'RECHAZADO'],
  COMPLETADO: [],
  RECHAZADO: [],
  ABIERTA: ['EN_TRATAMIENTO', 'RECHAZADA'],
  EN_TRATAMIENTO: ['CERRADA', 'RECHAZADA'],
  CERRADA: [],
  RECHAZADA: [],
};

const ARTICULO: Record<string, string> = { hito: 'Un hito', pago: 'Un pago', incidencia: 'Una incidencia' };

const GRPC_UNAVAILABLE = 14;
const GRPC_DEADLINE_EXCEEDED = 4;

function mensajeCrudo(err: unknown): string {
  if (!(err instanceof Error)) {
    return String(err);
  }
  const partes = [err.message];
  const detalles = (err as { details?: unknown }).details;
  if (Array.isArray(detalles)) {
    for (const d of detalles) {
      const o = d as { address?: string; mspId?: string; message?: string };
      partes.push(`[${o.mspId ?? '?'} @ ${o.address ?? '?'}] ${o.message ?? ''}`);
    }
  }
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message !== err.message) {
    partes.push(`causa: ${cause.message}`);
  }
  return partes.join('\n');
}

/** MSP que sí devolvieron endoso, tal como los reporta fabric-gateway. */
function firmasRecogidas(err: unknown): string[] {
  const detalles = (err as { details?: unknown }).details;
  if (!Array.isArray(detalles)) {
    return [];
  }
  const msps = detalles
    .map((d) => (d as { mspId?: string }).mspId)
    .filter((m): m is string => Boolean(m));
  return [...new Set(msps)];
}

function codigoGrpc(err: unknown): number | undefined {
  const c = (err as { code?: unknown }).code;
  return typeof c === 'number' ? c : undefined;
}

function loteMencionado(crudo: string, ctx: ContextoError): Lote | null {
  if (esLote(ctx.lote)) {
    return ctx.lote;
  }
  if (crudo.includes('quirofanos-tech')) return 'quirofanos-tech';
  if (crudo.includes('obra-gruesa-solar')) return 'obra-gruesa-solar';
  // "failed to find any endorsing peers for org(s): EmpresaBMSP" no nombra el lote, solo el MSP.
  return LOTES.find((l) => sociosDe(l).some((o) => crudo.includes(o))) ?? null;
}

function esFalloDeEndoso(crudo: string, grpc: number | undefined): boolean {
  return (
    grpc === GRPC_UNAVAILABLE ||
    /no endorsing peers|no peers available|failed to select|discovery|endorsement|write access|private data|privatedata|collection/i.test(
      crudo,
    )
  );
}

function estadosValidos(desde: string): string {
  const destinos = TRANSICIONES[desde];
  if (!destinos) {
    return 'ninguno documentado';
  }
  return destinos.length > 0 ? destinos.join(', ') : 'ninguno: es un estado final';
}

export function traducirError(
  err: unknown,
  ctx: ContextoError = {},
): { status: number; body: RespuestaError } {
  const detalle = mensajeCrudo(err);
  const grpc = codigoGrpc(err);
  const quien = etiquetaOrg(ctx.org);

  const noSocio = /no escribe en colección (\S+)/.exec(detalle);
  if (noSocio) {
    return {
      status: 403,
      body: {
        error: `${quien} no es socia del lote ${noSocio[1]} y la red ha rechazado la operación. Los datos privados de cada lote solo son visibles y escribibles por sus socios: ${RESUMEN_SOCIOS}.`,
        detalle,
        codigo: 'PDC_NO_SOCIO',
        nota: NOTA_AISLAMIENTO,
      },
    };
  }

  const sinAcceso = /sin acceso a datos privados de (\S+)/.exec(detalle);
  if (sinAcceso) {
    return {
      status: 403,
      body: {
        error: `${quien} no es socia del lote ${sinAcceso[1]}: su nodo no almacena estos datos privados, solo el hash que prueba que existen y que no han cambiado.`,
        detalle,
        codigo: 'PDC_SIN_ACCESO',
        nota: NOTA_AISLAMIENTO,
      },
    };
  }

  // El peer respondió, pero solo guarda el hash: falta un nodo socio, no falta permiso.
  if (/private data matching public hash version is not available/i.test(detalle)) {
    const l = loteMencionado(detalle, ctx);
    const socios = l ? etiquetaSocios(l) : 'los socios del lote';
    return {
      status: 503,
      body: {
        error: `El nodo que ha respondido guarda solo el hash de estos datos privados, no el contenido${l ? ` del lote ${l}` : ''}. Hace falta un nodo de ${socios}: levanta la red completa (make pdc-up) y repite.`,
        detalle,
        codigo: 'PDC_SIN_PEER',
      },
    };
  }

  const transicion = /transición inválida (\S+) → (\S+)/.exec(detalle);
  if (transicion) {
    const [, desde, hasta] = transicion;
    const tipo = /incidencia/i.test(ctx.ruta ?? '') ? 'incidencia' : 'hito';
    return {
      status: 409,
      body: {
        error: `${ARTICULO[tipo]} ${desde} no puede pasar a ${hasta} directamente. Estado actual: ${desde}. Estados válidos desde aquí: ${estadosValidos(desde)}.`,
        detalle,
        codigo: 'TRANSICION_INVALIDA',
      },
    };
  }

  const duplicado = /(hito|pago|incidencia) ya existe: (\S+)/.exec(detalle);
  if (duplicado) {
    return {
      status: 409,
      body: {
        error: `Ya existe un ${duplicado[1]} con el identificador ${duplicado[2]}. El registro es inmutable: no se sobrescribe. Crea un ${duplicado[1]} nuevo.`,
        detalle,
        codigo: 'DUPLICADO',
      },
    };
  }

  const inexistente = /(hito|pago|incidencia) no existe: (\S+)/.exec(detalle);
  if (inexistente) {
    return {
      status: 404,
      body: {
        error: `No hay ningún ${inexistente[1]} con el identificador ${inexistente[2]} en el registro.`,
        detalle,
        codigo: 'NO_ENCONTRADO',
      },
    };
  }

  const custodia = /pago (\S+) no está en CUSTODIA \((\w+)\)/.exec(detalle);
  if (custodia) {
    return {
      status: 409,
      body: {
        error: `El pago ${custodia[1]} ya no está en custodia (estado actual: ${custodia[2]}). Solo se puede autorizar o rechazar un pago en CUSTODIA.`,
        detalle,
        codigo: 'TRANSICION_INVALIDA',
      },
    };
  }

  if (/MVCC_READ_CONFLICT|PHANTOM_READ_CONFLICT/.test(detalle)) {
    return {
      status: 409,
      body: {
        error: 'Otra operación modificó este registro mientras se validaba la tuya. Vuelve a intentarlo.',
        detalle,
        codigo: 'CONFLICTO_CONCURRENCIA',
      },
    };
  }

  if (/jwt expired|TokenExpiredError/i.test(detalle)) {
    return {
      status: 401,
      body: {
        error: 'Tu sesión ha caducado (duran 8 horas). Vuelve a entrar.',
        detalle,
        codigo: 'SESION_CADUCADA',
      },
    };
  }

  // El peer de entrada caído se parece a "socio sin nodo" pero se arregla con otro comando.
  const peerDeEntradaCaido =
    /ECONNREFUSED|No connection established|failed to connect to all addresses|Name resolution failed|DNS resolution failed/i.test(
      detalle,
    );

  const lote = loteMencionado(detalle, ctx);
  if (!peerDeEntradaCaido && lote && loteSinPeerDiario(lote) && esFalloDeEndoso(detalle, grpc)) {
    return {
      status: 503,
      body: {
        error: `No hay ningún nodo de ${etiquetaSocios(lote)} disponible para firmar esta operación. Los datos privados del lote ${lote} solo se guardan en los nodos de sus socios, y en la red diaria esos nodos están apagados. Levanta la red completa (make pdc-up) y repite.`,
        detalle,
        codigo: 'PDC_SIN_PEER',
      },
    };
  }

  if (
    peerDeEntradaCaido ||
    grpc === GRPC_UNAVAILABLE ||
    grpc === GRPC_DEADLINE_EXCEEDED ||
    /UNAVAILABLE|DEADLINE_EXCEEDED/i.test(detalle)
  ) {
    return {
      status: 503,
      body: {
        error: `No se puede contactar con el nodo de la red blockchain en ${config.peerEndpoint}. La red no está levantada o aún está arrancando. Comprueba con make up-dev y docker ps.`,
        detalle,
        codigo: 'RED_NO_DISPONIBLE',
      },
    };
  }

  if (/ENDORSEMENT_POLICY_FAILURE|endorsement policy|signature set did not satisfy|enough transaction endorsements/i.test(detalle)) {
    const firmas = firmasRecogidas(err);
    const recogidas = firmas.length > 0 ? firmas.join(', ') : 'ninguna';
    const esPago = (ctx.ruta ?? '').startsWith('/pagos');
    return {
      status: 500,
      body: {
        error: esPago
          ? `El pago requiere la firma conjunta de la constructora y del ayuntamiento, y falta una de las dos. Firmas recogidas: ${recogidas}.`
          : `La red no ha reunido las firmas que exige la política de endoso de esta operación. Firmas recogidas: ${recogidas}.`,
        detalle,
        codigo: 'ENDOSO_INSUFICIENTE',
      },
    };
  }

  const invalido = /(\w+) (inválid[oa]|obligatori[oa]): ?(.*)/.exec(detalle);
  if (invalido) {
    return {
      status: 400,
      body: {
        error: `El campo ${invalido[1]} no es válido${invalido[3] ? `: ${invalido[3]}` : ''}. Corrígelo y vuelve a enviar.`,
        detalle,
        codigo: 'DATO_INVALIDO',
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'La operación no se ha podido completar. La red no ha devuelto un motivo reconocible; revisa el detalle técnico.',
      detalle,
      codigo: 'ERROR_INTERNO',
    },
  };
}

/** 403 de la guarda de rol: no es un fallo, es el circuito de autorización funcionando. */
export function rechazoSoloAdministracion(org: string | undefined): RespuestaError {
  const quien = etiquetaOrg(org);
  return {
    error: `Solo Administración (ayuntamiento) puede autorizar pagos. Tu sesión es ${quien}, constructora: puede completar hitos y dejar el pago en custodia, no liberarlo.`,
    detalle: `guarda de rol en la API: org=${org ?? 'desconocida'}, requerida=AdministracionMSP`,
    codigo: 'ROL_NO_AUTORIZADO',
    nota: 'Comportamiento esperado: separación de funciones entre constructora y ayuntamiento.',
  };
}

/** 403 de la guarda de rol para altas que solo hacen las constructoras. */
export function rechazoSoloConstructora(org: string | undefined, que: string): RespuestaError {
  const quien = etiquetaOrg(org);
  return {
    error: `${quien} no ejecuta obra: ${que} lo registra la constructora responsable del lote. Administración valida y autoriza pagos, no da de alta trabajo propio.`,
    detalle: `guarda de rol en la API: org=${org ?? 'desconocida'}, requerida=Empresa A/B/C/D`,
    codigo: 'ROL_NO_AUTORIZADO',
    nota: 'Comportamiento esperado: separación de funciones entre constructora y ayuntamiento.',
  };
}
