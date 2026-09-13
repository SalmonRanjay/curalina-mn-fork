# curalina_rooms

HTTP plus worker service scaffold for Curalina room rendering, intended for
local port `8103`.

A0 contains no rendering, homography, image editing, model loading, or job
execution. It only establishes the package, immutable settings, command
surface, and smoke tests.

```bash
make setup
make test
make test-contract
make test-integration
make run-api
make run-worker
make test-worker
```
