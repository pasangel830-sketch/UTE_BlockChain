#!/usr/bin/env bash
# Crea channel-obra (perfil UteFull, 5 orgs) y une orderers + peers del modo indicado.
# Uso: create-channel.sh dev|full|prod
#   dev  — 3 orderers + EmpresaA + Administración (mismo génesis que full)
#   full — 3 orderers + 5 peers (ute.local)
#   prod — 3 orderers + 5 peers (ute.prod, organizations-prod)
# En la VM se pueden fijar ORDERER / MSP vía fabric-env.sh (variables ya exportadas no se pisan).
set -euo pipefail

MODE="${1:-dev}"
if [[ "${MODE}" != "dev" && "${MODE}" != "full" && "${MODE}" != "prod" ]]; then
  echo "uso: $0 dev|full|prod"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NET="${ROOT}/network"
CHANNEL="${CHANNEL:-channel-obra}"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"
if [[ "${MODE}" == "prod" ]]; then
  DOMAIN=ute.prod
  ORG="${NET}/organizations-prod"
  CLI="ute-cli-prod"
  CRYPTO_HINT="./network/scripts/generate-crypto-prod.sh"
  mkdir -p "${NET}/.prod-cfg"
  cp "${NET}/configtx.production.yaml" "${NET}/.prod-cfg/configtx.yaml"
  ln -sfn ../organizations-prod "${NET}/.prod-cfg/organizations-prod"
  export FABRIC_CFG_PATH="${NET}/.prod-cfg"
else
  DOMAIN=ute.local
  ORG="${NET}/organizations"
  CLI="ute-cli-${MODE}"
  CRYPTO_HINT="./network/scripts/generate-crypto.sh"
  export FABRIC_CFG_PATH="${NET}"
fi

ART="${NET}/channel-artifacts"
if [[ "${MODE}" == "prod" ]]; then
  BLOCK="${ART}/${CHANNEL}.prod.block"
  BLOCK_IN_CLI="/workspace/channel-artifacts/${CHANNEL}.prod.block"
else
  BLOCK="${ART}/${CHANNEL}.block"
  BLOCK_IN_CLI="/workspace/channel-artifacts/${CHANNEL}.block"
fi

if [[ ! -d "${ORG}/peerOrganizations/empresaa.${DOMAIN}" ]]; then
  echo "falta crypto: ${CRYPTO_HINT}"
  exit 1
fi

mkdir -p "${ART}"

if [[ "${MODE}" == "prod" ]]; then
  for h in orderer1.ute.prod orderer2.ute.prod orderer3.ute.prod; do
    if ! grep -qE "[[:space:]]${h}([[:space:]]|$)" /etc/hosts 2>/dev/null; then
      echo "127.0.0.1 ${h}" | sudo tee -a /etc/hosts >/dev/null
    fi
  done
fi

osn_endpoint() {
  local host="$1" port="$2"
  if [[ "${MODE}" == "prod" ]]; then
    printf '%s:%s' "${host}" "${port}"
  else
    printf 'localhost:%s' "${port}"
  fi
}

if [[ ! -f "${BLOCK}" ]]; then
  configtxgen -profile UteFull -channelID "${CHANNEL}" -outputBlock "${BLOCK}"
fi

wait_osnadmin() {
  local host="$1" port="$2"
  local tls="${ORG}/ordererOrganizations/${DOMAIN}/orderers/${host}/tls"
  echo "esperando ${host} admin :${port}"
  for _ in $(seq 1 45); do
    if osnadmin channel list -o "$(osn_endpoint "${host}" "${port}")" \
      --ca-file "${tls}/ca.crt" \
      --client-cert "${tls}/server.crt" \
      --client-key "${tls}/server.key" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "timeout esperando ${host} :${port}"
  return 1
}

join_orderer() {
  local host="$1" port="$2"
  local tls="${ORG}/ordererOrganizations/${DOMAIN}/orderers/${host}/tls"
  local tmp
  tmp="$(mktemp)"
  osnadmin channel list -o "$(osn_endpoint "${host}" "${port}")" \
    --ca-file "${tls}/ca.crt" --client-cert "${tls}/server.crt" --client-key "${tls}/server.key" \
    >"${tmp}" 2>&1 || true
  if grep -q "${CHANNEL}" "${tmp}"; then
    echo "${host} ya tiene ${CHANNEL}"
    rm -f "${tmp}"
    return 0
  fi
  rm -f "${tmp}"
  osnadmin channel join --channelID "${CHANNEL}" --config-block "${BLOCK}" \
    -o "$(osn_endpoint "${host}" "${port}")" \
    --ca-file "${tls}/ca.crt" --client-cert "${tls}/server.crt" --client-key "${tls}/server.key"
}

