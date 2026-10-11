# Compound Registry — System Design

Date: 2026-10-11
Status: Approved for planning

## 1. Purpose and scope

A web application covering two features from the practical assessment:

1. **Compound analysis** — upload laboratory reports (PDF, JPG, JPEG, PNG; text-based or scanned), extract compound percentages, let a user review them, and save verified values into the existing `Compound` table.
2. **Production registration** — register, search and update production records, with a tamper-evident hash-chained audit trail on the critical fields (Production ID, TagNumber, Production Weight, Mineral Type).

Plus the general requirements: migrations that preserve existing data, authentication and role-based authorization, secure file access, API documentation, unit/integration/end-to-end tests, and deployment documentation.

### Success criteria

- A reviewer starts the whole system with `docker compose up` and signs in with seeded users for each role.
- All four sample reports extract correctly: right values in the right columns, missing values stored as `NULL`, uncertain values flagged, elements without a matching column reported as unmapped.
- Production records can be created, searched, updated with a reason, and their history shown; `/verify` reports an intact chain, and detects each tampering scenario in §6.4.
- Every item in the assessment's General Development Requirements is covered and documented.
- The UI is responsive from 360 px phones to wide desktops, in light and dark themes, and meets WCAG AA contrast.

### Out of scope

- An external blockchain network (the audit trail is a keyed hash chain in the database; see §6).
- Background job queues (single-report extraction runs within the request).
- Deleting production records (records must stay traceable).

## 2. Sample data findings

The provided files shape the extraction design:

| Sample | Nature | Implications |
|---|---|---|
| `9439c877…Certificate of Assay…pdf` | Scanner output with an existing low-quality text layer (`Si02雪11.32`, `問go`) | Text layers must be quality-scored; fall back to OCR. Zero/letter-O confusion inside formulas (`Na20`, `U308`), decimal commas (`0,067`). 23 compounds. |
| `bbe45a01.Assay Report…pdf` | Image-only PDF from a phone scan, yellow watermark over the value | OCR with colour removal. Single value `Sn = 57.57`; every other column stays `NULL`. |
| `ec17f3c6.Assay Report…pdf` | Text-based PDF exported from a spreadsheet, French labels | Table layout, Unicode subscripts (`Nb₂O₅`), `/` means missing → `NULL`. Sample weight `320.3` must be ignored. |
| `12359825…Certificate of Assay…jpg` | Photo of a handheld XRF analyzer screen | Second number per line is ±2σ uncertainty, not a value. `Nb`, `Y`, `Zr`, `Se` have no element columns → unmapped, never written into oxide columns. `Zn` → `zn_percent`, not `zno_percent`. List is truncated by the screen. |

### Provided `Compound.sql` issues

- Trailing comma before `);` — the script does not run as given.
- `id int NOT NULL PRIMARY KEY` without `AUTO_INCREMENT`.
- Columns with unclear meaning: `ai2o3_percent` (likely a misspelling of `al2o3_percent`, which also exists), `hso2_percent`, `ph_percent`, `bal_percent`, `i_percent`. They are kept unchanged for compatibility; the extractor never fills them automatically, but reviewers may set them manually.

## 3. Architecture

pnpm workspace, TypeScript throughout.

```
compound-registry/
├─ apps/
│  ├─ api/                 Fastify
│  │  └─ src/
│  │     ├─ modules/
│  │     │  ├─ auth/        login, refresh, logout, me; JWT cookies; RBAC guard
│  │     │  ├─ compounds/   extract, confirm, list, detail, file download
│  │     │  │  └─ extraction/  intake, text-layer, ocr, normalize, parser, catalog, scoring
│  │     │  ├─ production/  CRUD, search, pagination, CSV export
│  │     │  ├─ audit/       append, history, verify
│  │     │  ├─ reference/   companies, locations, agents, mineral types
│  │     │  └─ dashboard/   summary
│  │     ├─ db/            Drizzle schema, SQL migrations, seed
│  │     └─ shared/        config (zod-validated env), errors, storage, permissions
│  └─ web/                 React + Vite + Tailwind + shadcn/ui
│     └─ src/
│        ├─ features/      auth, dashboard, compounds, production
│        ├─ components/    ui primitives, layout
│        └─ lib/           api client, query setup, formatting
├─ packages/
│  └─ contracts/           zod schemas and types shared by api and web
├─ e2e/                    Playwright
├─ docker-compose.yml      mysql, api (with tesseract), web (nginx)
└─ docs/                   API.md, DEPLOYMENT.md, design/
```

Principles:

