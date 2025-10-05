.PHONY: install dev run test lint

install:
	pip install -r requirements.txt

dev:
	pip install -r requirements-dev.txt

run:
	uvicorn app:app --host 0.0.0.0 --port 8000 --reload

test:
	pytest -q

lint:
	python -m compileall app
