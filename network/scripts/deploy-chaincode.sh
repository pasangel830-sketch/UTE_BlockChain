#!/usr/bin/env bash
# Empaqueta, instala (A + Admin; B/C/D si están arriba), aprueba y hace commit.
# Uso: deploy-chaincode.sh hito|pago|incidencia|estado-obra [signature-policy]
set -euo pipefail

CC_NAME="${1:?uso: $0 hito|pago|incidencia|estado-obra [policy]}"
CC_VERSION="${CC_VERSION:-1.0}"
CC_SEQUENCE="${CC_SEQUENCE:-1}"
CHANNEL="${CHANNEL:-channel-obra}"
POLICY="${2:-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CC_SRC="${ROOT}/chaincode/${CC_NAME}"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"

if [[ ! -d "${CC_SRC}/src" ]]; then
  echo "no existe ${CC_SRC}"
  exit 1
fi

if [[ -z "${POLICY}" ]]; then
  if [[ "${CC_NAME}" == "pago" ]]; then
    POLICY="AND('EmpresaAMSP.peer','AdministracionMSP.peer')"
  elif [[ "${CC_NAME}" == "incidencia" ]]; then
    POLICY="OutOf(2, 'EmpresaAMSP.peer', 'EmpresaBMSP.peer', 'EmpresaCMSP.peer', 'EmpresaDMSP.peer', 'AdministracionMSP.peer')"
  else
    POLICY="OR('EmpresaAMSP.peer','AdministracionMSP.peer')"
  fi
fi

COLLECTIONS_ARGS=()
if [[ "${CC_NAME}" == "incidencia" ]]; then
  COLLECTIONS_ARGS=(--collections-config /workspace/collections-config.json)
fi

CLI=""
if docker ps --format '{{.Names}}' | grep -qx 'ute-cli-dev'; then
  CLI=ute-cli-dev
elif docker ps --format '{{.Names}}' | grep -qx 'ute-cli-full'; then
  CLI=ute-cli-full
else
  echo "no hay CLI Fabric (make up-dev)"
  exit 1
fi

echo "compilando ${CC_NAME} (Node 18)"
# shellcheck disable=SC1090
source "${HOME}/.nvm/nvm.sh"
nvm use 18 >/dev/null
(
  cd "${CC_SRC}"
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
  npm run build
)

STAGE="${CC_SRC}/.package"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"
cp "${CC_SRC}/package.json" "${STAGE}/"
cp -r "${CC_SRC}/dist" "${STAGE}/"

ORDERER_CA="/organizations/ordererOrganizations/ute.local/orderers/orderer1.ute.local/tls/ca.crt"
ORDERER="orderer1.ute.local:7050"
PKG="/tmp/${CC_NAME}.tar.gz"

echo "empaquetando ${CC_NAME} → ${PKG}"
docker exec "${CLI}" peer lifecycle chaincode package "${PKG}" \
  --path "/chaincode/${CC_NAME}/.package" --lang node --label "${CC_NAME}_${CC_VERSION}"

peer_exec() {
  local msp="$1" addr="$2" domain="$3"
  shift 3
  docker exec \
    -e CORE_PEER_LOCALMSPID="${msp}" \
    -e CORE_PEER_ADDRESS="${addr}" \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE="/organizations/peerOrganizations/${domain}/peers/peer0.${domain}/tls/ca.crt" \
    -e CORE_PEER_MSPCONFIGPATH="/organizations/peerOrganizations/${domain}/users/Admin@${domain}/msp" \
    "${CLI}" "$@"
}

install_cc() {
  local msp="$1" addr="$2" domain="$3"
  echo "install ${CC_NAME} en ${addr}"
  peer_exec "${msp}" "${addr}" "${domain}" peer lifecycle chaincode install "${PKG}" || true
}

query_pkg() {
  peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
    peer lifecycle chaincode queryinstalled
}

install_cc EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local
install_cc AdministracionMSP peer0.administracion.ute.local:9051 administracion.ute.local
if docker ps --format '{{.Names}}' | grep -qx 'peer0.empresab.ute.local'; then
  install_cc EmpresaBMSP peer0.empresab.ute.local:8051 empresab.ute.local
fi
if docker ps --format '{{.Names}}' | grep -qx 'peer0.empresac.ute.local'; then
  install_cc EmpresaCMSP peer0.empresac.ute.local:11051 empresac.ute.local
fi
if docker ps --format '{{.Names}}' | grep -qx 'peer0.empresad.ute.local'; then
  install_cc EmpresaDMSP peer0.empresad.ute.local:12051 empresad.ute.local
fi

INSTALLED="$(query_pkg)"
echo "${INSTALLED}"
PACKAGE_ID="$(echo "${INSTALLED}" | sed -n "s/^Package ID: \\(${CC_NAME}_${CC_VERSION}:[^ ,]*\\).*/\\1/p" | tail -1)"
if [[ -z "${PACKAGE_ID}" ]]; then
  echo "no se obtuvo package_id"
  exit 1
fi
echo "PACKAGE_ID=${PACKAGE_ID}"

approve() {
  local msp="$1" addr="$2" domain="$3"
  echo "approve ${msp}"
  peer_exec "${msp}" "${addr}" "${domain}" \
    peer lifecycle chaincode approveformyorg \
      -o "${ORDERER}" --ordererTLSHostnameOverride orderer1.ute.local \
      --channelID "${CHANNEL}" --name "${CC_NAME}" --version "${CC_VERSION}" \
      --package-id "${PACKAGE_ID}" --sequence "${CC_SEQUENCE}" \
      --signature-policy "${POLICY}" \
      ${COLLECTIONS_ARGS[@]+"${COLLECTIONS_ARGS[@]}"} \
      --tls --cafile "${ORDERER_CA}" --waitForEvent
}

approve EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local
approve AdministracionMSP peer0.administracion.ute.local:9051 administracion.ute.local

echo "commit ${CC_NAME} policy=${POLICY}"
peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
  peer lifecycle chaincode commit \
    -o "${ORDERER}" --ordererTLSHostnameOverride orderer1.ute.local \
    --channelID "${CHANNEL}" --name "${CC_NAME}" --version "${CC_VERSION}" \
    --sequence "${CC_SEQUENCE}" \
    --signature-policy "${POLICY}" \
    ${COLLECTIONS_ARGS[@]+"${COLLECTIONS_ARGS[@]}"} \
    --tls --cafile "${ORDERER_CA}" \
    --peerAddresses peer0.empresaa.ute.local:7051 \
    --tlsRootCertFiles /organizations/peerOrganizations/empresaa.ute.local/peers/peer0.empresaa.ute.local/tls/ca.crt \
    --peerAddresses peer0.administracion.ute.local:9051 \
    --tlsRootCertFiles /organizations/peerOrganizations/administracion.ute.local/peers/peer0.administracion.ute.local/tls/ca.crt \
    --waitForEvent

peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
  peer lifecycle chaincode querycommitted -C "${CHANNEL}" --name "${CC_NAME}"

echo "OK ${CC_NAME} committed (instalado A+Admin, sequence ${CC_SEQUENCE})"
