COMPOSE_DEV := docker compose -f network/docker-compose.dev.yaml
COMPOSE_FULL := docker compose -f network/docker-compose.full.yaml
COMPOSE_MON := docker compose -f monitoring/docker-compose.yaml
COMPOSE_MON_PROD := docker compose -f monitoring/docker-compose.prod.yaml
COMPOSE_PROD := docker compose -f network/docker-compose.production.yaml
ART_BLOCKS := network/channel-artifacts/*.block network/channel-artifacts/*.tx channel-obra.block

.PHONY: crypto crypto-prod channel-dev channel-full channel-prod up-dev down-dev logs-dev up-full down-full logs-full up-prod down-prod logs-prod verify-full reset-dev reset-full reset-demo-dev reset-demo-full clean-offchain seed monitoring-up monitoring-down monitoring-up-prod monitoring-down-prod ps clean-artifacts test-cc deploy-hito deploy-pago deploy-incidencia deploy-estado deploy-cc deploy-cc-prod init-pago init-estado verify-cc verify-api verify-pdc verify-ui api-up api-down ui-up pdc-up pdc-down

crypto:
	./network/scripts/generate-crypto.sh

crypto-prod:
	@if [ -f network/.env ]; then set -a && . ./network/.env && set +a; fi; \
	./network/scripts/generate-crypto-prod.sh

channel-dev:
	./network/scripts/create-channel.sh dev

channel-full:
	./network/scripts/create-channel.sh full

channel-prod:
	./network/scripts/create-channel.sh prod

up-dev:
	$(COMPOSE_FULL) down --remove-orphans || true
	./network/scripts/generate-crypto.sh
	$(COMPOSE_DEV) up -d
	./network/scripts/create-channel.sh dev

down-dev:
	$(COMPOSE_DEV) down --remove-orphans

logs-dev:
	$(COMPOSE_DEV) logs -f --tail=100

up-full:
	$(COMPOSE_DEV) down --remove-orphans || true
	./network/scripts/generate-crypto.sh
	$(COMPOSE_FULL) up -d
	./network/scripts/create-channel.sh full

down-full:
	$(COMPOSE_FULL) down --remove-orphans

logs-full:
	$(COMPOSE_FULL) logs -f --tail=100

up-prod:
	set -e; \
	if [ -f network/.env ]; then set -a && . ./network/.env && set +a; fi; \
	test -n "$$STATIC_IP" || { echo "STATIC_IP obligatorio (export o network/.env)"; exit 1; }; \
	test -n "$$JWT_SECRET" || { echo "JWT_SECRET obligatorio"; exit 1; }; \
	if [ "$${STORAGE_DRIVER:-gcs}" = gcs ]; then test -n "$$GCS_BUCKET" || { echo "GCS_BUCKET obligatorio con STORAGE_DRIVER=gcs"; exit 1; }; fi; \
	$(COMPOSE_DEV) down --remove-orphans || true; \
	$(COMPOSE_FULL) down --remove-orphans || true; \
	docker compose -f network/docker-compose.api.yaml down --remove-orphans || true; \
	if [ "$${FORCE:-0}" = "1" ]; then \
	  $(COMPOSE_PROD) down -v --remove-orphans || true; \
	  rm -f network/channel-artifacts/channel-obra.prod.block; \
	else \
	  $(COMPOSE_PROD) down --remove-orphans || true; \
	fi; \
	./network/scripts/generate-crypto-prod.sh; \
	if [ -s "$(HOME)/.nvm/nvm.sh" ]; then \
	  (. $(HOME)/.nvm/nvm.sh && nvm use 24 && cd backend && (test -f package-lock.json && npm ci || npm install) && npm run build); \
	else \
	  docker run --rm -v "$(CURDIR)/backend:/app" -w /app node:24.20.0-bookworm bash -c 'npm ci && npm run build'; \
	fi; \
	$(COMPOSE_PROD) up -d --build; \
	./network/scripts/create-channel.sh prod

down-prod:
	$(COMPOSE_PROD) down --remove-orphans

logs-prod:
	$(COMPOSE_PROD) logs -f --tail=100

verify-full:
	./network/scripts/verify-full.sh

clean-artifacts:
	rm -f $(ART_BLOCKS)

reset-dev:
	$(COMPOSE_FULL) down -v --remove-orphans || true
	$(COMPOSE_DEV) down -v --remove-orphans || true
	-docker ps -aq --filter 'name=dev-peer' | xargs -r docker rm -f
	rm -f $(ART_BLOCKS)
	./network/scripts/generate-crypto.sh
	$(COMPOSE_DEV) up -d
	./network/scripts/create-channel.sh dev

reset-full:
	$(COMPOSE_DEV) down -v --remove-orphans || true
	$(COMPOSE_FULL) down -v --remove-orphans || true
	-docker ps -aq --filter 'name=dev-peer' | xargs -r docker rm -f
	rm -f $(ART_BLOCKS)
	./network/scripts/generate-crypto.sh
	$(COMPOSE_FULL) up -d
	./network/scripts/create-channel.sh full

clean-offchain:
	mkdir -p backend/uploads
	docker run --rm -v "$(CURDIR)/backend/uploads:/uploads" node:24.20.0-bookworm bash -c 'find /uploads -mindepth 1 -delete'

# Red nueva para demo: baja API primero (Explorer en RAM), borra ledger y evidencias, redespliega CC.
reset-demo-dev:
	$(MAKE) api-down
	$(MAKE) pdc-down
	$(MAKE) monitoring-down
	$(MAKE) clean-offchain
	$(MAKE) reset-dev
	$(MAKE) deploy-cc
	$(MAKE) api-up

reset-demo-full:
	$(MAKE) api-down
	$(MAKE) pdc-down
	$(MAKE) monitoring-down
	$(MAKE) clean-offchain
	$(MAKE) reset-full
	$(MAKE) deploy-cc
	$(MAKE) api-up

seed:
	./network/scripts/seed-data.sh

monitoring-up:
	@docker network inspect ute-net >/dev/null 2>&1 || (echo "ute-net no existe: make up-dev o up-full primero"; exit 1)
	$(COMPOSE_MON) up -d

monitoring-down:
	$(COMPOSE_MON) down --remove-orphans

monitoring-up-prod:
	set -e; \
	if [ -f monitoring/.env ]; then set -a && . ./monitoring/.env && set +a; fi; \
	$(COMPOSE_MON_PROD) --profile alert-demo up -d

monitoring-down-prod:
	$(COMPOSE_MON_PROD) --profile alert-demo down --remove-orphans

ps:
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

test-cc:
	. $(HOME)/.nvm/nvm.sh && nvm use 18 && cd chaincode/hito && npm test
	. $(HOME)/.nvm/nvm.sh && nvm use 18 && cd chaincode/pago && npm test
	. $(HOME)/.nvm/nvm.sh && nvm use 18 && cd chaincode/incidencia && npm test
	. $(HOME)/.nvm/nvm.sh && nvm use 18 && cd chaincode/estado-obra && npm test

deploy-hito:
	./network/scripts/deploy-chaincode.sh hito "OR('EmpresaAMSP.peer','EmpresaBMSP.peer','EmpresaCMSP.peer','EmpresaDMSP.peer')"

deploy-pago:
	./network/scripts/deploy-chaincode.sh pago "OR(AND('EmpresaAMSP.peer','AdministracionMSP.peer'),AND('EmpresaBMSP.peer','AdministracionMSP.peer'),AND('EmpresaCMSP.peer','AdministracionMSP.peer'),AND('EmpresaDMSP.peer','AdministracionMSP.peer'))"

deploy-incidencia:
	./network/scripts/deploy-chaincode.sh incidencia

deploy-estado:
	./network/scripts/deploy-chaincode.sh estado-obra "OR('EmpresaAMSP.peer','EmpresaBMSP.peer','EmpresaCMSP.peer','EmpresaDMSP.peer','AdministracionMSP.peer')"

deploy-cc: deploy-hito deploy-pago deploy-incidencia deploy-estado
	./network/scripts/init-pago.sh
	./network/scripts/init-estado.sh

deploy-cc-prod:
	INSTALL_PDC_PEERS=1 FABRIC_MODE=prod $(MAKE) deploy-cc

init-pago:
	./network/scripts/init-pago.sh

init-estado:
	./network/scripts/init-estado.sh

verify-cc:
	./network/scripts/verify-hito-pago.sh

verify-api:
	./network/scripts/verify-api.sh

verify-pdc:
	./network/scripts/verify-pdc.sh

verify-ui:
	./network/scripts/verify-ui.sh

api-up:
	. $(HOME)/.nvm/nvm.sh && nvm use 24 && cd backend && (test -f package-lock.json && npm ci || npm install) && npm run build
	docker compose -f network/docker-compose.api.yaml up -d --force-recreate

api-down:
	docker compose -f network/docker-compose.api.yaml down --remove-orphans

ui-up:
	. $(HOME)/.nvm/nvm.sh && nvm use 24 && cd frontend && (test -f package-lock.json && npm ci || npm install) && npm run dev

pdc-up:
	docker compose -f network/docker-compose.pdc.yaml up -d
	./network/scripts/join-pdc-peers.sh

pdc-down:
	docker compose -f network/docker-compose.pdc.yaml down --remove-orphans
