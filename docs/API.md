# API Reference

Interactive documentation (OpenAPI 3, generated from the same schemas the server validates with) is served at **`/docs`**; the raw document is at `/docs/json`. This page explains the conventions and shows real request/response examples.

## Conventions

| Topic          | Rule                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base URL       | `/api`                                                                                                                                              |
| Authentication | Session cookies set by `POST /api/auth/login` (`access_token` 15 min, `refresh_token` 7 days, both `httpOnly`, `SameSite=Strict`)                   |
| CSRF           | Every `POST`, `PUT`, `PATCH`, `DELETE` (except login) must send header `x-csrf-token` equal to the readable `csrf_token` cookie                     |
| Decimals       | Sent and returned as strings: percentages `"57.5700"` (DECIMAL 10,4), weights `"320.300"` (DECIMAL 12,3)                                            |
| Dates          | Calendar dates `YYYY-MM-DD`; timestamps ISO-8601 UTC (`2026-10-11T16:09:55.438Z`)                                                                   |
| Missing values | `null` — never `0`                                                                                                                                  |
| Pagination     | `?page=1&pageSize=20` (max 100) → `{ items, total, page, pageSize }`                                                                                |
| Language       | Send `Accept-Language` (`en` or `fr`); error `message` texts and `details.fields` come back in that language, English otherwise. Codes never change |
| Tracing        | Every response has an `x-request-id` header; errors repeat it as `error.requestId`                                                                  |

## Errors

All errors share one shape:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields need your attention.",
    "details": {
      "fields": { "tagNumber": "Tag number is required", "weightKg": "Must be greater than zero" }
    },
    "requestId": "484350ce-8ad0-4f77-9809-9b8ec4675793"
  }
}
```

| Code                                         | HTTP | When                                                                                                                                                                    |
| -------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`                          | 422  | Body, query or path parameters are invalid; `details.fields` maps each field to a message                                                                               |
| `REASON_REQUIRED`                            | 422  | A critical production field changed without a `reason`                                                                                                                  |
| `EXTRACTION_FAILED`                          | 422  | The report could not be read; `details.reason` is `encrypted`, `unreadable`, `too_many_pages`, `no_text`, `no_compounds` or `ocr_failed`, and `message` says what to do |
| `IDEMPOTENCY_KEY_REUSED`                     | 422  | The same `Idempotency-Key` was sent with a different body                                                                                                               |
| `UNAUTHENTICATED`                            | 401  | No valid session                                                                                                                                                        |
| `INVALID_CREDENTIALS`                        | 401  | Wrong email or password                                                                                                                                                 |
| `FORBIDDEN`                                  | 403  | The role does not allow the action                                                                                                                                      |
| `CSRF_FAILED`                                | 403  | Missing or wrong `x-csrf-token`                                                                                                                                         |
| `NOT_FOUND`                                  | 404  | Unknown record or route                                                                                                                                                 |
| `VERSION_CONFLICT`                           | 409  | The record changed since it was loaded; `details.currentVersion`                                                                                                        |
| `TAG_NUMBER_TAKEN` / `PRODUCTION_CODE_TAKEN` | 409  | Uniqueness violation; `details.field` names the field                                                                                                                   |
| `DUPLICATE_NAME`                             | 409  | Reference data name or code already exists                                                                                                                              |
| `ALREADY_CONFIRMED`                          | 409  | The extraction was already saved; `details.compoundId`                                                                                                                  |
| `REQUEST_IN_PROGRESS`                        | 409  | An identical idempotent request is still running                                                                                                                        |
| `EXTRACTION_EXPIRED`                         | 410  | Unconfirmed extractions expire after 24 hours                                                                                                                           |
| `FILE_TOO_LARGE`                             | 413  | Upload exceeds `MAX_UPLOAD_MB`                                                                                                                                          |
| `UNSUPPORTED_FILE_TYPE`                      | 415  | Content is not PDF/JPEG/PNG, or the file name disagrees with the content                                                                                                |
| `RATE_LIMITED`                               | 429  | Too many requests (login: 5 per minute per IP and email; extraction: 20 per minute)                                                                                     |
| `WRONG_PASSWORD`                             | 422  | The current password given to `change-password` is wrong; `details.fields.currentPassword`                                                                              |
| `SELF_CHANGE_NOT_ALLOWED`                    | 422  | An administrator tried to disable their own account or remove their own administrator role                                                                              |
| `ACCOUNT_DISABLED`                           | 401  | The account was disabled by an administrator; its sessions end at the next request                                                                                      |
| `PASSWORD_CHANGE_REQUIRED`                   | 403  | The user signed in with a temporary password and must call `change-password` first                                                                                      |
| `LAST_ADMIN`                                 | 409  | The change would leave no active administrator                                                                                                                          |
| `EMAIL_TAKEN`                                | 409  | Another account already uses this email; `details.field` is `email`                                                                                                     |
| `INTERNAL_ERROR`                             | 500  | Unexpected failure; details are logged, never returned                                                                                                                  |

