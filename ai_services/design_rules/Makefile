PYTHON ?= python3

.PHONY: setup test lint typecheck check clean

setup:
	$(PYTHON) -m pip install --upgrade pip
	$(PYTHON) -m pip install -e ".[dev]"

test:
	PYTHONDONTWRITEBYTECODE=1 COVERAGE_FILE=/tmp/curalina_design_rules.coverage $(PYTHON) -m pytest -p no:cacheprovider

lint:
	$(PYTHON) -m ruff check --no-cache .

typecheck:
	$(PYTHON) -m mypy --strict --cache-dir=/tmp/curalina_design_rules_mypy_cache src/curalina_design_rules

check: lint typecheck test

clean:
	rm -rf .pytest_cache .ruff_cache .mypy_cache htmlcov
	find . -type d -name "__pycache__" -prune -exec rm -rf {} +
