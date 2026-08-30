#!/usr/bin/env bash
# Genera MSP con cryptogen (sin CA). Idempotente salvo FORCE=1.
# En drvfs (/mnt/c) chmod 600 no se aplica; el repo debe vivir en ext4 (~/ute/app).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NET="${ROOT}/network"
ORG="${NET}/organizations"
ART="${NET}/channel-artifacts"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"

if [[ -d "${ORG}/peerOrganizations/empresaa.ute.local" && "${FORCE:-0}" != "1" ]]; then
  echo "crypto ya existe (FORCE=1 para regenerar)"
  exit 0
fi

if ! command -v cryptogen >/dev/null; then
  echo "cryptogen no está en PATH. Día 1: binarios Fabric 2.5.16"
  exit 1
fi

rm -rf "${ORG}"
rm -f "${ART}"/*.block "${ART}"/*.tx 2>/dev/null || true
mkdir -p "${ORG}" "${ART}"

cryptogen generate --config="${NET}/crypto-config.yaml" --output="${ORG}"

find "${ORG}" -type f -name '*_sk' -exec chmod 600 {} \;
find "${ORG}" -type f -name '*.key' -exec chmod 600 {} \; 2>/dev/null || true

echo "crypto listo en network/organizations (no va a GitHub)"
