#!/usr/bin/env bash
# Ensayo de las 3 alertas. PeerCaido = docker stop real en fabric-ute.
# Latencia e endorsement: profile alert-demo en monitoring-ute (rate() necesita contadores vivos).
set -euo pipefail

PROM="${PROM_URL:-http://127.0.0.1:9090}"
PEER="${PEER_CONTAINER:-peer0.empresaa.ute.prod}"

query() {
  curl -sf --get "${PROM}/api/v1/query" --data-urlencode "query=$1"
}

echo "== targets =="
curl -sf "${PROM}/api/v1/targets" | python3 -c 'import json,sys
d=json.load(sys.stdin)
for t in d["data"]["activeTargets"]:
    print(t.get("health"), t.get("labels",{}).get("job"), t.get("scrapeUrl"))'

echo "== PeerCaido: stop ${PEER} =="
if command -v docker >/dev/null 2>&1 && docker inspect "${PEER}" >/dev/null 2>&1; then
  docker stop "${PEER}"
  echo "esperando 75s (for: 1m)"
  sleep 75
else
  echo "este host no tiene ${PEER}; dispara el stop en fabric-ute y espera 75s"
  sleep "${PEER_WAIT:-75}"
fi

echo "== ALERTS tras PeerCaido =="
query 'ALERTS' | python3 -m json.tool | head -80

if command -v docker >/dev/null 2>&1 && docker inspect "${PEER}" >/dev/null 2>&1; then
  docker start "${PEER}"
  echo "peer arrancado de nuevo"
fi

echo "== esperar LatenciaBloqueAlta (for: 2m) y ErrorEndorsementAlto (for: 5m) =="
echo "requiere COMPOSE_PROFILES=alert-demo en monitoring-ute"
deadline=$((SECONDS + 360))
while (( SECONDS < deadline )); do
  firing="$(query 'ALERTS{alertstate="firing"}' | python3 -c 'import json,sys
d=json.load(sys.stdin)
print(",".join(sorted({r["metric"].get("alertname","?") for r in d["data"]["result"]})))')"
  echo "$(date -u +%H:%M:%S) firing=${firing:-ninguna}"
  if [[ "${firing}" == *"LatenciaBloqueAlta"* && "${firing}" == *"ErrorEndorsementAlto"* ]]; then
    break
  fi
  sleep 20
done

echo "== ALERTS final =="
query 'ALERTS' | python3 -c 'import json,sys
d=json.load(sys.stdin)
for r in d["data"]["result"]:
    m=r["metric"]
    print(m.get("alertname"), m.get("alertstate"), m.get("instance",""), m.get("severity",""))'
