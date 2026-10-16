# Usability and Administration — Design

Date: 2026-10-12
Status: Approved for planning
Builds on: `2026-10-11-system-design.md`

## 1. Purpose

Make the application easier to adopt and complete as a business system:

1. **Languages** — English and French across the interface and the API's messages.
2. **User preferences** — per-user settings saved on the server, and self-service password change.
3. **Administration** — screens to manage reference data and user accounts, with an activity log.
4. **Help centre** — in-app how-to articles, keyboard shortcuts and contextual tips.
5. **Guided tour** — a role-aware walkthrough on first sign-in, replayable on demand.

### Success criteria

- Every interface text exists in English and French; a missing French key fails the type check.
- An API request with `Accept-Language: fr` receives French error and validation messages; error codes are unchanged.
- An administrator can add a user, change a role, disable or re-enable an account, reset a password, and manage companies, locations, agents and mineral types without leaving the application.
- The system can never be left without an active administrator.
- Every administrative action appears in the activity log with actor, time and before/after values.
- A new user is guided by a tour on first sign-in, can skip it, and is not shown it again until the tour version changes.
- Existing behaviour, data and tests of Tasks 1 and 2 are unaffected.

### Out of scope

- Languages other than English and French (the structure allows adding more).
- Translating user-entered data, recognised report text, chemical formulas, the README and the API reference.
- Single sign-on, password-reset emails and self-registration.

## 2. Languages

### 2.1 Catalogues

| Location                                     | Contents                                                                                                                               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts/src/i18n/en.ts`, `fr.ts` | Messages shared by API and web: validation messages, API error messages                                                                |
| `apps/web/src/i18n/en.ts`, `fr.ts`           | Interface texts, grouped by area: `common`, `nav`, `auth`, `dashboard`, `compounds`, `production`, `admin`, `settings`, `help`, `tour` |

- `en` is the source; `fr` is typed `Messages<typeof en>`, so every key must exist with the same shape. A missing or misspelt key fails `tsc`.
- Message syntax: `{name}` placeholders. Plurals use `Intl.PluralRules` with `{ one, other }` variants.
- `t(key, values?)` — key is a typed dotted path (e.g. `'production.form.weight.label'`).

### 2.2 Shared validation messages

The zod schemas in `contracts` carry message **keys** (`'validation.weight.positive'`) instead of English sentences. The web resolves keys in the active language; the API resolves them per request (§2.4). Keys without a catalogue entry fall back to the key's English text.

### 2.3 Choosing the language

Order: saved preference → browser language (`fr*` → French) → English. A switch in the top bar and in the user menu changes the language immediately (no reload), updates `<html lang>`, and saves the preference when signed in.

### 2.4 API

- The web sends `Accept-Language: en` or `fr` on every request.
- A request hook picks `fr` when the header prefers French, otherwise `en`.
- `errorHandler` translates `error.message` and each `details.fields` message from keys. Error codes, status codes and the response shape are unchanged.

### 2.5 Formatting

`format.ts` takes the active locale (`en-GB`, `fr-FR`): dates (`1 Oct 2026` / `1 oct. 2026`), numbers (`1,248.900` / `1 248,900`), relative times. Stored values remain decimal strings; only display changes. The date-style preference (§3) can switch display dates to ISO.

## 3. User preferences

### 3.1 Data

`users.preferences JSON NULL`, validated by `userPreferences` (contracts):

| Key         | Values                                             | Default       |
| ----------- | -------------------------------------------------- | ------------- |
| `language`  | `en`, `fr`                                         | from §2.3     |
| `theme`     | `light`, `dark`, `system`                          | `system`      |
| `density`   | `comfortable`, `compact`                           | `comfortable` |
| `pageSize`  | `10`, `20`, `50`                                   | `20`          |
| `dateStyle` | `local`, `iso`                                     | `local`       |
| `tour`      | `{ version: number, completedAt: string \| null }` | `null`        |

Unknown keys are dropped; invalid values fall back to defaults.

### 3.2 API

- `GET /api/me/preferences` → stored preferences merged with defaults.
- `PUT /api/me/preferences` → partial update, returns the merged result.
- `POST /api/auth/change-password` → `{ currentPassword, newPassword }`; new password at least 12 characters and different from the current one; clears `must_change_password`; revokes the user's other sessions.

### 3.3 Interface

`/settings` (all users, from the user menu): Profile (name, email, role — read-only), Preferences (immediate apply + save), Password. When `must_change_password` is set, every route redirects to a password-change screen until it is done.

## 4. Administration

Visible only with `admin:manage` (administrators). New sidebar section "Administration".

### 4.1 Reference data — `/admin/reference`

- Tabs: Companies, Locations, Agents, Mineral types.
- Searchable table: name, code (mineral types), status, number of production records using it.
- Add, rename, retire, reactivate. Retiring confirms and explains that existing records keep the entry.
- Existing reference endpoints gain `usageCount` and write to the activity log.

### 4.2 Users — `/admin/users`

- Table: name, email, role, status, last sign-in.
- **Add user:** name, email, role. The server generates a temporary password (16 characters, readable alphabet), returns it once; the interface shows it with a copy button and a warning that it will not be shown again. `must_change_password = true`.
- **Edit:** name and role.
- **Disable / re-enable:** disabling revokes all of the user's refresh tokens; a disabled user cannot sign in.
- **Reset password:** new temporary password shown once; revokes the user's sessions; sets `must_change_password`.
- **Safeguards (server-enforced):** an administrator cannot disable or demote themselves; the last active administrator cannot be disabled or demoted. Violations return `409 LAST_ADMIN` or `422 SELF_CHANGE_NOT_ALLOWED`.
- Access tokens of a disabled or demoted user stop working within at most 15 minutes; the authenticate hook re-checks `active` on every request to make disabling immediate.

### 4.3 Activity log — `/admin/activity`

Table `admin_activity`: `id`, `actor_id`, `actor_label`, `action`, `target_type`, `target_id`, `target_label`, `before JSON NULL`, `after JSON NULL`, `occurred_at DATETIME(3)`.

Actions: `user.created`, `user.updated`, `user.disabled`, `user.enabled`, `user.password_reset`, `reference.created`, `reference.updated`, `reference.retired`, `reference.reactivated`. Passwords and hashes never appear in `before`/`after`.

`GET /api/admin/activity?page&pageSize&action&targetType` → paginated, newest first. Read-only; no update or delete endpoint.

### 4.4 Data model changes — migration `0007_usability.sql`

```sql
ALTER TABLE users ADD COLUMN preferences JSON NULL,
                  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
                  ADD COLUMN last_sign_in_at DATETIME(3) NULL;
