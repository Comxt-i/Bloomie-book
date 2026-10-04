FROM node:22-alpine AS build
WORKDIR /build
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM caddy:2-alpine
COPY client/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /build/dist /srv
