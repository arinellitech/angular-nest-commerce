# Production image for the NestJS API (Node 24, multi-stage).
# Build:  docker build -t commerce-api .
# Run:    docker run -p 8080:8080 --env-file .env -e PORT=8080 commerce-api
# Migrations run on start (docker/entrypoint.sh) — safe to run repeatedly.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/package.json ./
COPY --chown=app:app docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x docker/entrypoint.sh
USER app
EXPOSE 8080
ENTRYPOINT ["docker/entrypoint.sh"]
