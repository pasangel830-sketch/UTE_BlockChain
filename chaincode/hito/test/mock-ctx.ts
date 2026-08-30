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

export function createMockCtx(mspId = 'EmpresaAMSP'): Context {
  const data = new Map<string, Buffer>();

  const createCompositeKey = (objectType: string, attrs: string[]): string =>
    `\u0000${objectType}\u0000${attrs.join('\u0000')}\u0000`;

  const stub = {
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
    getStateByPartialCompositeKeyWithPagination: jest.fn(
      async (objectType: string, attrs: string[], pageSize: number, bookmark: string) => {
        const prefix = `\u0000${objectType}\u0000${attrs.join('\u0000')}`;
        let keys = [...data.keys()].filter((k) => k.startsWith(prefix)).sort();
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
    setEvent: jest.fn(),
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
