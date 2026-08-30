#!/usr/bin/env bash
# E2E API: hito→pago, explorer, incidencia, estado. UI Next en :3000 si está arriba.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000}"
UI="${UI:-http://127.0.0.1:3000}"
ID="H-d7-$(date +%s)"

echo "esperando ${BASE}/health"
for _ in $(seq 1 30); do
  if curl -sf "${BASE}/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf "${BASE}/health"
echo

TOKEN="$(curl -sf -X POST "${BASE}/auth/login" -H 'content-type: application/json' \
  -d '{"username":"empresaA","password":"empresaA"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
auth() { curl -sf -H "authorization: Bearer ${TOKEN}" -H 'content-type: application/json' "$@"; }

curl -sf -X POST "${BASE}/hitos" -H "authorization: Bearer ${TOKEN}" -H 'content-type: application/json' \
  -d "{\"id\":\"${ID}\",\"titulo\":\"Cimentacion UI\",\"descripcion\":\"d7\",\"empresa\":\"EmpresaA\",\"importe\":10000}"
echo
auth -X POST "${BASE}/hitos/${ID}/iniciar"
echo
auth -X POST "${BASE}/hitos/${ID}/validar"
echo
auth -X POST "${BASE}/hitos/${ID}/completar"
echo
auth "${BASE}/pagos/pago-${ID}"
echo
auth "${BASE}/explorer"
echo
auth -X POST "${BASE}/estado/recalcular"
echo

if curl -sf "${UI}" >/dev/null; then
  echo "UI ${UI} OK"
else
  echo "UI ${UI} no responde (arrancar make ui-up)"
fi
echo "OK E2E ${ID}"
