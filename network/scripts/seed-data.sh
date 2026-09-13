#!/usr/bin/env bash
# Semilla del guion MANUAL §6. Requiere API arriba (make api-up o up-prod).
# Login POST /auth/login. Hito A hasta acta+CUSTODIA, autorizar, incidencia A;
# incidencia B si peers B o D responden en GET /red.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE="${API_URL:-http://127.0.0.1:4000}"
EV_HITO="${ROOT}/ficheros_evidencias_test/tarea_completada_forjado_planta_baja.pdf"
EV_INC_A="${ROOT}/ficheros_evidencias_test/fisura-forjado.jpg"
EV_INC_B="${ROOT}/ficheros_evidencias_test/instalacion-quirofano.jpg"
HITO_ID="${SEED_HITO_ID:-H-demo-A}"
INC_A="${SEED_INC_A:-I-demo-A}"
INC_B="${SEED_INC_B:-I-demo-B}"

echo "esperando ${BASE}/health"
ok=0
for _ in $(seq 1 45); do
  if curl -sf "${BASE}/health" >/dev/null; then
    ok=1
    break
  fi
  sleep 2
done
if [[ "${ok}" -ne 1 ]]; then
  echo "API no responde en ${BASE}"
  exit 1
fi

token_for() {
  curl -sf -X POST "${BASE}/auth/login" -H 'content-type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$1\"}" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

TOKEN_A="$(token_for empresaA)"
TOKEN_ADMIN="$(token_for administracion)"

if [[ "${SEED_EMPTY:-0}" == "1" ]]; then
  echo "seed vacío: no se crean hitos, pagos ni incidencias"
  hitos="$(curl -sf -H "authorization: Bearer ${TOKEN_A}" "${BASE}/hitos")"
  pagos="$(curl -sf -H "authorization: Bearer ${TOKEN_A}" "${BASE}/pagos")"
  incs="$(curl -sf -H "authorization: Bearer ${TOKEN_A}" "${BASE}/incidencias")"
  python3 - "${hitos}" "${pagos}" "${incs}" <<'PY'
import json, sys
def n(raw):
    d = json.loads(raw)
    if isinstance(d, list):
        return len(d)
    if isinstance(d, dict):
        for k in ("items", "hitos", "pagos", "incidencias"):
            v = d.get(k)
            if isinstance(v, list):
                return len(v)
    return -1
nh, np, ni = n(sys.argv[1]), n(sys.argv[2]), n(sys.argv[3])
print(f"conteo hitos={nh} pagos={np} incidencias={ni}")
if nh != 0 or np != 0 or ni != 0:
    sys.exit(1)
PY
  echo "seed OK vacío (${BASE})"
  exit 0
fi

auth_a() {
  curl -sf -H "authorization: Bearer ${TOKEN_A}" "$@"
}

auth_admin() {
  curl -sf -H "authorization: Bearer ${TOKEN_ADMIN}" "$@"
}

code_a() {
  curl -s -o /tmp/ute-seed-body -w '%{http_code}' -H "authorization: Bearer ${TOKEN_A}" "$@"
}

echo "hito ${HITO_ID}: crear → iniciar → validar → completar (acta)"
hcode="$(code_a -X POST "${BASE}/hitos" -H 'content-type: application/json' \
  -d "{\"id\":\"${HITO_ID}\",\"titulo\":\"Cimentacion demo\",\"descripcion\":\"MANUAL §6\",\"empresa\":\"EmpresaA\",\"importe\":10000}")"
if [[ "${hcode}" == "201" ]]; then
  auth_a -X POST "${BASE}/hitos/${HITO_ID}/iniciar" >/dev/null
  auth_a -X POST "${BASE}/hitos/${HITO_ID}/validar" >/dev/null
  curl -sf -X POST "${BASE}/hitos/${HITO_ID}/completar" \
    -H "authorization: Bearer ${TOKEN_A}" \
    -F "file=@${EV_HITO}" >/dev/null
  echo "hito ${HITO_ID} COMPLETADO + pago CUSTODIA"
elif [[ "${hcode}" == "409" || "${hcode}" == "400" || "${hcode}" == "500" ]]; then
  echo "hito ${HITO_ID} ya existía o no se pudo crear (${hcode}); se continúa"
else
  echo "POST /hitos falló HTTP ${hcode}"
  cat /tmp/ute-seed-body || true
  exit 1
fi

estado="$(auth_a "${BASE}/hitos/${HITO_ID}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("estado",""))')"
if [[ "${estado}" != "COMPLETADO" ]]; then
  echo "hito ${HITO_ID} no está COMPLETADO (${estado})"
  exit 1
fi

PAGO_ID="pago-${HITO_ID}"
echo "pago ${PAGO_ID}: Autorizar como administracion"
acode="$(curl -s -o /tmp/ute-seed-body -w '%{http_code}' -X POST "${BASE}/pagos/${PAGO_ID}/autorizar" \
  -H "authorization: Bearer ${TOKEN_ADMIN}" -H 'content-type: application/json')"
if [[ "${acode}" != "200" ]]; then
  echo "autorizar ${PAGO_ID} HTTP ${acode} (si ya estaba AUTORIZADO, ok)"
  cat /tmp/ute-seed-body || true
fi

echo "incidencia ${INC_A} (obra-gruesa-solar) + evidencia"
icode="$(code_a -X POST "${BASE}/incidencias" -H 'content-type: application/json' \
  -d "{\"id\":\"${INC_A}\",\"titulo\":\"Fisura forjado demo\",\"lote\":\"obra-gruesa-solar\",\"detalle\":\"parte A\",\"costeEstimado\":1500}")"
if [[ "${icode}" == "201" ]]; then
  curl -sf -X POST "${BASE}/incidencias/${INC_A}/evidencias" \
    -H "authorization: Bearer ${TOKEN_A}" \
    -F "file=@${EV_INC_A}" >/dev/null
  echo "incidencia ${INC_A} creada"
else
  echo "incidencia ${INC_A} no creada HTTP ${icode} (posible duplicado)"
fi

RED="$(curl -sf "${BASE}/red" || echo '{}')"
B_UP="$(echo "${RED}" | python3 -c 'import json,sys; p=json.load(sys.stdin).get("peers") or {}; print("1" if p.get("EmpresaBMSP") or p.get("EmpresaDMSP") else "0")')"
if [[ "${B_UP}" == "1" ]]; then
  echo "peers B/D arriba: incidencia ${INC_B} (quirofanos-tech)"
  TOKEN_B="$(token_for empresaB)"
  bcode="$(curl -s -o /tmp/ute-seed-body -w '%{http_code}' -X POST "${BASE}/incidencias" \
    -H "authorization: Bearer ${TOKEN_B}" -H 'content-type: application/json' \
    -d "{\"id\":\"${INC_B}\",\"titulo\":\"Instalacion quirofano demo\",\"lote\":\"quirofanos-tech\",\"detalle\":\"parte B\",\"costeEstimado\":2200}")"
  if [[ "${bcode}" == "201" ]]; then
    curl -sf -X POST "${BASE}/incidencias/${INC_B}/evidencias" \
      -H "authorization: Bearer ${TOKEN_B}" \
      -F "file=@${EV_INC_B}" >/dev/null
    echo "incidencia ${INC_B} creada"
  else
    echo "incidencia ${INC_B} HTTP ${bcode}"
    cat /tmp/ute-seed-body || true
  fi
else
  echo "peers B/D apagados: se omite incidencia quirófanos (MANUAL §6 paso 6)"
fi

echo "seed OK (${BASE}): ${HITO_ID}, ${PAGO_ID}, ${INC_A}"