In French (`Accept-Language: fr`) the same error reads `"message": "Certains champs demandent votre attention."` and `"tagNumber": "Le numéro d’étiquette est obligatoire"`; `code` and the shape stay the same.

## Permissions

| Action                                   | admin | supervisor |  operator   | auditor |
| ---------------------------------------- | :---: | :--------: | :---------: | :-----: |
| Upload, extract and save compounds       |   ✓   |     ✓      |      ✓      |    —    |
| View compounds and download report files |   ✓   |     ✓      |      ✓      |    ✓    |
| Create production records                |   ✓   |     ✓      |      ✓      |    —    |
| Edit non-critical production fields      |   ✓   |     ✓      | own records |    —    |
| Edit tag number, weight, mineral type    |   ✓   |     ✓      |      —      |    —    |
| Change the production ID                 |   ✓   |     —      |      —      |    —    |
| View history and verify integrity        |   ✓   |     ✓      |      —      |    ✓    |
| Manage reference data                    |   ✓   |     —      |      —      |    —    |
| Manage users and read the activity log   |   ✓   |     —      |      —      |    —    |

## Authentication

### `POST /api/auth/login`

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "supervisor@example.com", "password": "Demo!2026" }
```

`200` → `{ "user": { "id": 2, "name": "Eric Habimana", "email": "supervisor@example.com", "role": "supervisor" } }` and the three cookies. Errors: `INVALID_CREDENTIALS`, `RATE_LIMITED`, `VALIDATION_FAILED`.

### `POST /api/auth/refresh`

Rotates the refresh token and issues a new access token. Re-using an already-rotated refresh token revokes every session of that user. `200` → `{ "user": … }`; `401 UNAUTHENTICATED` when the session has ended.

### `POST /api/auth/logout` → `204`

### `GET /api/auth/me`

`200` → `{ "user": …, "mustChangePassword": false, "preferences": { "language": "fr", "theme": "system", "density": "comfortable", "pageSize": 20, "dateStyle": "local", "tour": null } }` or `401`.

### `POST /api/auth/change-password` → `204`

```json
{ "currentPassword": "old passphrase", "newPassword": "at least twelve characters" }
```

The new password needs at least 12 characters. Every other session of the user is signed out; the current one stays. Errors: `WRONG_PASSWORD`, `VALIDATION_FAILED`.

While `mustChangePassword` is `true` (after an administrator created the account or reset its password), every other endpoint except `GET /api/auth/me`, `POST /api/auth/logout` and `/api/me/preferences` answers `403 PASSWORD_CHANGE_REQUIRED`.

## Preferences

- `GET /api/me/preferences` → the preferences object shown above. Stored values that are missing or no longer valid come back as defaults.
- `PUT /api/me/preferences` with any subset, e.g. `{ "language": "fr", "pageSize": 50 }` → `200` with the merged preferences. Unknown keys or invalid values → `422 VALIDATION_FAILED`.

| Key         | Values                                 | Default          |
| ----------- | -------------------------------------- | ---------------- |
| `language`  | `en`, `fr`                             | `null` (browser) |
| `theme`     | `light`, `dark`, `system`              | `system`         |
| `density`   | `comfortable`, `compact`               | `comfortable`    |
| `pageSize`  | `10`, `20`, `50`                       | `20`             |
| `dateStyle` | `local`, `iso`                         | `local`          |
| `tour`      | `{ "version": 1, "completedAt": "…" }` | `null`           |

## Compounds

### `POST /api/compounds/extract`

Multipart upload. The `purchaseId` field must come **before** `file`.

```bash
curl -b cookies -H "x-csrf-token: $CSRF" \
  -F purchaseId=PO-2026-001 -F file=@analysis-certificate-text.pdf \
  http://localhost:8080/api/compounds/extract
