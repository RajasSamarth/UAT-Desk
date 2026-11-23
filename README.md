# UAT Desk — acceptance testing and sign-off

UAT Desk is a complete system for running client user acceptance testing (UAT) and collecting a verifiable sign-off. It has two sides:

- **Company side** — dashboard, new project, checklist upload, client access links, results, retest loop, certificate management.
- **Client side** — password login, tester details, sequential milestones, Pass/Fail/N/A results with comments and screenshots, sign-off with email OTP and a signature, and a completion certificate.

There are two ways to use it:

1. **Standalone demo** — `UAT Desk.html` (single HTML file, opens in any modern browser, no server required). Browser-only data; useful for demos and exploration.
2. **Production server layer** — Node 22 + Express + PostgreSQL under `server/`. Replaces localStorage/simulated behavior with real persistence, server-side auth, real OTP email, IP/device capture, S3-compatible storage, server-generated PDFs, public verification, and an append-only audit log.

The standalone `UAT Desk.html` remains intact and unchanged.

## Quick start — production server

Requires Docker Desktop (PostgreSQL) and Node 22.

```powershell
# 1. Start the database
docker compose up -d db

# 2. Install the server app
cd server
copy .env.example .env
# edit server/.env if you want to change admin credentials, SMTP, storage driver, etc.
npm install

# 3. Prepare the database
npm run migrate
npm run seed:demo

# 4. Start the app
npm start
# open http://localhost:3000 (or http://127.0.0.1:3100 if PORT=3100)
# Note: Use HTTP only for local development (NOT https://).
```

Sign-in credentials created by `npm run seed:demo`:

| Role | Email | Password |
|------|-------|----------|
| Company admin | admin@uatdesk.local (or `ADMIN_EMAIL` in `.env`) | change-me-now |
| Demo client 1 | link `UAT-ACME23` | acme-uat-2026 |
| Demo client 2 | link `UAT-NWFS10` | northwind-fs-01 |

> If `ADMIN_EMAIL` in `.env` differs from what was seeded, run `npm run seed -- --reset-admin` to sync the database with `.env`.

No SMTP server is configured by default, so OTP codes are written to the `dev_outbox` table and surfaced on the sign-off page for convenience. In development, if SMTP delivery fails, the system automatically falls back to `dev_outbox` so sign-off is never blocked.

## What the production layer provides

- PostgreSQL persistence: company users, products, clients, projects, access links, milestones, checklist items, append-only item results, testers, OTP challenges, sign-offs, audit log, dev outbox.
- Server-side auth: company and client sessions, CSRF tokens, rate limiting, access-link lockout after 5 failed passwords.
- Real OTP email via SMTP (or dev outbox in development), 6-digit codes valid 10 minutes.
- IP and device capture on every request and on sign-off; audit-logged.
- Screenshot storage with local (default) or S3-compatible driver; served through authenticated routes.
- Server-generated PDF certificates (pdfkit) with verification ID, milestone table, signature, SHA-256 record fingerprint, IP/device note, and verification URL.
- Public certificate verification at `/verify?id=VC-XXXX-XXXX`, including PDF fingerprint checking.
- Append-only audit log.

## Project structure

```
UAT Desk.html              # standalone demo (keep intact)
README.md                  # this file
docker-compose.yml         # PostgreSQL + optional MinIO + app service
server/
  package.json
  .env.example / .env      # configuration
  src/
    index.js               # entry point
    app.js                 # Express bootstrap, security, error handling
    config.js, db.js, migrate.js
    security.js            # scrypt password/OTP hashing, canonical hashes
    audit.js               # append-only audit log
    email.js               # SMTP or dev outbox
    storage.js             # local / S3 abstraction
    checklist.js           # xlsx/csv template parsing and validation
    projectService.js      # project bundle, milestones, stats, dashboard
    pdf.js                 # server-side certificate PDF
    auth.js                # session, CSRF, client-project middleware
    rateLimiters.js        # per-route rate limiting
    helpers.js             # formatting helpers
    routes/company.js
    routes/client.js
    routes/public.js
    views/**               # EJS server-rendered views (reuse prototype visual language)
    public/styles.css, public/app.js
    add-user.js, seed.js
  test/e2e.test.js         # end-to-end test (supertest)
```

## Security summary

- Passwords and OTPs hashed with Node `crypto` scrypt / HMAC (no native bcrypt).
- Session cookie `uatdesk.sid` (HttpOnly, SameSite lax; secure by default in production).
- CSRF token per session; rate limiters on login, OTP, results, and public verification.
- Uploaded files validated by magic bytes and extension; 5 MB checklist limit, 15 MB PDF limit.
- Storage path traversal protection; screenshots and PDFs served through authenticated routes.
- No public JSON API surface beyond health and HTML verification pages.

## More details

See `server/README.md` for environment variables, routes, Docker deployment, and the production checklist.