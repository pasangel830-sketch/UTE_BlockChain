# Informe técnico (factual)

Pareja del informe en metáforas: [INFORME-PROGRESO.md](INFORME-PROGRESO.md).
Checklist: [CHECKLIST.md](CHECKLIST.md). Fecha: 13 sep 2026.

Este archivo solo admite comandos, versiones y salidas. Sin analogías.

## Entorno

| Item | Valor |
| --- | --- |
| OS host | Windows 11 (10.0.26200) |
| WSL | Ubuntu-22.04, systemd, `.wslconfig` 11 GB RAM + 8 GB swap |
| Docker | Engine en Ubuntu (Desktop instalado en Windows, apagado) |
| Node | 24.20.0 (`.nvmrc`) y 18.20.8 (`chaincode/.nvmrc`) |
| Fabric binaries | 2.5.16 (`peer`, `cryptogen`, `configtxgen`, `osnadmin`) |
| Imágenes | `hyperledger/fabric-{peer,orderer,tools,ccenv,baseos}:2.5.16`; `fabric-nodeenv:2.5` (no existe tag 2.5.16) |
| Repo Windows (obsoleto) | `C:\Proyectos\UTE\app` (drvfs) |
| Repo objetivo | `~/ute/app` en ext4; Cursor `\\wsl$\Ubuntu-22.04\home\<user>\ute\app` |

## Git (13 sep 2026)

`develop` en `4781f87` (`la penultima`) al alinear estos docs. El working tree del 11 sep (evidencias + `completarHito`→pago) ya está en `develop`. Esta pasada (13 sep) actualiza `docs/` para coincidir con el código; `ficheros_evidencias_test/` sigue untracked (no se sube).

```
git remote -v
  origin  https://github.com/pasangel830-sketch/UTE_BlockChain.git (fetch)
  origin  https://github.com/pasangel830-sketch/UTE_BlockChain.git (push)
```

Remoto real: `pasangel830-sketch/UTE_BlockChain` (no `ute-blockchain-tfm`). `gh` CLI no está instalado en WSL; el push usa `git` + credenciales ya configuradas. Colaborador `DomingoMr`: pendiente de invitación (API collaborators 403 con el token de Cursor).

Snapshot 11 sep 2026 (antes de commit del working tree): HEAD `fca92c3`; cambios locales en backend, chaincode hito/pago, frontend hitos/incidencias/pagos, `verify-hito-pago.sh`. Eso ya no es HEAD.

Snapshot 30 ago 2026 (antes de alinear `main`): `42374c9 Mark` / `b02db9f Unify` / `c08b7c2 Initial commit`. Eso ya no es HEAD.

Antes del primer commit (30 ago, misma mañana): `git log` vacío, `git remote -v` vacío. Eso ya no aplica.

## Día 1 (29 ago 2026)

- `docker run hello-world`: OK.
- nvm: Node 24.20.0 y 18.20.8 instalados.
- Binarios Fabric 2.5.16 en `${HOME}/hyperledger/fabric-2.5.16/bin`.
- `gcloud` CLI instalado. Sin proyecto GCP usado.
- Sin Render.

## Días 2–3 (29 ago 2026)

- `cryptogen generate` → 6 MSP (A, B, C, D, Administración, Orderer), 3 orderers. Material en `network/organizations/` (gitignored).
- `make up-dev` (entonces): orderer1 + peer EmpresaA + peer Administración. Canal `channel-obra` perfil **UteDev** (2 orgs).
- `make up-full`: 5 peers + 3 orderers + CLI (9 contenedores). Canal perfil **UteFull** unido en 5 peers.
- Raft: 3 votantes; líder `orderer2`, term 2 (logs orderer).
- `make down-full` y `up-dev` restaurado.

## Corrección 30 ago 2026 (v5)

Problema: `UteDev` (2 MSP) no puede validar PDC ni políticas `OutOf(2,5)` / `AND(org, Admin)` en `approveformyorg`/`commit`.

Cambio:

