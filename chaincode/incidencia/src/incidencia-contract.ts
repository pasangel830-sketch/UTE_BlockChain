import { Context, Contract, Info, Transaction } from 'fabric-contract-api';
import {
  DetallePrivado,
  EstadoIncidencia,
  Incidencia,
  LOTES,
  TRANSICIONES,
  assertLote,
  mspPuedeColeccion,
} from './incidencia';

const PREFIX = 'inc:';
const IDX_ESTADO = 'inc~estado';
const IDX_LOTE = 'inc~lote';

@Info({ title: 'IncidenciaContract', description: 'Incidencias UTE con PDC' })
export class IncidenciaContract extends Contract {
  constructor() {
    super('IncidenciaContract');
  }

  @Transaction()
  async crearIncidencia(
    ctx: Context,
    id: string,
    titulo: string,
    empresa: string,
    lote: string,
  ): Promise<string> {
    this.require(id, 'id');
    this.require(titulo, 'titulo');
    this.require(empresa, 'empresa');
    assertLote(lote);
    const existing = await ctx.stub.getState(this.key(id));
    if (existing && existing.length > 0) {
      throw new Error(`incidencia ya existe: ${id}`);
    }
    const msp = ctx.clientIdentity.getMSPID();
    if (!mspPuedeColeccion(msp, lote)) {
      throw new Error(`MSP ${msp} no escribe en colección ${lote}`);
    }
    const detalle = this.readTransient(ctx);
    const now = this.now(ctx);
    const inc: Incidencia = {
      id,
      titulo,
      empresa,
      lote,
      estado: 'ABIERTA',
      createdAt: now,
      updatedAt: now,
    };
    await this.save(ctx, inc, undefined);
    await ctx.stub.putPrivateData(lote, this.key(id), Buffer.from(JSON.stringify(detalle)));
    return JSON.stringify(inc);
  }

  @Transaction()
  async tratarIncidencia(ctx: Context, id: string): Promise<string> {
    return this.transicionar(ctx, id, 'EN_TRATAMIENTO');
  }

  @Transaction()
  async cerrarIncidencia(ctx: Context, id: string): Promise<string> {
    return this.transicionar(ctx, id, 'CERRADA');
  }

  @Transaction()
  async rechazarIncidencia(ctx: Context, id: string, motivo: string): Promise<string> {
    this.require(motivo, 'motivo');
    const inc = await this.transicionarObj(ctx, id, 'RECHAZADA');
    inc.motivo = motivo;
    inc.updatedAt = this.now(ctx);
    await this.save(ctx, inc, inc.estado);
    return JSON.stringify(inc);
  }

  @Transaction(false)
  async consultarIncidencia(ctx: Context, id: string): Promise<string> {
    return JSON.stringify(await this.mustGet(ctx, id));
  }

  @Transaction(false)
  async consultarDetallePrivado(ctx: Context, id: string): Promise<string> {
    const inc = await this.mustGet(ctx, id);
    const msp = ctx.clientIdentity.getMSPID();
    if (!mspPuedeColeccion(msp, inc.lote)) {
      throw new Error(`sin acceso a datos privados de ${inc.lote}`);
    }
    const raw = await ctx.stub.getPrivateData(inc.lote, this.key(id));
    if (!raw || raw.length === 0) {
      throw new Error(`detalle privado no existe: ${id}`);
    }
    return Buffer.from(raw).toString('utf8');
  }

  @Transaction(false)
  async listarIncidencias(ctx: Context, pageSizeStr: string, bookmark: string): Promise<string> {
    const pageSize = this.parsePage(pageSizeStr);
    const { iterator, metadata } = await ctx.stub.getStateByRangeWithPagination(
      PREFIX,
      'inc;',
      pageSize,
      bookmark || '',
    );
    const items = await this.drain(iterator);
    return JSON.stringify({
      items,
      bookmark: metadata.bookmark || '',
      fetched: metadata.fetchedRecordsCount,
    });
  }

  @Transaction(false)
  async listarPorLote(
    ctx: Context,
    lote: string,
    pageSizeStr: string,
    bookmark: string,
  ): Promise<string> {
    assertLote(lote);
    const pageSize = this.parsePage(pageSizeStr);
    const { iterator, metadata } = await ctx.stub.getStateByPartialCompositeKeyWithPagination(
      IDX_LOTE,
      [lote],
      pageSize,
      bookmark || '',
    );
    const ids: string[] = [];
    let result = await iterator.next();
    while (!result.done) {
      if (result.value && result.value.value && result.value.value.length > 0) {
        ids.push(Buffer.from(result.value.value).toString('utf8'));
      }
      result = await iterator.next();
    }
    await iterator.close();
    const items: Incidencia[] = [];
    for (const iid of ids) {
      const raw = await ctx.stub.getState(this.key(iid));
      if (raw && raw.length > 0) {
        items.push(JSON.parse(Buffer.from(raw).toString('utf8')) as Incidencia);
      }
    }
    return JSON.stringify({
      items,
      bookmark: metadata.bookmark || '',
      fetched: metadata.fetchedRecordsCount,
    });
  }

