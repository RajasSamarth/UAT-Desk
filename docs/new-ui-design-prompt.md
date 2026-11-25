# UAT Desk — New UI Design Brief (Fresh Direction)

**Audience:** Product designer / UI designer / AI design agent  
**Goal:** Design a **brand-new visual identity** for UAT Desk.  
**Constraint:** Do **not** replicate the existing UI. Ignore the current slate/emerald EJS look, the existing component inventory, the card-on-light-gray layout, and the existing color palette. Treat the backend routes and data as fixed, but the frontend visual language as a blank canvas.

---

## 0. What this is not

This is **not** a rebuild of the old interface. Do not:

- Reuse the old slate (`#0f172a`) / emerald (`#0f766e`) palette.
- Reuse the old component names or markup patterns (`.card`, `.dropzone`, `.railitem`, etc.).
- Reuse the old layout patterns (top-bar-only nav, heavy drop-shadow cards, muted `#f8fafc` backgrounds).
- Copy the existing EJS view structure screen-for-screen visually.

Start from scratch. The screens and business rules stay the same; the look, layout, typography, spacing, elevation, and interaction language must be new.

---

## 1. Product context

**UAT Desk** is a B2B web application for running user acceptance testing (UAT) and collecting a tamper-evident electronic sign-off that issues a verifiable completion certificate.

Three audiences:

| Audience | Goal |
|---|---|
| **Company / release team** | Sign in, upload a checklist, create projects, monitor progress, send failed items back for retest, download certificates, revoke access. |
| **Client testers** | Open a private link with a password, enter name/email, work through milestones in order (Pass / Fail / N/A), attach screenshots, sign off with a 6-digit email OTP + signature. |
| **Anyone** | Verify a certificate by ID; optionally upload the PDF to check its SHA-256 fingerprint. |

**Core flows to design:**

1. Company sign-in → dashboard → new project (template upload) → share credentials.
2. Client link → password → tester identity → checklist portal → sign-off (details → OTP → signature) → certificate → PDF download.
3. Public verification ID lookup → valid/invalid result → optional PDF hash check.

There are **14 routes/screens** (see §6). Each must be designed for both light and dark mode, and for desktop + mobile.

---

## 2. Design direction: "Graphite & Signal"

Define **one** strong visual direction. Do not mix styles.

### 2.1 Core idea

A dark-forward, high-trust enterprise console. Surfaces are deep graphite/ink rather than light gray. Elevation comes from **thin 1px borders and subtle tonal shifts**, not heavy drop shadows. One brand accent color is used sparingly — only for primary actions, active states, and the brand mark. Semantic status colors (green / red / amber) are reserved strictly for pass / fail / warning states so they carry meaning.

### 2.2 Visual descriptors

- **Mood:** Authoritative, precise, calm, audit-grade. Think "banking dashboard" or "security console," not marketing site.
- **Primary surfaces:** Ink / graphite / near-black in dark mode; clean off-white / paper in light mode.
- **Contrast:** High contrast for text on surface; low chroma everywhere except the brand accent and status semantics.
- **Borders:** 1px, subtle, consistent. No border-radius heavier than 12px; prefer 6–8px for density.
- **Shadows:** Very soft, used only for elevated panels (dropdowns, modals, the signature canvas). Never the sole indicator of a card boundary — always pair with a border.
- **Icons:** Linear icons, consistent stroke weight (1.5–2px), geometric, no fill, no duotone.
- **Imagery:** None. No illustrations, no photos, no hero graphics. Typography and spacing carry the design.

### 2.3 Brand accent

Pick **one** brand accent and use it only for:
- Primary buttons (filled)
- Active nav items
- Focus rings
- The brand mark / logo

Suggested: **Indigo-Violet** (`#6366f1` / `#818cf8` light) or **Electric Cyan** (`#06b6d4` / `#22d3ee` light). Avoid green/red/amber as brand colors — those belong to pass/fail/warn semantics only.

---

## 3. Design system tokens

Define tokens for **light** and **dark** modes. Every value below must exist in both themes.

### 3.1 Color palette

**Neutrals (dark mode example — invert for light):**