- Modules are organized by feature; each owns its routes, service and repository and exposes only its service to other modules.
- One set of zod schemas in `packages/contracts` validates forms in the web app, requests in the API, and generates the OpenAPI document.
- Uploaded files live in a private storage directory outside any public path, under random names, and are served only through an authenticated, permission-checked endpoint.

### Stack

| Concern | Choice |
|---|---|
| Database | MySQL 8 (InnoDB, utf8mb4) |
| API | Node 22, Fastify, Drizzle ORM, zod, pino |
| PDF text | pdfjs-dist |
| PDF rasterization | pdftoppm (poppler-utils) |
| OCR | Tesseract 5 (`eng`, `fra`) |
| Image preprocessing | sharp |
| File type detection | file-type |
| Password hashing | argon2 |
| Web | React 18, Vite, Tailwind, shadcn/ui, TanStack Query, TanStack Table, react-hook-form, Recharts |
| Tests | Vitest, Supertest-style `fastify.inject`, Playwright |
| Delivery | Docker Compose, GitHub Actions CI |

## 4. Data model

### 4.1 Compound (existing table)

- Migration `0001`: the given `Compound` table, with only the trailing-comma error fixed, created with `CREATE TABLE IF NOT EXISTS` so existing data is never touched.
- Migration `0002`: `ALTER TABLE Compound MODIFY id INT NOT NULL AUTO_INCREMENT` and an index on `purchase_id`.
- No column is renamed or dropped.

### 4.2 compound_extraction (new)

| Column | Type | Notes |
|---|---|---|
| id | CHAR(36) PK | UUID, returned to the client as `extractionId` |
| compound_id | INT NULL, FK → Compound.id, unique | Set when the user confirms |
| status | ENUM('pending','confirmed','expired') | |
| original_name | VARCHAR(255) | |
| mime_type | VARCHAR(64) | Detected from content |
| size_bytes | INT | |
| sha256 | CHAR(64), indexed | Duplicate-upload warning |
| storage_key | VARCHAR(255) | Random name in private storage |
| method | ENUM('text-layer','ocr','hybrid') | |
| overall_confidence | DECIMAL(5,4) | |
| raw_text | MEDIUMTEXT | |
| result | JSON | Fields, unmapped values, warnings |
| created_by | BIGINT FK → users.id | |
| created_at, expires_at | DATETIME | Pending extractions expire after 24 h |

`Compound.file_path` stores the storage key of the confirmed file.

### 4.3 Users and reference data

- `users`: id, name, email (unique), password_hash (argon2id), role (`admin|supervisor|operator|auditor`), active, created_at.
- `refresh_tokens`: id, user_id, token_hash, expires_at, revoked_at, replaced_by.
- `companies`, `business_locations`, `traceability_agents`, `mineral_types`: id, unique name (mineral types also have a unique code), active, timestamps. Seeded with realistic values.

### 4.4 production

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AUTO_INCREMENT PK | Internal, never changes; the audit chain is keyed on it |
| production_code | VARCHAR(32) UNIQUE | The business "ID"; generated as `PRD-YYYY-NNNNNN` unless supplied; changeable by admin only, with a reason |
| tag_number | VARCHAR(32) UNIQUE | |
| production_date | DATE | Not in the future |
| mineral_type_id | FK → mineral_types | |
| weight_kg | DECIMAL(12,3) | `CHECK (weight_kg > 0)` |
| business_location_id | FK → business_locations | |
| traceability_agent_id | FK → traceability_agents | |
| company_id | FK → companies | |
| operator_representative | VARCHAR(120) | |
| version | INT | Optimistic locking |
| created_by, updated_by | FK → users | |
| created_at, updated_at | DATETIME(3) | |

### 4.5 production_audit_event

| Column | Type | Notes |
|---|---|---|
| id | BIGINT AUTO_INCREMENT PK | |
| production_id | BIGINT FK → production.id | |
| seq | INT | Unique with production_id; 1…n without gaps |
| event_type | ENUM('CREATE','UPDATE') | CREATE holds the original snapshot of critical fields |
| changes | JSON | `[{ field, from, to }]`, critical fields only |
| reason | TEXT NULL | Required on UPDATE |
| actor_id | BIGINT | |
| actor_label | VARCHAR(160) | Name and role at the time of the change |
| occurred_at | DATETIME(3) | |
| prev_hash | CHAR(64) | 64 zeros for the first event |
| hash | CHAR(64) | See §6.2 |

`BEFORE UPDATE` and `BEFORE DELETE` triggers raise `SQLSTATE '45000'`, making the table append-only for application connections.

