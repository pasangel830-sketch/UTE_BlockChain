#!/usr/bin/env bash
# PDC: collections committed, A lee obra-gruesa, Admin no; B (si está) escribe quirofanos-tech.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000}"
CHANNEL="${CHANNEL:-channel-obra}"
ID="I-pdc-$(date +%s)"

CLI=""
if docker ps --format '{{.Names}}' | grep -qx 'ute-cli-dev'; then
  CLI=ute-cli-dev
elif docker ps --format '{{.Names}}' | grep -qx 'ute-cli-full'; then
  CLI=ute-cli-full
else
  echo "no hay CLI Fabric"
  exit 1
fi

echo "=== collections committed ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=EmpresaAMSP \
  -e CORE_PEER_ADDRESS=peer0.empresaa.ute.local:7051 \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/organizations/peerOrganizations/empresaa.ute.local/peers/peer0.empresaa.ute.local/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/organizations/peerOrganizations/empresaa.ute.local/users/Admin@empresaa.ute.local/msp \
  "${CLI}" peer lifecycle chaincode querycommitted -C "${CHANNEL}" --name incidencia

TOKEN_A="$(curl -sf -X POST "${BASE}/auth/login" -H 'content-type: application/json' \
  -d '{"username":"empresaA","password":"empresaA"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
TOKEN_ADM="$(curl -sf -X POST "${BASE}/auth/login" -H 'content-type: application/json' \
  -d '{"username":"administracion","password":"administracion"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

echo "=== crear incidencia PDC obra-gruesa-solar ==="
curl -sf -X POST "${BASE}/incidencias" -H "authorization: Bearer ${TOKEN_A}" -H 'content-type: application/json' \
  -d "{\"id\":\"${ID}\",\"titulo\":\"Fisura PDC\",\"empresa\":\"EmpresaA\",\"lote\":\"obra-gruesa-solar\",\"detalle\":\"precio confidencial\",\"costeEstimado\":1200,\"notasTecnicas\":\"A/C\"}"
echo

echo "=== A lee privado ==="
curl -sf "${BASE}/incidencias/${ID}/privado" -H "authorization: Bearer ${TOKEN_A}"
echo

echo "=== Admin NO lee privado ==="
code="$(curl -s -o /tmp/pdc-admin.json -w '%{http_code}' "${BASE}/incidencias/${ID}/privado" -H "authorization: Bearer ${TOKEN_ADM}")"
echo "HTTP ${code}"
cat /tmp/pdc-admin.json
echo
if [[ "${code}" == "200" ]]; then
  echo "Admin no debería leer PDC"
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx 'peer0.empresab.ute.local'; then
  echo "=== peer B up: invoke quirofanos-tech ==="
  DETAIL_B64="$(printf '%s' '{"detalle":"tech pack","costeEstimado":900,"notasTecnicas":"B/D"}' | base64 -w0)"
  BID="I-q-$(date +%s)"
  docker exec \
    -e CORE_PEER_LOCALMSPID=EmpresaBMSP \
    -e CORE_PEER_ADDRESS=peer0.empresab.ute.local:8051 \
    -e CORE_PEER_TLS_ENABLED=true \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/organizations/peerOrganizations/empresab.ute.local/peers/peer0.empresab.ute.local/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/organizations/peerOrganizations/empresab.ute.local/users/Admin@empresab.ute.local/msp \
    "${CLI}" peer chaincode invoke \
      -o orderer1.ute.local:7050 --ordererTLSHostnameOverride orderer1.ute.local \
      -C "${CHANNEL}" -n incidencia \
      --tls --cafile /organizations/ordererOrganizations/ute.local/orderers/orderer1.ute.local/tls/ca.crt \
      --peerAddresses peer0.empresab.ute.local:8051 \
      --tlsRootCertFiles /organizations/peerOrganizations/empresab.ute.local/peers/peer0.empresab.ute.local/tls/ca.crt \
      --peerAddresses peer0.administracion.ute.local:9051 \
      --tlsRootCertFiles /organizations/peerOrganizations/administracion.ute.local/peers/peer0.administracion.ute.local/tls/ca.crt \
      --transient "{\"detalle\":\"${DETAIL_B64}\"}" \
      -c "{\"function\":\"crearIncidencia\",\"Args\":[\"${BID}\",\"Pack quirófano\",\"EmpresaB\",\"quirofanos-tech\"]}" \
      --waitForEvent
  echo "OK quirofanos-tech ${BID}"
else
  echo "peer B no está; quirofanos-tech se prueba con make pdc-up"
fi

echo "OK PDC ${ID}"
