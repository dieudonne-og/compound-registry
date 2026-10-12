# Requirements Coverage

How each requirement of the practical test is met, where it lives in the code and how it is verified.

**Verification at a glance:** 129 unit tests, 62 integration tests against MySQL, 5 browser end-to-end tests, and a container job that builds the Docker images and exercises the running stack through nginx. All run in CI on every push.

| Suite                | Command                 | Count                  |
| -------------------- | ----------------------- | ---------------------- |
| Unit                 | `pnpm test`             | 129                    |
| Integration (MySQL)  | `pnpm test:integration` | 62                     |
| End-to-end (browser) | `pnpm test:e2e`         | 5                      |
| Containers           | CI job `containers`     | build + 5 smoke checks |

Paths are relative to the repository root. `api/` means `apps/api/src/`, `web/` means `apps/web/src/`.

---

## Task 1 — Compound analysis upload, extraction and storage

### 1. Objective

| Requirement                                                      | Status | Where                                                                                 | Verified by                                                                   |
| ---------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Upload laboratory reports in different formats                   | Done   | `web/features/compounds/upload-page.tsx`, `api/modules/compounds/compounds.routes.ts` | `test/integration/compounds.test.ts`, `e2e/compounds.spec.ts`                 |
| Extract compound composition values automatically                | Done   | `api/modules/compounds/extraction/`                                                   | `extraction/pipeline.test.ts` (the four supplied reports, column by column)   |
| Review extracted data before saving                              | Done   | `web/features/compounds/review-panel.tsx`                                             | `review-state.test.ts`, `e2e/compounds.spec.ts`                               |
| Save verified results into the `Compound` table                  | Done   | `compounds.service.ts` → `confirm()`                                                  | `compounds.test.ts` ("saves confirmed values and keeps everything else NULL") |
| Support image-based and PDF reports, including scanned documents | Done   | `extraction/pipeline.ts`, `ocr.ts`, `rasterize.ts`                                    | Fixtures: scanned PDF, image-only PDF, text PDF, JPG photo                    |

### 2A. Frontend — upload form

| Requirement                               | Status | Where                                                                                                  | Verified by                                                                                         |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Purchase ID (required)                    | Done   | `upload-page.tsx`, shared rule `purchaseId` in `packages/contracts/src/compounds.ts`                   | `compounds.test.ts` ("requires a valid purchase ID"), `e2e/compounds.spec.ts`                       |
| Laboratory report upload (required)       | Done   | `dropzone.tsx` (drag-and-drop or browse)                                                               | `e2e/compounds.spec.ts`                                                                             |
| Supported formats PDF, JPG, JPEG, PNG     | Done   | `web/lib/files.ts`, `api/.../extraction/intake.ts`                                                     | `files.test.ts`, `intake.test.ts`                                                                   |
| File size and file type validation        | Done   | Browser: `files.ts`. Server: content detection (`file-type`), name must match content, `MAX_UPLOAD_MB` | `files.test.ts`, `intake.test.ts`, `compounds.test.ts` (415, 413), `e2e` (unsupported file refused) |
| Upload and extraction progress indicators | Done   | `web/lib/upload.ts` (real upload %), `processing-stages.tsx`                                           | Browser review                                                                                      |
| Clear success and error messages          | Done   | Toasts, inline field errors, extraction failures with a reason and a hint (`extraction/failure.ts`)    | `compounds.test.ts`, `e2e/compounds.spec.ts`                                                        |

### 3A. Backend — file processing

