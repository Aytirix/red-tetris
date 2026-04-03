COMPOSE := docker compose

.PHONY: help dev dev-build dev-down dev-logs prod prod-build prod-down prod-logs down

help:
	@printf "\n"
	@printf "Targets disponibles:\n"
	@printf "  make dev        Lance le frontend en mode dev avec hot reload\n"
	@printf "  make dev-build  Rebuild l'image frontend dev\n"
	@printf "  make dev-down   Stoppe le service frontend dev\n"
	@printf "  make dev-logs   Suit les logs du frontend dev\n"
	@printf "  make prod       Lance le frontend en mode production\n"
	@printf "  make prod-build Rebuild l'image frontend prod\n"
	@printf "  make prod-down  Stoppe le service frontend prod\n"
	@printf "  make prod-logs  Suit les logs du frontend prod\n"
	@printf "  make down       Stoppe les services dev et prod\n"
	@printf "\n"

dev:
	$(COMPOSE) --profile dev up --build frontend-dev

dev-build:
	$(COMPOSE) --profile dev build frontend-dev

dev-down:
	$(COMPOSE) --profile dev down

dev-logs:
	$(COMPOSE) logs -f frontend-dev

prod:
	$(COMPOSE) --profile prod up --build frontend-prod

prod-build:
	$(COMPOSE) --profile prod build frontend-prod

prod-down:
	$(COMPOSE) --profile prod down

prod-logs:
	$(COMPOSE) logs -f frontend-prod

down:
	$(COMPOSE) --profile dev --profile prod down