  colecciones(): string[] {
    return [...LOTES];
  }

  private readTransient(ctx: Context): DetallePrivado {
    const t = ctx.stub.getTransient();
    const raw = t.get('detalle');
    if (!raw || raw.length === 0) {
      throw new Error('transient detalle obligatorio');
    }
    const detalle = JSON.parse(Buffer.from(raw).toString('utf8')) as DetallePrivado;
    if (!detalle.detalle || !detalle.detalle.trim()) {
      throw new Error('detalle obligatorio');
    }
    const coste = Number(detalle.costeEstimado);
    if (!Number.isFinite(coste) || coste < 0) {
      throw new Error(`costeEstimado inválido: ${detalle.costeEstimado}`);
    }
    return {
      detalle: detalle.detalle,
      costeEstimado: Math.round(coste * 100) / 100,
      notasTecnicas: detalle.notasTecnicas || '',
    };
  }

  private async transicionar(ctx: Context, id: string, destino: EstadoIncidencia): Promise<string> {
    const inc = await this.transicionarObj(ctx, id, destino);
    return JSON.stringify(inc);
  }

  private async transicionarObj(
    ctx: Context,
    id: string,
    destino: EstadoIncidencia,
  ): Promise<Incidencia> {
    const inc = await this.mustGet(ctx, id);
    const permitidos = TRANSICIONES[inc.estado] || [];
    if (!permitidos.includes(destino)) {
      throw new Error(`transición inválida ${inc.estado} → ${destino}`);
    }
    const previo = inc.estado;
    inc.estado = destino;
    inc.updatedAt = this.now(ctx);
    await this.save(ctx, inc, previo);
    return inc;
  }

  private async mustGet(ctx: Context, id: string): Promise<Incidencia> {
    const raw = await ctx.stub.getState(this.key(id));
    if (!raw || raw.length === 0) {
      throw new Error(`incidencia no existe: ${id}`);
    }
    return JSON.parse(Buffer.from(raw).toString('utf8')) as Incidencia;
  }

  private async save(
    ctx: Context,
    inc: Incidencia,
    estadoPrevio: EstadoIncidencia | undefined,
  ): Promise<void> {
    await ctx.stub.putState(this.key(inc.id), Buffer.from(JSON.stringify(inc)));
    if (estadoPrevio && estadoPrevio !== inc.estado) {
      await ctx.stub.deleteState(ctx.stub.createCompositeKey(IDX_ESTADO, [estadoPrevio, inc.id]));
    }
    if (!estadoPrevio || estadoPrevio !== inc.estado) {
      await ctx.stub.putState(
        ctx.stub.createCompositeKey(IDX_ESTADO, [inc.estado, inc.id]),
        Buffer.from(inc.id),
      );
    }
    if (!estadoPrevio) {
      await ctx.stub.putState(
        ctx.stub.createCompositeKey(IDX_LOTE, [inc.lote, inc.id]),
        Buffer.from(inc.id),
      );
    }
  }

  private async drain(iterator: {
    next: () => Promise<{ value?: { key: string; value: Uint8Array }; done: boolean }>;
    close: () => Promise<void>;
  }): Promise<Incidencia[]> {
    const items: Incidencia[] = [];
    let result = await iterator.next();
    while (!result.done) {
      if (result.value && result.value.value && result.value.value.length > 0) {
        items.push(JSON.parse(Buffer.from(result.value.value).toString('utf8')) as Incidencia);
      }
      result = await iterator.next();
    }
    await iterator.close();
    return items;
  }

  private key(id: string): string {
    return `${PREFIX}${id}`;
  }

  private parsePage(s: string): number {
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1) {
      return 20;
    }
    return Math.min(n, 100);
  }

  private require(v: string, name: string): void {
    if (!v || !v.trim()) {
      throw new Error(`${name} obligatorio`);
    }
  }

  private now(ctx: Context): string {
    try {
      const ts = ctx.stub.getTxTimestamp();
      const secRaw = ts.seconds as unknown;
      const sec =
        typeof secRaw === 'object' && secRaw !== null && 'low' in (secRaw as object)
          ? (secRaw as { low: number }).low
          : Number(secRaw);
      return new Date(sec * 1000).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
}