```

`200` (nothing is stored in `Compound` yet):

```json
{
  "extractionId": "5d730a86-8490-45db-a867-92e8748b1fbd",
  "purchaseId": "PO-2026-001",
  "method": "text-layer",
  "pages": 1,
  "overallConfidence": 1,
  "fields": [
    {
      "column": "sn_percent",
      "label": "Sn",
      "value": "58.7200",
      "rawText": ". Sn 58.72",
      "confidence": 1,
      "uncertainty": null,
      "flags": []
    },
    {
      "column": "nb2o5_percent",
      "label": "Nb2O5",
      "value": "0.7000",
      "rawText": "Nb2O5 0.70",
      "confidence": 1,
      "uncertainty": null,
      "flags": []
    },
    {
      "column": "wo_percent",
      "label": "W",
      "value": null,
      "rawText": "W /",
      "confidence": 1,
      "uncertainty": null,
      "flags": ["missing_marker"]
    }
  ],
  "unmapped": [],
  "warnings": [],
  "duplicateOf": null,
  "rawText": "…"
}
```

- `method`: `text-layer` (selectable PDF text), `ocr` (images and scanned PDFs) or `hybrid` (mixed pages).
- `flags`: `low_confidence` (< 0.85), `fuzzy_name`, `conflict` (two different values; see `candidates`), `out_of_range` (> 100 %), `precision_truncated` (rounded to 4 decimals), `missing_marker` (`/`, `-`, `n.d.`, `<LOD` on the report → stored as NULL).
- `unmapped`: values found on the report that have no automatic column — `no_column` (e.g. element Nb when only Nb₂O₅ exists) or `manual_only` (columns with unclear meaning in the given schema).
- `warnings`: `TOTAL_EXCEEDS_100`, `DUPLICATE_FILE`, `LOW_OVERALL_CONFIDENCE`.

Errors: `FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`, `EXTRACTION_FAILED`, `VALIDATION_FAILED` (purchase ID), `FORBIDDEN`.

### `POST /api/compounds`

Saves the reviewed values. Columns that are omitted or `null` are stored as NULL.

```json
{
  "extractionId": "5d730a86-8490-45db-a867-92e8748b1fbd",
  "purchaseId": "PO-2026-001",
  "values": { "sn_percent": "58.72", "nb2o5_percent": "0.70", "wo_percent": null }
}
```

`201` → `{ "id": 42 }`. Each value must be 0–100 with at most 4 decimals. Errors: `VALIDATION_FAILED`, `ALREADY_CONFIRMED`, `EXTRACTION_EXPIRED`, `NOT_FOUND`, `FORBIDDEN`.

### `GET /api/compounds?purchaseId=PO-2026&from=2026-10-01&to=2026-10-31&page=1&pageSize=20`

Summaries: `{ id, purchaseId, extractionDate, fileName, method, overallConfidence, valuesCount }`.

### `GET /api/compounds/:id`

Summary plus `mimeType`, `values` (all 50 columns, `null` where empty), `unmapped`, `warnings`.

### `GET /api/compounds/:id/file`

Streams the original report (`Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`). Files are kept outside any public folder under random names.

## Production

### `POST /api/production`

Optional header `Idempotency-Key: <8–64 letters, digits or dashes>` makes retries safe: the same key and body return the stored response with header `idempotent-replayed: true`.

```json
{
  "tagNumber": "TAG-4509",
  "productionDate": "2026-10-10",
  "mineralTypeId": 1,
  "weightKg": "320.3",
  "businessLocationId": 1,
  "traceabilityAgentId": 1,
  "companyId": 1,
  "operatorRepresentative": "Jean Mugabo"
}
```

`201` → the record. `productionCode` is generated as `PRD-YYYY-NNNNNN` unless supplied. Rules: tag number unique (stored upper-case), production date not in the future in the business time zone (`APP_TIMEZONE`), weight > 0 with at most 3 decimals, references must exist and be active.

### `GET /api/production`

Query: `q` (production ID or tag, partial), `mineralTypeId`, `companyId`, `locationId`, `from`, `to`, `sort` (`createdAt`, `productionDate`, `weightKg`, `tagNumber`, prefix `-` for descending; default `-createdAt`), `page`, `pageSize`.

```json
{
  "items": [
    {
      "id": 8,
      "productionCode": "PRD-2026-000008",
      "tagNumber": "TAG-4508",
      "productionDate": "2026-10-06",
      "weightKg": "760.800",
      "mineralType": { "id": 3, "name": "Wolframite (Tungsten)", "code": "W" },
      "businessLocation": { "id": 4, "name": "Rubavu Processing Plant" },
      "traceabilityAgent": { "id": 2, "name": "Western Region Traceability Desk" },
      "company": { "id": 4, "name": "Kivu Ores Trading" },
      "operatorRepresentative": "Aline Umutoni",
      "version": 1,
      "createdBy": { "id": 3, "name": "Grace Mukamana" },
      "createdAt": "2026-10-11T16:09:55.438Z",
      "updatedBy": null,
      "updatedAt": "2026-10-11T16:09:55.438Z"
    }
  ],
  "total": 8,
  "page": 1,
  "pageSize": 1
}
```

### `GET /api/production/export.csv`

Same filters; returns UTF-8 CSV (with BOM for Excel). Cells starting with `=`, `+`, `-` or `@` are prefixed with `'` so spreadsheets do not run them as formulas.

