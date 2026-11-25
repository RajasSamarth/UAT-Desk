# UAT Desk — Frontend Rebuild Brief

> Paste this whole document into the AI/agent or hand it to the frontend team.
> It is self-contained: context, stack, design system, every screen, every
> component, data contracts, rules, and definition of done.

---

## 0. Context

**UAT Desk** is a B2B web application for running **user acceptance testing (UAT)**
on a software release and collecting a **tamper-evident electronic sign-off**
that produces a verifiable completion certificate.

There are three audiences:

1. **Company / release team** — signs in, uploads a checklist, creates a project,
   monitors progress, sends failed items back for retest, manages client access.
2. **Client testers** — open a private link, enter a password, work through
   milestones in order marking each item **Pass / Fail / N/A**, attach
   screenshots, then sign off with a 6-digit email code and a signature.
3. **Anyone** — verifies a certificate by its verification ID and can check a
   downloaded PDF against its SHA-256 fingerprint.

A working **Express + PostgreSQL + S3** backend already exists and is in
production. It is the source of truth. **Your job is to build the new frontend,
not to reinvent the business rules.**

---

## 1. Goal

Deliver a **production-grade, responsive, accessible** frontend that covers
**100% of the screens and flows** described below, looks like a modern SaaS
product, and preserves every server-side rule.

Success means:

- A company user can go from sign-in → new project → share credentials →
  watch progress → send a fix → download the certificate without touching a
  terminal.
- A client tester can complete a checklist on a phone, in order, with evidence,
  and sign off without confusion or dead ends.
- A verifier can confirm a certificate in under 15 seconds.
- Nothing regresses: same routes, same validation, same security posture.

---

## 2. Non-negotiables (do not break these)

| # | Rule |
|---|------|
| 1 | Auth is a **server session cookie** named `uatdesk.sid` (httpOnly, `SameSite=Lax`, `Secure` in production). Do **not** move auth to `localStorage`. |
| 2 | Every mutating request sends a **CSRF token** — `_csrf` form field or `X-CSRF-Token` header — and cookies (`credentials: 'include'`). |
| 3 | **Never** put passwords, session tokens, DB URLs, or S3 keys in client code, `localStorage`, or `sessionStorage`. |
| 4 | Respect the existing CSP: no inline `<script>`, no `eval`, images only from self + `data:`, styles self + inline, `frame-ancestors 'none'`. |
| 5 | Uploads are capped at **4 MB** (`MAX_UPLOAD_MB`). Screenshots: PNG/JPG only. Checklists: `.xlsx` / `.csv`. Certificate check: `.pdf`. |
| 6 | The checklist is **snapshotted** at project creation and is immutable. Never offer editing of item text after creation. |
| 7 | Dates are **calendar dates** (`YYYY-MM-DD`, no timezone drift) for expiry; timestamps are ISO with local formatting. |
| 8 | All server-provided text is **escaped**. Never use `dangerouslySetInnerHTML` on user data. |
| 9 | Keep existing route paths working (listed in §5). If you introduce a SPA, add a JSON API; do not delete the server routes until parity is proven. |
| 10 | The PDF is **generated server-side**. The frontend downloads, links, and prints it — it never builds the certificate PDF. |

---

## 3. Recommended stack

**Default (recommended):**

- **React 19 + TypeScript + Vite**
- **React Router** (or TanStack Router) for routes
- **TanStack Query** for server state, caching, and mutations
- **Tailwind CSS v4** mapped to the design tokens in §4 (no default palette)
- **Radix UI primitives** (headless) for Dialog, Select, Tabs, Tooltip, Toast —
  bring your own styling, keep the brand
- **Zod** + React Hook Form for validation
- **Vitest + Testing Library** for units, **Playwright** for e2e, **axe-core**
  for accessibility
- **Lucide** icons (stroke, 1.75–2px), no emoji as UI icons

**Do not** use MUI, Ant Design, Bootstrap, or any opinionated kit that imposes
its own look. The visual identity in §4 must survive.

**Alternative (acceptable):** keep server-rendered EJS and replace the view
layer with a component system + new CSS. The same screen inventory, components,
rules, and checklist apply. State the choice before starting.

---

## 4. Design system

### 4.1 Brand

Professional, calm, trustworthy. Think "audit-grade software", not a marketing
site. Dense but breathable. Nothing playful, nothing decorative for its own sake.

- **Palette:** slate neutrals + emerald accent ("Slate & Emerald").
- **Radii:** 8 / 12 / 16 px (`--radius-sm`, `--radius`, `--radius-lg`).
- **Shadows:** four levels, very soft, slate-tinted.
- **Font:** system UI stack for text; **monospace for IDs, hashes, project
  tokens, verification IDs, and codes**.
- **Density:** 15px base, 1.6 line-height, 4px spacing grid.
- **Dark mode:** full parity, not an afterthought; persisted per user.

### 4.2 Tokens (must be implemented exactly)

Light:

```
bg #f8fafc        surface #ffffff      surface-2 #f1f5f9   surface-3 #e2e8f0
ink #0f172a       ink-secondary #334155 muted #64748b
line #e2e8f0      line-strong #cbd5e1
brand #0f766e     brand-2 #0d9488      brand-soft #f0fdf4  brand-border #bbf7d0
danger #dc2626    danger-soft #fef2f2   danger-border #fecaca
warn #d97706      warn-soft #fffbeb     warn-border #fde68a
ok #059669        ok-soft #ecfdf5       ok-border #a7f3d0
```

Dark:

```
bg #0b1120        surface #111c33        surface-2 #182644   surface-3 #223458
ink #f8fafc       ink-secondary #cbd5e1  muted #94a3b8
line #1e293b      line-strong #334155
brand #2dd4bf     brand-2 #5eead4        brand-soft #0c2b27  brand-border #134e48
danger #f87171    danger-soft #381212    danger-border #5c1d1d
warn #fbbf24      warn-soft #382408      warn-border #5c3b0d
ok #34d399        ok-soft #082d22        ok-border #0f513d
```

### 4.3 Type scale

| Role | Size / weight |
|---|---|
| Page title (h1) | clamp(26px, 3.2vw, 36px), 800, letter-spacing -0.035em |
| Section (h2) | 20–22px, 700 |
| Card title (h3) | 17px, 700 |
| Body | 15px / 1.6 |
| Small | 13.5px |
| Tiny | 12px |
| Eyebrow | 11–12px, 700, uppercase, letter-spacing .08em, muted |

### 4.4 Status vocabulary (must match exactly)

Project status → label + tone:

| key | label | tone |
|---|---|---|
| `signed` | Signed off | pass (emerald) |
| `ready` | Waiting for signature | pass |
| `in-progress` | In testing | brand |
| `not-started` | Not started | neutral |
| `revoked` | Access turned off | fail (red) |
| `expired` | Link expired | fail |

Item status → label:

| key | label | tone |
|---|---|---|
| `pass` | Passed | pass |
| `fail` | Failed | fail |
| `na` | Not applicable | neutral |
| `retest` | Ready for retest | warn/retest |
| *(none)* | Not tested | neutral |

Milestone state → label: `complete` → "Complete", `locked` → "Locked",
`open` → "In progress".

---

## 5. Routes

### 5.1 Existing server routes (must keep working)

**Public**

```
GET  /                        landing
GET  /client                  client entry (project ID + password)
POST /client                  resolve token → redirect
GET  /verify                  verify form (also ?id=...)
POST /verify                  verify by ID
POST /verify/pdf              verify uploaded PDF hash
GET  /healthz                 JSON health (not UI)
```

**Company**

```
GET  /company/login           sign in
POST /company/login
POST /company/logout
GET  /company                 dashboard
GET  /company/projects/new    new project form
POST /company/projects/preview  multipart, returns JSON preview
POST /company/projects        multipart create
GET  /company/template.csv
GET  /company/template.xlsx
GET  /company/projects/:id    project detail
POST /company/projects/:id/password
POST /company/projects/:id/expiry
POST /company/projects/:id/revoke
POST /company/projects/:id/items/:itemId/fix
GET  /company/projects/:id/items/:itemId/screenshot
GET  /company/projects/:id/signature
GET  /company/projects/:id/certificate.pdf
```

**Client (token-scoped)**

```
GET  /p/:token                     password-only login
POST /p/:token
GET  /p/:token/tester              tester identity
POST /p/:token/tester
GET  /p/:token/portal?ms=<id>      checklist
POST /p/:token/items/:itemId/result        JSON when XHR
POST /p/:token/items/:itemId/screenshot
GET  /p/:token/items/:itemId/screenshot
GET  /p/:token/signoff
POST /p/:token/signoff/start
POST /p/:token/signoff/verify
POST /p/:token/signoff/submit
GET  /p/:token/certificate
GET /p/:token/certificate.pdf
GET /p/:token/signature
POST /p/:token/logout
```

**System**

```
404  not found
500  error
403  access revoked / expired / locked
```

### 5.2 SPA routes (if you build a client-rendered app)

```
/                                   landing
/client                             client entry
/verify                             verify (reads ?id=)
/company/login                      company sign in
/company                            dashboard
/company/projects/new               new project
/company/projects/:id               project detail
/p/:token                           client login
/p/:token/tester                    tester identity
/p/:token/portal                    checklist (?ms=)
/p/:token/signoff                   sign-off wizard
/p/:token/certificate               certificate
*                                   404
```

If you go SPA, add a JSON API namespace (e.g. `/api/...`) that returns the same
data shapes as §9, and keep the form routes until e2e parity passes.

---

## 6. Screen-by-screen specification

### 6.1 Landing — `/`

**Purpose:** split the audience and expose verification.

Required:

- Page header: eyebrow "Acceptance Testing & Verification", h1 "UAT Desk
  Portals", one-sentence value statement.
- Two cards side by side (stack on mobile):
  - **Client Portal** — icon, "For Clients & Testers", description, three
    bullet benefits, CTA "Open Client Portal →" to `/client`.
  - **Company Workspace** — icon, "For Project Managers & Release Teams",
    description, three bullet benefits, CTA to `/company` (label changes to
    "Go to Dashboard →" when a session exists, and shows the signed-in email).
- Verification banner card: shield icon, "Public Verification", "Verify a
  Completion Certificate", CTA "Verify Certificate →" to `/verify`.
- Top bar + footer (see §7).
- No marketing hero image. No pricing. No testimonials.

**States:** signed-in and signed-out for the company card. Mobile: single column.

---

### 6.2 Client entry — `/client`

**Purpose:** a tester who has an invitation enters the **Project ID** and
**password** without needing the full link.

Required:

- Centered auth card, max-width ~420–460px.
- Icon mark, eyebrow "Client Acceptance Testing", h1 "Open your UAT checklist",
  helper text.
- Fields:
  - **Project ID** — text, mono, uppercase display, placeholder `e.g.
    UAT-ACME23`, `autocomplete="username"`, required, autofocus.
  - **Password** — password, `autocomplete="current-password"`, required.