| Token | Use | Example (dark) |
|---|---|---|
| `--bg` | Page background | `#0b0f19` |
| `--surface` | Card / panel background | `#111827` |
| `--surface-2` | Slightly elevated panel | `#182033` |
| `--surface-3` | Hover / active state | `#1f2944` |
| `--ink` | Primary text | `#e5e7eb` |
| `--ink-secondary` | Secondary text | `#9ca3af` |
| `--muted` | Helper / caption text | `#6b7280` |
| `--line` | Borders / dividers | `#334155` |
| `--line-strong` | Active / focus borders | `#475569` |

**Brand (one accent):**

| Token | Use | Example |
|---|---|---|
| `--brand` | Primary actions, active nav | `#6366f1` |
| `--brand-hover` | Hover state | `#4f46e5` |
| `--brand-soft` | Subtle brand background | `#312e81` (dark) / `#eef2ff` (light) |
| `--brand-border` | Focus rings | `#818cf8` (dark) / `#6366f1` (light) |

**Semantic (never use for brand):**

| Token | Use |
|---|---|
| `--ok` | Passed / success | `#22c55e` |
| `--ok-soft` | Passed background | dark: `#064e3b` / light: `#ecfdf5` |
| `--danger` | Failed / error | `#ef4444` |
| `--danger-soft` | Failed background | dark: `#450a0a` / light: `#fef2f2` |
| `--warn` | Warning / retest / N/A mandatory | `#f59e0b` |
| `--warn-soft` | Warning background | dark: `#451a03` / light: `#fffbeb` |

### 3.2 Typography

Use a **geometric, high-contrast** type scale. No rounded, friendly, or playful typefaces.

| Role | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `--text-h1` | 32–40px (clamp) | 800 | 1.1 | Page titles |
| `--text-h2` | 24px | 700 | 1.25 | Section titles |
| `--text-h3` | 18–20px | 600 | 1.35 | Card titles |
| `--text-body` | 15px | 400–500 | 1.6 | Body copy |
| `--text-small` | 13.5px | 400 | 1.5 | Helper text |
| `--text-tiny` | 12px | 400 | 1.4 | Captions, metadata |
| `--text-eyebrow` | 11px | 700 | 1.4 | Labels, letter-spaced, uppercase |
| `--text-mono` | 13–14px | 400 | 1.5 | IDs, hashes, tokens, codes |

**Font stack:** Headlines and body: a clean geometric sans (Inter, Geist, or similar). Mono: JetBrains Mono, SF Mono, or Ubuntu Mono for IDs, hashes, verification codes.

### 3.3 Spacing

Use an **8px base grid**. Key values:

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Tight internal padding |
| `--space-2` | 8px | Default gap |
| `--space-3` | 12px | Component gap |
| `--space-4` | 16px | Section gap |
| `--space-5` | 20px | Card padding |
| `--space-6` | 24px | Page section gap |
| `--space-8` | 32px | Major page gap |
| `--space-10` | 40px | Hero / prominent gap |

### 3.4 Borders & radius

| Token | Value | Use |
|---|---|---|
| `--border-width` | 1px | All borders |
| `--radius-sm` | 6px | Buttons, badges, inputs |
| `--radius` | 8px | Cards, panels |
| `--radius-lg` | 12px | Modals, large panels |
| `--shadow-xs` | soft 1px shadow | Elevated hover states |
| `--shadow-md` | soft 2–4px shadow | Dropdowns, modals |
| `--shadow-lg` | soft 6–8px shadow | Large overlays |

Never use shadow alone to define a card. Every card must have a border.

---

## 4. New component inventory (reimagined)

Design these as a reusable library. Give them new names and new visual logic — do not map them 1:1 to old component names.

