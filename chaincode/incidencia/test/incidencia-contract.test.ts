import { IncidenciaContract } from '../src/incidencia-contract';
import { DetallePrivado, Incidencia } from '../src/incidencia';
import { createMockCtx } from './mock-ctx';

function parse<T>(s: string): T {
  return JSON.parse(s) as T;
}

const DETALLE = JSON.stringify({
  detalle: 'precio partida solar',
  costeEstimado: 1200,
  notasTecnicas: 'lote A',
});

describe('IncidenciaContract', () => {
  let cc: IncidenciaContract;

  function ctxA() {
    return createMockCtx('EmpresaAMSP', { detalle: DETALLE });
  }

  beforeEach(() => {
    cc = new IncidenciaContract();
  });

  async function crear(ctx = ctxA(), id = 'I1'): Promise<Incidencia> {
    return parse(await cc.crearIncidencia(ctx, id, 'Fisura forjado', 'EmpresaA', 'obra-gruesa-solar'));
  }

  test('crear queda ABIERTA y guarda PDC', async () => {
    const ctx = ctxA();
    const inc = await crear(ctx);
    expect(inc.estado).toBe('ABIERTA');
    expect(inc.lote).toBe('obra-gruesa-solar');
    expect(ctx.stub.putPrivateData).toHaveBeenCalledWith(
      'obra-gruesa-solar',
      'inc:I1',
      expect.any(Buffer),
    );
    const priv = parse<DetallePrivado>(await cc.consultarDetallePrivado(ctx, 'I1'));
    expect(priv.costeEstimado).toBe(1200);
  });

  test('no duplica id', async () => {
    const ctx = ctxA();
    await crear(ctx);
    await expect(crear(ctx)).rejects.toThrow(/ya existe/);
  });

  test('lote inválido', async () => {
    await expect(
      cc.crearIncidencia(ctxA(), 'I1', 'x', 'EmpresaA', 'otro'),
    ).rejects.toThrow(/lote inválido/);
  });

  test('Admin no escribe en colección A/C', async () => {
    const ctx = createMockCtx('AdministracionMSP', { detalle: DETALLE });
    await expect(
      cc.crearIncidencia(ctx, 'I1', 'x', 'EmpresaA', 'obra-gruesa-solar'),
    ).rejects.toThrow(/no escribe en colección/);
  });

  test('EmpresaA no escribe en quirofanos-tech', async () => {
    await expect(
      cc.crearIncidencia(ctxA(), 'I1', 'x', 'EmpresaB', 'quirofanos-tech'),
    ).rejects.toThrow(/no escribe en colección/);
  });

  test('transient detalle obligatorio', async () => {
    const ctx = createMockCtx('EmpresaAMSP', {});
    await expect(
      cc.crearIncidencia(ctx, 'I1', 'x', 'EmpresaA', 'obra-gruesa-solar'),
    ).rejects.toThrow(/transient detalle/);
  });

  test('ABIERTA → EN_TRATAMIENTO → CERRADA', async () => {
    const ctx = ctxA();
    await crear(ctx);
    expect(parse<Incidencia>(await cc.tratarIncidencia(ctx, 'I1')).estado).toBe('EN_TRATAMIENTO');
    expect(parse<Incidencia>(await cc.cerrarIncidencia(ctx, 'I1')).estado).toBe('CERRADA');
  });

  test('ABIERTA → RECHAZADA', async () => {
    const ctx = ctxA();
    await crear(ctx);
    const inc = parse<Incidencia>(await cc.rechazarIncidencia(ctx, 'I1', 'fuera de alcance'));
    expect(inc.estado).toBe('RECHAZADA');
    expect(inc.motivo).toBe('fuera de alcance');
  });

  test('transición inválida CERRADA → tratar', async () => {
    const ctx = ctxA();
    await crear(ctx);
    await cc.tratarIncidencia(ctx, 'I1');
    await cc.cerrarIncidencia(ctx, 'I1');
    await expect(cc.tratarIncidencia(ctx, 'I1')).rejects.toThrow(/transición inválida/);
  });

  test('Admin no lee detalle privado', async () => {
    const ctx = ctxA();
    await crear(ctx);
    ctx.clientIdentity.getMSPID = jest.fn(() => 'AdministracionMSP');
    await expect(cc.consultarDetallePrivado(ctx, 'I1')).rejects.toThrow(/sin acceso a datos privados/);
  });

  test('listarIncidencias paginado', async () => {
    const ctx = ctxA();
    await crear(ctx, 'I1');
    await crear(ctx, 'I2');
    const page = parse<{ items: Incidencia[]; fetched: number }>(
      await cc.listarIncidencias(ctx, '10', ''),
    );
    expect(page.items).toHaveLength(2);
    expect(page.fetched).toBe(2);
  });

  test('listarPorLote usa composite key', async () => {
    const ctx = ctxA();
    await crear(ctx, 'I1');
    const page = parse<{ items: Incidencia[] }>(
      await cc.listarPorLote(ctx, 'obra-gruesa-solar', '20', ''),
    );
    expect(page.items.map((i) => i.id)).toEqual(['I1']);
  });

  test('colecciones PDC del contrato', () => {
    expect(cc.colecciones()).toEqual(['obra-gruesa-solar', 'quirofanos-tech']);
  });
});
