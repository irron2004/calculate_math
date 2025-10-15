.PHONY: install dev run test lint validate-dag be fe clean build up down

UVICORN_CMD := .venv/bin/python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
VITE_DEV_CMD := npm --prefix frontend run dev
CLEAN_TARGETS := .pytest_cache frontend/node_modules frontend/dist frontend/.vite
DOCKER_COMPOSE := docker compose

install:
	pip install -r requirements.txt

dev:
	pip install -r requirements-dev.txt

run:
	$(UVICORN_CMD)

be:
	$(UVICORN_CMD)

fe:
	$(VITE_DEV_CMD)

test:
	pytest -q

lint: validate-dag
	python -m compileall app

validate-dag:
	python scripts/validate_skill_graph.py

clean:
	rm -rf $(CLEAN_TARGETS)
	find app tests frontend -type d -name '__pycache__' -prune -exec rm -rf {} +

build:
	$(DOCKER_COMPOSE) up --build -d

up:
	$(DOCKER_COMPOSE) up -d

down:
	$(DOCKER_COMPOSE) down
