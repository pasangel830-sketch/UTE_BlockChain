#!/usr/bin/env bash
set -euo pipefail
echo "=== PS ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo "=== RAFT orderer1 ==="
docker logs orderer1.ute.local 2>&1 | grep -iE "raft|leader|panic" | tail -20 || true
echo "=== RAFT orderer2 ==="
docker logs orderer2.ute.local 2>&1 | grep -iE "raft|leader|panic" | tail -15 || true
echo "=== RAFT orderer3 ==="
docker logs orderer3.ute.local 2>&1 | grep -iE "raft|leader|panic" | tail -15 || true
echo "=== peer channel list ==="
docker exec \
  -e CORE_PEER_LOCALMSPID=EmpresaAMSP \
  -e CORE_PEER_ADDRESS=peer0.empresaa.ute.local:7051 \
  -e CORE_PEER_TLS_ENABLED=true \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/organizations/peerOrganizations/empresaa.ute.local/peers/peer0.empresaa.ute.local/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/organizations/peerOrganizations/empresaa.ute.local/users/Admin@empresaa.ute.local/msp \
  ute-cli-full peer channel list
echo "=== containers expected 9 (5 peer + 3 orderer + cli) ==="
n="$(docker ps -q --filter name=ute.local --filter name=ute-cli-full | wc -l)"
echo "running=$n"
test "$n" -eq 9
echo "verify-full OK"
