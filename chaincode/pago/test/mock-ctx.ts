import type { Context } from 'fabric-contract-api';

type Entry = { key: string; value: Buffer };

function makeIterator(entries: Entry[]) {
  let i = 0;
  return {
    next: async () => {
      if (i >= entries.length) {
        return { value: undefined, done: true };
      }
      const e = entries[i++];
      return { value: { key: e.key, value: e.value }, done: false };
    },
    close: async () => undefined,
  };
}

export function createMockCtx(mspId = 'AdministracionMSP'): Context {
  const data = new Map<string, Buffer>();
  const remoteHitos = new Map<string, { id: string; estado: string; empresa: string; importe: number }>();

  const createCompositeKey = (objectType: string, attrs: string[]): string =>
    `\u0000${objectType}\u0000${attrs.join('\u0000')}\u0000`;

  const stub = {
    remoteHitos,
    getState: jest.fn(async (key: string) => data.get(key) ?? Buffer.alloc(0)),
    putState: jest.fn(async (key: string, value: Uint8Array) => {
      data.set(key, Buffer.from(value));
    }),
    deleteState: jest.fn(async (key: string) => {
      data.delete(key);
    }),
    createCompositeKey: jest.fn(createCompositeKey),
    getStateByRangeWithPagination: jest.fn(
      async (startKey: string, endKey: string, pageSize: number, bookmark: string) => {
        let keys = [...data.keys()].filter((k) => k >= startKey && k < endKey).sort();
        if (bookmark) {
          const idx = keys.findIndex((k) => k === bookmark);
          keys = idx >= 0 ? keys.slice(idx + 1) : keys;
        }
        const page = keys.slice(0, pageSize);
        const more = keys.length > pageSize;
        const entries = page.map((k) => ({ key: k, value: data.get(k)! }));
        return {
          iterator: makeIterator(entries),
          metadata: {
            bookmark: more ? page[page.length - 1] : '',
            fetchedRecordsCount: page.length,
          },
        };
      },
    ),
    getStateByPartialCompositeKeyWithPagination: jest.fn(async () => ({
      iterator: makeIterator([]),
      metadata: { bookmark: '', fetchedRecordsCount: 0 },
    })),
    setEvent: jest.fn(),
    getChannelID: jest.fn(() => 'channel-obra'),
    invokeChaincode: jest.fn(async (name: string, args: string[]) => {
      if (name === 'hito' && args[0] === 'HitoContract:consultarHito') {
        const h = remoteHitos.get(args[1]);
        if (!h) {
          return { status: 500, message: `hito no existe: ${args[1]}`, payload: Buffer.alloc(0) };
        }
        return { status: 200, message: '', payload: Buffer.from(JSON.stringify(h)) };
      }
      return { status: 500, message: `no mock ${name} ${args[0]}`, payload: Buffer.alloc(0) };
    }),
    getTxTimestamp: jest.fn(() => ({
      seconds: { low: 1756580000, high: 0 },
      nanos: 0,
    })),
  };

  const clientIdentity = {
    getMSPID: jest.fn(() => mspId),
    getID: jest.fn(() => `x509::/OU=client/CN=Admin@${mspId}`),
  };

  return { stub, clientIdentity } as unknown as Context;
}

export function mockHitoCompletado(
  ctx: Context,
  id: string,
  empresa: string,
  importe: number,
  estado = 'COMPLETADO',
): void {
  const map = (ctx.stub as unknown as {
    remoteHitos: Map<string, { id: string; estado: string; empresa: string; importe: number }>;
  }).remoteHitos;
  map.set(id, { id, estado, empresa, importe });
}
