#!/usr/bin/env bash
# cryptogen de producción. Requiere STATIC_IP (IP estática de fabric-ute).
# Copia crypto-config.production.yaml.example, sustituye REPLACE_STATIC_IP,
# genera network/organizations-prod y chmod 600 de *_sk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NET="${ROOT}/network"
ORG="${NET}/organizations-prod"
EXAMPLE="${NET}/crypto-config.production.yaml.example"
CFG="${NET}/crypto-config.production.yaml"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"

if [[ -z "${STATIC_IP:-}" ]]; then
  echo "STATIC_IP obligatorio (IP estática de fabric-ute)"
  exit 1
fi

if [[ ! "${STATIC_IP}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "STATIC_IP no es una IPv4: ${STATIC_IP}"
  exit 1
fi

if [[ -d "${ORG}/peerOrganizations/empresaa.ute.prod" && "${FORCE:-0}" != "1" ]]; then
  echo "crypto prod ya existe (FORCE=1 para regenerar)"
  exit 0
fi

if ! command -v cryptogen >/dev/null; then
  echo "cryptogen no está en PATH. Día 1: binarios Fabric 2.5.16"
  exit 1
fi

sed "s/REPLACE_STATIC_IP/${STATIC_IP}/g" "${EXAMPLE}" > "${CFG}"

if [[ -n "${API_FQDN:-}" ]]; then
  python3 - "${CFG}" "${API_FQDN}" "${STATIC_IP}" <<'PY'
import sys
from pathlib import Path
p = Path(sys.argv[1])
fqdn = sys.argv[2]
ip = sys.argv[3]
lines = p.read_text().splitlines(True)
out = []
for line in lines:
    out.append(line)
    if line.lstrip().startswith('-') and ip in line and f'"{fqdn}"' not in line:
        indent = line[: len(line) - len(line.lstrip())]
        out.append(f'{indent}- "{fqdn}"\n')
p.write_text(''.join(out))
PY
fi

rm -rf "${ORG}"
mkdir -p "${ORG}"

cryptogen generate --config="${CFG}" --output="${ORG}"

find "${ORG}" -type f -name '*_sk' -exec chmod 600 {} \;
find "${ORG}" -type f -name '*.key' -exec chmod 600 {} \; 2>/dev/null || true

echo "crypto prod listo en network/organizations-prod (SAN IP ${STATIC_IP}; no va a GitHub)"