- Submit "Open checklist" (full-width).
- Inline error notice for: empty ID, unknown ID (`Project ID “X” was not
  found…`), wrong password, locked account ("Too many failed attempts. Access
  is locked for N minutes.").
- Accepts a **pasted full URL** (`https://…/p/UAT-ACME23`) and extracts the
  token client-side or server-side.
- Dev-only demo shortcut box (two sample projects with "Fill in" buttons) —
  render only when `isDev`, and never in production builds.
- Footer links: "Company sign in →".

**States:** default, field error, unknown token, locked, submitting.

---

### 6.3 Verify — `/verify` (and `/verify?id=…`)

**Purpose:** public certificate verification.

Required:

- Header: eyebrow "Public check", h1 "Verify a UAT certificate", explanation.
- Two-column layout (stack on mobile):
  - **Check a verification ID** card: field `Verification ID` (mono,
    placeholder `VC-XXXX-XXXX`, `autocomplete="off"`, required, autofocus),
    button "Check certificate". Note: "The check reads the stored sign-off
    record. It does not expose the client's checklist answers."
  - **What this proves** card: 4-item checklist (signed on recorded date;
    email confirmed with one-time code; SHA-256 record fingerprint; PDF can be
    checked against its fingerprint).
- **Valid result** card:
  - Green check badge, eyebrow "Valid certificate".
  - Product + version heading, "Signed for **Client** on <date>".
  - Detail grid: Verification ID, Project ID, Signed by, Designation, Email
    verified (all mono where applicable).
  - "Record SHA-256" hashline with full hash, copyable.
  - **PDF check** sub-form: file input (`.pdf`) + "Check PDF". Outcomes:
    matches (green notice), does not match (red notice), no fingerprint stored
    (neutral notice).
- **Invalid result** card: red × badge, eyebrow "Not found", heading
  `No certificate matches “X”`, guidance to re-check typing and contact issuer.
- Auto-runs when `?id=` is present.

**States:** empty, valid, not found, pdf match, pdf mismatch, no pdf hash,
rate-limited.

---

### 6.4 Company sign-in — `/company/login`

Required:

- Centered auth card.
- Eyebrow "Company side", h1 "Sign in to UAT Desk", one-line description.
- Fields: Work email (email, `autocomplete="username"`, required, autofocus),
  Password (`current-password`, required).
- Submit "Sign in".
- Error notice: "That email and password do not match."
- Footer link: "Open Client Portal →".
- Never render the seeded admin credentials in production.

---

### 6.5 Dashboard — `/company`

Required:

- Page header: eyebrow "Company workspace", h1 "UAT projects", subtitle,
  actions: "Checklist template" (ghost, downloads `.xlsx`) and "New UAT
  project" (primary).
- **Four stat tiles:** In testing, Items to fix, Waiting for signature,
  Signed off. Each: large number + label.
- **Projects table** (desktop) with columns:
  Product and release (link + version + mono project ID),
  Client (+ owner name),
  Progress (bar + "N of M passed or N/A" + "K failed" in red),
  Status (badge),
  Current milestone,
  action "Open".
- **Mobile:** each row becomes a card; progress bar full width; status badge
  top-right; tap target ≥ 44px.
- Empty state: "No UAT projects yet" + explanation + "Create the first
  project".
- Sort: most recently active first (server already does this).

**States:** loading skeleton, empty, populated, error with retry.

---

### 6.6 New project — `/company/projects/new`

Required:

- Page header with breadcrumb "Dashboard / New project", h1 "New UAT project",
  explanation that the checklist is copied into the project.
- Actions: "Download .xlsx template", "Download .csv template".
- Error notice (form-level, bulleted) and a separate checklist-error notice
  ("The checklist was not accepted", bullets, "Nothing was imported").
- Success preview notice after a valid upload: "Checklist read successfully
  from <file>. N items across M milestones:" + list `Milestone — N items (R
  required)`.
- **Form** (`multipart/form-data`), two-column card grid on desktop:
  - **Card 1 — What is being tested**
    - Segmented control: `Existing product` / `Add a product`.
    - Existing panel: Product `<select>` (options from products; if none, an
      option "No products yet — add one").
    - New panel: "New product name" text.
    - "Release or version" text, placeholder `v1.0`, required.
    - Segmented control: `Existing client` / `Add a client`.
    - Existing panel: Client `<select>`.
    - New panel: "New client name" text.
  - **Card 2 — Link and responsibility**
    - "Company contact" text, required.
    - "Company contact email" email, optional, hint "gets the signed
      certificate".
    - "Link stays available until" date, required, default +30 days.
    - Info notice about one-time-shown password and revocability.
  - **Card 3 — Checklist file**
    - Column legend text (8 columns, see §10.5).
    - **Dropzone**: click or drag, `.xlsx`/`.csv`, shows selected file name and
      size, "up to 5 MB", states: idle / has-file / checking / valid / invalid.
    - Inline preview panel: spinner while checking, then either milestone list
      (green) or error list (red). Preview calls `POST
      /company/projects/preview` as soon as a file is chosen — **nothing is
      created yet**.
  - Footer actions: "Cancel" (ghost), "Create project and generate the client
    link" (primary).
- Client-side validation mirrors server: product/client chosen or named,
  version required, owner name required, owner email valid if present, expiry
  today or later, file required and type/size correct.
- On success: redirect to project detail with a one-time credentials card.

**States:** pristine, client-side errors, server errors, checklist errors,
preview loading, preview valid, preview invalid, submitting.

---

### 6.7 Project detail — `/company/projects/:id`

Required:

- Header: breadcrumb "Dashboard / <Client>", h1 `<Product> <version>`,
  subtitle `Client · owner · checklist: <filename>`; right side: status badge +
  "Open client link" (new tab).
- **One-time credentials card** (only right after creation or password
  rotation):
  - Eyebrow "Shown once", h2 "Client credentials", explanation that the
    password is hashed and cannot be shown again.
  - Three copy rows: **Link**, **Project ID**, **Password** — each readonly,
    mono, with a Copy button that confirms ("Copied" for ~1.4s).
  - **Invitation text** textarea (readonly, ~9 rows) + "Copy invitation".
- **Progress card:** "N of M items passed or marked N/A", "K failed" (red),
  "R waiting for retest", large percentage, big progress bar.
- **Signed-off card** (if signed): verification ID as heading, signer name +
  designation + signed date, actions "Verify" and "Download PDF", record
  SHA-256 hashline, PDF SHA-256 hashline, signature image preview.
- **Milestone cards**, one per milestone:
  - Eyebrow "Milestone N", h2 name, badge Complete / Locked / In progress.
  - **Item rows** with:
    - mono code, status badge (or "Not tested"), "Required" tag,
      "Evidence" tag.
    - title (strong), steps (pre-wrap, muted), "Expected: …" line.
    - "Client note: …" when present.
    - "Fix note: …" when present (retest style).
    - tester name + tested date when present.
    - screenshot thumbnail button (opens lightbox) when present.
    - **Side panel by status:**
      - `fail` and not signed → inline **fix form**: label "What was fixed?",
        textarea (placeholder "Build 1.0.4 corrects the total calculation.",
        required, min 3 chars), button "Mark fixed & send for retest",
        confirmation dialog.
      - `retest` → "Waiting for the client to retest."
      - `pass` / `na` → "Accepted."
      - none → "Not tested yet."
- **Access side card:**
  - Project ID (mono), Available until (date), Status badge.
  - Copy link row.
  - Divider.
  - "Generate a new password" (ghost, confirm dialog).
  - "Change end date" date field + "Update end date".
  - "Turn off client access" (danger, confirm) / "Restore client access".
- **Activity card:** last 50 audit events, newest first. Each: action with dots
  replaced by " · " (e.g. `item · result`), timestamp, actor — detail, IP in
  mono when present. Empty: "No activity yet."
- Sticky side column on desktop; stacks below on mobile.

**States:** no credentials (normal), credentials shown once, signed, revoked,
expired, no milestones, long lists (virtualise only if > 200 items).

---

### 6.8 Client login by token — `/p/:token`

Required:

- Centered auth card.
- Eyebrow "Client acceptance testing", h1 `<Product> <version>`, "Prepared for
  **Client** by <owner>".
- Error notice.
- Single field: "Password from your invitation" (password,
  `current-password`, required, autofocus).
- Submit "Open the checklist".
- Key-value rows: Project ID (mono), Available until (date).
- Warning: "This link is personal to your organisation. Do not forward it.
  Five wrong passwords lock access for 15 minutes."
- Footer links: "← Switch Project ID", "Company sign in →".

**Blocked states:** if revoked or expired, render the **Closed** screen
(§6.13) instead of the form.

---

### 6.9 Tester identity — `/p/:token/tester`

Required:

- Centered auth card.
- Eyebrow "Before you start", h1 "Who is testing?", explanation that name and
  email are recorded on every result and on the certificate, and that sign-off
  sends a code to that email.
- Fields: Full name (required, autofocus), Work email (email, required).
- Submit "Start testing".
- Footer line: "Testing **Product version** for Client."

**States:** default, validation error (name missing / invalid email).

---

### 6.10 Checklist portal — `/p/:token/portal?ms=<milestoneId>`

This is the core screen. It must feel fast and never lose a result.

**Layout (desktop):** two columns — left **milestone rail** (~260–300px),
right **milestone content**. Mobile: rail becomes a horizontal scrollable chip
row or a collapsible drawer above the content.

**Header block:**

- Eyebrow `Client · owner`, h1 `<Product> <version>`.
- Instruction: "Work through each milestone in order. A milestone unlocks when
  every item in the one before it has a result."
- Progress widget: "Overall progress", `N / M`, big bar, "P% complete",
  "K to fix" in red when > 0.

**Milestone rail:**

- Each item: number circle (or ✓ when complete), milestone name, "N of M done",
  "· locked" suffix when locked.
- States: `active` (current), `open`, `complete`, `locked`
  (`aria-disabled`, not clickable, no tab stop).
- Clicking an unlocked milestone navigates to `?ms=<id>`.

**Milestone card:**

- Eyebrow "Milestone N of M", h2 name, "N of M items done", state badge.
- Locked notice: "This milestone is locked. Finish the earlier milestone first.
  Go to the current milestone."

**Item card** (one per item):

- Top row: mono code, status badge, "Required" tag, "Evidence" tag.
- h3 title.
- Steps (pre-wrap).
- "Expected result" eyebrow block (pre-wrap).
- Retest notice (warn): "**Your team marked this fixed.** Please retest and
  mark it again. <fix note>".
- "Your note: …" when present.
- "Last result by <tester> · <date>".
- **Screenshot block** when an image exists: thumbnail button (lightbox),
  caption "Screenshot attached. Open it to check, or replace it below."
- **Screenshot upload form** (when milestone not locked):
  - File input styled as a mini button: "Attach screenshot" / "Replace
    screenshot", `accept="image/png,image/jpeg"`, required.
  - "Upload" button.
  - Hint "Screenshot evidence (optional)." when the item requires evidence.
- **Result form** (when milestone not locked), `data-auto-save`:
  - Segmented **Pass / Fail / N/A** radio group with semantic colors
    (green/red/neutral). **N/A is disabled for mandatory items** with tooltip
    "Required item cannot be marked N/A".
  - "What happened? *Required when marking Fail*" textarea (2 rows,
    placeholder "Add the steps you took and what you saw.").
  - Footer row: "Results save automatically on selection." + inline save
    status ("Saving…", "Saved ✓", error in red).
- **Auto-save behaviour:**
  - Selecting a radio saves immediately (POST form-urlencoded, `X-Requested-
    With: XMLHttpRequest`, `Accept: application/json`).
  - Comment input debounced 800 ms; blur saves.
  - Fail with empty comment does **not** save; show "Add note to save fail"
    and focus the textarea.
  - While saving, coalesce additional changes into one follow-up save.
  - On success: update the item badge, milestone count, rail count, and
    milestone badge **without reloading**.
  - On 403: "Session expired. Reload page." On network failure: "Network
    error".
  - Must work with keyboard only and announce the save state via
    `aria-live="polite"`.

**Bottom CTA** (only one visible):

- All done → "All milestones are complete" + "Sign off UAT".
- Current milestone complete and a next exists → "Milestone complete" +
  "Next milestone".
- Otherwise a hidden pending CTA that is revealed by auto-save when the
  milestone completes; it scrolls into view smoothly.
- When the last milestone completes, the CTA becomes "All milestones are
  complete" + "Sign off UAT".

**Edge cases:**

- No milestones → empty card "No checklist items" with instruction to contact
  the owner.
- Requested `?ms=` invalid or locked → fall back to the current milestone.
- Signed-off project → redirect to the certificate.
- Deep link to an item uses `#item-<id>`.

