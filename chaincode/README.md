# Chaincode (TypeScript, Node 18)

La rúbrica exige 4 chaincodes en TypeScript con tests unitarios.
Compilar a JS; `fabric-nodeenv:2.5` ejecuta Node 18 (`nvm use` este directorio).

| Contrato | Endorsement | Instalar en | Cuándo |
| --- | --- | --- | --- |
| HitoContract | org ejecutora | A + Admin (diario); más orgs en full si invocan | día 4 |
| PagoContract | org + Administración; escrow (custodia) | A + Admin | día 5 |
| IncidenciaContract | OutOf(2, 5) + PDC `obra-gruesa-solar` / `quirofanos-tech` | A + Admin diario; B/C/D con `make pdc-up` | día 8 |
| EstadoObraContract | escritura desde API (agregado, sin cross-cc) | A + Admin | día 9 |

No instalar 4 CC × 5 peers (20 contenedores `fabric-nodeenv`, ~2–3 GB extra).
PDC: `network/collections-config.json` (`requiredPeerCount: 0`).

Tests: Jest, sin red Fabric.

```bash
make test-cc                 # nvm 18, 4 contratos
make deploy-cc               # instala A+Admin, InitLedger pago + estado
make deploy-incidencia       # collections-config en approve/commit
make pdc-up                  # peers B/C/D un rato; join canal
make verify-pdc
make pdc-down
make verify-cc               # flujo hito→custodia→autorizar por CLI
```
