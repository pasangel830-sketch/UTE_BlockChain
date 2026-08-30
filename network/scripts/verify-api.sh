#!/usr/bin/env bash
# Comprueba API :4000 — login, hito, escrow, autorizar, mock banco.
set -euo pipefail

BASE="${BASE:-http://127.0.0.1:4000}"
ID="H-api-$(date +%s)"

echo "esperando ${BASE}/health"
for _ in $(seq 1 30); do
  if curl -sf "${BASE}/health" >/dev/null; then
    break
  fi
  sleep 2
done
curl -sf "${BASE}/health"
echo
curl -sf "${BASE}/metrics" | head -5
echo
curl -sf "${BASE}/api-docs/" >/dev/null
echo "swagger OK"

TOKEN="$(curl -sf -X POST "${BASE}/auth/login" -H 'content-type: application/json' \
  -d '{"username":"empresaA","password":"empresaA"}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"

auth() {
  curl -sf -H "authorization: Bearer ${TOKEN}" -H 'content-type: application/json' "$@"
}

curl -sf -X POST "${BASE}/hitos" -H "authorization: Bearer ${TOKEN}" -H 'content-type: application/json' \
  -d "{\"id\":\"${ID}\",\"titulo\":\"Cimentacion\",\"descripcion\":\"lote A\",\"empresa\":\"EmpresaA\",\"importe\":10000}"
echo
auth -X POST "${BASE}/hitos/${ID}/iniciar"
echo
auth -X POST "${BASE}/hitos/${ID}/validar"
echo
auth -X POST "${BASE}/hitos/${ID}/completar"
echo
auth -X POST "${BASE}/pagos/pago-${ID}/autorizar"
echo

echo "esperando webhook mock"
ok=0
for _ in $(seq 1 20); do
  if curl -sf "${BASE}/mock/banco/pagos" | grep -q "${ID}"; then
    ok=1
    break
  fi
  sleep 2
done
curl -sf "${BASE}/mock/banco/pagos"
echo
if [[ "${ok}" -ne 1 ]]; then
  echo "no llegó PagoAutorizado al mock"
  exit 1
fi
echo "OK API flujo ${ID}"