### 4.6 idempotency_keys

key (PK with user_id), user_id, request_hash, status_code, response JSON, created_at. Entries older than 24 h are purged.

## 5. Extraction pipeline

### 5.1 Intake

- Max size `MAX_UPLOAD_MB` (default 10), one file per request.
- Type detected from content; only `application/pdf`, `image/jpeg`, `image/png` accepted, and the extension must agree.
- PDFs: at most 10 pages; encrypted or corrupt files rejected.
- File stored under a random key; sha256 computed; a previous upload with the same hash produces a warning, not an error.

### 5.2 Text acquisition

- **PDF**: read the text layer with pdfjs and compute a quality score from the ratio of Latin/numeric characters, the share of recognized dictionary tokens, and the presence of catalog compound names.
  - Score ≥ 0.8 → use the text layer (`text-layer`).
  - Otherwise, or with no text → rasterize at 300 DPI and OCR (`ocr`).
  - Multi-page documents may mix both (`hybrid`).
- **Images** → OCR.
- **Preprocessing** (sharp): auto-rotate, greyscale, upscale to ~300 DPI equivalent, suppress coloured overlays (watermarks), normalize contrast, threshold.
- **Tesseract**: languages `eng+fra`; run page segmentation modes 6 and 4; keep the result with the higher mean word confidence. Word-level confidences are kept for scoring.

### 5.3 Normalization

- Unicode subscripts and superscripts to ASCII digits.
- Inside tokens that match a catalog formula after substitution, digit `0` → letter `O` (`Si02` → `SiO2`, `U308` → `U3O8`); free-standing numbers are never altered.
- Decimal comma → dot when between digits.
- A small, tested table of OCR confusions (`l/1/I`, `S/5`, `B/8`) applied only to candidate compound tokens.

### 5.4 Parsing

- **Catalog**: one entry per `Compound` column — column name, display label, aliases (e.g. `Fe2O3`, `Fe203`), kind (`element|oxide|other`), and `autoFill` (false for the unclear columns listed in §2).
- **Line scan**: compound token, optional separator (`=`, `:`, whitespace, table gap), number. Table rows and device-screen rows are handled by the same rule.
- **Second number on a line**: treated as uncertainty when the header mentions `±`, `2σ` or `error`; stored in the field as `uncertainty`, never as a value.
- **Missing markers** (`/`, `-`, `—`, `n.d.`, `ND`, `<LOD`, `<DL`): value `NULL` with a `missing_marker` note.
- **Ignored contexts**: lines carrying weight/`kg`/`POIDS`, dates, phone numbers, certificate or sample numbers.
- **Element vs oxide**: an element token maps only to an element column, an oxide only to its oxide column. Tokens with no matching column (`Nb`, `Y`, `Zr`, `Se`, …) go to `unmapped`.
- **Duplicates**: the same column found twice with different values → `conflict` flag with both candidates.

### 5.5 Scoring and flags

- Field confidence = OCR word confidence (1.0 for text-layer) × name-match score × plausibility factor.
- Validation: 0 ≤ value ≤ 100 and fits `DECIMAL(10,4)`; values with more than 4 decimals are rounded and flagged `precision_truncated`.
- Report-level warning when the sum of mapped values exceeds 105 %.
- Flags: `low_confidence` (< 0.85), `fuzzy_name`, `conflict`, `out_of_range`, `precision_truncated`, `missing_marker`.

### 5.6 Review contract

`POST /api/compounds/extract` → 

```json
{
  "extractionId": "uuid",
  "method": "ocr",
  "pages": 1,
  "overallConfidence": 0.91,
  "fields": [
    { "column": "sn_percent", "label": "Sn", "value": "57.5700", "rawText": "Sn = 57.57",
      "confidence": 0.93, "uncertainty": null, "flags": [] }
  ],
  "unmapped": [ { "label": "Nb", "value": "18.04", "rawText": "Nb 18.04 0.81" } ],
  "warnings": [],
  "duplicateOf": null,
  "rawText": "…"
}
```

Values are decimal strings to avoid floating-point loss. Nothing is written to `Compound` until `POST /api/compounds` with `{ extractionId, purchaseId, values }`; the server re-validates every value and links the extraction. Unconfirmed extractions and their files are removed after 24 h by a periodic cleanup.

### 5.7 Extraction tests

The four samples are test fixtures with expected-value files (e.g. ASi report → `sn_percent = 57.5700`, all other columns `NULL`). Unit tests cover each special case above.

## 6. Audit trail

### 6.1 Writing events