| Requirement                                                                  | Status | Where                                                                                                                                      | Verified by                                                |
| ---------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Accept supported image and PDF formats                                       | Done   | `intake.ts`                                                                                                                                | `intake.test.ts`                                           |
| Store files in appropriate storage, save path/reference in the database      | Done   | `api/shared/storage.ts` (private folder, random names, mode 0600); key saved in `Compound.file_path`                                       | `storage.test.ts`, `compounds.test.ts`                     |
| OCR and PDF text extraction tools                                            | Done   | Tesseract 5 (eng + fra), poppler `pdftotext`/`pdfinfo`/`pdftoppm`, sharp for image preparation                                             | `pipeline.test.ts`, `text-layer.test.ts`, container job    |
| Support scanned PDFs and PDFs with selectable text                           | Done   | Per page: clean text layer is used directly; garbled or missing text falls back to OCR (`textQuality`)                                     | `text-layer.test.ts`, `pipeline.test.ts`                   |
| Identify compound names/formulas and percentages                             | Done   | `catalog-index.ts`, `parser.ts`, catalogue in `packages/contracts/src/catalog.ts`                                                          | `catalog-index.test.ts`, `parser.test.ts`                  |
| Normalise values into the correct database fields                            | Done   | `normalize.ts` (subscripts, O/0 confusion, decimal commas); element vs oxide kept apart                                                    | `normalize.test.ts`, `parser.test.ts`                      |
| Handle missing values, unreadable text, different layouts, extraction errors | Done   | Missing markers → NULL; unreadable/encrypted/too slow → clear error; layout-independent parser; OCR escalation with voting for weak images | `parser.test.ts`, `pipeline.test.ts`, `text-layer.test.ts` |
| Return extracted data for review before insertion                            | Done   | `POST /api/compounds/extract` stores nothing in `Compound`; `POST /api/compounds` saves after review                                       | `compounds.test.ts` ("…without saving a Compound row")     |
| OCR for images/scans, direct extraction for text PDFs                        | Done   | `pipeline.ts`                                                                                                                              | Fixture `method` assertions (`text-layer` vs `ocr`)        |

### 3B. Data validation

| Requirement                                                     | Status | Where                                                                                                                                                      | Verified by                                                                                  |
| --------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Percentages numeric and within database precision               | Done   | `percentValue` (0–100, ≤ 4 decimals, `DECIMAL(10,4)`); decimal strings end to end, never floats                                                            | `decimal.test.ts`, `compounds.test.ts` (rejects `12.34567`, `101`)                           |
| Prevent values being assigned to the wrong compound             | Done   | Exact element/oxide separation (`Zn` ≠ `ZnO`); elements without a column reported, not forced; weights, dates and seal numbers ignored or flagged          | `parser.test.ts`, `catalog-index.test.ts`, XRF photo fixture                                 |
| Preserve missing values as NULL, not zero                       | Done   | `confirm()` maps every unspecified column to NULL; `/`, `n.d.`, `<LOD` → NULL                                                                              | `compounds.test.ts`, `foundation.test.ts`, `e2e/compounds.spec.ts` (checks the database row) |
| Report uncertain/low-confidence results for manual verification | Done   | Per-value confidence and flags (`low_confidence`, `fuzzy_name`, `conflict`, `out_of_range`, …); flagged values must be corrected or accepted before saving | `parser.test.ts`, `review-state.test.ts`                                                     |

### 3C. Database integration

| Requirement                                                                  | Status | Where                                                                                                 | Verified by                                                              |
| ---------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Use the provided `Compound` table structure                                  | Done   | `db/migrations/0001_compound.sql` (as supplied, trailing comma fixed), all 50 percentage columns kept | `foundation.test.ts`, `catalog.test.ts` (column list matches the schema) |
| Save purchase ID, file reference, extraction date, all supported percentages | Done   | `compounds.service.ts` → `confirm()`                                                                  | `compounds.test.ts`                                                      |
| `id` configured as primary key with auto-increment                           | Done   | `0002_compound_autoincrement.sql` (keeps existing rows, including id 0)                               | `foundation.test.ts` ("auto-increments Compound.id…")                    |

---

## Task 2 — Production registration, verification and change tracking

### 1. Objective

| Requirement                                             | Status | Where                                                       | Verified by                                            |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------- | ------------------------------------------------------ |
| Authorised users record production information          | Done   | `web/features/production/`, `api/modules/production/`       | `production.test.ts`, `e2e/production.spec.ts`         |
| Validate, save, maintain a tamper-evident audit trail   | Done   | `production.service.ts`, `api/modules/audit/`               | `production.test.ts`, `audit.test.ts`, `chain.test.ts` |
| Track changes to TagNumber, Weight, ID and Mineral Type | Done   | `CRITICAL_FIELDS` in `packages/contracts/src/production.ts` | `chain.test.ts`, `production.test.ts`                  |

### 2. Frontend — registration form

