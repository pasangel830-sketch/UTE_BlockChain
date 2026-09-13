#!/usr/bin/env bash
# Empaqueta, instala (A + Admin; B/C/D solo con INSTALL_PDC_PEERS=1), aprueba y hace commit.
# Uso: deploy-chaincode.sh hito|pago|incidencia|estado-obra [signature-policy]
# Hosts: ute.local o ute.prod según CLI (fabric-env.sh). Override: FABRIC_MODE, ORDERER, MSP.
set -euo pipefail

CC_NAME="${1:?uso: $0 hito|pago|incidencia|estado-obra [policy]}"
CC_VERSION="${CC_VERSION:-1.0}"
CC_SEQUENCE="${CC_SEQUENCE:-1}"
CHANNEL="${CHANNEL:-channel-obra}"
POLICY="${2:-}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/network/scripts/fabric-env.sh"
fabric_env

CC_SRC="${ROOT}/chaincode/${CC_NAME}"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"

if [[ ! -d "${CC_SRC}/src" ]]; then
  echo "no existe ${CC_SRC}"
  exit 1
fi

if [[ -z "${POLICY}" ]]; then
  if [[ "${CC_NAME}" == "pago" ]]; then
    POLICY="OR(AND('EmpresaAMSP.peer','AdministracionMSP.peer'),AND('EmpresaBMSP.peer','AdministracionMSP.peer'),AND('EmpresaCMSP.peer','AdministracionMSP.peer'),AND('EmpresaDMSP.peer','AdministracionMSP.peer'))"
  elif [[ "${CC_NAME}" == "hito" ]]; then
    POLICY="OR('EmpresaAMSP.peer','EmpresaBMSP.peer','EmpresaCMSP.peer','EmpresaDMSP.peer')"
  elif [[ "${CC_NAME}" == "estado-obra" ]]; then
    POLICY="OR('EmpresaAMSP.peer','EmpresaBMSP.peer','EmpresaCMSP.peer','EmpresaDMSP.peer','AdministracionMSP.peer')"
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

echo "compilando ${CC_NAME} (Node 18)"
if [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
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
else
  docker run --rm -v "${CC_SRC}:/cc" -w /cc node:18.20.8-bookworm bash -c \
    'if [ -f package-lock.json ]; then npm ci; else npm install; fi && npm run build'
fi

STAGE="${CC_SRC}/.package"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"
cp "${CC_SRC}/package.json" "${STAGE}/"
cp -r "${CC_SRC}/dist" "${STAGE}/"

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
  peer_exec EmpresaAMSP "${PEER_A}" "${DOM_A}" \
    peer lifecycle chaincode queryinstalled
}

install_cc EmpresaAMSP "${PEER_A}" "${DOM_A}"
install_cc AdministracionMSP "${PEER_ADMIN}" "${DOM_ADMIN}"
if [[ "${INSTALL_PDC_PEERS:-0}" == "1" ]]; then
  if fabric_peer_up "peer0.empresab.${DOMAIN}"; then
    install_cc EmpresaBMSP "${PEER_B}" "${DOM_B}"
  fi
  if fabric_peer_up "peer0.empresac.${DOMAIN}"; then
    install_cc EmpresaCMSP "${PEER_C}" "${DOM_C}"
  fi
  if fabric_peer_up "peer0.empresad.${DOMAIN}"; then
    install_cc EmpresaDMSP "${PEER_D}" "${DOM_D}"
  fi
fi

INSTALLED="$(query_pkg)"
echo "${INSTALLED}"
PACKAGE_ID="$(docker exec "${CLI}" peer lifecycle chaincode calculatepackageid "${PKG}")"
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
      -o "${ORDERER}" --ordererTLSHostnameOverride "${ORDERER_OVERRIDE}" \
      --channelID "${CHANNEL}" --name "${CC_NAME}" --version "${CC_VERSION}" \
      --package-id "${PACKAGE_ID}" --sequence "${CC_SEQUENCE}" \
      --signature-policy "${POLICY}" \
      ${COLLECTIONS_ARGS[@]+"${COLLECTIONS_ARGS[@]}"} \
      --tls --cafile "${ORDERER_CA}" --waitForEvent
}

approve EmpresaAMSP "${PEER_A}" "${DOM_A}"
approve AdministracionMSP "${PEER_ADMIN}" "${DOM_ADMIN}"
if [[ "${INSTALL_PDC_PEERS:-0}" == "1" ]]; then
  if fabric_peer_up "peer0.empresab.${DOMAIN}"; then
    approve EmpresaBMSP "${PEER_B}" "${DOM_B}"
  fi
  if fabric_peer_up "peer0.empresac.${DOMAIN}"; then
    approve EmpresaCMSP "${PEER_C}" "${DOM_C}"
  fi
  if fabric_peer_up "peer0.empresad.${DOMAIN}"; then
    approve EmpresaDMSP "${PEER_D}" "${DOM_D}"
  fi
fi

echo "commit ${CC_NAME} policy=${POLICY}"
peer_exec EmpresaAMSP "${PEER_A}" "${DOM_A}" \
  peer lifecycle chaincode commit \
    -o "${ORDERER}" --ordererTLSHostnameOverride "${ORDERER_OVERRIDE}" \
    --channelID "${CHANNEL}" --name "${CC_NAME}" --version "${CC_VERSION}" \
    --sequence "${CC_SEQUENCE}" \
    --signature-policy "${POLICY}" \
    ${COLLECTIONS_ARGS[@]+"${COLLECTIONS_ARGS[@]}"} \
    --tls --cafile "${ORDERER_CA}" \
    --peerAddresses "${PEER_A}" \
    --tlsRootCertFiles "/organizations/peerOrganizations/${DOM_A}/peers/peer0.${DOM_A}/tls/ca.crt" \
    --peerAddresses "${PEER_ADMIN}" \
    --tlsRootCertFiles "/organizations/peerOrganizations/${DOM_ADMIN}/peers/peer0.${DOM_ADMIN}/tls/ca.crt" \
    --waitForEvent

peer_exec EmpresaAMSP "${PEER_A}" "${DOM_A}" \
  peer lifecycle chaincode querycommitted -C "${CHANNEL}" --name "${CC_NAME}"

if [[ "${INSTALL_PDC_PEERS:-0}" == "1" ]]; then
  echo "OK ${CC_NAME} committed (instalado A+Admin+B/C/D vivos, sequence ${CC_SEQUENCE}, ${DOMAIN})"
else
  echo "OK ${CC_NAME} committed (instalado A+Admin; B/C/D: INSTALL_PDC_PEERS=1, sequence ${CC_SEQUENCE}, ${DOMAIN})"
fi
