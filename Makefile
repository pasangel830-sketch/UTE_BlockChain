COMPOSE_DEV := docker compose -f network/docker-compose.dev.yaml
COMPOSE_FULL := docker compose -f network/docker-compose.full.yaml
COMPOSE_MON := docker compose -f monitoring/docker-compose.yaml
COMPOSE_PROD := docker compose -f network/docker-compose.production.yaml
ART_BLOCKS := network/channel-artifacts/*.block network/channel-artifacts/*.tx channel-obra.block

.PHONY: crypto channel-dev channel-full up-dev down-dev logs-dev up-full down-full logs-full verify-full reset-dev reset-full seed monitoring-up monitoring-down ps clean-artifacts test-cc deploy-hito deploy-pago deploy-cc init-pago verify-cc verify-api api-up api-down

crypto:
	./network/scripts/generate-crypto.sh

channel-dev:
	./network/scripts/create-channel.sh dev

channel-full:
	./network/scripts/create-channel.sh full

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

verify-full:
	./network/scripts/verify-full.sh

clean-artifacts:
	rm -f $(ART_BLOCKS)

reset-dev:
	$(COMPOSE_FULL) down -v --remove-orphans || true
	$(COMPOSE_DEV) down -v --remove-orphans || true
	rm -f $(ART_BLOCKS)
	./network/scripts/generate-crypto.sh
	$(COMPOSE_DEV) up -d
	./network/scripts/create-channel.sh dev

reset-full:
	$(COMPOSE_DEV) down -v --remove-orphans || true
	$(COMPOSE_FULL) down -v --remove-orphans || true
	rm -f $(ART_BLOCKS)
	./network/scripts/generate-crypto.sh
	$(COMPOSE_FULL) up -d
	./network/scripts/create-channel.sh full

seed:
	./network/scripts/seed-data.sh

monitoring-up:
	@docker network inspect ute-net >/dev/null 2>&1 || (echo "ute-net no existe: make up-dev o up-full primero"; exit 1)
	$(COMPOSE_MON) up -d

monitoring-down:
	$(COMPOSE_MON) down --remove-orphans

ps:
	docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

test-cc:
	. $(HOME)/.nvm/nvm.sh && nvm use 18 && cd chaincode/hito && npm test
	. $(HOME)/.nvm/nvm.sh && nvm use 18 && cd chaincode/pago && npm test

deploy-hito:
	./network/scripts/deploy-chaincode.sh hito "OR('EmpresaAMSP.peer','AdministracionMSP.peer')"

deploy-pago:
	./network/scripts/deploy-chaincode.sh pago "AND('EmpresaAMSP.peer','AdministracionMSP.peer')"

deploy-cc: deploy-hito deploy-pago
	./network/scripts/init-pago.sh

init-pago:
	./network/scripts/init-pago.sh

verify-cc:
	./network/scripts/verify-hito-pago.sh

verify-api:
	./network/scripts/verify-api.sh

api-up:
	. $(HOME)/.nvm/nvm.sh && nvm use 24 && cd backend && (test -f package-lock.json && npm ci || npm install) && npm run build
	docker compose -f network/docker-compose.api.yaml up -d --force-recreate

api-down:
	docker compose -f network/docker-compose.api.yaml down --remove-orphans
