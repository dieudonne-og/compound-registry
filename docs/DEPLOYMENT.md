# Deployment Guide

## Requirements

- **With Docker:** Docker 24+ with Compose v2.
- **Without Docker:** Node.js 22, pnpm 9 (`corepack enable`), MySQL 8.0 or 8.4, Tesseract 5 with the `eng` and `fra` language data, and poppler-utils (`pdftoppm`, `pdftotext`, `pdfinfo`).

## Quick start with Docker

```bash
cp .env.example .env
openssl rand -hex 32   # paste as JWT_SECRET in .env
openssl rand -hex 32   # paste as AUDIT_SECRET in .env
docker compose up --build -d
docker compose ps        # db and api report healthy, web running
curl http://localhost:8080/api/health
```

The application is served at <http://localhost:8080>. The `web` container (nginx) serves the interface and forwards `/api` and `/docs` to the `api` container. The API runs migrations and seeds reference data and demo accounts when it starts.

Data lives in two volumes: `db-data` (MySQL) and `uploads` (laboratory report files).

## Local development

```bash
sudo apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra poppler-utils mysql-server
sudo mysql <<'SQL'
SET GLOBAL log_bin_trust_function_creators = 1;
CREATE USER IF NOT EXISTS 'cr'@'localhost' IDENTIFIED BY 'cr_dev_password';
CREATE DATABASE compound_registry;  CREATE DATABASE compound_registry_test;  CREATE DATABASE compound_registry_e2e;
GRANT ALL ON compound_registry.* TO 'cr'@'localhost';
GRANT ALL ON compound_registry_test.* TO 'cr'@'localhost';
GRANT ALL ON compound_registry_e2e.* TO 'cr'@'localhost';
SQL

pnpm install
cp .env.example .env            # then set JWT_SECRET and AUDIT_SECRET
cp apps/web/.env.example apps/web/.env
pnpm dev                        # API on :3000, web on :5173 (proxies /api to the API)
```

If port 3000 is taken, start the API with `PORT=3300` and the web server with `API_URL=http://localhost:3300`.

Add `log_bin_trust_function_creators = 1` under `[mysqld]` in the MySQL configuration so the setting survives restarts; MySQL needs it to create the audit triggers when binary logging is on.

### Tests

```bash
pnpm test               # unit tests
pnpm test:integration   # API against compound_registry_test (recreated on each run)
pnpm exec playwright install chromium
pnpm test:e2e           # starts the API on :3100 and the web app on :5174 against compound_registry_e2e
```

## Environment variables

### API

| Variable                         | Required                     | Default                    | Purpose                                                                                                                                                                         |
| -------------------------------- | ---------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | yes                          | —                          | MySQL connection, e.g. `mysql://cr:password@127.0.0.1:3306/compound_registry`                                                                                                   |
| `JWT_SECRET`                     | yes                          | —                          | Signs session tokens; at least 32 characters                                                                                                                                    |
| `AUDIT_SECRET`                   | yes                          | —                          | Keys the audit hash chain; at least 32 characters; see below                                                                                                                    |
| `NODE_ENV`                       | no                           | `development`              | `production` turns on `Secure` cookies (see `COOKIE_SECURE`) and replaces the demo accounts with one administrator (see `ADMIN_EMAIL`)                                          |
| `PORT`                           | no                           | `3000`                     | API port                                                                                                                                                                        |
| `STORAGE_DIR`                    | no                           | `./storage`                | Private folder for uploaded reports                                                                                                                                             |
| `MAX_UPLOAD_MB`                  | no                           | `10`                       | Upload size limit                                                                                                                                                               |
| `OCR_LANGS`                      | no                           | `eng+fra`                  | Tesseract languages                                                                                                                                                             |
| `WEB_ORIGIN`                     | no                           | `http://localhost:5173`    | Allowed browser origin (CORS)                                                                                                                                                   |
| `APP_TIMEZONE`                   | no                           | `Africa/Kigali`            | Business time zone for "today" (production dates, monthly figures)                                                                                                              |
| `LOG_LEVEL`                      | no                           | `info`                     | `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`                                                                                                                  |
| `SEED_DEMO`                      | no                           | —                          | `true` seeds the demo accounts and sample production records even in production mode                                                                                            |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | production without demo data | —                          | First administrator, created only when the database has no users; the password needs at least 12 characters. Start-up stops with a clear message if they are missing            |
| `COOKIE_SECURE`                  | no                           | `true` in production       | Set `false` only when serving over plain HTTP (the local Compose quick start)                                                                                                   |
| `TRUST_PROXY`                    | no                           | `0`                        | Number of reverse proxies in front of the API; their `X-Forwarded-For` entry becomes the client address used for rate limiting. Compose sets `1` (nginx)                        |
| `OCR_CONCURRENCY`                | no                           | `2`                        | Text-recognition runs allowed at once (CPU-bound)                                                                                                                               |
| `EXTRACTION_BUDGET_SECONDS`      | no                           | `150`                      | Time allowed to read one report; keep it below the proxy timeout (nginx: 180 s)                                                                                                 |
| `MIGRATION_DATABASE_URL`         | no                           | —                          | Separate account used only to apply migrations at start-up (needs `CREATE`, `ALTER`, `INDEX`, `TRIGGER`); lets `DATABASE_URL` use an account without `TRIGGER` or `DROP` rights |
| `SEED_PASSWORD`                  | no                           | `Demo!2026`                | Password of the seeded demo accounts                                                                                                                                            |
| `TEST_DATABASE_URL`              | tests only                   | `…/compound_registry_test` | Integration test database                                                                                                                                                       |
| `E2E_DATABASE_URL`               | tests only                   | `…/compound_registry_e2e`  | End-to-end test database                                                                                                                                                        |

