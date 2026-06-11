# Eval Studio v2 · convenience targets
.PHONY: help install dev backend frontend seed-smoke seed-bulk migrate test clean

help:
	@echo "Eval Studio · common targets"
	@echo ""
	@echo "  make install      one-shot: backend deps + frontend deps"
	@echo "  make dev          run backend + frontend together (uses concurrently)"
	@echo "  make backend      run FastAPI dev server only"
	@echo "  make frontend     run Vite dev server only"
	@echo ""
	@echo "  make migrate      apply Alembic migrations"
	@echo "  make seed-smoke   generate 8 sample cases (no DB write)"
	@echo "  make seed-bulk    generate 100 cases (30/20/20/30) + DB write"
	@echo ""
	@echo "  make test         pytest backend"
	@echo "  make clean        remove dist + caches + venv + DB"

install:
	cd backend && uv venv --python 3.11 .venv && uv pip install --python .venv/bin/python -e ".[dev]"
	npm install

dev:
	@echo "→ start backend with: cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000"
	@echo "→ start frontend with: npm run dev"

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	npm run dev

migrate:
	cd backend && DATABASE_URL='' .venv/bin/python -m alembic upgrade head

seed-smoke:
	cd backend && DATABASE_URL='' .venv/bin/python -m app.fixtures.seed --smoke

seed-bulk:
	cd backend && DATABASE_URL='' .venv/bin/python -m app.fixtures.seed --financial 30 --compliance 20 --research 20 --fraud 30

seed-load:
	cd backend && DATABASE_URL='' .venv/bin/python -m app.fixtures.load_from_json

test:
	cd backend && .venv/bin/pytest -v

clean:
	rm -rf node_modules dist .vite
	rm -rf backend/.venv backend/__pycache__ backend/data
	find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