- `POST /production` writes the record and a `CREATE` event (snapshot of the four critical fields) in one transaction.
- `PUT /production/:id` compares critical fields; if any changed, `reason` is required and an `UPDATE` event with the field-level differences is appended in the same transaction as the record update. Non-critical changes update the record and `updated_by/at` without an audit event.
- The latest event row for the record is read with `SELECT … FOR UPDATE` to serialize concurrent appends.

### 6.2 Hash

`hash = HMAC-SHA256(AUDIT_SECRET, canonicalJSON({ productionId, seq, eventType, changes, reason, actorId, actorLabel, occurredAt, prevHash }))`

Canonical JSON uses sorted keys, no whitespace, ISO-8601 UTC timestamps and decimal strings. The secret prevents someone with database access alone from rebuilding a consistent chain. Changing `AUDIT_SECRET` invalidates existing chains, so it is treated as permanent; key versioning is out of scope and documented as a future improvement.

### 6.3 Verification

`GET /production/:id/verify` returns `{ status: 'intact' | 'tampered', eventsChecked, failure?: { seq, reason } }` after checking:

1. `seq` runs 1…n without gaps and the first event is `CREATE`.
2. Each `prev_hash` equals the previous event's `hash`.
3. Each recomputed HMAC equals the stored `hash`.
4. Replaying all events reproduces the current critical-field values of the `production` row.

### 6.4 Detected tampering scenarios (each has an integration test)

| Scenario | Detected by |
|---|---|
| Event content edited | 3 |
| Event deleted in the middle | 1, 2 |
| Latest event deleted | 4 (and 1 when it was the only update) |
| Production row edited directly in the database | 4 |
| Chain rebuilt without the secret | 3 |

## 7. API

All routes under `/api`. OpenAPI generated from the shared schemas, served at `/docs`; `docs/API.md` holds examples.

### 7.1 Auth

- `POST /auth/login` — argon2 verification; sets an access JWT cookie (15 min) and a rotating refresh token cookie (7 days, stored hashed). Cookies are `httpOnly`, `SameSite=Strict`, `Secure` in production.
- `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- Login rate limit: 5 attempts per minute per IP and email.
- CSRF: double-submit token on state-changing requests.

### 7.2 Permissions

| Action | admin | supervisor | operator | auditor |
|---|:-:|:-:|:-:|:-:|
| compound:extract, compound:create | ✓ | ✓ | ✓ | — |
| compound:read, compound:file | ✓ | ✓ | ✓ | ✓ |
| production:create | ✓ | ✓ | ✓ | — |
| production:update (non-critical) | ✓ | ✓ | own | — |
| production:update-critical | ✓ | ✓ | — | — |
| production:update-code | ✓ | — | — | — |
| production:read | ✓ | ✓ | ✓ | ✓ |
| audit:read, audit:verify | ✓ | ✓ | — | ✓ |
| reference:manage | ✓ | — | — | — |

A single `can(user, action, resource?)` function in `packages/contracts` is used by the API guard and by the web app to hide unavailable controls.

### 7.3 Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | /compounds/extract | Multipart upload; returns extraction for review |
| POST | /compounds | Save reviewed values |
| GET | /compounds | List; `page`, `pageSize`, `purchaseId`, `from`, `to` |
| GET | /compounds/:id | Detail with extraction metadata |
| GET | /compounds/:id/file | Stream original file (permission-checked, `nosniff`) |
| POST | /production | Create (supports `Idempotency-Key`) |
| GET | /production | List; `page`, `pageSize`, `q`, `mineralTypeId`, `companyId`, `locationId`, `from`, `to`, `sort` |
| GET | /production/export.csv | Same filters, CSV |
| GET | /production/:id | Detail |
| PUT | /production/:id | Update; requires `version`; `reason` when critical fields change |
| GET | /production/:id/history | Audit events |
| GET | /production/:id/verify | Chain verification |
| GET | /reference/{companies,locations,agents,mineral-types} | Active reference data |
| POST, PATCH | /reference/… | Admin management |
| GET | /dashboard/summary | Counts, weight by mineral, recent activity, chain health |
| GET | /health | Liveness and database check |

### 7.4 Errors

```json
{ "error": { "code": "TAG_NUMBER_TAKEN", "message": "Tag number T-0045 is already registered.",
             "details": { "field": "tagNumber" }, "requestId": "…" } }
