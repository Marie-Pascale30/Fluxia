# syntax=docker/dockerfile:1
# Image de production du web (sortie Next « standalone »). À construire depuis la racine :
#   docker build -f apps/web/Dockerfile -t fluxia-web .
FROM node:24-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /repo
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/root/.npm npm ci --fetch-retries=5 --fetch-retry-mintimeout=20000 && npm run build -w web

FROM node:24-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
