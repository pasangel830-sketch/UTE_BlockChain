# Checklist 14 días — UTE Blockchain TFM

**Fuente de verdad.** El resto de `docs/` apunta aquí.
Leyenda: **HECHO** · **EN CURSO** · **PENDIENTE**
Actualizado: 11 sep 2026.

| | |
| --- | --- |
| Defensa | **PENDIENTE confirmar fecha con el tutor** (día 14 del plan ≠ fecha de tribunal) |
| Repo | `https://github.com/pasangel830-sketch/UTE_BlockChain.git` (`main` = `develop`) |
| Cadena | un perfil `UteFull` (5 MSP). Diario = 3 orderers + peers A y Admin |
| Chaincode | TypeScript (rúbrica), Node 18, `fabric-nodeenv:2.5` |
| API prod | VM `fabric-ute` (no Render/Railway). Justificación: [MEMORIA-NOTAS.md](MEMORIA-NOTAS.md) |
| Trazabilidad | [TRAZABILIDAD.md](TRAZABILIDAD.md) |
| Informe técnico | [INFORME-TECNICO.md](INFORME-TECNICO.md) |

Pendiente **usuario ahora**: invitar a `DomingoMr` como colaborador del repo; confirmar fecha de defensa con el tutor. GCP y Vercel no bloquean Fabric local.

---

## Criterio de «hecho» (todos los días)

Una fila pasa a HECHO solo si: (1) el comando o entrega existe en el repo o en la VM, (2) hay salida o captura en [INFORME-TECNICO.md](INFORME-TECNICO.md), (3) no queda un *workaround* sin anotar.

---

## Riesgos y contingencias

| Riesgo | Cuándo duele | Contingencia |
| --- | --- | --- |
| TLS/SAN de la IP pública | días 10 y 12 | Probar SAN el día 10; colchón el 13; no dejarlo para el 12 por la noche |
| 20 contenedores chaincode OOM | día 11 | Instalar cada CC solo en peers que endosan; medir `docker stats` antes del freeze |
| `gh` sin login / sin remoto | hoy | Cerrado: remoto `UTE_BlockChain`, `main` alineado con `develop`. Falta invitar `DomingoMr` |
| Cross-cc Hito→EstadoObra | días 4–8 | EstadoObra se escribe desde el backend; el CC no llama a otros CC |
| Cross-cc Hito→Pago (mismo tx) | 11 sep | `completarHito` → `invokeChaincode` pago; `origen=completarHito` evita invoke anidado hito←pago. Redeploy (`make deploy-cc`) pendiente de runtime |
| Render Free se duerme | defensa | API en la misma VM que Fabric (ya decidido) |
| `chmod 600` en drvfs | keys peer | Repo en ext4 `~/ute/app`, no en `/mnt/c` |
| Día 12 falla y no hay demo | defensa | Rebanada vertical (hito→pago→API→pantalla→Explorer) **antes del día 8** |

---

## RAM (WSL 11 GB)

| Pieza | Diario | Full | Notas |
| --- | --- | --- | --- |
| 3 orderers × 256 MB | 768 MB | 768 MB | Hacen falta 3: génesis Raft de `UteFull` |
| Peers | 2 × 1 GB | 5 × 512 MB | Diario 1 GB por install de CC |
| CLI | 256 MB | 256 MB | |
| Chaincode `fabric-nodeenv` | ~150 MB × N | ~150 MB × N | **Fuera** del `mem_limit` del peer. Diario: Hito+Pago en A+Admin ≈ 4–6 cajas (~0,6–0,9 GB). No 4×5=20 |
| Prometheus+Grafana | no en diario | ~768 MB | Red `ute-net`; día 13 / GCP |
| Next + Cursor + Chrome | variable | — | No junto a `up-full` |

Medir con `docker stats` antes del día 11. Objetivo diario < 6 GB de contenedores.

---

## Día 1 — Cuentas y entorno · HECHO (salvo GCP/Vercel y colaborador)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | WSL2 Ubuntu 22.04, `.wslconfig` 11 GB + swap 8 GB, systemd | `wsl -l -v` |
| HECHO | Docker Engine en Ubuntu (Desktop apagado) | `docker run hello-world` |
| HECHO | nvm: Node 24.20.0 y 18.20.8 | `node -v` en cada alias |
| HECHO | Binarios e imágenes Fabric 2.5.16; `fabric-nodeenv:2.5` | `peer version` |
| HECHO | gcloud CLI | `gcloud version` |
| HECHO | Monorepo, Makefile, compose, `.gitignore` | árbol en repo |
| HECHO | Repo GitHub `pasangel830-sketch/UTE_BlockChain`; `main` = `develop` | `git remote -v`; `origin/main` |
| PENDIENTE (usuario) | Invitar `DomingoMr` como colaborador | Settings → Collaborators |
| PENDIENTE (usuario) | GCP 300 USD, alertas; Vercel Hobby. Sin Render | consolas cloud |
| HECHO | Proyecto en ext4 `~/ute/app` (no `C:\Proyectos\UTE\app`) | `df -T` → ext4 |