- `configtx.yaml`: solo perfil `UteFull`. `LifecycleEndorsement` = `OutOf(2, 5 peers)`.
- Compose diario: 3 orderers + 2 peers, red Docker `ute-net`, `mem_limit` peer 1g, `CORE_CHAINCODE_INSTALLTIMEOUT=300s`, puertos operations publicados.
- `create-channel.sh dev|full` comparte `channel-obra.block`.
- `make up-dev` ejecuta `full down` antes. `reset-*` borra `channel-artifacts/*.block` y el `channel-obra.block` suelto en la raíz.
- Monitoring: red externa `ute-net`, `extra_hosts: host-gateway`, `alerts.yml`, provisioning Grafana.

## `make reset-dev` (30 ago 2026, 21:10 CEST, ext4)

Génesis `UteDev` (20 206 B, 29 ago) borrado. `configtxgen -profile UteFull` escribió `network/channel-artifacts/channel-obra.block` (41 389 B). Copia suelta `~/ute/app/channel-obra.block` eliminada.

```
make reset-dev
  crypto ya existe (FORCE=1 para regenerar)
  Network ute-net Created
  3 orderers + 2 peers + ute-cli-dev Started
  osnadmin join ×3 → Status: 201, consensusRelation: consenter, status: active, height: 1
  join OK peer0.empresaa.ute.local:7051
  join OK peer0.administracion.ute.local:9051
  canal channel-obra listo (dev): perfil UteFull, 2 peers + 3 orderers

configtxgen -inspectBlock ... | MSP
  EmpresaAMSP EmpresaBMSP EmpresaCMSP EmpresaDMSP AdministracionMSP

docker ps
  orderer1.ute.local               7050, 7053, 8443
  orderer2.ute.local               8050, 8053, 8444
  orderer3.ute.local               9050, 9053, 8445
  peer0.empresaa.ute.local         7051, 9444
  peer0.administracion.ute.local   9051, 9445
  ute-cli-dev

docker network inspect ute-net → 6 contenedores
peer channel getinfo -c channel-obra → height: 1
```


## Monitorización (definido, no demostrado en runtime)

Alertas en `monitoring/alerts.yml`:

1. `PeerCaido` — `up{job="fabric-peers", role="required"} == 0`
2. `LatenciaBloqueAlta` — p99 `ledger_block_processing_time` > 5s
3. `ErrorEndorsementAlto` — ratio success=false > 5 %

Demostración con tráfico: día 13.

## Días 4–5 (30 ago 2026) — chaincode

`nvm use 18`. Jest sin red:

```
cd chaincode/hito && npm test
  Test Suites: 1 passed, 1 total
  Tests:       12 passed, 12 total

cd chaincode/pago && npm test
  Test Suites: 1 passed, 1 total
  Tests:       9 passed, 9 total
```

Deploy (CLI `ute-cli-dev`, install solo A+Admin):

```
make deploy-hito
  Package ID: hito_1.0:eb3408107e3c2edb6590988eb48ec51a0733e55b7ee10d062136b5261c1fa5ed
  commit policy=OR('EmpresaAMSP.peer','AdministracionMSP.peer')
  Approvals: [AdministracionMSP: true, EmpresaAMSP: true, EmpresaBMSP: false, EmpresaCMSP: false, EmpresaDMSP: false]

make deploy-pago
  Package ID: pago_1.0:cc18dc627f761cad2529f2626f15b0d0898031a4cdecc970da055c8e4d8d552f
  commit policy=AND('EmpresaAMSP.peer','AdministracionMSP.peer')
  Approvals: [AdministracionMSP: true, EmpresaAMSP: true, B/C/D: false]

./network/scripts/init-pago.sh
  payload: {"EmpresaA":35,"EmpresaB":25,"EmpresaC":20,"EmpresaD":20}

./network/scripts/verify-hito-pago.sh H-d5
  H-d5 PENDIENTE → EN_EJECUCION → VALIDACION → COMPLETADO
  pago-H-d5 CUSTODIA desglose 3500/2500/2000/2000 → AUTORIZADO
```

