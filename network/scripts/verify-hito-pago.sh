#!/usr/bin/env bash
# Recorre hito PENDIENTE→…→COMPLETADO y pago CUSTODIA→AUTORIZADO.
set -euo pipefail

CHANNEL="${CHANNEL:-channel-obra}"
ID="${1:-H-demo-$(date +%s)}"
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
TLS_A=/organizations/peerOrganizations/empresaa.ute.local/peers/peer0.empresaa.ute.local/tls/ca.crt
TLS_ADM=/organizations/peerOrganizations/administracion.ute.local/peers/peer0.administracion.ute.local/tls/ca.crt

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

hito_invoke() {
  peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
    peer chaincode invoke \
      -o "${ORDERER}" --ordererTLSHostnameOverride orderer1.ute.local \
      -C "${CHANNEL}" -n hito \
      --tls --cafile "${ORDERER_CA}" \
      --peerAddresses peer0.empresaa.ute.local:7051 \
      --tlsRootCertFiles "${TLS_A}" \
      -c "$1" \
      --waitForEvent
}

pago_invoke() {
  peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
    peer chaincode invoke \
      -o "${ORDERER}" --ordererTLSHostnameOverride orderer1.ute.local \
      -C "${CHANNEL}" -n pago \
      --tls --cafile "${ORDERER_CA}" \
      --peerAddresses peer0.empresaa.ute.local:7051 \
      --tlsRootCertFiles "${TLS_A}" \
      --peerAddresses peer0.administracion.ute.local:9051 \
      --tlsRootCertFiles "${TLS_ADM}" \
      -c "$1" \
      --waitForEvent
}

echo "flujo ${ID} (primer invoke hito: nodeenv puede tardar)"
ok=0
for i in $(seq 1 20); do
  if hito_invoke "{\"function\":\"crearHito\",\"Args\":[\"${ID}\",\"Cimentacion\",\"lote A\",\"EmpresaA\",\"10000\"]}"; then
    ok=1
    break
  fi
  echo "reintento crearHito (${i}/20)"
  sleep 15
done
if [[ "${ok}" -ne 1 ]]; then
  echo "crearHito falló"
  exit 1
fi
hito_invoke "{\"function\":\"iniciarHito\",\"Args\":[\"${ID}\"]}"
hito_invoke "{\"function\":\"enviarValidacion\",\"Args\":[\"${ID}\"]}"
hito_invoke "{\"function\":\"completarHito\",\"Args\":[\"${ID}\"]}"

peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
  peer chaincode query -C "${CHANNEL}" -n hito -c "{\"function\":\"consultarHito\",\"Args\":[\"${ID}\"]}"

pago_invoke "{\"function\":\"ponerEnCustodia\",\"Args\":[\"pago-${ID}\",\"${ID}\",\"EmpresaA\",\"10000\"]}"
pago_invoke "{\"function\":\"autorizarPago\",\"Args\":[\"pago-${ID}\"]}"

peer_exec EmpresaAMSP peer0.empresaa.ute.local:7051 empresaa.ute.local \
  peer chaincode query -C "${CHANNEL}" -n pago -c "{\"function\":\"consultarPago\",\"Args\":[\"pago-${ID}\"]}"

echo "OK flujo ${ID}"
