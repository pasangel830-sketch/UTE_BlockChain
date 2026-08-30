import { Context, Contract, Info, Transaction } from 'fabric-contract-api';
import { EMPRESAS, Empresa, EstadoHito, Hito, TRANSICIONES } from './hito';

const PREFIX = 'hito:';
const IDX_ESTADO = 'hito~estado';
const IDX_EMPRESA = 'hito~empresa';

@Info({ title: 'HitoContract', description: 'Hitos de obra UTE' })
export class HitoContract extends Contract {
  constructor() {
    super('HitoContract');
  }

  @Transaction()
  async crearHito(
    ctx: Context,
    id: string,
    titulo: string,
    descripcion: string,
    empresa: string,
    importeStr: string,
  ): Promise<string> {
    this.require(id, 'id');
    this.require(titulo, 'titulo');
    if (!(EMPRESAS as readonly string[]).includes(empresa)) {
      throw new Error(`empresa inválida: ${empresa}`);
    }
    const importe = this.parseImporte(importeStr);
    const existing = await ctx.stub.getState(this.key(id));
    if (existing && existing.length > 0) {
      throw new Error(`hito ya existe: ${id}`);
    }
    const now = this.now(ctx);
    const hito: Hito = {
      id,
      titulo,
      descripcion: descripcion || '',
      empresa: empresa as Empresa,
      importe,
      estado: 'PENDIENTE',
      createdAt: now,
      updatedAt: now,
    };
    await this.save(ctx, hito, undefined);
    return JSON.stringify(hito);
  }

  @Transaction()
  async iniciarHito(ctx: Context, id: string): Promise<string> {
    return this.transicionar(ctx, id, 'EN_EJECUCION');
  }

  @Transaction()
  async enviarValidacion(ctx: Context, id: string): Promise<string> {
    return this.transicionar(ctx, id, 'VALIDACION');
  }

  @Transaction()
  async completarHito(ctx: Context, id: string): Promise<string> {
    return this.transicionar(ctx, id, 'COMPLETADO');
  }

  @Transaction()
  async rechazarHito(ctx: Context, id: string, motivo: string): Promise<string> {
    this.require(motivo, 'motivo');
    const hito = await this.transicionarObj(ctx, id, 'RECHAZADO');
    hito.motivoRechazo = motivo;
    hito.updatedAt = this.now(ctx);
    await this.save(ctx, hito, 'VALIDACION');
    return JSON.stringify(hito);
  }

  @Transaction(false)
  async consultarHito(ctx: Context, id: string): Promise<string> {
    const hito = await this.mustGet(ctx, id);
    return JSON.stringify(hito);
  }

  @Transaction(false)
  async listarHitos(ctx: Context, pageSizeStr: string, bookmark: string): Promise<string> {
    const pageSize = this.parsePage(pageSizeStr);
    const { iterator, metadata } = await ctx.stub.getStateByRangeWithPagination(
      PREFIX,
      'hito;',
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
  async listarHitosPorEstado(
    ctx: Context,
    estado: string,
    pageSizeStr: string,
    bookmark: string,
  ): Promise<string> {
    this.assertEstado(estado);
    const pageSize = this.parsePage(pageSizeStr);
    const { iterator, metadata } = await ctx.stub.getStateByPartialCompositeKeyWithPagination(
      IDX_ESTADO,
      [estado],
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
    const items: Hito[] = [];
    for (const hid of ids) {
      const raw = await ctx.stub.getState(this.key(hid));
      if (raw && raw.length > 0) {
        items.push(JSON.parse(Buffer.from(raw).toString('utf8')) as Hito);
      }
    }
    return JSON.stringify({
      items,
      bookmark: metadata.bookmark || '',
      fetched: metadata.fetchedRecordsCount,
    });
  }

  private async transicionar(ctx: Context, id: string, destino: EstadoHito): Promise<string> {
    const hito = await this.transicionarObj(ctx, id, destino);
    return JSON.stringify(hito);
  }

  private async transicionarObj(ctx: Context, id: string, destino: EstadoHito): Promise<Hito> {
    const hito = await this.mustGet(ctx, id);
    const permitidos = TRANSICIONES[hito.estado] || [];
    if (!permitidos.includes(destino)) {
      throw new Error(`transición inválida ${hito.estado} → ${destino}`);
    }
    const previo = hito.estado;
    hito.estado = destino;
    hito.updatedAt = this.now(ctx);
    await this.save(ctx, hito, previo);
    return hito;
  }

  private async mustGet(ctx: Context, id: string): Promise<Hito> {
    const raw = await ctx.stub.getState(this.key(id));
    if (!raw || raw.length === 0) {
      throw new Error(`hito no existe: ${id}`);
    }
    return JSON.parse(Buffer.from(raw).toString('utf8')) as Hito;
  }

  private async save(ctx: Context, hito: Hito, estadoPrevio: EstadoHito | undefined): Promise<void> {
    await ctx.stub.putState(this.key(hito.id), Buffer.from(JSON.stringify(hito)));
    if (estadoPrevio && estadoPrevio !== hito.estado) {
      await ctx.stub.deleteState(ctx.stub.createCompositeKey(IDX_ESTADO, [estadoPrevio, hito.id]));
      await ctx.stub.deleteState(ctx.stub.createCompositeKey(IDX_EMPRESA, [hito.empresa, hito.id]));
    }
    if (!estadoPrevio || estadoPrevio !== hito.estado) {
      await ctx.stub.putState(
        ctx.stub.createCompositeKey(IDX_ESTADO, [hito.estado, hito.id]),
        Buffer.from(hito.id),
      );
    }
    if (!estadoPrevio) {
      await ctx.stub.putState(
        ctx.stub.createCompositeKey(IDX_EMPRESA, [hito.empresa, hito.id]),
        Buffer.from(hito.id),
      );
    } else if (estadoPrevio !== hito.estado) {
      await ctx.stub.putState(
        ctx.stub.createCompositeKey(IDX_EMPRESA, [hito.empresa, hito.id]),
        Buffer.from(hito.id),
      );
    }
  }

  private async drain(iterator: {
    next: () => Promise<{ value?: { key: string; value: Uint8Array }; done: boolean }>;
    close: () => Promise<void>;
  }): Promise<Hito[]> {
    const items: Hito[] = [];
    let result = await iterator.next();
    while (!result.done) {
      if (result.value && result.value.value && result.value.value.length > 0) {
        const key = result.value.key || '';
        if (key.startsWith(PREFIX)) {
          items.push(JSON.parse(Buffer.from(result.value.value).toString('utf8')) as Hito);
        }
      }
      result = await iterator.next();
    }
    await iterator.close();
    return items;
  }

  private key(id: string): string {
    return `${PREFIX}${id}`;
  }

  private parseImporte(s: string): number {
    const n = Number(s);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`importe inválido: ${s}`);
    }
    return Math.round(n * 100) / 100;
  }

  private parsePage(s: string): number {
    const n = parseInt(s, 10);
    if (!Number.isFinite(n) || n < 1) {
      return 20;
    }
    return Math.min(n, 100);
  }

  private assertEstado(estado: string): asserts estado is EstadoHito {
    if (!TRANSICIONES[estado]) {
      throw new Error(`estado inválido: ${estado}`);
    }
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