`docker ps` nodeenv: 4 cajas (`hito`+`pago` × peer A + peer Admin). Sin peers B/C/D.

## Día 6 (30 ago 2026) — API

```
docker compose -f network/docker-compose.api.yaml up -d
  ute-api  node:24.20.0-bookworm  :4000  red ute-net

curl /health → {"ok":true}
GET /metrics → process_cpu_* (prom-client)
GET /api-docs/ → 200 (Swagger UI)
Express 5.2.1 + @hyperledger/fabric-gateway 1.12.0
STORAGE_DRIVER=local  GRPC_KEEPALIVE_TIME_MS=120000

./network/scripts/verify-api.sh
  POST /auth/login empresaA
  H-api-1788121082 PENDIENTE → EN_EJECUCION → VALIDACION
  POST /hitos/.../completar → COMPLETADO + pago CUSTODIA
  POST /pagos/pago-.../autorizar → AUTORIZADO
  GET /mock/banco/pagos → evento PagoAutorizado
  docker logs ute-api: webhook mock banco 200
```

## Días 7–9 (30 ago 2026) — UI, Incidencia PDC, EstadoObra

```
cd chaincode/incidencia && npm test
  Test Suites: 1 passed
  Tests:       13 passed

cd chaincode/estado-obra && npm test
  Test Suites: 1 passed
  Tests:       6 passed

make deploy-incidencia
  Package ID: incidencia_1.0:363daeeb5f2e15d439afeb4b4579b53d9c39c201239d105f21685b45955fbd8d
  commit policy=OutOf(2, EmpresaA/B/C/D + Administracion peers)
  Approvals al commit: A+Admin; tras pdc-up: 5/5
  collections: obra-gruesa-solar, quirofanos-tech (querycommitted JSON)

make deploy-estado && ./network/scripts/init-estado.sh
  Package ID: estado-obra_1.0:a89c7505727cfc084e621acb7ff8ed10776e7b886de8826862a85dd645ef8ff5
  InitLedger → avancePct 0

./network/scripts/verify-api.sh
  H-api-1788122714 PENDIENTE → … → COMPLETADO + CUSTODIA → AUTORIZADO
  GET /mock/banco/pagos → PagoAutorizado

./network/scripts/verify-pdc.sh
  EmpresaA GET /incidencias/:id/privado → detalle + coste 1200
  Administracion GET privado → HTTP 500 sin acceso a datos privados
  peer B invoke quirofanos-tech → I-q-1788123556 ABIERTA VALID

GET /explorer (JWT)
  height: 48  channel: channel-obra  polling 3 s en UI
  bloques con number + txCount

POST /estado/recalcular
  hitosCompletados/hitosTotal, pagosCustodia/Autorizados, incidenciasAbiertas, avancePct

frontend Next 15.5.24  GET :3000 → 200
  rutas: / /dashboard /hitos /pagos /incidencias /estado /explorer  (7)
  NEXT_PUBLIC_API_URL=http://localhost:4000

./network/scripts/verify-ui.sh  OK E2E H-d7-1788123573  UI :3000 OK

make pdc-up  peers B/C/D en ute-net, join channel-obra, install+approve incidencia
```

## Post día 9 (31 ago – 6 sep 2026) — sesiones, roles, errores

Sin redeploy de chaincode. Commits `25bd7dc` (31 ago) y `68699bd` (6 sep).

```
git show 25bd7dc --stat
  backend: auth, config, errors.ts (nuevo), explorer, fabric, orgs.ts (nuevo), routes, swagger
  frontend: Shell, login 5 cuentas, hitos/pagos/incidencias/estado, ExplorerPanel, ErrorBox, lib/orgs.ts
  network: AUTH_USERS 5 MSP; create-channel.sh / join-pdc-peers.sh: join ya activo = OK
  docs: MANUAL.md, MEJORAS-UI.md
  27 files, +1679 −133

git show 68699bd --stat
  backend/src/{errors,routes,swagger}.ts
  frontend/src/app/{hitos,incidencias,pagos}/page.tsx
  6 files, +170 −40
```

