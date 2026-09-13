PYTHON ?= python3

.PHONY: setup test test-contract test-integration test-worker run-api run-worker lint typecheck clean

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -e ".[dev]"

test:
	PYTHONDONTWRITEBYTECODE=1 COVERAGE_FILE=/tmp/curalina_variants.coverage $(PYTHON) -m pytest tests/unit -p no:cacheprovider

test-contract:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m pytest tests/contract -p no:cacheprovider --no-cov

test-integration:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m pytest tests/integration -p no:cacheprovider --no-cov

test-worker:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m pytest tests/worker -p no:cacheprovider --no-cov

run-api:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m curalina_variants.bootstrap api

run-worker:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m curalina_variants.bootstrap worker

lint:
	$(PYTHON) -m ruff check --no-cache .

typecheck:
	$(PYTHON) -m mypy --strict --cache-dir=/tmp/curalina_variants_mypy_cache src/curalina_variants

clean:
	rm -rf .pytest_cache .ruff_cache .mypy_cache htmlcov
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