| Field / requirement                                                  | Status | Where                                                                                         | Verified by                                                                                   |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ID — system-generated or validated                                   | Done   | Generated as `PRD-YYYY-NNNNNN`; that format is reserved; only administrators may change an ID | `production.test.ts`                                                                          |
| TagNumber (required)                                                 | Done   | Unique, stored upper-case                                                                     | `production.test.ts` (duplicate regardless of case)                                           |
| Production date (required, date picker)                              | Done   | `date-picker.tsx`; future dates blocked using the business time zone                          | `business-day.test.ts`, `production.test.ts` (Kigali late evening)                            |
| Mineral type from configured types                                   | Done   | Searchable list loaded from `/api/reference/mineral-types`                                    | `reference.test.ts`, `e2e/production.spec.ts`                                                 |
| Production weight (kg) > 0                                           | Done   | `weightKgValue` (> 0, ≤ 3 decimals, `DECIMAL(12,3)`), database `CHECK` constraint             | `decimal.test.ts`, `production.test.ts`                                                       |
| Business location, traceability agent, company from registered lists | Done   | Lists loaded from `/api/reference/*`; retired entries stay valid on records that use them     | `reference.test.ts`, `production.test.ts`, `form-logic.test.ts`                               |
| Name of operator representative (required)                           | Done   | `production-form.tsx`                                                                         | `production.test.ts`                                                                          |
| Input controls, dropdowns, date pickers, validation                  | Done   | `combobox.tsx`, `date-picker.tsx`, shared zod rules                                           | `form-logic.test.ts`, `e2e/production.spec.ts`                                                |
| Load companies, locations, agents, mineral types from the backend    | Done   | `web/features/production/api.ts` → `useReference`                                             | `e2e/production.spec.ts`                                                                      |
| Prevent accidental duplicate submissions                             | Done   | Submit disabled while saving + `Idempotency-Key` header replayed by the server                | `production.test.ts` (idempotent retry), `e2e/production.spec.ts` (double-click → one record) |
| Clear success and error messages                                     | Done   | Toasts; server field errors shown on the form; version-conflict dialog                        | `e2e/production.spec.ts`                                                                      |
| View, search and update records according to permissions             | Done   | List with search, filters, sorting, pagination, CSV export; detail page; role-aware editing   | `production.test.ts`, `e2e/production.spec.ts` (auditor read-only)                            |

### 3A. Production APIs

| Endpoint                                                        | Status | Verified by                                                                      |
| --------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `POST /api/production`                                          | Done   | `production.test.ts`                                                             |
| `GET /api/production` (pagination and filters)                  | Done   | `production.test.ts` ("filters, paginates and sorts")                            |
| `GET /api/production/:id`                                       | Done   | `production.test.ts`                                                             |
| `PUT /api/production/:id` (validation and audit)                | Done   | `production.test.ts` (reason required, from/to recorded, stale version rejected) |
| `GET /api/production/:id/history`                               | Done   | `production.test.ts`, `audit.test.ts`                                            |
| `GET /api/production/:id/verify`                                | Done   | `audit.test.ts` (five tampering scenarios)                                       |
| Supporting endpoints for companies, minerals, locations, agents | Done   | `GET/POST/PATCH /api/reference/{kind}` — `reference.test.ts`                     |

### 3B. Validation and database storage

| Requirement                                            | Status | Where                                                                                                    | Verified by                                                             |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Validate every field independently of the frontend     | Done   | Same zod schemas enforced by the API; references checked in the database                                 | `production.test.ts` ("validates every field on the server")            |
| Uniqueness rules for production IDs and tag numbers    | Done   | Unique indexes, mapped to `TAG_NUMBER_TAKEN` / `PRODUCTION_CODE_TAKEN`                                   | `production.test.ts`                                                    |
| Validate references to companies, locations and agents | Done   | `validateFields()`                                                                                       | `production.test.ts`                                                    |
| Transactions where appropriate                         | Done   | Record change and audit event in one transaction under a row lock                                        | `production.test.ts` (simultaneous edits: one wins, chain stays linear) |
| Record who created or modified a record and when       | Done   | `created_by/at`, `updated_by/at`                                                                         | `production.test.ts`                                                    |
| Authentication and role-based authorisation            | Done   | Cookie sessions, refresh rotation, CSRF, login rate limit; one permission table (`can()`) for API and UI | `auth.test.ts`, `permissions.test.ts`, `production.test.ts`             |

### 3C. Blockchain-based audit trail

