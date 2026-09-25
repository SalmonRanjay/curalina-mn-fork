# curalina-sd15

Stateless Stable Diffusion 1.5 renderer sidecar (ADR-0020 D3/D4). Not a
business service: no database, no jobs, one render per request.

- `GET /healthz` -> `{"status":"ok","renderer":"sd15","ready":bool}`. Always
  HTTP 200; `ready` is false until the model has loaded once (lazy load on the
  first `/v1/render`).
- `POST /v1/render` -> PNG bytes with `X-Renderer`, `X-Model-Id`,
  `X-Elapsed-Ms`, `X-Label`. Errors are flat `{code,message,retryable}`
  (422 bad input, 503 `model_unavailable`, 500 `render_failed`). Never a
  placeholder image.

Env: `SD15_MODEL_ID` (default `stable-diffusion-v1-5/stable-diffusion-v1-5`;
a smaller distilled model such as `nota-ai/bk-sdm-small` may be swapped in),
`SD15_STEPS` (20), `SD15_GUIDANCE` (7.5), `SERVICE_PORT` (8104).

## Resource notes

Docker Desktop needs >= 10 GB memory for SD 1.5 on CPU. A render takes roughly
1-4 minutes on CPU, and the first request also downloads ~4 GB of weights into
the `hf_cache` named volume (downloaded once).

## Tests

`pip install -e '.[dev]' && python -m pytest` - uses a fake pipeline; no torch,
network or model download.
