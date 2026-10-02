# syntax=docker/dockerfile:1
# Image de production de l'API. À construire depuis la racine du dépôt :
#   docker build -f apps/api/Dockerfile -t fluxia-api .
FROM node:24-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /repo
COPY . .
RUN --mount=type=cache,target=/root/.npm npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 && npm run build -w api

# Dépendances d'exécution uniquement (la CLI Prisma sert aux migrations au démarrage)
FROM node:24-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --fetch-retries=5 --omit=dev --ignore-scripts -w api -w @fluxia/shared \
    && cd apps/api && npx prisma version

FROM node:24-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/storage
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/dist packages/shared/dist
WORKDIR /repo/apps/api
COPY --from=build /repo/apps/api/package.json /repo/apps/api/prisma.config.ts ./
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/dist ./dist
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