Detalle histórico: [DIA-1-CHECKLIST.md](DIA-1-CHECKLIST.md).

---

## Días 2–3 — Red Fabric · HECHO (canal unificado 30 ago)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | cryptogen 6 MSP, LevelDB, sin CA/CouchDB | `network/organizations/` local |
| HECHO | Un perfil `UteFull` (5 orgs). Sin `UteDev` | `configtx.yaml` |
| HECHO | PDC `obra-gruesa-solar` y `quirofanos-tech` | `collections-config.json` |
| HECHO | `make up-full` 5 peers + 3 orderers Raft (29 ago, líder orderer2) | [INFORME-TECNICO.md](INFORME-TECNICO.md) |
| HECHO | Lifecycle `OutOf(2,5)`: A+Admin basta | `configtx.yaml` |
| HECHO | `make reset-dev` génesis `UteFull` (30 ago, ext4) | 3 orderers + A + Admin; 5 MSP en el bloque |

Tras reset: diario = 3 orderers + peer A + peer Admin + CLI. Mismo génesis que full.

---

## Días 4–7 — Rebanada vertical (Hito + Pago → API → 1 pantalla → Explorer) · HECHO

Invertido respecto al plan original: punta a punta **antes del día 8**. Incidencia, PDC y EstadoObra después.

### Día 4 — HitoContract TS · HECHO (30 ago 2026)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | `nvm use 18`. HitoContract TypeScript + Jest | `npm test` en `chaincode/hito` (12 tests) |
| HECHO | Estados PENDIENTE → EN_EJECUCION → VALIDACION → COMPLETADO\|RECHAZADO | tests de transición |
| HECHO | Composite keys + `GetStateByRangeWithPagination` | listados LevelDB |
| HECHO | Endorsement `OR(A,B,C,D)`; completar pide empresa+Admin en API | commit + `endosantesDeHito` / `endosantesDePago` |

### Día 5 — PagoContract TS + escrow · HECHO (30 ago 2026)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | PagoContract TS + Jest | `npm test` en `chaincode/pago` (11 tests, 11 sep) |
| HECHO | Escrow: fondos CUSTODIA hasta `PagoAutorizado` (PDF §4.2) | tests + invoke `H-d5` |
| HECHO | Endorsement `OR(AND(org, Admin)…)` por empresa del hito | commit `OR(AND(A,Admin),AND(B,Admin),AND(C,Admin),AND(D,Admin))`; API pide el par de esa empresa |
| HECHO | Init participaciones 35/25/20/20 | `InitLedger` → `{"EmpresaA":35,...}` |
| HECHO | `completarHito` dispara custodia en el mismo tx (`invokeChaincode` pago); EstadoObra sigue en backend | API `POST /hitos/:id/completar` → `{hito, pago}` CUSTODIA (código 11 sep; redeploy pendiente) |

### Día 6 — API (trozo de hitos/pagos) · HECHO (30 ago 2026)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Express 5.2.1, Gateway 1.12.0, JWT, helmet, cors, rate-limit | `ute-api` en :4000 |
| HECHO | multer, Swagger, prom-client `/metrics` | `/api-docs`, `/metrics` |
| HECHO | Listener `PagoAutorizado` → webhook mock `POST /mock/banco/pagos` | log + 200 |
| HECHO | `STORAGE_DRIVER=local`. gRPC keepalive | env compose API |

### Día 7 — Una pantalla + Explorer · HECHO (30 ago 2026)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Next 15.5: pantalla de hitos/pagos + Explorer (polling 3 s) | flujo crear hito → completar → pago visible |
| HECHO | `NEXT_PUBLIC_API_URL=http://localhost:4000` | E2E local |
| HECHO | README con diagrama de esta rebanada | [README.md](../README.md) |

**Criterio del bloque 4–7:** un usuario crea un hito, lo completa, el pago queda en custodia, el evento llega al mock bancario y el Explorer muestra el bloque. Sin Incidencia ni PDC todavía.

---

## Día 8 — Incidencia + PDC · HECHO (30 ago 2026)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | IncidenciaContract TS, endorsement OutOf(2,5) | tests + commit |
| HECHO | PDC en full (peers B/C/D un rato) | collections commit |
| HECHO | Resto de API (si quedó algo el día 6) | Swagger completo |

---

## Día 9 — Resto UI + EstadoObra · HECHO (30 ago 2026)

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Siete pantallas en total | recuento rutas Next |
| HECHO | EstadoObraContract TS: el backend escribe el agregado; **sin** invoke cruzado | tests + API |
| HECHO | README detallado + diagramas (entregable Fase 2) | [README.md](../README.md) |

### Post día 9 — huecos UI y roles · HECHO (31 ago – 6 sep 2026)

