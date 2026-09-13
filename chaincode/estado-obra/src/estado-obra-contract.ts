import { Context, Contract, Info, Transaction } from 'fabric-contract-api';
import { ESTADO_VACIO, EstadoObra } from './estado';

const KEY = 'estado:obra';

@Info({ title: 'EstadoObraContract', description: 'Agregado de obra; lo escribe el backend' })
export class EstadoObraContract extends Contract {
  constructor() {
    super('EstadoObraContract');
  }

  @Transaction()
  async InitLedger(ctx: Context): Promise<string> {
    const existing = await ctx.stub.getState(KEY);
    if (existing && existing.length > 0) {
      return Buffer.from(existing).toString('utf8');
    }
    const estado: EstadoObra = { ...ESTADO_VACIO, updatedAt: this.now(ctx) };
    await ctx.stub.putState(KEY, Buffer.from(JSON.stringify(estado)));
    return JSON.stringify(estado);
  }

  @Transaction()
  async escribirEstado(ctx: Context, json: string): Promise<string> {
    this.require(json, 'json');
    let parsed: Partial<EstadoObra>;
    try {
      parsed = JSON.parse(json) as Partial<EstadoObra>;
    } catch {
      throw new Error('json inválido');
    }
    const estado: EstadoObra = {
      id: 'obra',
      hitosTotal: this.n(parsed.hitosTotal),
      hitosCompletados: this.n(parsed.hitosCompletados),
      hitosRechazados: this.n(parsed.hitosRechazados),
      pagosCustodia: this.n(parsed.pagosCustodia),
      pagosAutorizados: this.n(parsed.pagosAutorizados),
      importeCustodia: this.n(parsed.importeCustodia),
      importeAutorizado: this.n(parsed.importeAutorizado),
      incidenciasAbiertas: this.n(parsed.incidenciasAbiertas),
      incidenciasCerradas: this.n(parsed.incidenciasCerradas),
      avancePct: Math.min(100, Math.max(0, this.n(parsed.avancePct))),
      updatedAt: this.now(ctx),
    };
    await ctx.stub.putState(KEY, Buffer.from(JSON.stringify(estado)));
    return JSON.stringify(estado);
  }

  @Transaction(false)
  async consultarEstado(ctx: Context): Promise<string> {
    const raw = await ctx.stub.getState(KEY);
    if (!raw || raw.length === 0) {
      throw new Error('estado no inicializado; llamar InitLedger');
    }
    return Buffer.from(raw).toString('utf8');
  }

  private n(v: unknown): number {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      return 0;
    }
    return Math.round(n * 100) / 100;
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