| # | Component | New visual concept |
|---|---|---|
| 1 | `Shell` | Full-bleed background with centered or max-width content; top bar or left nav per audience |
| 2 | `TopBar` | Thin, 1px bottom border, brand mark left, identity + actions right |
| 3 | `LeftNav` (company workspace only) | Vertical rail, active state via background fill + brand accent left border |
| 4 | `PageHeader` | Eyebrow (uppercase, letter-spaced), H1, thin divider or whitespace separation from body |
| 5 | `SignalCard` | Surface panel with 1px border, subtle hover lift, optional brand-accent top border for "active" state |
| 6 | `FocusPanel` | Max-width ~520px centered panel for auth flows; softer edges, larger whitespace |
| 7 | `StatTile` | Number large + mono, label small, optional mini sparkline or progress ring |
| 8 | `ProgressRing` | Circular stroke indicator replacing flat bars where appropriate |
| 9 | `StatusChip` | Small pill, semantic color only (ok / danger / warn / neutral), no brand color |
| 10 | `IdentityField` | Input with label above, mono for IDs, clear focus ring in `--brand-border` |
| 11 | `CopyBlock` | Readonly mono value + copy trigger with "Copied" micro-copy |
| 12 | `SelectField` | Clean dropdown, 1px border, chevron icon, brand accent on open |
| 13 | `SegmentedControl` | Two/three pill options, active state fills with brand color |
| 14 | `CheckboxField` / `RadioField` | Custom-drawn, 20px touch target, brand accent when checked |
| 15 | `Dropzone` | Dashed 1px border, hover fills with `--brand-soft`, large touch target |
| 16 | `ChecklistPreview` | Milestone list with counts, inline valid/invalid states |
| 17 | `MilestoneRail` | Horizontal list (desktop) or scrollable chips (mobile), active via brand underline or fill |
| 18 | `ChecklistItemCard` | Dense card, code in mono left, status chip right, collapsible detail |
| 19 | `ResultChoices` | Pass/Fail/N-A as large segmented buttons, not tiny radios; N-A disabled state visually dimmed |
| 20 | `AutoSaveStatus` | Inline micro-status ("Saving…", "Saved") with subtle animation |
| 21 | `ScreenshotUpload` | Attach/replace button with thumbnail grid |
| 22 | `FixForm` | Textarea + confirmation trigger, danger-leaning but not alarming |
| 23 | `Stepper` | 3-step horizontal progress, active step highlighted, completed steps with checkmark |
| 24 | `OtpGrid` | 6 individual boxes, mono, large, brand accent on active box |
| 25 | `SignatureCanvas` | Full-width canvas with baseline, pointer events, clear control |
| 26 | `TypedSignature` | Text input styled like a signature field |
| 27 | `ConsentField` | Checkbox with long legal label, readable at small size |
| 28 | `CertificateSheet` | **Print-first** A4 layout, white background regardless of theme, bordered like a document |
| 29 | `VerificationResult` | Valid/invalid card with large check or X, hash blocks in mono |
| 30 | `PdfHashCheck` | File upload + match/mismatch/no-fingerprint outcome states |
| 31 | `ActivityFeed` | Chronological list, actor bold, action mono, timestamp muted |
| 32 | `Lightbox` | Full-screen overlay for screenshot evidence |
| 33 | `ConfirmDialog` | Centered modal, destructive action in `--danger`, cancel subtle |
| 34 | `Toast` | Bottom-right or top-center, auto-dismiss, brand or semantic color |
| 35 | `EmptyState` | Icon (linear), headline, helper, primary action |
| 36 | `Skeleton` | Pulse animation on surface-2 |
| 37 | `ErrorState` | Status code large, human message, escape actions |
| 38 | `FlashBar` | Top-of-content dismissible bar, ok/error variants |
| 39 | `ThemeToggle` | Sun/moon icon, no flash on load |
| 40 | `BrandMark` | Abstract geometric logo, works at 24px and 120px |

---

## 5. Layout architecture (new)

Do not reuse the old top-bar-only layout for everything. Propose:

- **Public / landing:** Centered hero content, two audience cards (reimagined as surface cards with borders, not soft shadows), verification banner as a bordered strip.
- **Company workspace:** Optional left nav rail (Dashboard, New Project, Verify, Client Portal switcher) + main content area. Desktop: side rail; mobile: bottom tab or hamburger.
- **Client flows (auth, tester, portal, sign-off, certificate):** Centered `FocusPanel` for auth/identity; `Shell` with left `MilestoneRail` + main content for the portal; print-first sheet for certificate.
- **Certificate:** Full-page document layout, optimized for print (A4), hides all chrome when printed.

