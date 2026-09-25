# curalina-composite

Stateless composite room renderer (no model, CPU-only Pillow). Draws a
procedural room shell (perspective walls, floor, skirting, window, palette from
`brief.atmosphere` and `brief.style`) and pastes REAL supplier product
cutouts, resized only (pixels are never edited), with soft shadows.

- `GET /healthz` -> `{"status":"ok","renderer":"composite","ready":bool}`
  (`ready` = supplier directory is mounted). Always HTTP 200.
- `POST /v1/render` -> PNG with `X-Renderer`, `X-Model-Id`, `X-Elapsed-Ms`,
  `X-Label`, and `X-Pieces` (JSON array of piece names, ASCII-escaped).
- Errors are flat `{code,message,retryable}`: 422 `invalid_request`,
  `unsupported_room_type|style|atmosphere`; 503 `no_catalogue_images` when no
  piece at all can be loaded; 500 `render_failed`. Never an empty room.

Supplier dir (`SUPPLIER_IMAGES_DIR`, default `/data/supplier_images`, read-only):
`LUXUS/Product Images/<NNN - Name>/*.png` (RGBA furniture cutouts, category from
the name) and `CELADON/<NNN - Title - SKU>/*.png` (wall art). ATRIANI is ignored.
Missing categories are skipped; the rest still renders.

Selection is deterministic from `seed` (sha256 of prompt when null). Sizes are
illustrative approximations, not to scale (see `render.py`).

Tests: `pip install -e '.[dev]' && python -m pytest` (tmp-dir fixtures only).
