import { HitoContract } from '../src/hito-contract';
import { Hito } from '../src/hito';
import { createMockCtx } from './mock-ctx';

function parse<T>(s: string): T {
  return JSON.parse(s) as T;
}

describe('HitoContract', () => {
  let cc: HitoContract;
  let ctx: ReturnType<typeof createMockCtx>;

  beforeEach(() => {
    cc = new HitoContract();
    ctx = createMockCtx();
  });

  async function crear(id = 'H1'): Promise<Hito> {
    return parse(
      await cc.crearHito(ctx, id, 'Cimentación', 'Lote A', 'EmpresaA', '10000'),
    );
  }

  test('crearHito queda PENDIENTE', async () => {
    const h = await crear();
    expect(h.estado).toBe('PENDIENTE');
    expect(h.importe).toBe(10000);
    expect(h.empresa).toBe('EmpresaA');
  });

  test('no duplica id', async () => {
    await crear();
    await expect(crear()).rejects.toThrow(/ya existe/);
  });

  test('importe inválido', async () => {
    await expect(
      cc.crearHito(ctx, 'H1', 'x', '', 'EmpresaA', '-1'),
    ).rejects.toThrow(/importe/);
  });

  test('empresa inválida', async () => {
    await expect(
      cc.crearHito(ctx, 'H1', 'x', '', 'EmpresaZ', '10'),
    ).rejects.toThrow(/empresa/);
  });

  test('PENDIENTE → EN_EJECUCION → VALIDACION → COMPLETADO', async () => {
    await crear();
    expect(parse<Hito>(await cc.iniciarHito(ctx, 'H1')).estado).toBe('EN_EJECUCION');
    expect(parse<Hito>(await cc.enviarValidacion(ctx, 'H1')).estado).toBe('VALIDACION');
    expect(parse<Hito>(await cc.completarHito(ctx, 'H1')).estado).toBe('COMPLETADO');
  });

  test('VALIDACION → RECHAZADO', async () => {
    await crear();
    await cc.iniciarHito(ctx, 'H1');
    await cc.enviarValidacion(ctx, 'H1');
    const h = parse<Hito>(await cc.rechazarHito(ctx, 'H1', 'defecto estructural'));
    expect(h.estado).toBe('RECHAZADO');
    expect(h.motivoRechazo).toBe('defecto estructural');
  });

  test('transición inválida PENDIENTE → COMPLETADO', async () => {
    await crear();
    await expect(cc.completarHito(ctx, 'H1')).rejects.toThrow(/transición inválida/);
  });

  test('no se reabre COMPLETADO', async () => {
    await crear();
    await cc.iniciarHito(ctx, 'H1');
    await cc.enviarValidacion(ctx, 'H1');
    await cc.completarHito(ctx, 'H1');
    await expect(cc.iniciarHito(ctx, 'H1')).rejects.toThrow(/transición inválida/);
  });

  test('consultarHito', async () => {
    await crear();
    const h = parse<Hito>(await cc.consultarHito(ctx, 'H1'));
    expect(h.id).toBe('H1');
  });

  test('hito inexistente', async () => {
    await expect(cc.consultarHito(ctx, 'NO')).rejects.toThrow(/no existe/);
  });

  test('listarHitos con GetStateByRangeWithPagination', async () => {
    await crear('H1');
    await crear('H2');
    await crear('H3');
    const page1 = parse<{ items: Hito[]; bookmark: string; fetched: number }>(
      await cc.listarHitos(ctx, '2', ''),
    );
    expect(page1.items).toHaveLength(2);
    expect(page1.fetched).toBe(2);
    expect(page1.bookmark).toBeTruthy();
    const page2 = parse<{ items: Hito[] }>(await cc.listarHitos(ctx, '2', page1.bookmark));
    expect(page2.items).toHaveLength(1);
  });

  test('listarHitosPorEstado usa composite key', async () => {
    await crear('H1');
    await crear('H2');
    await cc.iniciarHito(ctx, 'H1');
    const pendientes = parse<{ items: Hito[] }>(
      await cc.listarHitosPorEstado(ctx, 'PENDIENTE', '20', ''),
    );
    const ejecucion = parse<{ items: Hito[] }>(
      await cc.listarHitosPorEstado(ctx, 'EN_EJECUCION', '20', ''),
    );
    expect(pendientes.items.map((h) => h.id)).toEqual(['H2']);
    expect(ejecucion.items.map((h) => h.id)).toEqual(['H1']);
  });
});