```

| Code | HTTP |
|---|---|
| VALIDATION_FAILED (with `details.fields`) | 422 |
| REASON_REQUIRED | 422 |
| EXTRACTION_FAILED (with a user-facing hint) | 422 |
| UNAUTHENTICATED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| VERSION_CONFLICT | 409 |
| TAG_NUMBER_TAKEN, PRODUCTION_CODE_TAKEN | 409 |
| EXTRACTION_EXPIRED | 410 |
| FILE_TOO_LARGE | 413 |
| UNSUPPORTED_FILE_TYPE | 415 |
| RATE_LIMITED | 429 |
| INTERNAL_ERROR | 500 |

Every response carries a `requestId`, also present in structured logs. Internal error details are never returned.

### 7.5 Security baseline

Helmet headers, CORS restricted to the web origin, body and upload size limits, parameterized queries only, environment validated at startup.

## 8. User interface

### 8.1 Visual language

- Neutral slate surfaces, one deep teal accent; semantic colours: green (verified), amber (needs review), red (tampered/error).
- Inter for text; JetBrains Mono for numbers, hashes and IDs.
- Light and dark themes, following the system setting with a manual toggle.
- 8 px spacing grid, compact tables.
- Desktop: collapsible sidebar, top bar with breadcrumbs, command search (⌘K), user menu. Phone: sidebar becomes a drawer, tables become cards, single-column forms with a sticky action bar.

### 8.2 Screens

1. **Sign in** — split layout, inline errors, lockout message.
2. **Dashboard** — tiles (records this month, total kg, reports processed, items needing review), weight by mineral chart, recent activity, chain health.
3. **Compound upload** — three steps:
   1. Purchase ID and drag-and-drop area with instant type/size checks.
   2. Upload percentage, then named stages: *Reading document → Running OCR → Matching compounds*.
   3. Review: document preview (zoomable) beside the fields on desktop, stacked on phone. Each field shows a confidence chip and its source text. Flagged fields are pinned at the top in amber; unmapped values in a separate panel; empty fields show "—". *Confirm and save* is enabled once flagged fields are corrected or explicitly accepted. Success toast with links to the record or a new upload.
4. **Compound records** — filterable table, detail page with link to the original file.
5. **Production list** — server-side pagination, search, filters, sorting, CSV export; empty and skeleton states.
6. **Production form** — searchable selects loaded from the API, date picker with no future dates, weight input with kg suffix. In edit mode critical fields show a lock icon; changing one reveals a required reason field. Unsaved-changes guard, disabled submit while pending, Idempotency-Key, version-conflict dialog offering a reload.
7. **Record detail** — fields, vertical audit timeline (actor, time, from → to, reason, short hash) and a *Verify* action showing *Chain intact* or *Tampered at event #n* with the reason.

### 8.3 Accessibility

Full keyboard support, visible focus, labelled inputs, `aria-live` error announcements, WCAG AA contrast in both themes, `prefers-reduced-motion` respected.

## 9. Testing

- **Unit (Vitest)**: normalization, parser, catalog, scoring, all four samples end to end through the pipeline, contract schemas, canonical JSON and HMAC, permission rules.
- **Integration (Vitest + MySQL test database)**: every endpoint's success and error paths, transactional writes, trigger enforcement, each tampering scenario in §6.4, idempotency, version conflicts.
- **End-to-end (Playwright)**:
  - Sign in → upload the ASi report → review → save → record listed.
  - Create a production record → change weight with a reason → timeline shows it → verify intact.
  - Direct database edit → verify reports tampered.
  - Phone viewport pass over the main flows.
- **CI**: GitHub Actions running lint, type-check, unit, integration (MySQL service) and end-to-end tests.

## 10. Delivery

- `docker compose up` — MySQL, API (image includes Tesseract and poppler), web (nginx serving the build and proxying `/api`). Migrations and seed run on API start.
- Seeded users: one per role, credentials listed in the README.
- Documentation: `README.md` (overview, quick start, demo users, screenshots, notes on the `Compound.sql` fixes), `docs/API.md`, `docs/DEPLOYMENT.md` (environment variables, production checklist, backups, `AUDIT_SECRET` handling), `.env.example`.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| DATABASE_URL | MySQL connection | — (required) |
| JWT_SECRET | Access token signing | — (required) |
| AUDIT_SECRET | Audit chain HMAC key | — (required) |
| STORAGE_DIR | Private upload directory | `./storage` |
| MAX_UPLOAD_MB | Upload size limit | `10` |
| OCR_LANGS | Tesseract languages | `eng+fra` |
| WEB_ORIGIN | Allowed CORS origin | `http://localhost:5173` |
| PORT | API port | `3000` |
| NODE_ENV | Environment | `development` |
