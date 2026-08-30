import { PagoContract } from '../src/pago-contract';
import { Pago, PARTICIPACIONES_DEFAULT } from '../src/pago';
import { createMockCtx } from './mock-ctx';

function parse<T>(s: string): T {
  return JSON.parse(s) as T;
}

describe('PagoContract', () => {
  let cc: PagoContract;
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(async () => {
    cc = new PagoContract();
    ctx = createMockCtx();
    await cc.InitLedger(ctx);
  });

  test('InitLedger 35/25/20/20', async () => {
    const p = parse<Record<string, number>>(await cc.getParticipaciones(ctx));
    expect(p).toEqual(PARTICIPACIONES_DEFAULT);
    expect(p.EmpresaA + p.EmpresaB + p.EmpresaC + p.EmpresaD).toBe(100);
  });

  test('InitLedger es idempotente', async () => {
    await cc.InitLedger(ctx);
    const p = parse<Record<string, number>>(await cc.getParticipaciones(ctx));
    expect(p.EmpresaA).toBe(35);
  });

  test('ponerEnCustodia deja fondos en CUSTODIA y reparte', async () => {
    const pago = parse<Pago>(
      await cc.ponerEnCustodia(ctx, 'pago-H1', 'H1', 'EmpresaA', '10000'),
    );
    expect(pago.estado).toBe('CUSTODIA');
    expect(pago.desglose.EmpresaA).toBe(3500);
    expect(pago.desglose.EmpresaB).toBe(2500);
    expect(pago.desglose.EmpresaC).toBe(2000);
    expect(pago.desglose.EmpresaD).toBe(2000);
  });

  test('completarHito dispara lógica de pago (sin cross-cc): custodia con hitoId', async () => {
    const pago = parse<Pago>(
      await cc.ponerEnCustodia(ctx, 'pago-H99', 'H1-completado', 'EmpresaA', '1000'),
    );
    expect(pago.hitoId).toBe('H1-completado');
    expect(pago.estado).toBe('CUSTODIA');
    const porHito = parse<Pago>(await cc.getPagoPorHito(ctx, 'H1-completado'));
    expect(porHito.id).toBe('pago-H99');
  });

  test('no duplica pago ni hito', async () => {
    await cc.ponerEnCustodia(ctx, 'pago-H1', 'H1', 'EmpresaA', '100');
    await expect(cc.ponerEnCustodia(ctx, 'pago-H1', 'H1', 'EmpresaA', '100')).rejects.toThrow(
      /ya existe/,
    );
    await expect(cc.ponerEnCustodia(ctx, 'pago-H1b', 'H1', 'EmpresaA', '100')).rejects.toThrow(
      /ya hay pago/,
    );
  });

  test('autorizarPago emite PagoAutorizado y sale de CUSTODIA', async () => {
    await cc.ponerEnCustodia(ctx, 'pago-H1', 'H1', 'EmpresaA', '10000');
    const pago = parse<Pago>(await cc.autorizarPago(ctx, 'pago-H1'));
    expect(pago.estado).toBe('AUTORIZADO');
    expect(ctx.stub.setEvent).toHaveBeenCalledWith(
      'PagoAutorizado',
      expect.any(Buffer),
    );
    const payload = JSON.parse((ctx.stub.setEvent as jest.Mock).mock.calls[0][1].toString());
    expect(payload.pagoId).toBe('pago-H1');
    expect(payload.importeTotal).toBe(10000);
  });

  test('no autoriza si no está en CUSTODIA', async () => {
    await cc.ponerEnCustodia(ctx, 'pago-H1', 'H1', 'EmpresaA', '100');
    await cc.autorizarPago(ctx, 'pago-H1');
    await expect(cc.autorizarPago(ctx, 'pago-H1')).rejects.toThrow(/no está en CUSTODIA/);
  });

  test('rechazarPago desde CUSTODIA', async () => {
    await cc.ponerEnCustodia(ctx, 'pago-H1', 'H1', 'EmpresaA', '100');
    const pago = parse<Pago>(await cc.rechazarPago(ctx, 'pago-H1', 'incidencia grave'));
    expect(pago.estado).toBe('RECHAZADO');
  });

  test('listarPagos paginado', async () => {
    await cc.ponerEnCustodia(ctx, 'pago-1', 'H1', 'EmpresaA', '100');
    await cc.ponerEnCustodia(ctx, 'pago-2', 'H2', 'EmpresaA', '200');
    const page = parse<{ items: Pago[]; fetched: number }>(await cc.listarPagos(ctx, '10', ''));
    expect(page.items).toHaveLength(2);
    expect(page.fetched).toBe(2);
  });
});
