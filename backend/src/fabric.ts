import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers, Gateway, Contract } from '@hyperledger/fabric-gateway';
import { createPrivateKey } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { config, OrgMsp } from './config';

const ORG_DOMAIN: Record<OrgMsp, string> = {
  EmpresaAMSP: 'empresaa.ute.local',
  AdministracionMSP: 'administracion.ute.local',
};

type Handle = { gateway: Gateway; client: grpc.Client };

const cache = new Map<OrgMsp, Handle>();

async function firstFile(dir: string): Promise<string> {
  const files = await fs.readdir(dir);
  if (files.length === 0) {
    throw new Error(`directorio vacío: ${dir}`);
  }
  return path.join(dir, files[0]);
}

async function connectOrg(org: OrgMsp): Promise<Handle> {
  const domain = ORG_DOMAIN[org];
  const msp = path.join(
    config.cryptoPath,
    'peerOrganizations',
    domain,
    'users',
    `Admin@${domain}`,
    'msp',
  );
  const cert = await fs.readFile(await firstFile(path.join(msp, 'signcerts')));
  const keyPem = await fs.readFile(await firstFile(path.join(msp, 'keystore')));
  const tlsRoot = await fs.readFile(
    path.join(
      config.cryptoPath,
      'peerOrganizations',
      'empresaa.ute.local',
      'peers',
      'peer0.empresaa.ute.local',
      'tls',
      'ca.crt',
    ),
  );
  const client = new grpc.Client(config.peerEndpoint, grpc.credentials.createSsl(tlsRoot), {
    'grpc.ssl_target_name_override': config.peerHostAlias,
    'grpc.default_authority': config.peerHostAlias,
    'grpc.keepalive_time_ms': config.keepaliveTime,
    'grpc.keepalive_timeout_ms': config.keepaliveTimeout,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.min_time_between_pings_ms': config.keepaliveTime,
  });
  const gateway = connect({
    client,
    identity: { mspId: org, credentials: cert },
    signer: signers.newPrivateKeySigner(createPrivateKey(keyPem)),
    hash: hash.sha256,
  });
  return { gateway, client };
}

export async function getGateway(org: OrgMsp): Promise<Gateway> {
  let h = cache.get(org);
  if (!h) {
    h = await connectOrg(org);
    cache.set(org, h);
  }
  return h.gateway;
}

function contract(gw: Gateway, chaincode: string, name: string): Contract {
  return gw.getNetwork(config.channelName).getContract(chaincode, name);
}

export async function submit(
  org: OrgMsp,
  chaincode: string,
  name: string,
  fn: string,
  args: string[],
  endorsing?: string[],
): Promise<string> {
  const c = contract(await getGateway(org), chaincode, name);
  const bytes = endorsing
    ? await c.submit(fn, { arguments: args, endorsingOrganizations: endorsing })
    : await c.submitTransaction(fn, ...args);
  return Buffer.from(bytes).toString('utf8');
}

export async function evaluate(
  org: OrgMsp,
  chaincode: string,
  name: string,
  fn: string,
  args: string[],
): Promise<string> {
  const c = contract(await getGateway(org), chaincode, name);
  const bytes = await c.evaluateTransaction(fn, ...args);
  return Buffer.from(bytes).toString('utf8');
}

export async function closeAll(): Promise<void> {
  for (const h of cache.values()) {
    h.gateway.close();
    h.client.close();
  }
  cache.clear();
}