`25bd7dc` (código, no salida de runtime):

- `AUTH_USERS` = A/B/C/D + Administración. Gateway de B/C/D firma con su MSP; evaluate/submit diario sigue a `PEER_ENDPOINT` (peer A).
- `empresa` y `lote` salen de `perfilDe(org)`, no de `'EmpresaA'` / `'obra-gruesa-solar'` fijos.
- `POST /pagos/:id/autorizar` 403 si `org !== AdministracionMSP`. `verify-api.sh` autoriza como `administracion`.
- Explorer: `previousHash`, `dataHash`, `txId`, `chaincode.fn`, `creatorMsp`, `endorsers`.
- `backend/src/errors.ts`: `traducirError` → JSON `{ error, detalle, codigo, nota }`. UI: `ErrorBox`.
- `create-channel.sh` / `join-pdc-peers.sh`: canal ya unido no falla `make up-dev`.

`68699bd` (código, no salida de runtime):

- Guardas API: `perfilConstructora` en alta/avance/rechazo de hito; `requireAdministracion` en autorizar y rechazar pago (`submit` siempre `AdministracionMSP`); `requireCreadoraIncidencia` (evaluate + `empresa` del perfil) en tratar/cerrar/rechazar incidencia.
- `POST /incidencias`: `empresa` = `perfil.empresa` (el body no la elige).
- Swagger: 403 en avance de hito, pago y trámite de incidencia.
- UI: Admin sin botones de avance de hito; pagos CUSTODIA → Autorizar + Rechazar; incidencias muestran `empresa`; Tratar/Cerrar solo si `perfil.empresa === i.empresa`.

## 9 sep 2026 — políticas, gateway, sonda de peers

Commits `0e24eb8` (22:17 CEST) y `fca92c3` (22:47 CEST). Código; el redeploy de políticas en la red diaria no está capturado aquí.

```
git show 0e24eb8 --stat
  Makefile (políticas commit hito/pago/estado)
  backend: errors, fabric, orgs, routes, swagger
  chaincode: hito/incidencia/pago (textos)
  frontend: hitos/page.tsx
  network/scripts/deploy-chaincode.sh
  docs/*
  22 files, +404 −138

git show fca92c3 --stat
  backend: app.ts GET /red; fabric peersLevantados; errors, index, orgs, swagger
  frontend: incidencias/page.tsx, lib/orgs.ts
  8 files, +99 −16
```

`0e24eb8`:

- `make deploy-hito` → `OR(EmpresaA/B/C/D.peer)`.
- `make deploy-pago` → `OR(AND(A,Admin), AND(B,Admin), AND(C,Admin), AND(D,Admin))`.
- `make deploy-estado` → `OR(A/B/C/D/Admin.peer)`.
- `submit` de hito/pago/estado entra por el peer del primer endosante (`ORG_PEER_PORT`: A 7051, B 8051, C 11051, D 12051, Admin 9051). Evaluate diario sigue por peer A.
- `requireEmpresaHito` + `endosantesDeHito` / `endosantesDePago`. Completar pide el par empresa+Admin.
- Completar hito: dos `submit` (HitoContract + PagoContract). Eso cambia el 11 sep (código ahora en `develop`).

`fca92c3`:

- `GET /red` → `{ peers: Record<OrgMsp, boolean> }`. Sonda TCP 800 ms, caché 10 s. Arranque API llama `peersLevantados()`.
- `loteSinPeerDiario(lote, vivos)` / UI `lotePdcApagada(lote, vivos)`: aviso `make pdc-up` según peers vivos, no solo A+Admin fijos.

## 11 sep 2026 — evidencias, listas, hito→pago mismo tx

Working tree a las 20:50 CEST; después en `develop`. Jest en Node 18:

