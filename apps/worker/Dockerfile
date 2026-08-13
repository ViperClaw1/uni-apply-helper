FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl xvfb x11vnc tini \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.10.0 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# Chromium + OS deps — only invalidates when package.json / lockfile change,
# NOT on every source code deploy (was the 10min bottleneck).
FROM deps AS playwright

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN for i in 1 2 3; do pnpm --filter worker exec playwright install --with-deps chromium && break || { echo "playwright install failed (attempt $i), retrying..." >&2; sleep 5; }; done

FROM deps AS build

ENV CI=true

COPY . .

RUN pnpm --filter @uni-apply/shared build \
  && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uni_apply" pnpm --filter @uni-apply/database exec prisma generate \
  && pnpm --filter @uni-apply/database build \
  && pnpm --filter worker build \
  && pnpm prune --prod --config.confirmModulesPurge=false \
  && pnpm install --prod --frozen-lockfile

# Keep apt libs from --with-deps; browsers live outside /app.
FROM playwright AS runner

ENV APP=worker
ENV UNI_APPLY_RUNTIME=worker
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=build /app /app

RUN chmod +x apps/worker/docker/entrypoint.sh

# tini as PID 1 so Xvfb/x11vnc (backgrounded in entrypoint.sh alongside the Node app) get
# signals forwarded and zombies reaped correctly — see plan: snug-rolling-mitten.md, Phase 1.
ENTRYPOINT ["tini", "--"]
CMD ["/app/apps/worker/docker/entrypoint.sh"]
