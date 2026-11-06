# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# Só o que a API precisa do monorepo
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@^2 prune @nexo/api --docker

FROM base AS builder
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=@nexo/api...

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
COPY --from=builder --chown=node:node /app /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- http://127.0.0.1:4000/health || exit 1
# Migrations (e seed se o banco estiver vazio) antes de subir o servidor
CMD ["sh", "-c", "node packages/db/dist/bootstrap.js && node apps/api/dist/server.js"]