Plan original: [MEJORAS-UI.md](MEJORAS-UI.md). Commits `25bd7dc`, `68699bd`. Sin cambio de chaincode.

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Chip de sesión + 5 logins (A/B/C/D/Admin); lote/empresa según MSP | UI + `AUTH_USERS` |
| HECHO | Solo Administración autoriza o rechaza pagos; constructora no avanza si es Admin | 403 API + botones |
| HECHO | Incidencia: empresa de sesión; tramitar solo la creadora | 403 `ROL_NO_AUTORIZADO` |
| HECHO | Explorer con txs Fabric; errores traducidos (`ErrorBox`) | `GET /explorer`, `errors.ts` |
| HECHO | Manual de uso | [MANUAL.md](MANUAL.md) |

### Post día 9b — políticas, gateway, sonda · HECHO (9 sep 2026)

Commits `0e24eb8`, `fca92c3`. Políticas de commit alineadas con B/C/D.

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Políticas: hito `OR(A,B,C,D)`; pago `OR(AND(org,Admin)…)`; estado `OR(5 MSP)` | Makefile + `deploy-chaincode.sh` |
| HECHO | Gateway submit hito/pago/estado al peer del primer endosante | `fabric.ts` `ORG_PEER_PORT` |
| HECHO | Solo la empresa del hito lo avanza | `requireEmpresaHito` 403 |
| HECHO | `GET /red` sonda TCP; UI PDC usa peers vivos | `/red` + `lotePdcApagada(vivos)` |

### Post día 9c — evidencias, listas, hito→pago · HECHO (11 sep 2026)

Working tree (sin commit). Jest: hito 12/12, pago 11/11. Redeploy de CC no demostrado en runtime.

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Evidencias ancladas a incidencia: disco + SHA-256; hash en `notasTecnicas` PDC al crear | `storage.ts` + `POST /incidencias/:id/evidencias` |
| HECHO | Solo la creadora adjunta (ABIERTA/EN_TRATAMIENTO); solo socios listan/descargan | 403 `ROL_NO_AUTORIZADO` / `PDC_SIN_ACCESO` |
| HECHO | Listas hitos/pagos/incidencias/evidencias más reciente primero; fecha en UI | `listaOrdenada` + `porFechaDesc` |
| HECHO | `completarHito` → `PagoContract:ponerEnCustodia` en el mismo tx | tests Jest; `verify-hito-pago.sh` endosa A+Admin |

---

## Día 10 — Tarde prueba cloud · PENDIENTE

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| HECHO | Mañana: huecos UI | [MEJORAS-UI.md](MEJORAS-UI.md); ver Post día 9 / 9b / 9c |
| PENDIENTE | VM e2-standard-4, IP estática, certs con **SAN de esa IP** | `openssl x509 -in ... -text` muestra la IP |
| PENDIENTE | API en la misma VM; Gateway → peer por red Docker | curl HTTPS o :4000 interno |
| PENDIENTE | Apagar VM | consola GCP |

---

## Día 11 — Freeze · PENDIENTE

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| PENDIENTE | `docker stats` con CC instalados (no adivinar RAM) | captura en informe técnico |
| PENDIENTE | Demo: `up-full` + API + `next start`. Cursor cerrado. Sin Grafana local | flujo demo |
| PENDIENTE | VPC + IP + VM `fabric-ute` apagada | GCP |

---

## Día 12 — Producción app · PENDIENTE

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| PENDIENTE | cryptogen prod con SAN (`crypto-config.production.yaml.example`) | |
| PENDIENTE | 5 peers + 3 orderers + CC (solo peers que endosan) + `make seed` | seed real, no stub |
| PENDIENTE | API systemd/docker; GCS + SA de la VM | |
| PENDIENTE | Vercel Hobby → API HTTPS | |
| PENDIENTE | Sin Caddy/Grafana este día. Sin Render | |

---

## Día 13 — Monitorización + QA · PENDIENTE

Compose local ya tiene: red `ute-net`, puertos operations, `alerts.yml` (3 alertas del PDF), provisioning Grafana.

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| PENDIENTE | VM `monitoring-ute` (e2-small si e2-micro OOM) | |
| PENDIENTE | Prometheus 3 d, Grafana, Caddy 2.11.4 | iframe defensa |
| PENDIENTE | Demostrar las 3 alertas: peer caído, bloque > 5 s, endorsement > 5 % | captura Grafana/Prometheus |
| PENDIENTE | Flujo demo + colchón TLS | |

---

## Día 14 — Defensa · PENDIENTE

| Estado | Tarea | Hecho si |
| --- | --- | --- |
| PENDIENTE | VMs 30–60 min antes. Seed. Tres ensayos. Vídeo | |
| PENDIENTE | Sin deploys ese día | |

---

## Fuera de GitHub (nunca commitear)

`.env`, claves, certs, `network/organizations/`, wallets, JSON de service account, JWT, volúmenes Fabric, evidencias (`uploads/`, `ficheros_evidencias_test/`), datos Grafana.