| Requirement                                                                              | Status | Where                                                                                  | Verified by                                                                                                                             |
| ---------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Track Production ID, TagNumber, Weight, Mineral Type                                     | Done   | `diffCritical()` in `api/modules/audit/chain.ts`                                       | `chain.test.ts`                                                                                                                         |
| Immutable event with record ID, previous and new values, changed fields, user, timestamp | Done   | `production_audit_event` table; `UPDATE`/`DELETE` blocked by triggers                  | `audit.test.ts` ("blocks edits and deletes…")                                                                                           |
| Previous and current event hash                                                          | Done   | `prev_hash`, `hash = HMAC-SHA256(AUDIT_SECRET, canonical event)`                       | `chain.test.ts`                                                                                                                         |
| Reason for change                                                                        | Done   | Required for every change to a tracked field                                           | `production.test.ts` (`REASON_REQUIRED`)                                                                                                |
| Each event linked to the preceding one; modification or deletion detectable              | Done   | Verification checks sequence, links, hashes and replays the history against the record | `audit.test.ts`: edited event, deleted middle event, deleted latest event, record edited directly, history rewritten without the secret |
| Original record and every change traceable                                               | Done   | `CREATE` event holds the original values; history timeline in the UI                   | `production.test.ts`, `e2e/production.spec.ts`                                                                                          |

Known limit, stated in the README and API reference: someone with full database access who removes the triggers, deletes a record's latest events _and_ rolls the record back — or deletes a record with its whole history — leaves nothing in the database to contradict it. Catching that needs a copy of the chain heads stored outside the database.

---

## General development requirements

| #   | Requirement                                                                                  | Status | Where                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Forms, tables, validation, loading states, error handling, responsive layouts                | Done   | `apps/web` — skeleton loaders, empty and error states, phone layouts (cards instead of tables, drawer navigation); `e2e/responsive.spec.ts` checks for no horizontal scrolling on a phone |
| 2   | Backend APIs, business logic, file processing, database integration                          | Done   | `apps/api` — feature modules: auth, compounds (extraction), production, audit, reference, dashboard                                                                                       |
| 3   | Migrations preserving existing data and relationships                                        | Done   | `apps/api/src/db/migrations` — the supplied table is created only if missing and altered in place; optional separate migration account                                                    |
| 4   | Authentication, authorisation, input validation, secure file access                          | Done   | Cookie sessions, CSRF, rate limiting through a trusted proxy count, four roles; file downloads only through an authorised endpoint, files outside any public folder                       |
| 5   | API documentation with examples and error codes                                              | Done   | `docs/API.md`, interactive OpenAPI at `/docs`                                                                                                                                             |
| 6   | Unit and integration tests for APIs, extraction, validation, persistence, audit verification | Done   | 129 unit + 62 integration tests                                                                                                                                                           |
| 7   | End-to-end testing of the frontend-to-database workflow                                      | Done   | `e2e/` — upload → review → database row; register → correct → verify → tamper detected; read-only auditor; phone layout                                                                   |
| 8   | Deployment instructions, configuration, environment variables                                | Done   | `docs/DEPLOYMENT.md`, `.env.example`, `docker-compose.yml`, CI container job                                                                                                              |

## Beyond the brief

- Dashboard with monthly figures, weight by mineral, recent activity and audit-chain health.
- Command search (Ctrl/⌘ K), light and dark themes, keyboard navigation and screen-reader labels.
- CSV export with protection against spreadsheet formula injection.
- Duplicate-upload warning, confidence score per value, side-by-side document preview.
- First administrator created from environment variables in production; no demo accounts unless requested.
- English and French throughout: every screen, number and date format, and the API's error messages (`Accept-Language`); the choice is saved with the account.
- User administration: add users with a one-time temporary password, change roles, disable accounts, reset passwords; the last administrator is protected and every change is logged.
- Reference-data screens for companies, locations, agents and mineral types, showing how many production records use each entry before it is retired.
- Activity log of administrative changes with filters.
- Settings: password change (forced after a temporary password), theme, table density, page size and date style.
- Help centre: searchable how-to articles, keyboard shortcuts (`?`, `g` then a letter), explanation tips on confidence, unmapped values, production IDs, reasons and integrity, and an administrator contact.
- A guided tour on first sign-in, limited to the screens the user's role can reach and replayable from the help panel.
