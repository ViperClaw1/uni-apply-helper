FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
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

FROM deps AS build

ENV CI=true

COPY . .

RUN pnpm --filter @uni-apply/shared build \
  && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uni_apply" pnpm --filter @uni-apply/database exec prisma generate \
  && pnpm --filter @uni-apply/database build \
  && pnpm --filter api build \
  && pnpm prune --prod --config.confirmModulesPurge=false \
  && pnpm install --prod --frozen-lockfile \
  && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uni_apply" pnpm --filter @uni-apply/database exec prisma generate \
  && pnpm --filter @uni-apply/database build

FROM base AS runner

ENV APP=api
ENV NODE_ENV=production

COPY --from=build /app /app

CMD ["pnpm", "--filter", "api", "start:prod"]

