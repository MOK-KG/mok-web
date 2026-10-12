# Сборка и раздача web для Coolify.
# Переменные VITE_* встраиваются в бандл при сборке — задаются как Build Arguments в Coolify.

FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# Адрес API (по умолчанию /api на том же домене)
ARG VITE_API_URL=
# Заглушка входа: active | pending | denied. Пусто — реальный бэкенд
ARG VITE_AUTH_MOCK=
ENV VITE_API_URL=$VITE_API_URL VITE_AUTH_MOCK=$VITE_AUTH_MOCK
RUN pnpm build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/health || exit 1
