#!/usr/bin/env bash
# Crea channel-obra (perfil UteFull, 5 orgs) y une orderers + peers del modo indicado.
# Uso: create-channel.sh dev|full
#   dev  — 3 orderers + EmpresaA + Administración (mismo génesis que full)
#   full — 3 orderers + 5 peers
set -euo pipefail

MODE="${1:-dev}"
if [[ "${MODE}" != "dev" && "${MODE}" != "full" ]]; then
  echo "uso: $0 dev|full"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NET="${ROOT}/network"
ORG="${NET}/organizations"
ART="${NET}/channel-artifacts"
CHANNEL="${CHANNEL:-channel-obra}"
CLI="ute-cli-${MODE}"
BLOCK="${ART}/${CHANNEL}.block"
export PATH="${HOME}/bin:${HOME}/hyperledger/fabric-2.5.16/bin:${PATH}"
export FABRIC_CFG_PATH="${NET}"

if [[ ! -d "${ORG}/peerOrganizations/empresaa.ute.local" ]]; then
  echo "falta crypto: ./network/scripts/generate-crypto.sh"
  exit 1
fi

mkdir -p "${ART}"

if [[ ! -f "${BLOCK}" ]]; then
  configtxgen -profile UteFull -channelID "${CHANNEL}" -outputBlock "${BLOCK}"
fi

wait_osnadmin() {
  local host="$1" port="$2"
  local tls="${ORG}/ordererOrganizations/ute.local/orderers/${host}/tls"
  echo "esperando ${host} admin :${port}"
  for _ in $(seq 1 45); do
    if osnadmin channel list -o "localhost:${port}" \
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
  local tls="${ORG}/ordererOrganizations/ute.local/orderers/${host}/tls"
  local tmp
  tmp="$(mktemp)"
  osnadmin channel list -o "localhost:${port}" \
    --ca-file "${tls}/ca.crt" --client-cert "${tls}/server.crt" --client-key "${tls}/server.key" \
    >"${tmp}" 2>&1 || true
  if grep -q "${CHANNEL}" "${tmp}"; then
    echo "${host} ya tiene ${CHANNEL}"
    rm -f "${tmp}"
    return 0
  fi
  rm -f "${tmp}"
  osnadmin channel join --channelID "${CHANNEL}" --config-block "${BLOCK}" \
    -o "localhost:${port}" \
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
    "${CLI}" peer channel join -b "/workspace/channel-artifacts/${CHANNEL}.block" 2>&1)" || rc=$?
  if echo "${out}" | grep -qiE "Successfully submitted|already joined"; then
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

wait_osnadmin orderer1.ute.local 7053
wait_osnadmin orderer2.ute.local 8053
wait_osnadmin orderer3.ute.local 9053

join_orderer orderer1.ute.local 7053
join_orderer orderer2.ute.local 8053
join_orderer orderer3.ute.local 9053

wait_cli

PEERS=(
  "EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local"
  "AdministracionMSP peer0.administracion.ute.local:9051 administracion.ute.local"
)
if [[ "${MODE}" == "full" ]]; then
  PEERS+=(
    "EmpresaBMSP peer0.empresab.ute.local:8051 empresab.ute.local"
    "EmpresaCMSP peer0.empresac.ute.local:11051 empresac.ute.local"
    "EmpresaDMSP peer0.empresad.ute.local:12051 empresad.ute.local"
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

echo "canal ${CHANNEL} listo (${MODE}): perfil UteFull, ${#PEERS[@]} peers + 3 orderers"