### Web (build time)

| Variable                  | Default | Purpose                                                                     |
| ------------------------- | ------- | --------------------------------------------------------------------------- |
| `VITE_MAX_UPLOAD_MB`      | `10`    | Size limit shown and checked in the browser (keep equal to `MAX_UPLOAD_MB`) |
| `VITE_SHOW_DEMO_ACCOUNTS` | —       | `true` shows the demo account shortcuts on the sign-in page                 |

### Docker Compose

The `web` container reads `CLIENT_MAX_BODY_SIZE` (default `12m`), the largest request nginx accepts; keep it a little above `MAX_UPLOAD_MB`.

`DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`, `AUDIT_SECRET`, `WEB_ORIGIN`, `APP_TIMEZONE`, `MAX_UPLOAD_MB`, `SEED_DEMO`, `SEED_PASSWORD`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `COOKIE_SECURE`, `OCR_CONCURRENCY` and `SHOW_DEMO_ACCOUNTS` (web build) are read from `.env`. The quick start runs over plain HTTP, so Compose sets `COOKIE_SECURE=false` by default.

## Database

- Migrations are plain SQL files in `apps/api/src/db/migrations`, applied in order at start-up and recorded in `schema_migrations`. Run them on their own with `pnpm db:migrate`.
- MySQL does not roll back schema changes, so a migration that fails part-way must be fixed and re-run; each file is small to keep that simple.
- The supplied `Compound` table is created only if it does not exist, so existing data is preserved. Later migrations add `AUTO_INCREMENT` to its `id` and an index on `purchase_id`.
- Every database session runs in UTC; the application converts to `APP_TIMEZONE` only where a business date is needed.

## The audit secret

`AUDIT_SECRET` is part of every audit hash. Treat it as permanent:

- Changing it makes every existing history fail verification.
- Store it in a secrets manager and back it up **separately** from database backups — someone holding both could rebuild a chain.
- Supporting several keys (key versioning) is a possible future improvement.

## Production checklist

- Put HTTPS in front of the `web` container (a load balancer or reverse proxy) and set `COOKIE_SECURE=true`. If that proxy adds its own `X-Forwarded-For` hop, raise `TRUST_PROXY` accordingly.
- Set `NODE_ENV=production`, set `SEED_DEMO=false`, provide `ADMIN_EMAIL` and `ADMIN_PASSWORD` for the first administrator, and build the web image with `SHOW_DEMO_ACCOUNTS=false`.
- Use long random values for `JWT_SECRET`, `AUDIT_SECRET`, `DB_PASSWORD` and `DB_ROOT_PASSWORD`.
- Apply migrations with a separate account (`MIGRATION_DATABASE_URL`) and give the application account (`DATABASE_URL`) only `SELECT`, `INSERT`, `UPDATE` and `DELETE` on its own database, so it can neither drop nor alter the audit triggers.
- Back up the database and the uploads volume together: `mysqldump --single-transaction compound_registry` plus a copy of the storage folder.
- Set `WEB_ORIGIN` to the public address.

## Operations

- **Health:** `GET /api/health` checks the API and the database; the API and database containers have health checks.
- **Logs:** structured JSON; every request and error carries a `requestId`, which is also returned to the browser in error messages.
- **Housekeeping:** every hour the API deletes files of extractions that were never confirmed (after 24 hours) and clears expired idempotency keys.
- **Scaling:** text recognition is CPU-bound. Run more `api` replicas behind the web server for heavier upload volumes; they share the database and the uploads volume.
