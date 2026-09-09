import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers, Gateway, Contract } from '@hyperledger/fabric-gateway';
import { createPrivateKey } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { config, OrgMsp } from './config';

const ORG_DOMAIN: Record<OrgMsp, string> = {
  EmpresaAMSP: 'empresaa.ute.local',
  EmpresaBMSP: 'empresab.ute.local',
  EmpresaCMSP: 'empresac.ute.local',
  EmpresaDMSP: 'empresad.ute.local',
  AdministracionMSP: 'administracion.ute.local',
};

const ORG_PEER_PORT: Record<OrgMsp, string> = {
  EmpresaAMSP: '7051',
  EmpresaBMSP: '8051',
  EmpresaCMSP: '11051',
  EmpresaDMSP: '12051',
  AdministracionMSP: '9051',
};

type Handle = { gateway: Gateway; client: grpc.Client };

const cache = new Map<string, Handle>();

async function firstFile(dir: string): Promise<string> {
  const files = await fs.readdir(dir);
  if (files.length === 0) {
    throw new Error(`directorio vacío: ${dir}`);
  }
  return path.join(dir, files[0]);
}

function esOrgMsp(m: string): m is OrgMsp {
  return m in ORG_DOMAIN;
}

/** Evaluate diario entra por peer A. Submit de hito/pago/estado B/C/D/Admin usa el peer de quien endosa. */
function gatewayPeerDe(endorsing?: string[]): OrgMsp {
  const primero = endorsing?.find((m) => esOrgMsp(m));
  return primero ?? 'EmpresaAMSP';
}

function endpointOf(peerOrg: OrgMsp): { endpoint: string; hostAlias: string } {
  if (peerOrg === 'EmpresaAMSP') {
    return { endpoint: config.peerEndpoint, hostAlias: config.peerHostAlias };
  }
  const host = config.peerEndpoint.split(':')[0];
  const local = host === 'localhost' || host === '127.0.0.1';
  const alias = `peer0.${ORG_DOMAIN[peerOrg]}`;
  return {
    endpoint: `${local ? host : alias}:${ORG_PEER_PORT[peerOrg]}`,
    hostAlias: alias,
  };
}

async function connectOrg(org: OrgMsp, peerOrg: OrgMsp = 'EmpresaAMSP'): Promise<Handle> {
  const domain = ORG_DOMAIN[org];
  const peerDomain = ORG_DOMAIN[peerOrg];
  const { endpoint, hostAlias } = endpointOf(peerOrg);
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
      peerDomain,
      'peers',
      `peer0.${peerDomain}`,
      'tls',
      'ca.crt',
    ),
  );
  const client = new grpc.Client(endpoint, grpc.credentials.createSsl(tlsRoot), {
    'grpc.ssl_target_name_override': hostAlias,
    'grpc.default_authority': hostAlias,
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

export async function getGateway(org: OrgMsp, peerOrg: OrgMsp = 'EmpresaAMSP'): Promise<Gateway> {
  const key = `${org}@${peerOrg}`;
  let h = cache.get(key);
  if (!h) {
    h = await connectOrg(org, peerOrg);
    cache.set(key, h);
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
  transientData?: Record<string, string | Uint8Array>,
): Promise<string> {
  const via =
    chaincode === config.chaincodePago ||
    chaincode === config.chaincodeHito ||
    chaincode === config.chaincodeEstado
      ? gatewayPeerDe(endorsing)
      : 'EmpresaAMSP';
  const c = contract(await getGateway(org, via), chaincode, name);
  const bytes =
    endorsing || transientData
      ? await c.submit(fn, {
          arguments: args,
          endorsingOrganizations: endorsing,
          transientData,
        })
      : await c.submitTransaction(fn, ...args);
  return Buffer.from(bytes).toString('utf8');
}

export async function evaluate(
  org: OrgMsp,
  chaincode: string,
  name: string,
  fn: string,
  args: string[],
  endorsing?: string[],
): Promise<string> {
  const c = contract(await getGateway(org), chaincode, name);
  const bytes = endorsing
    ? await c.evaluate(fn, { arguments: args, endorsingOrganizations: endorsing })
    : await c.evaluateTransaction(fn, ...args);
  return Buffer.from(bytes).toString('utf8');
}

export async function closeAll(): Promise<void> {
  for (const h of cache.values()) {
    h.gateway.close();
    h.client.close();
  }
  cache.clear();
}
