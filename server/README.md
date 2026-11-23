# UAT Desk — production server layer

Server-rendered Express application backed by PostgreSQL. Replaces the browser-only `UAT Desk.html` demo with real persistence, server-side auth, OTP email, screenshot storage, PDF certificates, public verification, and audit logging.

## Prerequisites

- Node 20+ (developed/tested on Node 22)
- PostgreSQL 14+ (16 recommended; Docker container provided at repo root)
- Optional: SMTP server for real OTP email; S3-compatible bucket (MinIO provided) for screenshot/PDF storage

## Quick start

From the repository root:

```powershell
# 1. Start PostgreSQL (port 5432)
docker compose up -d db

# 2. Install the server
cd server
copy .env.example .env
npm install

# 3. Migrate and seed demo data
npm run migrate
npm run seed:demo

# 4. Start the app
npm start
# open http://localhost:3000
```

Demo credentials (from `npm run seed:demo`):

- Company: `admin@uatdesk.local` / `change-me-now`
- Client link 1: `UAT-ACME23` / `acme-uat-2026` (Acme Retail, one item left to fix)
- Client link 2: `UAT-NWFS10` / `northwind-fs-01` (Northwind Logistics, fresh)

No SMTP by default: OTP codes are logged to console and written to the `dev_outbox` table, and shown on the sign-off page.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Run the app (port 3000 by default, or PORT from .env) |
| `npm run dev` | Run with Node `--watch` for development |
| `npm run migrate` | Apply `migrations/001_init.sql` |
| `npm run seed:demo` | Create admin user + two demo client projects with known passwords |
| `npm run seed -- --reset-admin` | Sync admin user email and password in the DB with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` |
| `npm run user:add -- email "Name" "password"` | Add/update a company user (CLI) |
| `npm run test:unit` | Run unit tests (fast, no PostgreSQL database required) |
| `npm test` | Run the full test suite (unit + E2E against PostgreSQL) |

## Configuration (`server/.env`)

| Variable | Default | Notes |
|----------|---------|-------|
| `NODE_ENV` | `development` | `production` enables secure session cookies |
| `PORT` | `3000` | App listen port |
| `APP_BASE_URL` | `http://localhost:3000` | Base URL used in emails and verification links |
| `DATABASE_URL` | `postgres://uat:uat@localhost:5432/uatdesk` | PostgreSQL connection string |
| `SESSION_SECRET` | (required example in `.env.example`) | Session signing secret — change in production |
| `ADMIN_EMAIL` | `admin@uatdesk.local` | Seeded company admin email |
| `ADMIN_PASSWORD` | `change-me-now` | Seeded company admin password — change it |
| `MAIL_FROM` | `UAT Desk <no-reply@uatdesk.local>` | Sender for OTP / certificate emails |
| `SMTP_URL` | (none) | Nodemailer SMTP connection string; omit for dev outbox mode |
| `STORAGE_DRIVER` | `local` | `local` or `s3` |
| `STORAGE_DIR` | `./storage` | Local storage root |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | (none) | S3-compatible settings (MinIO) |
| `TRUST_PROXY` | `false` | Set `true` behind a reverse proxy so `req.ip` is the client IP |
| `COOKIE_SECURE` | `true` when `NODE_ENV=production` | Set `false` only for local HTTP production-mode containers |

## Docker

`docker-compose.yml` at the repo root defines:

- `db` — PostgreSQL 16 (port 5432)
- `app` — builds `./server`, runs migrations then the app (port 3000)
- `minio` — optional S3-compatible storage, profile `s3` (`docker compose --profile s3 up -d`)

Example production-style run:

```powershell
docker compose up -d db
# set SMTP_URL, SESSION_SECRET, ADMIN_PASSWORD, APP_BASE_URL as needed
docker compose up -d app
npm run seed --prefix server -- --reset-admin   # optional
```

The app container runs `node src/migrate.js && node src/index.js` on startup, so the schema is always current.

## Data model

Tables: `company_users`, `products`, `clients`, `projects`, `access_links`, `milestones`, `checklist_items`, `item_results`, `testers`, `otp_challenges`, `signoffs`, `audit_log`, `dev_outbox`, `schema_migrations`.

Key relationships: one project → one access link, many milestones → many checklist items → many append-only item results. One sign-off per project stores verification ID, record fingerprint (SHA-256 of canonical JSON), PDF fingerprint, signer details, OTP verification time, IP/user-agent, and optional drawn signature.

## Routes

All routes are server-rendered HTML (EJS); there is no public JSON API.

