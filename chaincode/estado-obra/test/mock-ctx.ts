import type { Context } from 'fabric-contract-api';

export function createMockCtx(mspId = 'EmpresaAMSP'): Context {
  const data = new Map<string, Buffer>();
  const stub = {
    getState: jest.fn(async (key: string) => data.get(key) ?? Buffer.alloc(0)),
    putState: jest.fn(async (key: string, value: Uint8Array) => {
      data.set(key, Buffer.from(value));
    }),
    deleteState: jest.fn(async (key: string) => {
      data.delete(key);
    }),
    createCompositeKey: jest.fn(
      (objectType: string, attrs: string[]) => `\u0000${objectType}\u0000${attrs.join('\u0000')}\u0000`,
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
