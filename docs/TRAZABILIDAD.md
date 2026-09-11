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
| Escrow / fondos custodiados (§4.2) | PagoContract + API; `completarHito` → `invokeChaincode` pago (11 sep) | HECHO (día 5; mismo tx 11 sep, Jest) | funcional |
| Evento `PagoAutorizado` + integración bancaria | listener Express + `POST /mock/banco/pagos` | HECHO (día 6) | funcional |
| Endorsement pago org + Administración | política al hacer commit del CC | HECHO `OR(AND(A,Admin), AND(B,Admin), AND(C,Admin), AND(D,Admin))`; API pide el par de la empresa del hito | |
| Incidencias 2 de 5 | IncidenciaContract OutOf(2,5) | HECHO (día 8) | |
| Evidencias (foto/PDF) + hash | `POST /incidencias/:id/evidencias`; SHA-256 en PDC `notasTecnicas`; binario fuera de cadena | HECHO (11 sep, working tree) | funcional |
| Estado de obra | EstadoObraContract alimentado por backend (sin cross-cc) | HECHO (día 9) | |
| API JWT, multer, Swagger, prom-client | `backend/` | HECHO (día 6; evidencias ancladas 11 sep) | |
| Frontend 7 pantallas + Explorer | `frontend/` | HECHO (días 7 y 9; detalle txs y 5 sesiones 31 ago; evidencias y fechas 11 sep) | |
| Separación de funciones (API) | `backend/src/routes.ts` guardas de rol | HECHO (31 ago autorizar; 6 sep avance hito, rechazar pago, creadora incidencia; 9 sep empresa del hito; 11 sep adjunto/socio evidencia) | funcional |
| Repo GitHub compartido con DomingoMr | `pasangel830-sketch/UTE_BlockChain` (`main`) | PARCIAL (remoto HECHO; falta invitar `DomingoMr`) | Fase 2 |
| README detallado con diagramas | `README.md` | HECHO (días 7 y 9) | Fase 2 |
| Monitorización: peer caído, bloque > 5 s, endorsement > 5 % | `monitoring/alerts.yml` + Grafana | PARCIAL (definido; demo día 13) | **1** |
| Prometheus alcanza peers/orderers | red `ute-net`, puertos 9444–9448 / 8443–8445 | HECHO compose | |
| Despliegue API (PDF: Railway/Render) | VM `fabric-ute`; [MEMORIA-NOTAS.md](MEMORIA-NOTAS.md) | PENDIENTE deploy; desviación anotada | |
| Frontend Vercel | Vercel Hobby | PENDIENTE | |
| Seed demo | `network/scripts/seed-data.sh` | PARCIAL (stub día 12) | |

Actualizar la columna Estado al cerrar cada día, no al empezar.
