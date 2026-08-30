import { EstadoObraContract } from '../src/estado-obra-contract';
import { EstadoObra } from '../src/estado';
import { createMockCtx } from './mock-ctx';

function parse<T>(s: string): T {
  return JSON.parse(s) as T;
}

describe('EstadoObraContract', () => {
  let cc: EstadoObraContract;
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(async () => {
    cc = new EstadoObraContract();
    ctx = createMockCtx();
    await cc.InitLedger(ctx);
  });

  test('InitLedger deja ceros', async () => {
    const e = parse<EstadoObra>(await cc.consultarEstado(ctx));
    expect(e.id).toBe('obra');
    expect(e.hitosTotal).toBe(0);
    expect(e.avancePct).toBe(0);
  });

  test('InitLedger es idempotente', async () => {
    await cc.escribirEstado(ctx, JSON.stringify({ hitosTotal: 3, hitosCompletados: 1, avancePct: 33 }));
    await cc.InitLedger(ctx);
    const e = parse<EstadoObra>(await cc.consultarEstado(ctx));
    expect(e.hitosTotal).toBe(3);
  });

  test('escribirEstado guarda el agregado del backend', async () => {
    const e = parse<EstadoObra>(
      await cc.escribirEstado(
        ctx,
        JSON.stringify({
          hitosTotal: 4,
          hitosCompletados: 2,
          hitosRechazados: 1,
          pagosCustodia: 1,
          pagosAutorizados: 1,
          importeCustodia: 1000,
          importeAutorizado: 5000,
          incidenciasAbiertas: 2,
          incidenciasCerradas: 1,
          avancePct: 50,
        }),
      ),
    );
    expect(e.hitosCompletados).toBe(2);
    expect(e.avancePct).toBe(50);
    expect(e.importeAutorizado).toBe(5000);
    expect(e.id).toBe('obra');
  });

  test('json inválido', async () => {
    await expect(cc.escribirEstado(ctx, 'no-json')).rejects.toThrow(/json inválido/);
  });

  test('consultar sin init', async () => {
    const empty = createMockCtx();
    await expect(cc.consultarEstado(empty)).rejects.toThrow(/no inicializado/);
  });

  test('no hay invoke cruzado: el contrato solo persiste JSON', async () => {
    expect((cc as unknown as { stub?: unknown }).stub).toBeUndefined();
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../src/estado-obra-contract.ts'),
      'utf8',
    ) as string;
    expect(src).not.toMatch(/invokeChaincode/);
  });
});
