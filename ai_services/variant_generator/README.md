# curalina_variants

HTTP plus worker service scaffold for Curalina visual variants, intended for
local port `8102`.

A0 contains no image processing, mask logic, model loading, or job execution.
It only establishes the package, immutable settings, command surface, and
smoke tests.

```bash
make setup
make test
make test-contract
make test-integration
make run-api
make run-worker
make test-worker
```
