# Plan 14 días TFM UTE Blockchain (v5)

Checklist vivo: **[CHECKLIST.md](CHECKLIST.md)**. Este archivo es el marco (stack, por qué, calendario). No duplicar tareas.

PC: Windows 11, 16 GB. Docker Engine en WSL2 (Ubuntu 22.04, ext4 `~/ute/app`). Sin Render/Railway. cryptogen. LevelDB.

## Stack

| Capa | Pin |
| --- | --- |
| Host | Win11 16 GB, WSL2 Ubuntu 22.04, Docker Engine. Repo en ext4, no `/mnt/c` |
| WSL | `.wslconfig`: memory=11GB, swap=8GB |
| Node API/UI | 24.20.0 |
| Node chaincode | 18 / imagen `fabric-nodeenv:2.5`. **TypeScript** compilado (rúbrica) |
| Fabric | 2.5.16, cryptogen, LevelDB |
| Canal | un perfil `UteFull` (5 MSP, 3 Raft). Diario: mismos orderers, peers A+Admin |
| Gateway | `@hyperledger/fabric-gateway` 1.12.0 + gRPC keepalive |
| Express | 5.2.1 + helmet, cors, express-rate-limit |
| Next / Tailwind | 15.5.24 / 3.4 |
| API prod | VM `fabric-ute`. Justificación vs PDF (Railway/Render): [MEMORIA-NOTAS.md](MEMORIA-NOTAS.md) |
| Frontend prod | Vercel Hobby |
| Monitor | Prometheus v3.14.0 3d, Grafana 12.4.1, Caddy 2.11.4. Alertas y dashboards ya en `monitoring/` |

## Cambios v4 → v5 (30 ago 2026)

- Un canal `UteFull`. Dev ya no usa 2 orgs (rompía PDC y políticas 2-de-5 / pago).
- Diario: 3 orderers (quórum Raft) + 2 peers. Full: +peers B/C/D.
- Chaincode TypeScript. EstadoObra escrito por el backend (sin cross-cc).
- Rebanada vertical Hito+Pago→API→pantalla→Explorer **antes del día 8**.
- Escrow (§4.2) y webhook mock `PagoAutorizado` en el calendario.
- RAM: contar contenedores `fabric-nodeenv`; instalar CC solo donde se endosa; peers diario 1 GB; `CORE_CHAINCODE_INSTALLTIMEOUT=300s`.
- Monitorización: Prometheus en `ute-net`, puertos operations, `host-gateway`, `alerts.yml`, Grafana provisioning.
- Makefile: `up-dev` baja full; reset borra `*.block`; `seed` tiene stub.
- Docs: un checklist; informe técnico aparte del informe en metáforas.

## Calendario

| Día | Foco | Criterio de hecho (resumen) |
| --- | --- | --- |
| 1 | Entorno | WSL, Engine, Node, Fabric. GitHub = usuario |
| 2–3 | Red | `UteFull` unido. Diario restaurable |
| 4 | Hito TS | tests + install A+Admin |
| 5 | Pago TS + escrow | tests + política org+Admin |
| 6 | API hitos/pagos + listener + webhook mock | :4000 + evento |
| 7 | 1 pantalla + Explorer | flujo E2E local |
| 8 | Incidencia + PDC | OutOf(2,5) + collections |
| 9 | Resto UI + EstadoObra (backend escribe) | 7 pantallas |
| 10 | VM + SAN | IP en el certificado |
| 11 | Freeze + medir RAM CC | `docker stats` |
| 12 | Prod app | seed real, Vercel, GCS |
| 13 | Monitor GCP + 3 alertas | iframe defensa |
| 14 | Defensa | 3 ensayos, sin deploys |

Detalle por fila: [CHECKLIST.md](CHECKLIST.md). Trazabilidad rúbrica: [TRAZABILIDAD.md](TRAZABILIDAD.md).

## Fuera de GitHub

`.env`, claves, certs, wallets, SA JSON, JWT, volúmenes Fabric, evidencias Grafana.
