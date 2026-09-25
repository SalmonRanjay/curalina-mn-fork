The file you need is `pytorch_lora_weights.safetensors` from inside `curalina_lora.zip`. Right now the SD service can't load it, so I'll add that. First I'm reading the service code.

The health-check contract is fixed at three keys, so I'll remove the extra `lora` field and shorten the long lines.

All 8 tests pass and lint and types are clean. Now I'm rebuilding the SD container so it includes `peft`, so it's ready as soon as you drop the file in.

You need one file from the zip: `pytorch_lora_weights.safetensors`. I've added LoRA support to the SD service (committed as `825d3fe`), so you can now test it in the project.

**Steps:**
1. In Drive, download `curalina_lora.zip` and unzip it. Inside is `pytorch_lora_weights.safetensors` (about 6 MB).
2. Put that file in `ai_services/renderers/sd15/lora/`. The folder is git-ignored, so it won't be committed.
3. Restart the SD service with the LoRA switched on:
   ```bash
   SD15_LORA_PATH=/lora docker compose up -d --no-deps sd15_renderer
   ```
4. Test it directly. This takes about 6 minutes on your CPU:
   ```bash
   curl -s -D - -o lora_test.png -X POST localhost:8104/v1/render -H 'content-type: application/json' -d '{"schema_version":"1.0","prompt":"a bedroom with a bed and nightstands, organic modern style, bright and airy, interior design photo","negative_prompt":"people, text, watermark, low quality","width":512,"height":512,"seed":42,"brief":{"room_type":"Bedroom","style":"Organic Modern","atmosphere":"Bright & Airy","pattern":null}}'
   ```
   The response header `X-Model-Id` should end in `+lora`. Then open `lora_test.png`.
5. To go through the quiz and see the LoRA render, keep the same environment setting and restart the app.

**Behaviour to know about:**
- **Trigger word:** the service adds `crlnstyle` to every prompt automatically, so you don't type it.
- **No silent fallback:** if the file is missing or the path is wrong, the request returns a 503 error instead of quietly rendering without the LoRA.
- **Scale:** if the effect is too strong or weak, change it with `SD15_LORA_SCALE=0.7` (or 1.2) in the same command.
- **Weights already cached:** the base model was downloaded earlier, so the first request only loads it and doesn't download again.

To compare fairly, render once with the LoRA and once without, using the same seed. Send me both images and I'll help you judge whether more training is worth it.
