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

## Git (30 ago 2026, antes del primer commit)

```
git log     → does not have any commits yet
git remote -v → (vacío)
gh auth status → not logged into any GitHub hosts
```

Acción: primer commit local tras v5. Push: bloqueado hasta `gh auth login` y crear `ute-blockchain-tfm` (invitar `DomingoMr`).

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
- `make up-dev` ejecuta `full down` antes. `reset-*` borra `channel-artifacts/*.block`.
- Monitoring: red externa `ute-net`, `extra_hosts: host-gateway`, `alerts.yml`, provisioning Grafana.

Pendiente de ejecutar en ext4: `make reset-dev` (el bloque `channel-obra.block` actual es génesis UteDev de 2 orgs; no reutilizar).

## Monitorización (definido, no demostrado en runtime)

Alertas en `monitoring/alerts.yml`:

1. `PeerCaido` — `up{job="fabric-peers", role="required"} == 0`
2. `LatenciaBloqueAlta` — p99 `ledger_block_processing_time` > 5s
3. `ErrorEndorsementAlto` — ratio success=false > 5 %

Demostración con tráfico: día 13.

## Siguiente medición a pegar aquí

```
df -T ~/ute/app
git log -1 --oneline
git remote -v
make reset-dev
docker ps --format "table {{.Names}}\t{{.Status}}"
docker stats --no-stream
```