```
cd chaincode/hito && npm test
  Test Suites: 1 passed, 1 total
  Tests:       12 passed, 12 total

cd chaincode/pago && npm test
  Test Suites: 1 passed, 1 total
  Tests:       11 passed, 11 total
```

Pago: 9 tests (30 ago) → 11 (añade «no custodia si el hito no está COMPLETADO» y «origen completarHito no consulta el hito»).

Código (no salida de runtime de red):

- `completarHito` hace `ctx.stub.invokeChaincode('pago', ['PagoContract:ponerEnCustodia', ...], channel)` y devuelve `{ hito, pago }`. Un solo `submitCommit` en la API. Respuesta `{hito, pago, evidencia}`. `verify-hito-pago.sh`: `completar_invoke` endosa A+Admin.
- `ponerEnCustodia(..., origen)`: si `origen === 'completarHito'` no llama a hito (Fabric rechaza invoke anidado con el mismo txid). Si el origen es otro, `leerHito` exige estado `COMPLETADO` e importe/empresa coincidentes.
- Evidencias de incidencia: `POST/GET /incidencias/:id/evidencias`, `GET .../evidencias/:eid`. Disco `UPLOAD_DIR` + `index.json`; SHA-256; máx. 5 MB; mime imagen/PDF. Binario **no** entra en Fabric. Al crear, el frontend pone `hashEvidencia <sha256> <nombre>` en `notasTecnicas` (PDC).
- Evidencias de hito: `POST/GET /hitos/:id/evidencias` (solo empresa del hito, estado `VALIDACION`). Completar exige acta: multipart `file` o evidencia ya subida; el SHA-256 va a `hashEvidencia`. `GET /evidencias` índice por padre (omite incidencias de lote ajeno).
- Guardas: `requireAdjuntoHito`; `requireAdjuntoIncidencia` (creadora + ABIERTA|EN_TRATAMIENTO); `requireSocioEvidencia` (socios del lote; Admin 403 `PDC_SIN_ACCESO`). Multer `LIMIT_FILE_SIZE` → 400.
- Listas `GET /hitos|/pagos|/incidencias` `pageSize` default 100, orden `createdAt` desc. UI: `formatFecha` + `porFechaDesc`. Pagos: detalle técnico al autorizar.
- Fixtures locales (untracked): `ficheros_evidencias_test/` (PDF/PNG/JPG de fisura, quirófano, forjado, actas).

Hace falta `make deploy-cc` para que el ledger ejecute el invoke cruzado; el Jest no instala chaincode.

## 13 sep 2026 — Explorer y bloque al completar

Commit `4781f87` (`la penultima`). Código; sin captura de `docker stats` ni de `make deploy-cc`.

- `explorer.ts`: si llega bloque 0 con `dataHash` distinto al génesis en RAM, vacía snapshot e índice `txBloque` (cadena nueva tras `reset-demo-*`).
- `recordarBloqueTx` + `submitCommit`: al completar, la API asigna el número de bloque al hito en la respuesta (el world state no lo guarda).
- `GET /hitos` rellena `bloque` desde el índice si falta.

## 13 sep 2026 — Día 10 SAN (prueba corta)

GCP `ute-tfm` / `europe-west1-b`. IP reservada `fabric-ute-ip` = `34.34.181.140`. DuckDNS `ute-tfm.duckdns.org` → esa IP. VM `fabric-ute` e2-standard-4, VPC `ute-vpc` / `10.8.0.0/24` (privada `10.8.0.2`). 7051 no abierto a Internet.

cryptogen: SAN con IPv4 pelada (no prefijo `IP:`; eso acaba como DNS). `FORCE=1` `generate-crypto-prod.sh` `STATIC_IP=34.34.181.140` `API_FQDN=ute-tfm.duckdns.org`.

```
openssl x509 -in network/organizations-prod/peerOrganizations/empresaa.ute.prod/peers/peer0.empresaa.ute.prod/tls/server.crt -noout -text | grep -A2 'Subject Alternative Name'
            X509v3 Subject Alternative Name:
                DNS:peer0.empresaa.ute.prod, DNS:peer0, DNS:peer0.empresaa.ute.prod, DNS:ute-tfm.duckdns.org, IP Address:34.34.181.140
```