---

### 6.11 Sign-off wizard — `/p/:token/signoff`

Three steps, one visible at a time. A **stepper** shows 1 Signer details,
2 Email code, 3 Signature (active / done / pending).

Guard: if not every milestone is complete, show an error and redirect to the
portal. If already signed, redirect to the certificate.

**Step 1 — Signer details**

- Card: h2 "Who is signing?", explanation that name and designation appear on
  the certificate.
- Fields: Full name (required, prefill tester name), Designation or role
  (required, placeholder "e.g. Head of Operations"), Work email for the
  one-time code (email, required, prefill tester email).
- Submit "Send the one-time code".

**Step 2 — Email code**

- Card: h2 "Check your email", "A six-digit code was sent to **email**. It
  expires in 10 minutes."
- Dev-only notice showing the code when SMTP is not configured.
- **OTP input**: 6 separate boxes or one 6-char input, `inputmode="numeric"`,
  `pattern="[0-9]{6}"`, `maxlength=6`, `autocomplete="one-time-code"`,
  autofocus, paste-friendly, mono, large.
- Submit "Verify code".
- Secondary actions: "Send a new code" (re-posts signer details) and "Change
  signer details" (`?restart=1`).
- Errors: expired code, wrong code, too many attempts (5), start again.

**Step 3 — Signature**

