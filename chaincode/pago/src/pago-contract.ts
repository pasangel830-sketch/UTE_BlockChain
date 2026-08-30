import { Context, Contract, Info, Transaction } from 'fabric-contract-api';
import { Pago, PARTICIPACIONES_DEFAULT, repartir } from './pago';

const PREFIX = 'pago:';
const KEY_PARTS = 'participaciones';
const IDX_HITO = 'pago~hito';

@Info({ title: 'PagoContract', description: 'Pagos en escrow UTE' })
export class PagoContract extends Contract {
  constructor() {
    super('PagoContract');
  }

  @Transaction()
  async InitLedger(ctx: Context): Promise<string> {
    const existing = await ctx.stub.getState(KEY_PARTS);
    if (existing && existing.length > 0) {
      return Buffer.from(existing).toString('utf8');
    }
    await ctx.stub.putState(KEY_PARTS, Buffer.from(JSON.stringify(PARTICIPACIONES_DEFAULT)));
    return JSON.stringify(PARTICIPACIONES_DEFAULT);
  }

  @Transaction(false)
  async getParticipaciones(ctx: Context): Promise<string> {
    const raw = await ctx.stub.getState(KEY_PARTS);
    if (!raw || raw.length === 0) {
      throw new Error('participaciones no inicializadas; llamar InitLedger');
    }
    return Buffer.from(raw).toString('utf8');
  }

  @Transaction()
  async ponerEnCustodia(
    ctx: Context,
    pagoId: string,
    hitoId: string,
    empresa: string,
    importeStr: string,
  ): Promise<string> {
    this.require(pagoId, 'pagoId');
    this.require(hitoId, 'hitoId');
    this.require(empresa, 'empresa');
    const importe = this.parseImporte(importeStr);
    const existing = await ctx.stub.getState(this.key(pagoId));
    if (existing && existing.length > 0) {
      throw new Error(`pago ya existe: ${pagoId}`);
    }
    const porHito = await ctx.stub.getState(ctx.stub.createCompositeKey(IDX_HITO, [hitoId]));
    if (porHito && porHito.length > 0) {
      throw new Error(`ya hay pago en custodia para hito ${hitoId}`);
    }
    const parts = JSON.parse(await this.getParticipaciones(ctx)) as Record<string, number>;
    const now = this.now(ctx);
    const pago: Pago = {
      id: pagoId,
      hitoId,
      empresa,
      importeTotal: importe,
      participaciones: parts,
      desglose: repartir(importe, parts),
      estado: 'CUSTODIA',
      createdAt: now,
      updatedAt: now,
    };
    await ctx.stub.putState(this.key(pagoId), Buffer.from(JSON.stringify(pago)));
    await ctx.stub.putState(ctx.stub.createCompositeKey(IDX_HITO, [hitoId]), Buffer.from(pagoId));
    return JSON.stringify(pago);
  }

  @Transaction()
  async autorizarPago(ctx: Context, pagoId: string): Promise<string> {
    const pago = await this.mustGet(ctx, pagoId);
    if (pago.estado !== 'CUSTODIA') {
      throw new Error(`pago ${pagoId} no está en CUSTODIA (${pago.estado})`);
    }
    pago.estado = 'AUTORIZADO';
    pago.updatedAt = this.now(ctx);
    await ctx.stub.putState(this.key(pagoId), Buffer.from(JSON.stringify(pago)));
    const evento = {
      pagoId: pago.id,
      hitoId: pago.hitoId,
      empresa: pago.empresa,
      importeTotal: pago.importeTotal,
      desglose: pago.desglose,
      estado: pago.estado,
    };
    ctx.stub.setEvent('PagoAutorizado', Buffer.from(JSON.stringify(evento)));
    return JSON.stringify(pago);
  }

  @Transaction()
  async rechazarPago(ctx: Context, pagoId: string, motivo: string): Promise<string> {
    this.require(motivo, 'motivo');
    const pago = await this.mustGet(ctx, pagoId);
    if (pago.estado !== 'CUSTODIA') {
      throw new Error(`pago ${pagoId} no está en CUSTODIA (${pago.estado})`);
    }
    pago.estado = 'RECHAZADO';
    pago.updatedAt = this.now(ctx);
    await ctx.stub.putState(this.key(pagoId), Buffer.from(JSON.stringify(pago)));
    return JSON.stringify(pago);
  }

  @Transaction(false)
  async consultarPago(ctx: Context, pagoId: string): Promise<string> {
    return JSON.stringify(await this.mustGet(ctx, pagoId));
  }

  @Transaction(false)
  async getPagoPorHito(ctx: Context, hitoId: string): Promise<string> {
    const raw = await ctx.stub.getState(ctx.stub.createCompositeKey(IDX_HITO, [hitoId]));
    if (!raw || raw.length === 0) {
      throw new Error(`no hay pago para hito ${hitoId}`);
    }
    const pagoId = Buffer.from(raw).toString('utf8');
    return this.consultarPago(ctx, pagoId);
  }

  @Transaction(false)
  async listarPagos(ctx: Context, pageSizeStr: string, bookmark: string): Promise<string> {
    const pageSize = this.parsePage(pageSizeStr);
    const { iterator, metadata } = await ctx.stub.getStateByRangeWithPagination(
      PREFIX,
      'pago;',
      pageSize,
      bookmark || '',
    );
    const items: Pago[] = [];
    let result = await iterator.next();
    while (!result.done) {
      if (result.value && result.value.value && result.value.value.length > 0) {
        items.push(JSON.parse(Buffer.from(result.value.value).toString('utf8')) as Pago);
      }
      result = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify({
      items,
      bookmark: metadata.bookmark || '',
      fetched: metadata.fetchedRecordsCount,
    });
  }

  private async mustGet(ctx: Context, id: string): Promise<Pago> {
    const raw = await ctx.stub.getState(this.key(id));
    if (!raw || raw.length === 0) {
      throw new Error(`pago no existe: ${id}`);
    }
    return JSON.parse(Buffer.from(raw).toString('utf8')) as Pago;
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