- `GET /` — home page: choose between Client Portal, Company Workspace, or Certificate Verification
- `GET/POST /client` — dedicated client portal: open checklist with Project ID (e.g. `UAT-ACME23`) and password
- `GET/POST /company/login` — company sign-in
- `GET /company` — company dashboard (projects, stats, current milestone)
- `GET/POST /company/projects/new` — create a project with checklist upload (`.xlsx` / `.csv`)
- `GET /company/projects/:id` — project detail: progress, milestones, items, credentials, access controls, activity
- `POST /company/projects/:id/password` — rotate client password
- `POST /company/projects/:id/expiry` — change link end date
- `POST /company/projects/:id/revoke` — revoke/restore client access
- `POST /company/projects/:id/items/:itemId/fix` — mark a failed item fixed and send for retest
- `GET /company/projects/:id/certificate.pdf` — download signed certificate PDF
- `GET/GET /company/template.xlsx\|.csv` — download checklist template
- `GET/POST /p/:token` — client password entry
- `GET/POST /p/:token/tester` — tester name/email
- `GET /p/:token/portal` — sequential checklist portal with results, screenshots, retest
- `POST /p/:token/items/:itemId/screenshot` — attach/replace screenshot
- `POST /p/:token/items/:itemId/result` — save Pass/Fail/N/A result
- `GET/POST /p/:token/signoff` — sign-off: signer details → OTP verify → drawn/typed signature → certificate
- `GET /p/:token/certificate` — signed certificate page
- `GET /p/:token/certificate.pdf` — download PDF
- `GET /p/:token/signature` — serve stored signature image
- `GET/POST /verify` — public certificate verification by ID
- `POST /verify/pdf` — check an uploaded PDF against its stored fingerprint
- `GET /healthz` — health check
- `GET /company/logout`, `POST /p/:token/logout` — sign out

## Security controls

- Passwords/OTPs hashed with Node `crypto` scrypt / HMAC (no bcrypt dependency).
- Session cookie `uatdesk.sid` — HttpOnly, SameSite lax, secure by default in production.
- CSRF token (`_csrf`) per session on all mutating routes.
- Rate limiters on company login, client login, OTP start/verify, results/screenshots, and public verification.
- Access-link lockout: 5 failed passwords → 15 minutes.
- File uploads validated by magic bytes + extension; 5 MB checklist limit, 15 MB PDF limit.
- Storage path traversal protection; screenshots/PDFs served only through authenticated routes.
- OTP: 6-digit code, valid 10 minutes, 5 attempts, old codes invalidated on resend.
- Electronic signature (drawn PNG or typed Helvetica-Oblique), not certificate-based digital signature.
- IP/user-agent captured on requests and sign-off; audit log append-only.

## Email / OTP

When `SMTP_URL` is unset, `email.js` logs emails to console and inserts them into `dev_outbox`. Query the latest code:

```sql
SELECT body FROM dev_outbox WHERE to_email = 'signer@example.com' ORDER BY id DESC LIMIT 1;
```

The 6-digit code is also rendered on the sign-off page in development mode.

## Storage

- `local`: files under `STORAGE_DIR/projects/<projectId>/...`
- `s3`: S3-compatible bucket via `@aws-sdk/client-s3`
- Screenshots stored per checklist item (`image_key`); PDFs stored per sign-off (`signature_key` / `pdf_key`)

## Tests

`server/test/e2e.test.js` exercises the full flow with supertest against a real database: company login, project creation, client login/tester, screenshot upload, results across milestones, retest loop, OTP sign-off (from `dev_outbox`), drawn signature, PDF certificate, and public verification including PDF fingerprint check.

```powershell
npm test
```

## Production checklist

Before exposing this to real users:

- [ ] Run behind TLS (HTTPS) and set `COOKIE_SECURE=true`, `TRUST_PROXY=true` if behind a load balancer.
- [ ] Configure `SMTP_URL` so OTP emails are delivered; test delivery and spam folder placement.
- [ ] Change `ADMIN_PASSWORD`, `SESSION_SECRET`, and any demo passwords; remove or rotate seed data.
- [ ] Use `STORAGE_DRIVER=s3` with a dedicated bucket and least-privilege credentials; enable versioning/encryption.
- [ ] Set up PostgreSQL backups and point-in-time recovery; test restore.
- [ ] Add company user management / SSO (OIDC/SAML) at the `company_users` authentication layer if required.
- [ ] Confirm e-signature legality for your jurisdiction; retain audit log and signer email/OTP evidence.
- [ ] Add log aggregation, monitoring, and alerting (errors, rate-limit triggers, failed logins).
- [ ] Consider Redis-backed rate limiting and session store for multi-instance deployments.
- [ ] Add upload antivirus scanning and file-type revalidation for screenshot/PDF uploads.
- [ ] Define data retention and deletion policy (GDPR / privacy), including tester emails and IP addresses.

## Notes

- The standalone `UAT Desk.html` at the repo root is intentionally left unchanged from the prototype phase.
- No git repository exists in this workspace; all changes are uncommitted plain files.