wait_cli() {
  echo "esperando ${CLI}"
  for _ in $(seq 1 30); do
    if docker exec "${CLI}" true >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  echo "timeout esperando ${CLI}"
  return 1
}

join_peer() {
  local msp="$1" addr="$2" domain="$3"
  local out rc=0
  out="$(docker exec \
    -e CORE_PEER_LOCALMSPID="${msp}" \
    -e CORE_PEER_ADDRESS="${addr}" \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE="/organizations/peerOrganizations/${domain}/peers/peer0.${domain}/tls/ca.crt" \
    -e CORE_PEER_MSPCONFIGPATH="/organizations/peerOrganizations/${domain}/users/Admin@${domain}/msp" \
    "${CLI}" peer channel join -b "${BLOCK_IN_CLI}" 2>&1)" || rc=$?
  if echo "${out}" | grep -qiE "Successfully submitted|already joined|already exists with state"; then
    echo "join OK ${addr}"
    return 0
  fi
  echo "${out}"
  return "${rc}"
}

join_peer_retry() {
  local msp="$1" addr="$2" domain="$3"
  local i
  for i in $(seq 1 20); do
    if join_peer "${msp}" "${addr}" "${domain}"; then
      return 0
    fi
    echo "reintento join ${addr} (${i}/20)"
    sleep 3
  done
  echo "falló join ${addr}"
  return 1
}

verify_peer() {
  local msp="$1" addr="$2" domain="$3"
  docker exec \
    -e CORE_PEER_LOCALMSPID="${msp}" \
    -e CORE_PEER_ADDRESS="${addr}" \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE="/organizations/peerOrganizations/${domain}/peers/peer0.${domain}/tls/ca.crt" \
    -e CORE_PEER_MSPCONFIGPATH="/organizations/peerOrganizations/${domain}/users/Admin@${domain}/msp" \
    "${CLI}" peer channel list 2>/dev/null | grep -q "${CHANNEL}"
}

wait_osnadmin "orderer1.${DOMAIN}" 7053
wait_osnadmin "orderer2.${DOMAIN}" 8053
wait_osnadmin "orderer3.${DOMAIN}" 9053

join_orderer "orderer1.${DOMAIN}" 7053
join_orderer "orderer2.${DOMAIN}" 8053
join_orderer "orderer3.${DOMAIN}" 9053

wait_cli

PEERS=(
  "EmpresaAMSP peer0.empresaa.${DOMAIN}:7051 empresaa.${DOMAIN}"
  "AdministracionMSP peer0.administracion.${DOMAIN}:9051 administracion.${DOMAIN}"
)
if [[ "${MODE}" == "full" || "${MODE}" == "prod" ]]; then
  PEERS+=(
    "EmpresaBMSP peer0.empresab.${DOMAIN}:8051 empresab.${DOMAIN}"
    "EmpresaCMSP peer0.empresac.${DOMAIN}:11051 empresac.${DOMAIN}"
    "EmpresaDMSP peer0.empresad.${DOMAIN}:12051 empresad.${DOMAIN}"
  )
fi

for spec in "${PEERS[@]}"; do
  # shellcheck disable=SC2086
  set -- ${spec}
  join_peer_retry "$1" "$2" "$3"
done

failed=0
for spec in "${PEERS[@]}"; do
  # shellcheck disable=SC2086
  set -- ${spec}
  if verify_peer "$1" "$2" "$3"; then
    echo "canal OK $2"
  else
    echo "falta canal en $2"
    failed=1
  fi
done

if [[ "${failed}" -ne 0 ]]; then
  echo "channel-obra no está en los peers de modo ${MODE}"
  exit 1
fi

echo "canal ${CHANNEL} listo (${MODE}): perfil UteFull, ${#PEERS[@]} peers + 3 orderers (${DOMAIN})"