---

## 6. Screen-by-screen design requirements

For each of the 14 screens, describe the **visual layout, hierarchy, and states**. Do not copy old EJS markup. Design fresh.

### 6.1 Landing — `/`
- Two audience cards side by side (stack mobile): "For Clients & Testers" and "For Project Managers & Release Teams."
- Each card: icon mark (linear), headline, one-line description, 3 short benefits, primary or ghost CTA.
- Verification strip below: bordered horizontal band with "Verify a Completion Certificate" CTA.
- States: signed-out and signed-in company variants.

### 6.2 Client entry — `/client`
- Centered `FocusPanel`, max ~460px.
- Brand mark + eyebrow + H1.
- Fields: Project ID (mono, uppercase), Password.
- CTA "Open checklist" (full width, brand filled).
- Error states: unknown ID, wrong password, locked (with minutes).
- Dev demo shortcuts (only in dev builds, visually distinct as a bordered dev box).

### 6.3 Verify — `/verify`
- Two-column desktop: left = ID lookup form; right = "What this proves" benefit list.
- Valid result: large check icon, verification details grid, record + PDF SHA-256 hash blocks (mono, wrap).
- PDF check sub-form: file input + match/mismatch/no-fingerprint outcomes (ok / danger / neutral notices).
- Invalid result: large X, "No certificate matches" headline, guidance.

### 6.4 Company sign-in — `/company/login`
- Centered `FocusPanel`.
- Fields: Work email, Password.
- CTA "Sign in."
- Error message styling.
- Link to client portal.

### 6.5 Dashboard — `/company`
- Stat tiles (4): In testing, Items to fix, Waiting for signature, Signed off.
- Project table or card list (mobile): product, client, progress bar/ring, status chip, current milestone, open action.
- Empty state: illustration-free, headline + helper + CTA.
- **Important:** "Waiting for signature" must use `done === total` logic (pass + N/A), not `tested === total`.

### 6.6 New project — `/company/projects/new`
- Two-column form desktop, single column mobile.
- Segmented controls for existing/new product and client.
- Dropzone with drag state, file name, size, inline preview milestone list.
- Expiry date picker.
- Submit CTA.
- One-time credentials panel after creation (link, project ID, password, invite text, copy buttons).

### 6.7 Project detail — `/company/projects/:id`
- Header with status chip + "Open client link."
- One-time credentials card (conditional).
- Progress ring or bar with pass/fail counts.
- Milestone cards with item rows: code (mono), status chip, required/evidence tags, title, steps, expected, notes, screenshot thumbnail.
- Fix form on fail items (≥3 char note, confirm dialog).
- Access side panel: ID, expiry, rotate password, change expiry, revoke/restore.
- Activity feed: newest first, actor + action + timestamp.

### 6.8 Client login by token — `/p/:token`
- Centered `FocusPanel`.
- Single password field.
- Project ID + expiry shown.
- Lock warning text.
- Revoked/expired → render Closed screen instead.

### 6.9 Tester identity — `/p/:token/tester`
- Centered `FocusPanel`.
- Name + work email fields.
- "Start testing" CTA.

### 6.10 Checklist portal — `/p/:token/portal`
- Desktop: left `MilestoneRail` (scrollable if many), right main content.
- Mobile: rail collapses to top chips or drawer.
- Header: overall progress ring/bar, "N of M done," "K to fix."
- Milestone card: name, done count, state chip, locked notice if applicable.
- Item cards: dense layout, result choices (large Pass/Fail/N-A buttons), comment textarea, screenshot attach/replace, lightbox trigger.
- Auto-save inline status per item.
- Bottom CTA bar (sticky mobile): "Next milestone" or "Sign off UAT," revealed smoothly when milestone completes.
- Locked milestones visually dimmed and non-interactive.