Mínimo en `ute-prod`: 3 orderers + peer A + peer Admin + API. `curl -sf http://127.0.0.1:4000/health` → `{"ok":true}`. Gateway usó `PEER_HOST_ALIAS=peer0.empresaa.ute.prod` (nombre Docker). Sin canal: listeners 404/`channel-obra` (esperado). VM apagada; IP y disco se conservan.

## 13 sep 2026 — Día 11 freeze + RAM

`docker stats --no-stream` en WSL. Sin Grafana local. `fabric-ute` TERMINATED. No hay `monitoring-ute`.

Anti-patrón (install en 5 peers, 20 `fabric-nodeenv` + Grafana/Prometheus):

| Caja | n | Mem (aprox.) |
| --- | --- | --- |
| fabric-nodeenv 4 CC × 5 peers | 20 | ~51–54 MiB c/u ≈ **1,04 GiB** |
| 5 peers | 5 | ~80–87 MiB (límite 512) |
| 3 orderers | 3 | ~17–19 MiB (límite 256) |
| API + Grafana + Prometheus + CLI | 4 | ~194 MiB |
| **Suma** | **32** | **~1,7 GiB** |

Cabe en WSL 11 GB. No es el objetivo.

Tras `make up-full` + CC vivos solo en endosantes (A+Admin; +B incidencia/estado por MANUAL §6 paso 6). `make monitoring-down`. `deploy-chaincode.sh` ya no instala B/C/D salvo `INSTALL_PDC_PEERS=1`.

```
NAME                               MEM USAGE / LIMIT
peer0.empresaa                     74.29MiB / 512MiB
peer0.administracion               77.97MiB / 512MiB
peer0.empresab                     65.49MiB / 512MiB
peer0.empresac                     70.68MiB / 512MiB
peer0.empresad                     84.80MiB / 512MiB
orderer1                           16.22MiB / 256MiB
orderer2                           14.73MiB / 256MiB
orderer3                           15.50MiB / 256MiB
ute-api                            61.43MiB / 384MiB
ute-cli-full                       32.96MiB / 256MiB
8 nodeenv A+Admin (hito/pago/incidencia/estado)  ~51 MiB c/u
2 nodeenv B (incidencia + estado, paso 6)        ~50 MiB c/u
```

10 `fabric-nodeenv` (no 20). Suma contenedores **~1024 MiB**. Objetivo diario < 6 GB: cumple.

Demo MANUAL §6 (`next start`, no `dev`): `H-d11` COMPLETADO `hashEvidencia` + bloque 38; `pago-H-d11` AUTORIZADO; webhook `GET /mock/banco/pagos`; Explorer altura 43; `I-d11-A` + `I-demo-B`. UI `:3000` 200 en 7 rutas. TypeScript: `next build` exigía tipar el `.catch` de `/evidencias` en hitos/incidencias.

Freeze: no más pantallas, políticas ni chaincode salvo bugs de prod.

## 13 sep 2026 — Día 12 producción app (sin Grafana)

GCP `ute-tfm` / `europe-west1-b`. `fabric-ute` RUNNING → ensayo → TERMINATED. IP `34.34.181.140` sin cambio (no se regeneró SAN por IP). `FORCE=1` crypto + `down -v`. Canal `UteFull`: 5 peers + 3 orderers (`ute.prod`).

osnadmin en prod usa `ordererN.ute.prod:7053` (SAN no incluye `localhost`; `/etc/hosts` → `127.0.0.1`). `crypto-config.production.yaml.example` añade `localhost`/`127.0.0.1` en SANS de orderers para el próximo FORCE.

