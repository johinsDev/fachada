# Image for the per-tenant SiteSandbox container. Build context: the repo root.
FROM node:24-trixie-slim

# Helper binary used by @cloudflare/sandbox's Files API; tag = installed SDK version.
COPY --from=docker.io/cloudflare/sandbox:1.0.3 /usr/local/bin/sandbox-shim /usr/local/bin/sandbox-shim

RUN apt-get update \
  && apt-get install -y --no-install-recommends procps tar ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# The two template seeds with their dependencies installed once, so no session ever
# runs npm install. Sites link their node_modules to these.
COPY packages/templates/galias /opt/templates/galias
COPY packages/templates/pro /opt/templates/pro
RUN cd /opt/templates/galias && npm install --no-audit --no-fund \
  && cd /opt/templates/pro && npm install --no-audit --no-fund \
  && cd /opt/templates/galias && ./node_modules/.bin/astro build \
  && cd /opt/templates/pro && ./node_modules/.bin/astro build \
  && rm -rf /opt/templates/*/dist

RUN mkdir -p /workspace
WORKDIR /workspace
ENV ASTRO_TELEMETRY_DISABLED=1
CMD ["sleep", "infinity"]
