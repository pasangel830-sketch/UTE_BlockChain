import { config } from './config';
import { getGateway } from './fabric';

export type ExplorerBlock = {
  number: number;
  txCount: number;
  receivedAt: string;
};

const MAX = 40;
const blocks: ExplorerBlock[] = [];
let height = 0;

function toNum(v: unknown): number {
  if (typeof v === 'bigint') {
    return Number(v);
  }
  if (v && typeof v === 'object' && 'toNumber' in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

export function getExplorerSnapshot(): { height: number; channel: string; blocks: ExplorerBlock[] } {
  return {
    height,
    channel: config.channelName,
    blocks: [...blocks].slice(-MAX).reverse(),
  };
}

export async function startBlockListener(): Promise<void> {
  const loop = async (): Promise<void> => {
    for (;;) {
      try {
        const network = (await getGateway('EmpresaAMSP')).getNetwork(config.channelName);
        const start = height > 0 ? BigInt(Math.max(0, height - 1)) : undefined;
        const events = await network.getBlockEvents(start !== undefined ? { startBlock: start } : {});
        try {
          for await (const block of events) {
            const header = block.getHeader();
            const num = toNum(header?.getNumber());
            const txCount = block.getData()?.getDataList()?.length ?? 0;
            const item: ExplorerBlock = {
              number: num,
              txCount,
              receivedAt: new Date().toISOString(),
            };
            if (!blocks.some((b) => b.number === num)) {
              blocks.push(item);
              if (blocks.length > MAX) {
                blocks.shift();
              }
            }
            height = Math.max(height, num + 1);
          }
        } finally {
          events.close();
        }
      } catch (err) {
        console.error('listener bloques', err);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  };
  void loop();
}