- Verified banner: eyebrow "Email verified", signer name as h2, "Designation,
  Client · email", badge "Code verified".
- Summary grid: Checklist `M items`, Passed `P`, Not applicable `N`,
  Milestones `K`.
- Card "Your signature" with explanation.
- Segmented control: **Draw signature** / **Type signature**.
- Drawn panel:
  - `<canvas>` signature pad, full width, ~260px tall, 2.2px round stroke,
    pointer events (mouse, touch, stylus), device-pixel-ratio aware, preserves
    drawing on resize.
  - Hint "Sign above the line" (a baseline).
  - "Clear" button.
  - Caption "Use a mouse, trackpad, finger or stylus."
  - Exports PNG data URL into a hidden `signature` field on submit.
- Typed panel: "Type your full name" text input (prefilled with signer name).
- **Consent checkbox** (required): "I confirm that I have reviewed the results
  above and that I accept this release on behalf of **Client**. I understand
  this is an electronic signature."
- Footer: "Signed at <time> · IP and browser are recorded." + primary
  "Sign and issue certificate".
- Validation: drawn requires a non-empty pad; typed requires non-empty name;
  consent required.
- On success: redirect to certificate with a success flash.

**States:** step 1, step 2, step 3, restart, expired, too many attempts,
already signed, not complete.

---

### 6.12 Certificate — `/p/:token/certificate`

Required:

- Header: eyebrow "Signed and stored", h1 "UAT completion certificate",
  "Verification ID **VC-…**"; actions: "Download PDF", "Print", "Public
  verification".
- **Printable certificate sheet** (A4-ish, print-friendly):
  - Band: "UAT Desk" kicker + "UAT Completion Certificate" + verification ID.
  - Statement naming the client, product, version, item count, milestone count.
  - Details grid: Client, Product, Project ID (mono), Company contact, UAT
    opened, Signed on.
  - Milestones table: Milestone, Items, Passed, Not applicable, Completed.
  - Signature block: label "Signed for Client", signature image (or typed name
    + "Typed electronic signature"), signature line, signer name, designation,
    email, "Email verified by one-time code on <date>".
  - Meta: Signed, Signer IP (mono), Signature type (Drawn/Typed electronic).
  - Fingerprint block: Record SHA-256, PDF SHA-256 (mono, wrapping).
  - Footer: verification URL + verification ID.
- Disclaimer notice: electronic signature with an audit trail, not a
  certificate-based digital signature; hashes let a verifier detect changes.
- **Print CSS:** hide top bar, nav, footer, buttons, notices; keep the sheet
  on white; avoid page breaks inside the signature block.

