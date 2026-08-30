# Trazabilidad PDF → código → rúbrica

Defensa: **PENDIENTE confirmar fecha con el tutor.**
Estados: HECHO · PARCIAL · PENDIENTE · N/A.
Fuente de tareas: [CHECKLIST.md](CHECKLIST.md).

| Requisito (propuesta / rúbrica) | Dónde | Estado | Puntos (aprox.) |
| --- | --- | --- | --- |
| Red Fabric 5 orgs + Raft 3 orderers | `network/configtx.yaml` perfil `UteFull`; compose full | HECHO (red); reset-dev pendiente | red local |
| Canal único usable en diario | `create-channel.sh`; compose dev = 3 orderers + A + Admin | HECHO diseño; reset pendiente | |
| PDC obra-gruesa / quirófanos | `network/collections-config.json` | HECHO YAML; commit CC día 8 | |
| 4 chaincodes **TypeScript** + tests unitarios | `chaincode/` (hito, pago, incidencia, estado-obra) | PENDIENTE | **4** |
| Escrow / fondos custodiados (§4.2) | PagoContract + API | PENDIENTE (día 5) | funcional |
| Evento `PagoAutorizado` + integración bancaria | listener Express + `POST /mock/banco/pagos` | PENDIENTE (día 6) | funcional |
| Endorsement pago org + Administración | política al hacer commit del CC | PENDIENTE (día 5) | |
| Incidencias 2 de 5 | IncidenciaContract OutOf(2,5) | PENDIENTE (día 8) | |
| Estado de obra | EstadoObraContract alimentado por backend (sin cross-cc) | PENDIENTE (día 9) | |
| API JWT, multer, Swagger, prom-client | `backend/` | PENDIENTE (día 6) | |
| Frontend 7 pantallas + Explorer | `frontend/` | PENDIENTE (días 7 y 9) | |
| Repo GitHub compartido con DomingoMr | remoto + colaborador | PENDIENTE (usuario: `gh auth login`) | Fase 2 |
| README detallado con diagramas | `README.md` | PARCIAL (esqueleto 30 ago) | Fase 2 |
| Monitorización: peer caído, bloque > 5 s, endorsement > 5 % | `monitoring/alerts.yml` + Grafana | PARCIAL (definido; demo día 13) | **1** |
| Prometheus alcanza peers/orderers | red `ute-net`, puertos 9444–9448 / 8443–8445 | HECHO compose | |
| Despliegue API (PDF: Railway/Render) | VM `fabric-ute`; [MEMORIA-NOTAS.md](MEMORIA-NOTAS.md) | PENDIENTE deploy; desviación anotada | |
| Frontend Vercel | Vercel Hobby | PENDIENTE | |
| Seed demo | `network/scripts/seed-data.sh` | PARCIAL (stub día 12) | |

Actualizar la columna Estado al cerrar cada día, no al empezar.
