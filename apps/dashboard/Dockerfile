# Image du dashboard. Contexte de build : la racine du depot.
#
# Bun installe, Node construit et sert : Bun ne charge pas le runtime serveur
# precompile de Next 16 (« Expected CommonJS module to have a function
# wrapper »), et rend 500 sur toutes les routes.
ARG BUN_VERSION=1.3.11
ARG NODE_VERSION=22
# Aligne sur la devDependency turbo de la racine.
ARG TURBO_VERSION=2.10.12

# Elagage du monorepo au sous-ensemble dont le dashboard depend. Produit
# out/json (manifestes + bun.lock elagues) et out/full (les sources).
FROM oven/bun:${BUN_VERSION}-alpine AS pruner
ARG TURBO_VERSION
WORKDIR /repo
COPY . .
RUN bunx turbo@${TURBO_VERSION} prune @lumyx/dashboard --docker

# Les dependances seules. La couche ne contenant que des manifestes, elle
# reste valide tant que les dependances ne bougent pas -- toucher une source
# ne relance pas l'installation.
FROM oven/bun:${BUN_VERSION}-alpine AS deps
WORKDIR /repo
COPY --from=pruner /repo/out/json/ ./
# Le lockfile elague ne decrit que dashboard + ui, donc --frozen-lockfile
# tient, la ou le bun.lock du depot decrit aussi des workspaces prives absents
# d'un clone public.
RUN bun install --frozen-lockfile

FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=pruner /repo/out/full/ ./
# Next est appele directement plutot que par `turbo run` : turbo delegue
# l'execution des scripts au gestionnaire de paquets, et bun n'existe pas dans
# cette image. L'elagage, lui, a deja produit tout ce qu'il devait produire.
WORKDIR /repo/apps/dashboard
RUN node ../../node_modules/next/dist/bin/next build

FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0

RUN addgroup -S lumyx && adduser -S lumyx -G lumyx

# Sortie autoportante : Next n'y recopie que le sous-ensemble de node_modules
# qu'il a trace. Le static et le public ne sont pas dedans, d'ou les deux
# copies suivantes.
COPY --from=build --chown=lumyx:lumyx /repo/apps/dashboard/.next/standalone ./
COPY --from=build --chown=lumyx:lumyx /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=build --chown=lumyx:lumyx /repo/apps/dashboard/public ./apps/dashboard/public

USER lumyx
EXPOSE 3001
CMD ["node", "apps/dashboard/server.js"]