---

### 6.13 Closed / blocked — revoked or expired

Rendered in place of client login/portal when access is off.

Required:

- Centered card, icon (power for revoked, hourglass for expired).
- h1 "Client access is turned off" or "This link has expired".
- Explanation naming the owner and (for expiry) the end date.
- Line: "Project ID <mono> · Client".
- Action "Verify a certificate".

---

### 6.14 Error pages — 404 / 403 / 500

- Centered card with status number as the mark.
- h1 + human message (no stack traces in production).
- Actions: "Go to the start page", "Verify a certificate".
- 400 file-too-large: "That file is too large. Checklists and screenshots are
  limited to 5 MB, and certificate PDFs to 15 MB."
- 503 DB unreachable: "The database is not reachable right now. Please try
  again in a moment."

---

## 7. Global shell

### 7.1 Top bar

- Left: brand mark (rounded square with a check glyph) + "UAT Desk" + a small
  contextual subtitle:
  - company → "company workspace"
  - client with project → `<Product> <version>`
  - client without project → "client testing portal"
  - public → "acceptance testing and sign-off"
- Center/right nav (contextual):
  - company: Dashboard, New UAT project, Verify certificate, "Client portal →"
  - client in project: Checklist, Certificate (if signed), Client portal,
    "Company portal →"
  - public: Client portal, Company portal, Verify certificate
- Right: signed-in identity (company email or tester name) + "Sign out", and a
  **theme toggle** (light/dark, persisted).
- Mobile: collapse nav into a menu; brand + theme toggle remain visible.

### 7.2 Flash bar

- Types: `ok`, `error` (and neutral info).
- Dismiss button (×), auto-dismiss after 8s, `role="status"`.

### 7.3 Footer

- "UAT Desk · server-side acceptance testing, sign-off and verification"
- Links: Client portal, Company portal, Verify a certificate.

### 7.4 Lightbox

- Full-screen overlay for screenshot evidence.
- Close button, click-outside, `Escape`.
- `role="dialog"`, `aria-modal`, focus trap, restore focus on close.

---

## 8. Component inventory

Build these as reusable components. Every screen is composed from this list.

| # | Component | Key requirements |
|---|---|---|
| 1 | `AppShell` | Top bar + main + footer + flash slot |
| 2 | `TopBar` | Brand, contextual subtitle, nav, identity, sign out, theme toggle |
| 3 | `NavLink` | Active state, keyboard focus |
| 4 | `ThemeToggle` | Light/dark, persisted, no flash on load |
| 5 | `FlashBar` | ok/error, dismiss, auto-hide 8s, `role=status` |
| 6 | `Footer` | Links |
| 7 | `PageHeader` | Eyebrow/breadcrumb, h1, subtitle, actions slot |
| 8 | `Button` | primary, ghost, danger, `sm`, `block`, `icon`; loading + disabled |
| 9 | `Field` | label, hint, error, required marker, input/select/textarea |
| 10 | `Select` | Accessible, keyboard, search for long lists |
| 11 | `Textarea` | Auto-grow optional, counter optional |
| 12 | `Checkbox` / `Radio` | 44px target, focus ring |
| 13 | `SegmentedControl` | 2–3 options, controlled, `role=radiogroup` |
| 14 | `Badge` | pass, fail, brand, retest, neutral |
| 15 | `Tag` | Required, Evidence |
| 16 | `Card` | optional header with title + actions |
| 17 | `StatTile` | number + label |
| 18 | `ProgressBar` | value, size (`sm`/`big`), label |
| 19 | `DataTable` | header, sortable-ready, row link, mobile card mode |
| 20 | `EmptyState` | icon, title, text, action |
| 21 | `Notice` | info, ok, error, retest; title + body + list |
| 22 | `CopyRow` | readonly mono value + Copy, "Copied" feedback, clipboard fallback |
| 23 | `Dropzone` | click + drag, type/size guard, idle/has-file/checking/valid/invalid |
| 24 | `ChecklistPreview` | spinner, success milestone list, error list |
| 25 | `CredentialsPanel` | link, project ID, password, invite text, copy all |
| 26 | `AccessPanel` | ID, expiry, status, copy link, rotate password, change expiry, revoke |
| 27 | `MilestoneRail` | active/open/complete/locked, count, ✓, keyboard nav |
| 28 | `ChecklistItemCard` | code, badges, title, steps, expected, notes, tester, thumbnail |
| 29 | `ResultChoices` | Pass/Fail/N/A, N/A disabled when mandatory, semantic colors |
| 30 | `AutoSaveForm` | radio + comment, debounce, coalescing, inline status, `aria-live` |
| 31 | `ScreenshotUpload` | attach/replace, preview, upload progress, error |
| 32 | `FixForm` | note ≥ 3 chars, confirm dialog, submit |
| 33 | `Stepper` | 3 steps, active/done/pending, `aria-current="step"` |
| 34 | `OtpInput` | 6 digits, paste, numeric keyboard, auto-advance |
| 35 | `SignaturePad` | pointer events, DPR-aware, resize-safe, clear, PNG export |
| 36 | `TypedSignature` | name input |
| 37 | `ConsentCheckbox` | required, long label with client name |
| 38 | `CertificateSheet` | printable layout, tables, signature block, hashes |
| 39 | `VerificationResult` | valid/invalid, detail grid, hash lines |
| 40 | `PdfHashCheck` | file input + match/mismatch/no-hash states |
| 41 | `ActivityFeed` | event list, actor, detail, IP, timestamps |
| 42 | `Lightbox` | dialog, focus trap, Escape, click-outside |
| 43 | `ConfirmDialog` | replaces `window.confirm`; destructive styling |
| 44 | `Toast` | success/error, dismiss, stacking |
| 45 | `Skeleton` | cards, table rows, progress |
| 46 | `ErrorState` | status, message, retry/escape actions |

