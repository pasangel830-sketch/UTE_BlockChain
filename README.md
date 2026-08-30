# UTE_BlockChain

Plataforma de Gestión de Uniones Temporales de Empresas (UTE) con Trazabilidad Blockchain.

Registro compartido de hitos, pagos (con escrow) e incidencias. Hyperledger Fabric 2.5, API Express, frontend Next.js.

**Estado y tareas:** [docs/CHECKLIST.md](docs/CHECKLIST.md)  
**Rúbrica → código:** [docs/TRAZABILIDAD.md](docs/TRAZABILIDAD.md)  
**Desviaciones del PDF (memoria):** [docs/MEMORIA-NOTAS.md](docs/MEMORIA-NOTAS.md)

## Arquitectura

```mermaid
flowchart LR
  subgraph ui [Vercel]
    Next[Next.js]
  end
  subgraph vm [VM fabric-ute]
    API[Express + Gateway]
    WH[Mock banco /mock/banco/pagos]
    P[Peers A-D + Admin]
    O[Orderers Raft x3]
    API -->|gRPC TLS| P
    API -->|evento PagoAutorizado| WH
    P --> O
  end
  subgraph mon [VM monitoring-ute]
    Prom[Prometheus]
    Graf[Grafana]
    Prom --> P
    Prom --> O
    Prom --> API
    Graf --> Prom
  end
  Next -->|HTTPS JWT| API
```

Diario en el portátil: mismos MSP y políticas; solo arrancan 3 orderers + peer Empresa A + peer Administración (`make up-dev`). Full añade peers B/C/D (`make up-full`). PDC de quirófanos: `make pdc-up` (B/C/D un rato, mismo canal).

## Políticas (canal `UteFull`, 5 orgs)

| Qué | Política | Satisfacible con A+Admin |
| --- | --- | --- |
| Lifecycle (approve/commit) | OutOf(2, 5) | sí |
| Pago | org + Administración | sí |
| Incidencia | OutOf(2, 5) | sí |
| PDC `obra-gruesa-solar` | A o C, `requiredPeerCount: 0` | endoso A con C apagado |
| PDC `quirofanos-tech` | B o D | hace falta peer B o D (perfil full) |

## Árbol

```
network/      Fabric (compose, configtx, scripts)
chaincode/    4 contratos TypeScript (Node 18)
backend/      Express + fabric-gateway (Node 24)
frontend/     Next.js
monitoring/   Prometheus + Grafana (red ute-net)
docs/         CHECKLIST.md es la fuente de verdad
```

## Requisitos locales

- Windows 11 + WSL2 Ubuntu 22.04. **Repo en ext4:** `~/ute/app`, no `C:\Proyectos\...`.
- Cursor: abrir `\\wsl$\Ubuntu-22.04\home\<usuario>\ute\app`.
- Docker Engine en Ubuntu (no Desktop).
- Node 24.20.0 y 18.20.8 (nvm). Fabric 2.5.16 en `PATH`.

## Comandos

```bash
make up-dev          # 3 orderers + A + Admin + canal UteFull
make down-dev
make up-full         # baja dev; 5 peers + 3 orderers
make verify-full
make reset-dev       # down -v, borra *.block, crypto si hace falta, up
make monitoring-up   # requiere ute-net (Fabric ya arriba)
make seed            # día 12; hoy es stub
make test-cc         # Jest 4 contratos (Node 18)
make deploy-cc       # hito+pago+incidencia+estado-obra en A+Admin; InitLedger
make api-up          # Express :4000 en ute-net
make api-down
make ui-up           # Next 15.5 :3000  NEXT_PUBLIC_API_URL=http://localhost:4000
make pdc-up          # peers B/C/D un rato; join + approve incidencia
make pdc-down
make verify-pdc
./network/scripts/verify-api.sh
./network/scripts/verify-ui.sh
```

Certificados: `network/organizations/` (no se suben). Regenerar: `FORCE=1 ./network/scripts/generate-crypto.sh`.

## Rebanada vertical (días 4–7)

Flujo local: UI → API :4000 → Hito + Pago → Explorer (polling 3 s).

```mermaid
sequenceDiagram
  participant U as Next :3000
  participant A as API :4000
  participant H as HitoContract
  participant P as PagoContract
  participant E as Explorer
  participant B as Mock banco
  U->>A: login JWT
  U->>A: POST /hitos
  A->>H: crearHito PENDIENTE
  U->>A: iniciar → validar → completar
  A->>H: completarHito COMPLETADO
  A->>P: ponerEnCustodia
  P-->>A: CUSTODIA
  U->>A: POST /pagos/:id/autorizar
  P-->>A: evento PagoAutorizado
  A->>B: POST /mock/banco/pagos
  U->>A: GET /explorer (cada 3 s)
  A-->>E: altura + bloques
```

`NEXT_PUBLIC_API_URL=http://localhost:4000`. Pantallas Next (7): `/` login, `/dashboard`, `/hitos` (hitos+pagos+Explorer), `/pagos`, `/incidencias`, `/estado`, `/explorer`.

## Flujo de pago (objetivo de demo)

```mermaid
sequenceDiagram
  participant U as UI
  participant A as API
  participant H as HitoContract
  participant P as PagoContract
  participant B as Mock banco
  U->>A: completar hito
  A->>H: completarHito
  H-->>A: COMPLETADO
  A->>P: poner en CUSTODIA (escrow)
  P-->>A: evento PagoAutorizado
  A->>B: POST /mock/banco/pagos
```

## Estado de obra (día 9)

EstadoObraContract guarda un JSON agregado. El backend lo calcula (hitos, pagos, incidencias) y hace `submit escribirEstado`. No hay `invokeChaincode` entre contratos.

## Monitorización

Tres alertas (PDF): peer caído, latencia de bloque > 5 s, error de endorsement > 5 %. Definidas en `monitoring/alerts.yml`. Grafana provisionado en `monitoring/grafana/`.

## Licencia / visibilidad

Repo privado de TFM. Invitar a `DomingoMr`. Sin secretos en Git.
