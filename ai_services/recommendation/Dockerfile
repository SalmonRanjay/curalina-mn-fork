# Multi-stage Dockerfile for recommendation service
# Builds efficiently, installs only runtime dependencies in final image

FROM python:3.14-slim as builder

WORKDIR /build

# Install system dependencies needed for Python package builds
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy and build the shared design_rules package. A regular (non-editable)
# install is required here: an editable install writes a .pth pointer back
# to /build/design_rules, which does not exist in the final stage once only
# site-packages and /app/design_rules are copied over.
COPY design_rules/ /build/design_rules/
RUN pip install --no-cache-dir /build/design_rules/

# Copy and build the recommendation service (same reasoning as above)
COPY recommendation/ /build/recommendation/
RUN pip install --no-cache-dir /build/recommendation/

# Final runtime image
FROM python:3.14-slim

WORKDIR /app

# Install only the runtime system dependencies
# openpyxl may need some support, but python:3.14-slim should suffice
RUN apt-get update && apt-get install -y --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy service source code (for PYTHONPATH references)
COPY --from=builder /build/design_rules /app/design_rules
COPY --from=builder /build/recommendation /app/recommendation

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CURALINA_ENV=docker \
    SERVICE_HOST=0.0.0.0

# Create directory for SQLite database persistence
RUN mkdir -p /data && chmod 755 /data

# Health check: curl the OpenAPI endpoint
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:${SERVICE_PORT:-8101}/openapi.json', timeout=2)" || exit 1

# Expose the service port (default 8101 for recommendation)
EXPOSE 8101

# Default command: start API server
# To start a worker, override ENTRYPOINT or CMD with "python3 -m curalina_recommendation.bootstrap worker"
ENTRYPOINT ["python3", "-m", "curalina_recommendation.bootstrap"]
