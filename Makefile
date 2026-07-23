.DEFAULT_GOAL := help
COMPOSE := docker compose
DEV_PROFILE := --profile dev
PROD_PROFILE := --profile prod
ALL_PROFILES := $(DEV_PROFILE) $(PROD_PROFILE)
UID := $(shell id -u)
GID := $(shell id -g)

export UID
export GID

.PHONY: help dev dev-build dev-down dev-logs prod prod-build prod-down prod-logs down clean test test-server test-front test-watch-server test-watch-front node_modules-server node_modules-front

help: ## Affiche cette aide
	@printf "\n"
	@printf "\033[1;38;5;216mRED PIECE\033[0m\n"
	@printf "\033[2mCompose: %s\033[0m\n\n" "$(COMPOSE)"
	@printf "\033[1mDevelopment\033[0m\n"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev" "Lance la stack dev complete"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev-build" "Rebuild les images du profil dev"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev-logs" "Suit les logs de la stack dev"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev-down" "Stoppe la stack dev"
	@printf "\n"
	@printf "\033[1mProduction\033[0m\n"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod" "Lance toute la stack active du profil prod"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod-build" "Rebuild toutes les images du profil prod"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod-logs" "Suit les logs de la stack prod"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod-down" "Stoppe la stack prod"
	@printf "\n"
	@printf "\033[1mTests\033[0m\n"
	@printf "  \033[36m%-18s\033[0m %s\n" "test" "Lance TOUT: serveur puis frontend, avec couverture"
	@printf "  \033[36m%-18s\033[0m %s\n" "test-server" "Tests + couverture du serveur uniquement"
	@printf "  \033[36m%-18s\033[0m %s\n" "test-front" "Tests + couverture du frontend uniquement"
	@printf "  \033[36m%-18s\033[0m %s\n" "test-watch-server" "Tests du serveur en mode watch"
	@printf "  \033[36m%-18s\033[0m %s\n" "test-watch-front" "Tests du frontend en mode watch"
	@printf "\n"
	@printf "\033[1mMaintenance\033[0m\n"
	@printf "  \033[36m%-12s\033[0m %s\n" "down" "Stoppe les stacks dev et prod sans supprimer les volumes"
	@printf "  \033[36m%-12s\033[0m %s\n" "clean" "Supprime les conteneurs, reseaux, volumes et orphelins"
	@printf "\n"

dev: ## Lance la stack dev (frontend, backend, db, pgadmin)
	$(COMPOSE) $(DEV_PROFILE) up --build

dev-build: ## Rebuild les images du profil dev
	$(COMPOSE) $(DEV_PROFILE) build

dev-down: ## Stoppe la stack dev
	$(COMPOSE) $(DEV_PROFILE) down --remove-orphans

dev-logs: ## Suit les logs de la stack dev
	$(COMPOSE) $(DEV_PROFILE) logs -f

prod: ## Lance la stack prod complete
	$(COMPOSE) $(PROD_PROFILE) up --build

prod-build: ## Rebuild les images du profil prod
	$(COMPOSE) $(PROD_PROFILE) build

prod-down: ## Stoppe la stack prod
	$(COMPOSE) $(PROD_PROFILE) down --remove-orphans

prod-logs: ## Suit les logs de la stack prod
	$(COMPOSE) $(PROD_PROFILE) logs -f

test: ## Lance les deux suites de tests + couverture (serveur puis frontend)
	@$(MAKE) --no-print-directory test-server
	@$(MAKE) --no-print-directory test-front
	@printf "\n\033[1;32mLes deux suites sont vertes.\033[0m\n"

test-server: node_modules-server ## Tests + couverture du serveur uniquement
	@printf "\n\033[1;38;5;216m>>> Tests serveur\033[0m\n"
	cd server && npm run test:coverage

test-front: node_modules-front ## Tests + couverture du frontend uniquement
	@printf "\n\033[1;38;5;216m>>> Tests frontend\033[0m\n"
	cd frontend && npm run test:coverage

test-watch-server: node_modules-server ## Tests du serveur en mode watch
	cd server && npm run test:watch

test-watch-front: node_modules-front ## Tests du frontend en mode watch
	cd frontend && npm run test:watch

# Les tests tournent hors Docker: on installe les dependances si elles manquent,
# sinon `npm run test` echoue avec un simple "vitest: not found".
node_modules-server:
	@[ -d server/node_modules ] || (printf "Installation des dependances serveur...\n" && cd server && npm ci)

node_modules-front:
	@[ -d frontend/node_modules ] || (printf "Installation des dependances frontend...\n" && cd frontend && npm ci)

down: ## Stoppe les stacks dev et prod sans supprimer les volumes
	$(COMPOSE) $(ALL_PROFILES) down --remove-orphans

clean: ## Supprime les conteneurs, reseaux, volumes et orphelins
	$(COMPOSE) $(ALL_PROFILES) down --volumes --remove-orphans