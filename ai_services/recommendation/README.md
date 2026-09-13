# curalina_recommendation

Synchronous recommendation HTTP service scaffold for Curalina, intended for
local port `8101`.

A0 contains no recommendation, ranking, import, or bundle-composition logic.
It only establishes the package, immutable settings, command surface, and
smoke tests.

```bash
make setup
make test
make test-contract
make test-integration
make run-api
```