### 6.11 Sign-off wizard — `/p/:token/signoff`
- 3-step `Stepper`: Signer details → Email code → Signature.
- Step 1: Name, designation, work email.
- Step 2: `OtpGrid` (6 boxes), resend, change details, expiry warning.
- Step 3: Verified banner, summary grid (passed / N-A / milestones), `SignatureCanvas` vs `TypedSignature` toggle, consent checkbox, "Sign and issue certificate."
- States: incomplete gate, expired, too many attempts, already signed.

### 6.12 Certificate — `/p/:token/certificate`
- Print-first A4 `CertificateSheet`.
- Document header: verification ID, client, product, version.
- Statement paragraph.
- Details grid.
- Milestones table.
- Signature block: image or typed name, signature line, signer meta, OTP verification line.
- Fingerprint block: Record SHA-256, PDF SHA-256.
- Print CSS: hides all chrome, white background, legible at 100%.

### 6.13 Closed / blocked
- Centered card, large icon (lock / clock), headline ("Access turned off" / "Link expired"), explanation, owner name, project ID, "Verify a certificate" link.

### 6.14 Error pages (404 / 403 / 500)
- Large status code, human message, escape actions ("Go to start," "Verify certificate").

---

## 7. Motion & interaction

- All transitions: 200–300ms, `ease-out`, fade + slight slide. **No bouncing, no elastic.**
- Auto-save status: appear → hold 2s → fade.
- Milestone completion: reveal bottom CTA with smooth scroll into view.
- Modal/dialog: scale 98% → 100% + fade-in.
- No parallax, no decorative animation.
- Respect `prefers-reduced-motion`.

---

## 8. Responsive breakpoints

| Breakpoint | Behavior |
|---|---|
| ≥ 1200px | Desktop layouts, side rails, tables |
| 900–1199px | Narrowed side panels, compact tables |
| 600–899px | Single column, tables → cards, rail → chips |
| < 600px | Full-width cards, sticky bottom CTA on portal/sign-off, full-width signature canvas, hamburger nav |

Touch targets: minimum 44×44px everywhere.

---

## 9. Accessibility (WCAG 2.2 AA)

- Keyboard-only operation on every journey.
- Visible focus ring (`--brand-border`) on all interactive elements.
- Semantic HTML: `header`, `nav`, `main`, `footer`, one `h1` per page.
- Stepper uses `aria-current="step"`.
- Auto-save status uses `aria-live="polite"`.
- Dialogs/lightbox: `role="dialog"`, `aria-modal="true"`, focus trap, Escape closes, focus returns.
- Form errors linked via `aria-describedby` + `aria-invalid`.
- Contrast ≥ 4.5:1 text, ≥ 3:1 UI, both themes.
- Never color alone for status — always pair with label/icon/text.
- Signature pad has typed alternative (motor accessibility).
- Zoom to 200% without loss; reflow at 320px width.

---

## 10. Deliverables

1. **Design tokens file** (CSS variables or Figma variables) for light/dark — colors, type, spacing, radius, borders, shadows.
2. **Component library spec** — all 40 components with states (default, hover, active, focus, disabled, error).
3. **High-fidelity mockups** — all 14 screens, light + dark, desktop (1440px) + mobile (390px).
4. **Component gallery / Storybook or Figma file** showing every component isolated.
5. **Print spec** for the certificate sheet (A4, margins, font embedding).
6. **Motion notes** — easing, durations, reduced-motion fallback.

---

## 11. Explicit exclusions (read before designing)

- ❌ Do not use the old slate/emerald palette.
- ❌ Do not reuse old component names (`.card`, `.dropzone`, `.railitem`, `.shotform`, etc.) as visual templates.
- ❌ Do not use heavy drop shadows as the primary card boundary.
- ❌ No illustrations, photos, or hero graphics.
- ❌ No rounded, bubbly, or "friendly" typefaces.
- ❌ Do not preserve the old dashboard `ready` bug (`tested === total`). Use `done === total`.
- ❌ Do not put secrets, tokens, or demo credentials in visual designs.

---

## Sign-off

Designer: ____________________  Date: __________  
Approved directions: Colors ▢  Typography ▢  Layout ▢  Components ▢