CREATE TABLE admin_activity (…);  -- §4.3, index on occurred_at
```

No change to `Compound`, `production`, `production_audit_event` or reference tables.

### 4.5 Permissions

New action `admin:manage` (administrators). `reference:manage` remains for compatibility and maps to administrators. All new routes and screens use `can()`.

## 5. Help centre

Side panel opened from a `?` button in the top bar or the `?` key.

- **Articles** (translated, defined in code): upload and review a report; confidence and flags; register and correct production; verify history; manage reference data and users (administrators only). Each article: title, 3–6 steps, a link to the relevant screen. Filter box searches titles and steps.
- **Keyboard shortcuts:** `Ctrl/⌘ K` search, `?` help, `g d` dashboard, `g p` production, `g c` compound analyses, `g u` upload. Shortcuts ignore keystrokes while typing in inputs.
- **Contextual tips:** an `InfoTip` (ⓘ button + popover) beside: confidence chip, "Found but not saved", reason for change, Production ID, Verify integrity.
- **Contact:** "Contact your administrator" with the first active administrator's email from `GET /api/help/contact`.

## 6. Guided tour

- Library: `driver.js`.
- Steps are built by `buildTour(user, isVisible)`; steps whose target element is absent or hidden are dropped:

| Group          | Shown to                                   | Steps (target)                                                                                                                     |
| -------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Common         | everyone                                   | welcome (none); navigation (`nav`); search (`search`); language switch (`language`); theme (`theme`); help (`help`)                |
| Laboratory     | `compound:extract`                         | upload report (`nav-upload`); confidence and "Looks correct" (explained on the help step, since the review screen needs an upload) |
| Production     | `production:create`                        | register production (`nav-register`); reasons for critical changes and history (`nav-production`)                                  |
| Audit          | `audit:verify` and not `production:create` | history and verification (`nav-production`)                                                                                        |
| Administration | `admin:manage`                             | administration area (`nav-admin`)                                                                                                  |
| Closing        | everyone                                   | where to replay the tour (`help`)                                                                                                  |

- Targets are marked with `data-tour="…"` attributes, never CSS classes.
- `TOUR_VERSION` constant. The tour starts automatically after sign-in when `preferences.tour?.version !== TOUR_VERSION`; finishing or skipping saves `{ version: TOUR_VERSION, completedAt }`.
- Help menu → "Take the tour" restarts it at any time.
- Texts translated; keyboard: arrows, Esc to close.

## 7. Errors (additions)

| Code                       | HTTP | When                                                                                            |
| -------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| `LAST_ADMIN`               | 409  | Would leave no active administrator                                                             |
| `SELF_CHANGE_NOT_ALLOWED`  | 422  | Administrator disabling or demoting themselves                                                  |
| `EMAIL_TAKEN`              | 409  | Creating a user with an existing email                                                          |
| `WRONG_PASSWORD`           | 422  | Current password incorrect on change                                                            |
| `PASSWORD_CHANGE_REQUIRED` | 403  | Any API call other than auth/me/preferences/change-password while `must_change_password` is set |
| `ACCOUNT_DISABLED`         | 401  | Disabled account signing in or using an existing session                                        |

## 8. Testing

- **Type check:** French catalogues complete.
- **Unit:** `t()` placeholders and plurals; locale formatting; preference parsing/defaults; `buildTour` per role and with hidden targets; shortcut handling ignores inputs; help search.
- **Integration:** `Accept-Language: fr` errors and field messages; preferences GET/PUT; change password (wrong current, too short, success revokes other sessions); users CRUD; safeguards (`LAST_ADMIN`, `SELF_CHANGE_NOT_ALLOWED`); disabled user rejected on next request and at sign-in; temporary password forces change (`PASSWORD_CHANGE_REQUIRED`); every admin action logged without secrets; reference `usageCount`.
- **End-to-end:** admin creates a user → new user signs in → forced password change → tour appears, skipped, not shown after reload → switches to French → main screens in French; help panel opens with `?` and finds an article.

## 9. Order of delivery

1. Languages (catalogues, `t()`, formatting, API localisation, switch).
2. Preferences and password change (migration, endpoints, settings page, forced change).
3. Administration (users, reference screens, activity log, safeguards).
4. Help centre.
5. Guided tour.

Each step leaves the application working and the full test suite green.
