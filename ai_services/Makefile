PYTHON ?= python3
SERVICES := design_rules recommendation variant_generator room_generator

.PHONY: setup-all test-all test-contracts run-suite clean

setup-all:
	$(MAKE) -C design_rules setup
	$(MAKE) -C recommendation setup
	$(MAKE) -C variant_generator setup
	$(MAKE) -C room_generator setup

test-all:
	$(MAKE) -C design_rules test
	$(MAKE) -C recommendation test
	$(MAKE) -C variant_generator test
	$(MAKE) -C room_generator test

test-contracts:
	$(PYTHON) -m pytest contracts/tests tests -p no:cacheprovider

run-suite:
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m suite_client

clean:
	$(MAKE) -C design_rules clean
	$(MAKE) -C recommendation clean
	$(MAKE) -C variant_generator clean
	$(MAKE) -C room_generator clean
	rm -rf contracts/.pytest_cache
