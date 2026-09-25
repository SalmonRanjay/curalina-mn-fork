# composite renderer sidecar: CPU-only Pillow, no model.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SERVICE_PORT=8105 \
    SUPPLIER_IMAGES_DIR=/data/supplier_images

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn pillow pydantic numpy

COPY pyproject.toml README.md /app/
COPY src /app/src
RUN pip install --no-cache-dir --no-deps /app

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8105/healthz', timeout=2)" || exit 1

EXPOSE 8105
CMD ["python3", "-m", "curalina_composite.main"]
