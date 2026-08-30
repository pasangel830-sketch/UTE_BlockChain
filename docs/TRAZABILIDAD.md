# Trazabilidad PDF → código → rúbrica

Defensa: **PENDIENTE confirmar fecha con el tutor** (no aparece en el PDF ni en el plan; día 14 = ensayo, no tribunal).
Estados: HECHO · PARCIAL · PENDIENTE · N/A.
Fuente de tareas: [CHECKLIST.md](CHECKLIST.md).

| Requisito (propuesta / rúbrica) | Dónde | Estado | Puntos (aprox.) |
| --- | --- | --- | --- |
| Red Fabric 5 orgs + Raft 3 orderers | `network/configtx.yaml` perfil `UteFull`; compose full | HECHO | red local |
| Canal único usable en diario | `create-channel.sh`; compose dev = 3 orderers + A + Admin | HECHO (`make reset-dev` 30 ago) | |
| PDC obra-gruesa / quirófanos | `network/collections-config.json` | HECHO YAML + commit CC día 8 | |
| 4 chaincodes **TypeScript** + tests unitarios | `chaincode/` (hito, pago, incidencia, estado-obra) | HECHO (días 4–5 y 8–9) | **4** |
| Escrow / fondos custodiados (§4.2) | PagoContract + API | HECHO (día 5) | funcional |
| Evento `PagoAutorizado` + integración bancaria | listener Express + `POST /mock/banco/pagos` | HECHO (día 6) | funcional |
| Endorsement pago org + Administración | política al hacer commit del CC | HECHO `AND(EmpresaAMSP.peer, AdministracionMSP.peer)` | |
| Incidencias 2 de 5 | IncidenciaContract OutOf(2,5) | HECHO (día 8) | |
| Estado de obra | EstadoObraContract alimentado por backend (sin cross-cc) | HECHO (día 9) | |
| API JWT, multer, Swagger, prom-client | `backend/` | HECHO (día 6) | |
| Frontend 7 pantallas + Explorer | `frontend/` | HECHO (días 7 y 9) | |
| Repo GitHub compartido con DomingoMr | `pasangel830-sketch/UTE_BlockChain` (`main`) | PARCIAL (remoto HECHO; falta invitar `DomingoMr`) | Fase 2 |
| README detallado con diagramas | `README.md` | HECHO (días 7 y 9) | Fase 2 |
| Monitorización: peer caído, bloque > 5 s, endorsement > 5 % | `monitoring/alerts.yml` + Grafana | PARCIAL (definido; demo día 13) | **1** |
| Prometheus alcanza peers/orderers | red `ute-net`, puertos 9444–9448 / 8443–8445 | HECHO compose | |
| Despliegue API (PDF: Railway/Render) | VM `fabric-ute`; [MEMORIA-NOTAS.md](MEMORIA-NOTAS.md) | PENDIENTE deploy; desviación anotada | |
| Frontend Vercel | Vercel Hobby | PENDIENTE | |
| Seed demo | `network/scripts/seed-data.sh` | PARCIAL (stub día 12) | |

Actualizar la columna Estado al cerrar cada día, no al empezar.
