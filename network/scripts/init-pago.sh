#!/usr/bin/env bash
# InitLedger de PagoContract (participaciones 35/25/20/20).
set -euo pipefail

CHANNEL="${CHANNEL:-channel-obra}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
source "${ROOT}/network/scripts/fabric-env.sh"
fabric_env

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

invoke_both() {
  local args="$1"
  peer_exec EmpresaAMSP "${PEER_A}" "${DOM_A}" \
    peer chaincode invoke \
      -o "${ORDERER}" --ordererTLSHostnameOverride "${ORDERER_OVERRIDE}" \
      -C "${CHANNEL}" -n pago \
      --tls --cafile "${ORDERER_CA}" \
      --peerAddresses "${PEER_A}" \
      --tlsRootCertFiles "/organizations/peerOrganizations/${DOM_A}/peers/peer0.${DOM_A}/tls/ca.crt" \
      --peerAddresses "${PEER_ADMIN}" \
      --tlsRootCertFiles "/organizations/peerOrganizations/${DOM_ADMIN}/peers/peer0.${DOM_ADMIN}/tls/ca.crt" \
      -c "${args}" \
      --waitForEvent
}

echo "InitLedger pago (primer invoke: nodeenv puede tardar hasta 5 min)"
ok=0
for i in $(seq 1 20); do
  if invoke_both '{"function":"InitLedger","Args":[]}'; then
    ok=1
    break
  fi
  echo "reintento InitLedger (${i}/20)"
  sleep 15
done
if [[ "${ok}" -ne 1 ]]; then
  echo "InitLedger falló"
  exit 1
fi

peer_exec EmpresaAMSP "${PEER_A}" "${DOM_A}" \
  peer chaincode query -C "${CHANNEL}" -n pago -c '{"function":"getParticipaciones","Args":[]}'

echo "OK InitLedger pago"
