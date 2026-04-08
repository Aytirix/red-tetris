.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help dev dev-build dev-down dev-logs prod prod-build prod-down prod-logs  backend-dev backend-dev-build down clean

help: ## Affiche cette aide
	@printf "\n"
	@printf "\033[1;38;5;216mRED TETRIS\033[0m\n"
	@printf "\033[2mCompose: %s\033[0m\n\n" "$(COMPOSE)"
	@printf "\033[1mDevelopment\033[0m\n"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev" "Lance le frontend et le backend avec hot reload"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev-build" "Rebuild l'image de developpement"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev-logs" "Suit les logs du frontend dev"
	@printf "  \033[36m%-12s\033[0m %s\n" "dev-down" "Stoppe le service frontend dev"
	@printf "  \033[36m%-12s\033[0m %s\n" "backend-dev" "Lance le backend en mode dev avec hot reload"
	@printf "  \033[36m%-12s\033[0m %s\n" "backend-dev-build" "Rebuild l'image backend dev"
	@printf "\n"
	@printf "\033[1mProduction\033[0m\n"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod" "Lance le frontend et le backend en mode production"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod-build" "Rebuild l'image de production"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod-logs" "Suit les logs du frontend prod"
	@printf "  \033[36m%-12s\033[0m %s\n" "prod-down" "Stoppe le service frontend prod"
	@printf "\n"
	@printf "\033[1mMaintenance\033[0m\n"
	@printf "  \033[36m%-12s\033[0m %s\n" "down" "Stoppe dev et prod sans supprimer les volumes"
	@printf "  \033[36m%-12s\033[0m %s\n" "clean" "Supprime conteneurs, reseaux, volumes et orphelins"
	@printf "\n"

dev: ## Lance le frontend en mode dev avec hot reload
	$(COMPOSE) --profile dev up --build frontend-dev

dev-build: ## Rebuild l'image frontend dev
	$(COMPOSE) --profile dev build frontend-dev

dev-down: ## Stoppe le service frontend dev
	$(COMPOSE) --profile dev down

dev-logs: ## Suit les logs du frontend dev
	$(COMPOSE) logs -f frontend-dev

prod: ## Lance le frontend en mode production
	$(COMPOSE) --profile prod up --build frontend-prod

prod-build: ## Rebuild l'image frontend prod
	$(COMPOSE) --profile prod build frontend-prod

prod-down: ## Stoppe le service frontend prod
	$(COMPOSE) --profile prod down

prod-logs: ## Suit les logs du frontend prod
	$(COMPOSE) logs -f frontend-prod

####################
# Services backend #
####################

backend-dev: ## Lance le backend en mode dev avec hot reload
	$(COMPOSE) --profile dev up --build backend-dev db adminer

backend-dev-build: ## Rebuild l'image backend dev db adminer
	$(COMPOSE) --profile dev build backend-dev

down: ## Stoppe les services dev et prod
	$(COMPOSE) --profile dev --profile prod down --remove-orphans

clean: ## Supprime les conteneurs, reseaux et volumes Docker Compose
	$(COMPOSE) --profile dev --profile prod down --volumes --remove-orphans