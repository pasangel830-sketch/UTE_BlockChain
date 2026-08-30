#!/usr/bin/env bash
# Une peers B/C/D (compose pdc) al canal channel-obra ya existente.
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

for spec in \
  "EmpresaBMSP peer0.empresab.ute.local:8051 empresab.ute.local" \
  "EmpresaCMSP peer0.empresac.ute.local:11051 empresac.ute.local" \
  "EmpresaDMSP peer0.empresad.ute.local:12051 empresad.ute.local"
do
  # shellcheck disable=SC2086
  set -- ${spec}
  ok=0
  for i in $(seq 1 20); do
    if join_peer "$1" "$2" "$3"; then
      ok=1
      break
    fi
    echo "reintento join $2 (${i}/20)"
    sleep 3
  done
  if [[ "${ok}" -ne 1 ]]; then
    echo "falló join $2"
    exit 1
  fi
done
echo "OK peers B/C/D en ${CHANNEL}"

if docker exec "${CLI}" test -d /chaincode/incidencia/.package; then
  echo "install incidencia en B/C/D"
  docker exec "${CLI}" peer lifecycle chaincode package /tmp/incidencia.tar.gz \
    --path /chaincode/incidencia/.package --lang node --label incidencia_1.0 || true
  for spec in \
    "EmpresaBMSP peer0.empresab.ute.local:8051 empresab.ute.local" \
    "EmpresaCMSP peer0.empresac.ute.local:11051 empresac.ute.local" \
    "EmpresaDMSP peer0.empresad.ute.local:12051 empresad.ute.local"
  do
    # shellcheck disable=SC2086
    set -- ${spec}
    docker exec \
      -e CORE_PEER_LOCALMSPID="$1" \
      -e CORE_PEER_ADDRESS="$2" \
      -e CORE_PEER_TLS_ENABLED=true \
      -e CORE_PEER_TLS_ROOTCERT_FILE="/organizations/peerOrganizations/$3/peers/peer0.$3/tls/ca.crt" \
      -e CORE_PEER_MSPCONFIGPATH="/organizations/peerOrganizations/$3/users/Admin@$3/msp" \
      "${CLI}" peer lifecycle chaincode install /tmp/incidencia.tar.gz || true
  done
  PACKAGE_ID="$(docker exec \
    -e CORE_PEER_LOCALMSPID=EmpresaBMSP \
    -e CORE_PEER_ADDRESS=peer0.empresab.ute.local:8051 \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/organizations/peerOrganizations/empresab.ute.local/peers/peer0.empresab.ute.local/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/organizations/peerOrganizations/empresab.ute.local/users/Admin@empresab.ute.local/msp \
    "${CLI}" peer lifecycle chaincode queryinstalled | sed -n 's/^Package ID: \(incidencia_1.0:[^ ,]*\).*/\1/p' | tail -1)"
  echo "approve B/C/D PACKAGE_ID=${PACKAGE_ID}"
  POLICY="OutOf(2, 'EmpresaAMSP.peer', 'EmpresaBMSP.peer', 'EmpresaCMSP.peer', 'EmpresaDMSP.peer', 'AdministracionMSP.peer')"
  for spec in \
    "EmpresaBMSP peer0.empresab.ute.local:8051 empresab.ute.local" \
    "EmpresaCMSP peer0.empresac.ute.local:11051 empresac.ute.local" \
    "EmpresaDMSP peer0.empresad.ute.local:12051 empresad.ute.local"
  do
    # shellcheck disable=SC2086
    set -- ${spec}
    echo "approve $1"
    docker exec \
      -e CORE_PEER_LOCALMSPID="$1" \
      -e CORE_PEER_ADDRESS="$2" \
      -e CORE_PEER_TLS_ENABLED=true \
      -e CORE_PEER_TLS_ROOTCERT_FILE="/organizations/peerOrganizations/$3/peers/peer0.$3/tls/ca.crt" \
      -e CORE_PEER_MSPCONFIGPATH="/organizations/peerOrganizations/$3/users/Admin@$3/msp" \
      "${CLI}" peer lifecycle chaincode approveformyorg \
        -o orderer1.ute.local:7050 --ordererTLSHostnameOverride orderer1.ute.local \
        --channelID "${CHANNEL}" --name incidencia --version 1.0 \
        --package-id "${PACKAGE_ID}" --sequence 1 \
        --signature-policy "${POLICY}" \
        --collections-config /workspace/collections-config.json \
        --tls --cafile /organizations/ordererOrganizations/ute.local/orderers/orderer1.ute.local/tls/ca.crt \
        --waitForEvent || true
  done
fi