---

## 9. Data contracts

### 9.1 Project bundle (client + company detail)

```ts
type ItemStatus = 'pass' | 'fail' | 'na' | 'retest' | null;
type MilestoneState = 'complete' | 'locked' | 'open';

interface ChecklistItem {
  id: string;
  code: string;
  title: string;
  steps: string;
  expected: string;
  mandatory: boolean;
  evidence: boolean;
  image_key: string | null;
  status: ItemStatus;
  comment: string | null;
  fix_note: string | null;
  tester_name: string | null;
  tester_email: string | null;
  tested_at: string | null;   // ISO
}

interface Milestone {
  id: string;
  position: number;
  name: string;
  items: ChecklistItem[];
}

interface ProjectBundle {
  project: {
    id: string;
    version: string;
    owner_name: string;
    owner_email: string | null;
    checklist_filename: string | null;
    created_at: string;
  };
  product: { name: string };
  client: { name: string };
  link: {
    token: string;
    expires_at: string;        // YYYY-MM-DD
    revoked_at: string | null;
    rotated_at: string | null;
  };
  milestones: Milestone[];
  signoff: Signoff | null;
  stats: {
    total: number;
    done: number;      // pass + na
    na: number;
    fail: number;
    retest: number;
    tested: number;    // pass + fail + na
  };
  states: MilestoneState[];
  currentIndex: number;
  status: 'signed' | 'ready' | 'in-progress' | 'not-started' | 'revoked' | 'expired';
  expired: boolean;
}
```

### 9.2 Signoff

```ts
interface Signoff {
  verification_id: string;      // VC-XXXX-XXXX
  signer_name: string;
  signer_designation: string;
  signer_email: string;
  otp_verified_at: string;
  signature_kind: 'drawn' | 'typed';
  signature_key: string | null;
  signed_at: string;
  ip: string | null;
  user_agent: string | null;
  record_hash: string;          // SHA-256
  pdf_key: string | null;
  pdf_hash: string | null;
  summary: Array<{
    name: string;
    total: number;
    pass: number;
    na: number;
    completedAt: number | null;  // epoch ms
  }>;
}
```

### 9.3 Dashboard row

```ts
interface DashboardRow {
  id: string;
  version: string;
  owner_name: string;
  created_at: string;
  product_name: string;
  client_name: string;
  token: string;
  expires_at: string;        // YYYY-MM-DD
  revoked_at: string | null;
  verification_id: string | null;
  signed_at: string | null;
  total: number;
  done: number;
  fail: number;
  retest: number;
  tested: number;
  milestone_count: number;
  current_milestone: string | null;
  status: 'signed' | 'ready' | 'in-progress' | 'not-started' | 'revoked' | 'expired';
}
```

### 9.4 Checklist preview response

```ts
type PreviewResponse =
  | { ok: true; fileName: string; total: number;
      milestones: Array<{ name: string; count: number; required: number }> }
  | { ok: false; fileName?: string; errors: string[] };
```

### 9.5 Result save response (XHR)

```ts
type SaveResult =
  | { ok: true; status: 'pass'|'fail'|'na'; code: string;
      milestoneComplete: boolean; allDone: boolean;
      stats: { total: number; done: number; na: number; fail: number;
               retest: number; tested: number } }
  | { ok: false; error: string };
```

### 9.6 Verification

```ts
type VerifyResult =
  | { found: true; row: {
      verification_id: string; token: string; product_name: string;
      version: string; client_name: string; signer_name: string;
      signer_designation: string; signed_at: string;
      otp_verified_at: string; record_hash: string;
      pdf_hash: string | null;
    } }
  | { found: false; id: string };
```

---

## 10. Business rules that must be visible in the UI

1. **Sequential milestones.** A milestone is complete when **every** item is
   `pass` or `na`. A milestone unlocks only when all earlier milestones are
   complete. Locked milestones are not clickable.
2. **Sign-off gate.** Sign-off is possible only when
   `stats.total > 0 && stats.done === stats.total`. Failures block sign-off.
3. **Fail requires a comment.** Never save `fail` with an empty comment; show
   "Add note to save fail" and focus the textarea.
4. **Mandatory ≠ N/A.** Disable N/A for mandatory items, with an explanatory
   tooltip.
5. **Company fix loop.** Only a `fail` item can be sent for retest, and the fix
   note needs ≥ 3 characters. After that the item is `retest` and the client
   must re-mark it.
6. **Password shown once.** Generated passwords are displayed once, in a
   one-time card, with copy and invitation text. After that only "Generate a
   new password" exists.
7. **Access control.** Revoked or expired links show the Closed screen, not the
   login form. Five wrong passwords lock access for 15 minutes.
8. **OTP.** 6 digits, 10-minute expiry, max 5 attempts, one active challenge
   per email, rate-limited. Resending invalidates the previous code.
9. **Certificate.** Created on sign-off; emailed to the signer and the company
   contact; contains verification ID, record SHA-256, PDF SHA-256.
10. **Verification.** ID lookup is case-insensitive and normalised to upper
    case. PDF check compares SHA-256 and reports match / mismatch / no
    fingerprint.
11. **Checklist snapshot.** Uploaded checklists are copied into the project;
    later edits to the source file never change what the client signs.

### Known defect to fix while you are here

