FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @cr/web...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ARG VITE_MAX_UPLOAD_MB=10
ARG VITE_APP_TIMEZONE=Africa/Kigali
ENV VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS VITE_MAX_UPLOAD_MB=$VITE_MAX_UPLOAD_MB VITE_APP_TIMEZONE=$VITE_APP_TIMEZONE
RUN pnpm --filter @cr/web build

FROM nginx:1.27-alpine
# Rendered at start-up by the nginx image (envsubst), e.g. CLIENT_MAX_BODY_SIZE.
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
ENV CLIENT_MAX_BODY_SIZE=12m
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
