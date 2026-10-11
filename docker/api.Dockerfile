FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @cr/api...
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cr/api build && pnpm --filter @cr/api deploy --prod /out \
 && cp -r apps/api/dist /out/dist && cp -r apps/api/src/db/migrations /out/dist/migrations

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra poppler-utils \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production STORAGE_DIR=/data/storage OMP_THREAD_LIMIT=1
WORKDIR /app
COPY --from=build /out .
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