```
make deploy-cc-prod
  hito_1.0:7dcab9e181fea607e5a0624aff9bf9ec1efcfd5303e9e9ff4dbf09464c57b214
  pago_1.0:0145678959005e92216352db7a5085b6cd855790dd1d4e484496d06a3eafc673
  incidencia_1.0:e1c5e4d8946e63615ae020472b50be9aa8bd10660c752f7394b8c3a9ab9ff63b
  estado-obra_1.0:a89c7505727cfc084e621acb7ff8ed10776e7b886de8826862a85dd645ef8ff5
  Approvals 5/5. InitLedger pago: {"EmpresaA":35,"EmpresaB":25,"EmpresaC":20,"EmpresaD":20}
  InitLedger estado-obra: hitosTotal 0
```

GCS `gs://ute-tfm-evidencias-ute-tfm` EUROPE-WEST1 UBLA. SA `384692693750-compute@developer.gserviceaccount.com` `roles/storage.objectAdmin`. API `STORAGE_DRIVER=gcs`. ADC metadata desde el contenedor.

```
POST /evidencias (empresaA)
  {"driver":"gcs","path":"gs://ute-tfm-evidencias-ute-tfm/1789302261640-ute-dia12-probe.txt"}
gcloud storage ls gs://ute-tfm-evidencias-ute-tfm/
  gs://ute-tfm-evidencias-ute-tfm/1789302261640-ute-dia12-probe.txt
```

API `:4000` bind `127.0.0.1`. `MOCK_BANCO_URL=http://ute-api:4000/mock/banco/pagos`. Cadvisor/node-exporter con profile `exporters` (no arrancan). Sin Grafana.

Caddy `caddy:2.11.4`. `{ email off }` lo rechaza Let's Encrypt; Caddyfile sin bloque email.

```
curl -I https://ute-tfm.duckdns.org/health
  HTTP/2 200
  via: 1.1 Caddy
issuer=C = US, O = Let's Encrypt, CN = YE2
subject=CN = ute-tfm.duckdns.org
notBefore=Sep 13 11:13:41 2026 GMT
curl http://34.34.181.140:4000/health → timeout (no publicado a Internet)
```

`SEED_EMPTY=1`: hitos=0 pagos=0 incidencias=0. Smoke 3.7 (no el guion MANUAL §6): `H-d12` COMPLETADO `hashEvidencia ae8f0dd60a17e30f` + `pago-H-d12` CUSTODIA. Explorer `height: 31` `completarHito` bloque 30.

Vercel Hobby (13 sep, tarde): proyecto `ute-block-chain`, GitHub `pasangel830-sketch/UTE_BlockChain` rama `main`.

```
curl -I https://ute-tfm.duckdns.org/health → HTTP/2 200 (VM RUNNING)
OPTIONS /auth/login Origin: https://ute-block-chain.vercel.app → 204
  access-control-allow-origin: https://ute-block-chain.vercel.app
GET /hitos (empresaA) → H-d12 COMPLETADO. Explorer height 32.
CORS_ORIGIN en VM: https://ute-block-chain.vercel.app
curl https://ute-block-chain.vercel.app/ → 404 x-vercel-error: NOT_FOUND
```

El proyecto Hobby existe; el Production Domain aún no tiene un deploy Next Ready (típico si Root Directory quedó `./`). Hace falta Settings → Root Directory `frontend`, Framework Next.js, env `NEXT_PUBLIC_API_URL=https://ute-tfm.duckdns.org`, Redeploy.

Sin `monitoring-ute`. Sin Render. `fabric-ute` RUNNING para el ensayo Vercel.

## 14 sep 2026 — Día 13 monitorización + QA

GCP `ute-tfm` / `europe-west1-b`. `fabric-ute` ya RUNNING (ledger día 12). Nueva VM `monitoring-ute` **e2-small** (2 GB; e2-micro 1 GB no cabe Grafana+Prometheus). Privada `10.8.0.3`, IP `monitoring-ute-ip` = `34.38.37.200`. Firewall `ute-allow-ops-vpc`: 8443–8445, 9444–9448, 4000, 3000, 8080, 9100, 9090 solo `10.8.0.0/24`. 7051 y `/metrics` de peers no a Internet.