The **dashboard** currently marks a project `ready` when
`tested === total` (counts `fail` as tested), while the client portal and
sign-off gate use `done === total` (pass + N/A). This lets the dashboard show
"Waiting for signature" while failures remain. **Use `done === total` for the
`ready` status everywhere.** Do not reproduce the bug in the new frontend.

---

## 11. Accessibility (WCAG 2.2 AA)

- Full keyboard operation: every action reachable, visible focus ring, logical
  tab order, no keyboard traps.
- Semantic landmarks: `header`, `nav`, `main`, `footer`; one `h1` per page;
  heading order without skips.
- The milestone rail is a list of links; locked entries are
  `aria-disabled="true"` with no tab stop.
- The stepper uses `aria-current="step"`.
- Auto-save status is `aria-live="polite"`; toasts use `role="status"`.
- Lightbox and dialogs: `role="dialog"`, `aria-modal="true"`, focus trap,
  Escape, restore focus.
- Form errors are linked with `aria-describedby` and `aria-invalid`.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for UI; never rely on color alone — pair
  status with a label and an icon.
- Touch targets ≥ 44×44 px.
- Respect `prefers-reduced-motion`; no parallax; transitions ≤ 200 ms.
- Signature pad has a visible label and a typed alternative (motor
  accessibility).
- Zoom to 200% without loss of function; reflow at 320 px width.

---

## 12. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥ 1200px | Two-column project detail; full table; rail + content |
| 900–1199px | Narrower side column; rail 240px |
| 600–899px | Single column; table → cards; rail → horizontal chips |
| < 600px | Auth cards full width; buttons full width; sticky bottom action bar on portal and sign-off; signature pad full width; nav in a menu |

Mobile specifics:

- Portal: sticky bottom bar showing "N of M done" + "Next milestone" /
  "Sign off".
- Result choices must be thumb-reachable and not overlap the keyboard.
- Screenshot upload uses the camera/library picker.
- Certificate prints on A4 and stays legible at 100%.

---

## 13. Performance budgets

- Landing and dashboard: **LCP < 2.0 s** on a simulated 4G/mid-range phone.
- CLS < 0.05; INP < 200 ms.
- JS for the landing route ≤ 120 KB gzipped; portal ≤ 200 KB.
- Route-level code splitting; lazy-load the signature pad and PDF helpers.
- Cache GETs with TanStack Query; invalidate after mutations.
- No layout shift when the flash bar or credentials card appears.
- Images: lazy, explicit dimensions, `decoding="async"`.
- Fonts: system stack — no webfont request.

---

## 14. Security requirements

- Send CSRF on every mutation (`_csrf` or `X-CSRF-Token`); handle 403 by
  prompting a reload.
- `credentials: 'include'` on all API calls.
- Never log tokens, passwords, OTP codes, or hashes to the console.
- Escape all user content; no raw HTML injection.
- Validate file type and size client-side **and** rely on server validation.
- Do not embed the project token or verification ID in analytics or error
  reports.
- No third-party scripts on authenticated pages (CSP forbids them).
- Do not render dev-only demo credentials in production builds.

---

## 15. Testing and definition of done

### 15.1 E2E journeys (Playwright)

1. Company signs in → dashboard loads with stats and rows.
2. Create project from an `.xlsx` → preview appears → create → credentials
   card → copy link/ID/password.
3. Client opens link → password → tester identity → portal.
4. Mark items Pass/Fail/N/A → fail without comment blocked → milestone
   unlocks → auto-save status visible.
5. Complete all milestones → sign off → OTP → draw signature → consent →
   certificate → download PDF.
6. Verify the certificate by ID; upload the PDF and get "matches".
7. Company sends a failed item for retest; client re-marks it.
8. Revoke access → client sees Closed; restore → access returns.
9. Expiry in the past → Closed with expiry copy.
10. 5 wrong passwords → locked message with minutes.

### 15.2 Quality gates

- `axe-core` zero critical/serious violations on all 14 screens, light + dark.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95.
- No console errors in any journey.
- Visual regression snapshots for all screens at 390 px, 768 px, 1440 px.
- TypeScript strict, no `any` in public props.
- Component story or preview page for every item in §8.

### 15.3 Definition of done

- [ ] All 14 screens implemented and reachable.
- [ ] All 46 components implemented and reused (no one-off duplicates).
- [ ] Every state in §6 has a visible design (loading, empty, error, success,
      locked, expired, revoked, signed).
- [ ] All 11 business rules enforced in the UI.
- [ ] Dashboard `ready` uses `done === total`.
- [ ] Light and dark mode complete.
- [ ] Keyboard-only run of all 10 journeys passes.
- [ ] Mobile run of journeys 3–6 passes on a 390 px viewport.
- [ ] Print output of the certificate is clean.
- [ ] No secrets, tokens, or dev credentials in the production bundle.
- [ ] E2E suite green in CI.

---

## 16. Deliverables

1. Source code with the stack above, TypeScript strict.
2. `docs/` note explaining the API additions (if SPA) and how to run it.
3. Component library page (Storybook or `/dev/components`) covering §8.
4. Playwright suite for §15.1 and a CI job.
5. Before/after screenshots of all 14 screens, light + dark, desktop + mobile.
6. A short migration note: which server routes were replaced, which remain.

---

## 17. Out of scope

- Changing the database schema or business rules.
- Rebuilding the certificate PDF (server-side).
- Email/SMTP infrastructure.
- Billing, organisations, multi-tenant admin, user management UI beyond the
  seeded company account.
- Native mobile apps.
- Recovering the missing legacy storage files (separate infrastructure issue).
