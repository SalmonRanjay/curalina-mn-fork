# sd15 renderer sidecar. CPU torch is the real path on the dev host (Intel Mac).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/hf_cache \
    SERVICE_PORT=8104

WORKDIR /app

RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir diffusers transformers accelerate safetensors peft \
    fastapi uvicorn pillow pydantic

COPY pyproject.toml README.md /app/
COPY src /app/src
RUN pip install --no-cache-dir --no-deps /app

RUN mkdir -p /hf_cache

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8104/healthz', timeout=2)" || exit 1

EXPOSE 8104
CMD ["python3", "-m", "curalina_sd15.main"]
