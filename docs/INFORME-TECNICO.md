# Informe técnico (factual)

Pareja del informe en metáforas: [INFORME-PROGRESO.md](INFORME-PROGRESO.md).
Checklist: [CHECKLIST.md](CHECKLIST.md). Fecha: 30 ago 2026.

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

## Git (30 ago 2026)

```
df -T ~/ute/app
  /dev/sdd  ext4  ...  / 

git log --oneline --decorate -3
  42374c9 (HEAD -> develop, origin/develop) Mark
  b02db9f Unify
  c08b7c2 (origin/main) Initial commit   # main desfasado; se alinea en el mismo día

git remote -v
  origin  https://github.com/pasangel830-sketch/UTE_BlockChain.git (fetch)
  origin  https://github.com/pasangel830-sketch/UTE_BlockChain.git (push)
```

Remoto real: `pasangel830-sketch/UTE_BlockChain` (no `ute-blockchain-tfm`). `gh` CLI no está instalado en WSL; el push usa `git` + credenciales ya configuradas. Colaborador `DomingoMr`: pendiente de invitación (API collaborators 403 con el token de Cursor).

Antes del primer commit (misma mañana): `git log` vacío, `git remote -v` vacío. Eso ya no aplica.

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
