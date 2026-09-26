# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN --mount=type=secret,id=maptiler_api_key,required=false \
    VITE_MAPTILER_API_KEY="$(cat /run/secrets/maptiler_api_key 2>/dev/null || true)" \
    npm run build && npm run build:server

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    WALLPAPER_HOST=0.0.0.0 \
    WALLPAPER_PORT=8080 \
    WALLPAPER_STATIC_DIR=/app/dist \
    WALLPAPER_COUNTRIES_PATH=/app/countries.json \
    WALLPAPER_SETTINGS_PATH=/data/wallpaper-settings.json

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    mkdir -p /data && \
    chown node:node /data

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server
COPY --from=build --chown=node:node /app/countries.json ./countries.json

USER node
EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist-server/host/server.js"]
