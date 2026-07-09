FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

RUN corepack enable

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS build

ARG APP=api
ENV APP=$APP

COPY . .

RUN pnpm --filter @uni-apply/shared build \
  && pnpm --filter @uni-apply/database build \
  && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/uni_apply" pnpm --filter @uni-apply/database generate \
  && pnpm --filter "$APP" build \
  && pnpm prune --prod

FROM base AS runner

ARG APP=api
ENV APP=$APP
ENV NODE_ENV=production

COPY --from=build /app /app

RUN if [ "$APP" = "worker" ]; then pnpm --filter worker exec playwright install --with-deps chromium; fi

CMD ["sh", "-c", "pnpm --filter \"$APP\" start:prod"]

