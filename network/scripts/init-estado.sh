#!/usr/bin/env bash
# InitLedger de EstadoObraContract.
set -euo pipefail

CHANNEL="${CHANNEL:-channel-obra}"
CLI=""
if docker ps --format '{{.Names}}' | grep -qx 'ute-cli-dev'; then
  CLI=ute-cli-dev
elif docker ps --format '{{.Names}}' | grep -qx 'ute-cli-full'; then
  CLI=ute-cli-full
else
  echo "no hay CLI Fabric"
  exit 1
fi

ORDERER_CA="/organizations/ordererOrganizations/ute.local/orderers/orderer1.ute.local/tls/ca.crt"
ORDERER="orderer1.ute.local:7050"

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

invoke() {
  peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
    peer chaincode invoke \
      -o "${ORDERER}" --ordererTLSHostnameOverride orderer1.ute.local \
      -C "${CHANNEL}" -n estado-obra \
      --tls --cafile "${ORDERER_CA}" \
      --peerAddresses peer0.empresaa.ute.local:7051 \
      --tlsRootCertFiles /organizations/peerOrganizations/empresaa.ute.local/peers/peer0.empresaa.ute.local/tls/ca.crt \
      -c '{"function":"InitLedger","Args":[]}' \
      --waitForEvent
}

echo "InitLedger estado-obra"
ok=0
for i in $(seq 1 20); do
  if invoke; then
    ok=1
    break
  fi
  echo "reintento InitLedger (${i}/20)"
  sleep 15
done
if [[ "${ok}" -ne 1 ]]; then
  echo "InitLedger estado-obra falló"
  exit 1
fi
peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
  peer chaincode query -C "${CHANNEL}" -n estado-obra -c '{"function":"consultarEstado","Args":[]}'
echo "OK InitLedger estado-obra"
