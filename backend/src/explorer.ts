import { common, msp, peer } from '@hyperledger/fabric-protos';
import { config } from './config';
import { getGateway } from './fabric';

export type ExplorerTx = {
  txId: string;
  type?: string;
  fn?: string;
  chaincode?: string;
  creatorMsp?: string;
  endorsers?: string[];
  timestamp?: string;
};

export type ExplorerBlock = {
  number: number;
  txCount: number;
  receivedAt: string;
  previousHash?: string;
  dataHash?: string;
  txs?: ExplorerTx[];
};

const MAX = 40;
const blocks: ExplorerBlock[] = [];
let height = 0;

const HEADER_TYPES: Record<number, string> = {
  0: 'MESSAGE',
  1: 'CONFIG',
  2: 'CONFIG_UPDATE',
  3: 'ENDORSER_TRANSACTION',
  4: 'ORDERER_TRANSACTION',
  5: 'DELIVER_SEEK_INFO',
  6: 'CHAINCODE_PACKAGE',
};

function toNum(v: unknown): number {
  if (typeof v === 'bigint') {
    return Number(v);
  }
  if (v && typeof v === 'object' && 'toNumber' in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
}

function hex(bytes: Uint8Array | undefined): string | undefined {
  if (!bytes || bytes.length === 0) {
    return undefined;
  }
  return Buffer.from(bytes).toString('hex');
}

function mspOf(identityBytes: Uint8Array | undefined): string | undefined {
  if (!identityBytes || identityBytes.length === 0) {
    return undefined;
  }
  try {
    return msp.SerializedIdentity.deserializeBinary(identityBytes).getMspid() || undefined;
  } catch {
    return undefined;
  }
}

/** Extrae chaincode, función y MSP endosantes de un ENDORSER_TRANSACTION. */
function parseEndorserTx(data: Uint8Array): Pick<ExplorerTx, 'fn' | 'chaincode' | 'endorsers'> {
  const out: Pick<ExplorerTx, 'fn' | 'chaincode' | 'endorsers'> = {};
  const tx = peer.Transaction.deserializeBinary(data);
  for (const action of tx.getActionsList()) {
    const payload = peer.ChaincodeActionPayload.deserializeBinary(action.getPayload_asU8());
    try {
      const proposal = peer.ChaincodeProposalPayload.deserializeBinary(
        payload.getChaincodeProposalPayload_asU8(),
      );
      const spec = peer.ChaincodeInvocationSpec.deserializeBinary(
        proposal.getInput_asU8(),
      ).getChaincodeSpec();
      out.chaincode = spec?.getChaincodeId()?.getName() || out.chaincode;
      const args = spec?.getInput()?.getArgsList_asU8() ?? [];
      if (args.length > 0) {
        out.fn = Buffer.from(args[0]).toString('utf8') || out.fn;
      }
    } catch {
      // propuesta ilegible: se conservan los endosos
    }
    const endorsers = (payload.getAction()?.getEndorsementsList() ?? [])
      .map((e) => mspOf(e.getEndorser_asU8()))
      .filter((m): m is string => Boolean(m));
    if (endorsers.length > 0) {
      out.endorsers = [...new Set([...(out.endorsers ?? []), ...endorsers])];
    }
  }
  return out;
}

function parseEnvelope(envelopeBytes: Uint8Array): ExplorerTx | null {
  const envelope = common.Envelope.deserializeBinary(envelopeBytes);
  const payload = common.Payload.deserializeBinary(envelope.getPayload_asU8());
  const header = payload.getHeader();
  if (!header) {
    return null;
  }
  const channelHeader = common.ChannelHeader.deserializeBinary(header.getChannelHeader_asU8());
  const type = channelHeader.getType();
  const ts = channelHeader.getTimestamp();
  const tx: ExplorerTx = {
    txId: channelHeader.getTxId(),
    type: HEADER_TYPES[type] ?? String(type),
  };
  if (ts) {
    tx.timestamp = new Date(ts.getSeconds() * 1000 + Math.floor(ts.getNanos() / 1e6)).toISOString();
  }
  try {
    const sigHeader = common.SignatureHeader.deserializeBinary(header.getSignatureHeader_asU8());
    tx.creatorMsp = mspOf(sigHeader.getCreator_asU8());
  } catch {
    // cabecera de firma ilegible
  }
  if (type === common.HeaderType.ENDORSER_TRANSACTION) {
    try {
      Object.assign(tx, parseEndorserTx(payload.getData_asU8()));
    } catch {
      // transacción ilegible: se mantiene txId y creador
    }
  }
  return tx;
}

function parseBlock(block: common.Block, receivedAt: string): ExplorerBlock {
  const header = block.getHeader();
  const envelopes = block.getData()?.getDataList_asU8() ?? [];
  const item: ExplorerBlock = {
    number: toNum(header?.getNumber()),
    txCount: envelopes.length,
    receivedAt,
    previousHash: hex(header?.getPreviousHash_asU8()),
    dataHash: hex(header?.getDataHash_asU8()),
  };
  const txs: ExplorerTx[] = [];
  for (const envelope of envelopes) {
    try {
      const tx = parseEnvelope(envelope);
      if (tx) {
        txs.push(tx);
      }
    } catch (err) {
      console.error('explorer: envelope ilegible bloque', item.number, err);
    }
  }
  if (txs.length > 0) {
    item.txs = txs;
  }
  return item;
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
            const item = parseBlock(block, new Date().toISOString());
            const num = item.number;
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