### `GET /api/production/:id`

### `PUT /api/production/:id`

Full record plus `version` (from the last read) and, when the tag number, weight, mineral type or production ID changes, a `reason` (5–500 characters).

```json
{
  "productionCode": "PRD-2026-000001",
  "tagNumber": "TAG-4501",
  "productionDate": "2026-09-01",
  "mineralTypeId": 1,
  "weightKg": "1248.9",
  "businessLocationId": 1,
  "traceabilityAgentId": 1,
  "companyId": 1,
  "operatorRepresentative": "Jean Mugabo",
  "version": 1,
  "reason": "Re-weighed on the certified warehouse scale"
}
```

`200` → the updated record (`version` + 1). Errors: `VERSION_CONFLICT`, `REASON_REQUIRED`, `FORBIDDEN` (operator editing someone else's record or a critical field; non-admin changing the ID), `TAG_NUMBER_TAKEN`, `PRODUCTION_CODE_TAKEN`, `VALIDATION_FAILED`.

## Audit trail

### `GET /api/production/:id/history`

```json
[
  {
    "seq": 1,
    "eventType": "CREATE",
    "changes": [
      {
        "field": "productionCode",
        "from": null,
        "to": "PRD-2026-000001",
        "fromLabel": null,
        "toLabel": "PRD-2026-000001"
      },
      { "field": "weightKg", "from": null, "to": "1250.500", "fromLabel": null, "toLabel": "1250.500 kg" },
      {
        "field": "mineralTypeId",
        "from": null,
        "to": 1,
        "fromLabel": null,
        "toLabel": "Cassiterite (Tin) (SN)"
      }
    ],
    "reason": null,
    "actor": { "id": 1, "label": "Alice Uwase (admin)" },
    "occurredAt": "2026-10-11T16:09:55.143Z",
    "prevHash": "0000000000000000000000000000000000000000000000000000000000000000",
    "hash": "9c82a90c58151748b13c5244fdeba431bb3469338f5ddd745e0314df246fb939"
  }
]
```

### `GET /api/production/:id/verify`

`200` → `{ "status": "intact", "eventsChecked": 2 }` or

```json
{
  "status": "tampered",
  "eventsChecked": 2,
  "failure": { "seq": 2, "reason": "HASH_MISMATCH", "message": "Event #2 was altered after it was recorded." }
}
```

How it works: every change to the production ID, tag number, weight or mineral type appends an event whose `hash` is `HMAC-SHA256(AUDIT_SECRET, canonical JSON of the event including prevHash)`. The record update and its event are written in one transaction, and database triggers reject `UPDATE` and `DELETE` on the event table. Verification recomputes the chain and checks:

| Check                                                                                   | Detects                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `seq` runs 1…n and starts with `CREATE` (`SEQUENCE_GAP`, `MISSING_CREATE`, `NO_EVENTS`) | Deleted events                                   |
| Each `prevHash` equals the previous `hash` (`PREV_HASH_MISMATCH`)                       | Re-ordered or spliced events                     |
| Each recomputed HMAC equals the stored `hash` (`HASH_MISMATCH`)                         | Edited events, chains rebuilt without the secret |
| Replaying all changes reproduces the live record (`STATE_MISMATCH`)                     | Direct edits to the record, deleted latest event |

Verification reads the record and its events in one consistent snapshot, so an edit saved at the same moment never shows as tampering. Limit: someone with full database access who removes the triggers, deletes a record's latest events and also rolls the record back to the values before them — or deletes a record with its whole history — leaves nothing in the database to contradict it. Detecting that requires a copy of the chain heads kept outside the database.

## Reference data

- `GET /api/reference/{companies|locations|agents|mineral-types}` → `[{ "id": 1, "name": "Cassiterite (Tin)", "code": "SN", "active": true, "usageCount": 0 }]`. Admins may add `?includeInactive=true`; `usageCount` (production records using the entry) is computed only then and is `0` otherwise.
- `POST /api/reference/{kind}` (admin) → `201`; mineral types require `code`
- `PATCH /api/reference/{kind}/{id}` (admin) → `200`; `{ "active": false }` retires an entry without breaking existing records

Every create, rename, retirement and reactivation is recorded in the activity log.

## Users and activity (administrators)

### `GET /api/users`

`200` → `[{ "id": 5, "name": "Diane Uwimana", "email": "diane@example.com", "role": "operator", "active": true, "mustChangePassword": true, "lastSignInAt": null, "createdAt": "2026-10-12T09:14:03.000Z" }]`

### `POST /api/users`

```json
{ "name": "Diane Uwimana", "email": "diane@example.com", "role": "operator" }
```

`201` → `{ "user": { … }, "temporaryPassword": "q7XkPm2vRt9wHa4s" }`. The 16-character temporary password is shown once, is never logged or stored in clear, and must be changed at first sign-in. Errors: `EMAIL_TAKEN`, `VALIDATION_FAILED`.

### `PATCH /api/users/:id`

Any of `{ "name": "…", "role": "supervisor", "active": false }` → `200` with the user. A role change applies from the user's next request; disabling signs the user out everywhere. Errors: `SELF_CHANGE_NOT_ALLOWED`, `LAST_ADMIN`, `NOT_FOUND`.

### `POST /api/users/:id/reset-password`

`200` → `{ "user": { … }, "temporaryPassword": "…" }`; the user is signed out everywhere and must change the password at the next sign-in.

### `GET /api/admin/activity?action=user.created&targetType=user&page=1&pageSize=20`

```json
{
  "items": [
    {
      "id": 12,
      "actor": { "id": 1, "label": "Alice Uwase (admin)" },
      "action": "user.updated",
      "targetType": "user",
      "targetId": 5,
      "targetLabel": "Diane Uwimana (diane@example.com)",
      "before": { "role": "operator" },
      "after": { "role": "supervisor" },
      "occurredAt": "2026-10-12T09:20:41.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 20
}
```

`action` is one of `user.created`, `user.updated`, `user.disabled`, `user.enabled`, `user.password_reset`, `reference.created`, `reference.updated`, `reference.retired`, `reference.reactivated`; `targetType` is `user` or `reference`. Only changed fields appear in `before` and `after`; passwords never do.

## Help

`GET /api/help/contact` (any signed-in user) → `{ "email": "admin@example.com" }`: the administrator shown in the help panel, or `null` when there is none.

## Dashboard

`GET /api/dashboard/summary` → counts for the current month (business time zone), weight by mineral, the eight latest audit events and the result of verifying every record's chain.

## Health

`GET /api/health` → `{ "status": "ok", "db": "ok" }` (no authentication).