API prod bind `0.0.0.0:4000` (VPC). Caddy `ute-tfm.duckdns.org/grafana*` → `10.8.0.3:3000`. Grafana 12.4.1 `GF_SECURITY_ALLOW_EMBEDDING=true`, `SERVE_FROM_SUB_PATH`, ROOT_URL `https://ute-tfm.duckdns.org/grafana`. Prometheus v3.14.0 `--storage.tsdb.retention.time=3d`. Caddy 2.11.4 en monitoring-ute (localhost). Cadvisor/node-exporter: imagen cadvisor pin falló (`gcr.io` v0.56.1 / `ghcr.io` v0.49.1 not found); scrape `fabric-exporters` DOWN. Las 3 alertas del PDF no lo necesitan.

```
docker stats --no-stream  (monitoring-ute e2-small)
NAME             MEM USAGE / LIMIT
prometheus       106.5MiB / 512MiB
grafana          264.4MiB / 512MiB
ute-caddy-mon    55.63MiB / 128MiB
ute-alert-demo   22.66MiB / 1.919GiB
Mem: 1.9Gi total, ~505Mi used, 1.3Gi available
```

Targets Prometheus (VPC):

```
up      fabric-peers     peer0.empresaa.ute.prod:9444
up      fabric-peers     peer0.administracion.ute.prod:9445
up      fabric-peers     peer0.empresab.ute.prod:9446
up      fabric-peers     peer0.empresac.ute.prod:9447
up      fabric-peers     peer0.empresad.ute.prod:9448
up      fabric-orderers  orderer1/2/3.ute.prod:8443-8445
up      backend          fabric-ute:4000
up      alert-demo       alert-demo:9105
down    fabric-exporters fabric-ute:8080 / :9100
retention 3d
```

Alertas firing (`GET /api/v1/query?query=ALERTS`, 14 sep 18:42Z):

```
PeerCaido            firing  peer0.empresaa.ute.prod:9444  critical   docker stop 75s+
LatenciaBloqueAlta   firing  alert-demo:9105               warning    exporter ensayo (p99>5s)
ErrorEndorsementAlto firing                                warning    exporter ensayo (>5 %)
```

`alerts.yml` del PDF no se cambió. Latencia/endorsement reales en e2-standard-4 no llegan a 5 s / 5 %; `monitoring/alert-demo-exporter.py` (profile `alert-demo`) incrementa histogram/counters para que `rate()` no sea 0. PeerCaido es stop real del peer A (`up==0`).

Iframe: `https://ute-tfm.duckdns.org/grafana/d/ute-fabric/ute-fabric?orgId=1&refresh=10s&kiosk&theme=light` → HTTP/2 200, sin `X-Frame-Options`. UI `/monitor`. Vercel `/monitor` sigue 404 hasta redeploy Next (Root `frontend`).

Flujo demo (seed, no SEED_EMPTY):

```
SEED_HITO_ID=H-d13 SEED_INC_A=I-d13-A SEED_INC_B=I-d13-B ./network/scripts/seed-data.sh
H-d13 COMPLETADO hash ae8f0dd60a17e30f bloque 83
pago-H-d13 AUTORIZADO
GET /mock/banco/pagos  evento pago-H-d13 2026-09-14T18:43:17.122Z  35/25/20/20
I-d13-A + I-d13-B creadas
Explorer height 87
GET /red  5 peers true
```

Colchón TLS (mismo volumen Caddy día 12):

```
curl -I https://ute-tfm.duckdns.org/health → HTTP/2 200 via Caddy
issuer=C = US, O = Let's Encrypt, CN = YE2
subject=CN = ute-tfm.duckdns.org
notBefore=Sep 13 11:13:41 2026 GMT
notAfter=Dec 12 11:13:40 2026 GMT
```

VMs apagadas al terminar (`fabric-ute`, `monitoring-ute`). IP y discos se conservan. Día 14: encender 30–60 min antes.

