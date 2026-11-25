# UAT Desk — Frontend Rebuild Checklist

How to use: tick each box only when you can **see it working in the new
frontend**, not when the file exists. Every item names the screen and, where
useful, the component from `frontend-prompt.md` §8.

Legend: `[ ]` not done · `[x]` verified · `[-]` intentionally deferred (write
the reason next to it).

---

## A. Foundation and global shell

### A1. Design system

- [ ] Colour tokens implemented exactly (light + dark) — §4.2.
- [ ] Radii 8 / 12 / 16 px used consistently.
- [ ] Four soft shadow levels defined and used.
- [ ] Type scale matches §4.3 (h1 clamp 26–36px/800, body 15/1.6, tiny 12px).
- [ ] Eyebrow style: 11–12px, 700, uppercase, letter-spacing .08em, muted.
- [ ] System UI font stack; monospace for IDs, hashes, tokens, codes.
- [ ] 4px spacing grid; no arbitrary pixel values in components.
- [ ] No default Tailwind/MUI blue anywhere — brand is emerald `#0f766e`.
- [ ] Focus ring visible on every interactive element (light + dark).

### A2. Theme

- [ ] Light mode is the default when the OS has no preference.
- [ ] Dark mode follows `prefers-color-scheme` on first visit.
- [ ] Theme toggle switches light/dark.
- [ ] Choice persists across reloads.
- [ ] No flash of wrong theme on first paint.
- [ ] Toggle is keyboard accessible with an accessible name.

### A3. Top bar (`TopBar`, `NavLink`)

- [ ] Brand mark + "UAT Desk" wordmark.
- [ ] Contextual subtitle: "company workspace".
- [ ] Contextual subtitle: `<Product> <version>` on client project pages.
- [ ] Contextual subtitle: "client testing portal" on client pages without a
      project.
- [ ] Contextual subtitle: "acceptance testing and sign-off" on public pages.
- [ ] Company nav: Dashboard · New UAT project · Verify certificate · Client
      portal →.
- [ ] Client nav: Checklist · Certificate (only when signed) · Client portal ·
      Company portal →.
- [ ] Public nav: Client portal · Company portal · Verify certificate.
- [ ] Active nav item is visually marked.
- [ ] Company identity chip shows the signed-in email + "Sign out".
- [ ] Client identity chip shows the tester name + "Sign out".
- [ ] Sign out posts with CSRF and returns to the correct login.
- [ ] Mobile: nav collapses into a menu; brand + theme toggle stay visible.
- [ ] Brand link goes to the correct home per context.

### A4. Flash (`FlashBar`)

- [ ] Success style renders for `ok` flash.
- [ ] Error style renders for `error` flash.
- [ ] Dismiss button removes it.
- [ ] Auto-dismisses after ~8 seconds.
- [ ] `role="status"` so screen readers announce it.
- [ ] Does not cause layout shift when it appears/disappears.

### A5. Footer

- [ ] Tagline: "UAT Desk · server-side acceptance testing, sign-off and
      verification".
- [ ] Links: Client portal, Company portal, Verify a certificate.
- [ ] Stacks cleanly on mobile.

### A6. System pages

- [ ] 404 page with status mark, message, "Go to the start page", "Verify a
      certificate".
- [ ] 403 page for revoked/expired access.
- [ ] 500 page with human message, no stack trace.
- [ ] 400 "file too large" message mentions the 5 MB / 15 MB limits.
- [ ] 503 "database not reachable" message.
- [ ] AJAX/API errors return JSON `{ ok:false, error }`, not HTML.

---

## B. Landing — `/`

- [ ] Eyebrow "Acceptance Testing & Verification".
- [ ] H1 "UAT Desk Portals".
- [ ] One-sentence value statement.
- [ ] Client Portal card: icon, "For Clients & Testers", description.
- [ ] Client Portal card: 3 benefit bullets.
- [ ] Client Portal card: CTA "Open Client Portal →" → `/client`.
- [ ] Company Workspace card: icon, "For Project Managers & Release Teams",
      description.
- [ ] Company Workspace card: 3 benefit bullets.
- [ ] Company card CTA → `/company`.
- [ ] Company card CTA label changes to "Go to Dashboard →" when signed in.
- [ ] Company card shows "Signed in as <email>" when signed in.
- [ ] Verification banner: shield icon, "Public Verification".
- [ ] Verification banner: "Verify a Completion Certificate" + description.
- [ ] Verification banner CTA → `/verify`.
- [ ] Two-column layout on desktop, single column on mobile.
- [ ] No pricing, testimonials, hero images, or marketing filler.

---

## C. Client entry — `/client`

- [ ] Centered auth card, max-width 420–460px.
- [ ] Icon mark + eyebrow "Client Acceptance Testing".
- [ ] H1 "Open your UAT checklist" + helper text.
- [ ] Field: Project ID — mono, uppercase display, placeholder `e.g.
      UAT-ACME23`, `autocomplete="username"`, required, autofocus.
- [ ] Field: Password — `autocomplete="current-password"`, required.
- [ ] Submit "Open checklist" (full width).
- [ ] Error: empty project ID.
- [ ] Error: unknown project ID shows the entered value.
- [ ] Error: wrong password.
- [ ] Error: locked account with remaining minutes.
- [ ] Pasting a full `/p/<token>` URL is accepted and resolved.
- [ ] Dev-only demo box with "Fill in" shortcuts.
- [ ] Demo box is absent from production builds.
- [ ] Footer link "Company sign in →".

---

## D. Verify — `/verify`

- [ ] Eyebrow "Public check", h1 "Verify a UAT certificate", explanation.
- [ ] Field: Verification ID — mono, placeholder `VC-XXXX-XXXX`,
      `autocomplete="off"`, required, autofocus.
- [ ] Button "Check certificate".
- [ ] Note that checklist answers are not exposed.
- [ ] "What this proves" card with 4 items.
- [ ] Valid result: green check badge + eyebrow "Valid certificate".
- [ ] Valid result: product + version heading.
- [ ] Valid result: "Signed for <Client> on <date>".
- [ ] Valid result: detail grid — Verification ID, Project ID, Signed by,
      Designation, Email verified.
- [ ] Valid result: Record SHA-256 hashline, copyable.
- [ ] Valid result: PDF check file input (`.pdf`) + "Check PDF".
- [ ] PDF outcome: matches (green).
- [ ] PDF outcome: does not match (red).
- [ ] PDF outcome: no fingerprint stored (neutral).
- [ ] Invalid result: red × badge, "Not found", echoes the entered ID,
      guidance text.
- [ ] `?id=` in the URL runs the lookup automatically.
- [ ] Case-insensitive, normalised to uppercase.
- [ ] Rate-limit response handled gracefully.

---

## E. Company sign-in — `/company/login`

- [ ] Eyebrow "Company side", h1 "Sign in to UAT Desk", description.
- [ ] Field: Work email — `autocomplete="username"`, required, autofocus.
- [ ] Field: Password — `autocomplete="current-password"`, required.
- [ ] Submit "Sign in" (full width).
- [ ] Error "That email and password do not match."
- [ ] Email value is preserved after a failed attempt.
- [ ] Footer link "Open Client Portal →".
- [ ] Seeded admin credentials are NOT displayed in production.

---

## F. Dashboard — `/company`

- [ ] Eyebrow "Company workspace", h1 "UAT projects", subtitle.
- [ ] Action "Checklist template" downloads `.xlsx`.
- [ ] Action "New UAT project" → `/company/projects/new`.
- [ ] Stat tile: In testing.
- [ ] Stat tile: Items to fix.
- [ ] Stat tile: Waiting for signature.
- [ ] Stat tile: Signed off.
- [ ] Table columns: Product and release, Client, Progress, Status, Current
      milestone, action.
- [ ] Product cell: product name + muted version, links to detail.
- [ ] Product cell: mono project ID underneath.
- [ ] Client cell: client name + owner name.
- [ ] Progress cell: bar + "N of M passed or N/A".
- [ ] Progress cell: "K failed" in red when K > 0.
- [ ] Status badge uses the exact labels in §4.4.
- [ ] Current milestone text, or "—", or "Complete" when signed.
- [ ] "Open" action per row.
- [ ] Empty state: "No UAT projects yet" + explanation + "Create the first
      project".
- [ ] Loading skeleton for stats and table.
- [ ] Error state with retry.
- [ ] Mobile: rows become cards, progress full width, 44px targets.
- [ ] **Status bug fixed:** `ready` uses `done === total`, not
      `tested === total`.

---

## G. New project — `/company/projects/new`

### G1. Header and notices

- [ ] Breadcrumb "Dashboard / New project".
- [ ] H1 "New UAT project" + explanation of the checklist snapshot.
- [ ] "Download .xlsx template" action.
- [ ] "Download .csv template" action.
- [ ] Form-level error notice with bulleted messages.
- [ ] Checklist error notice: "The checklist was not accepted" + "Nothing was
      imported."
- [ ] Success preview notice: file name, total items, milestone count.
- [ ] Preview lists each milestone with item count and required count.

### G2. What is being tested

- [ ] Segmented control: Existing product / Add a product.
- [ ] Existing product `<select>` populated from products.
- [ ] Fallback option "No products yet — add one" when the list is empty.
- [ ] New product name field appears only in "Add a product".
- [ ] Field: Release or version — required, placeholder `v1.0`.
- [ ] Segmented control: Existing client / Add a client.
- [ ] Existing client `<select>` populated from clients.
- [ ] Fallback option "No clients yet — add one".
- [ ] New client name field appears only in "Add a client".

### G3. Link and responsibility

- [ ] Field: Company contact — required.
- [ ] Field: Company contact email — optional, hint "gets the signed
      certificate".
- [ ] Field: Link stays available until — date, required, default +30 days.
- [ ] Info notice about one-time password and revocability.

### G4. Checklist file (`Dropzone`, `ChecklistPreview`)

- [ ] Column legend lists all 8 columns.
- [ ] Dropzone accepts click and drag-and-drop.
- [ ] Accepts `.xlsx` and `.csv` only.
- [ ] Rejects wrong extension with a clear message.
- [ ] Rejects > 5 MB with a clear message.
- [ ] Shows selected file name and human-readable size.
- [ ] Shows "checking the file…" while previewing.
- [ ] Calls `POST /company/projects/preview` on file choice.
- [ ] Spinner visible during the request.
- [ ] Valid preview: green panel + "Checklist looks good — N items across M
      milestones" + per-milestone list.
- [ ] Invalid preview: red panel + bulleted server errors.
- [ ] Dropzone gets has-file / invalid visual states.
- [ ] Nothing is created by the preview.
- [ ] Stale responses are ignored (rapid re-selection).

### G5. Submission

- [ ] Client-side validation: product, client, version, owner, email format,
      expiry ≥ today, file present.
- [ ] "Cancel" returns to dashboard.
- [ ] Primary button "Create project and generate the client link".
- [ ] Button disabled/loading while submitting; no double submit.
- [ ] Server validation errors are re-rendered with values preserved.
- [ ] File name is preserved in the error state.
- [ ] Success redirects to project detail with a credentials card.

---

## H. Project detail — `/company/projects/:id`

### H1. Header

- [ ] Breadcrumb "Dashboard / <Client>".
- [ ] H1 product name + muted version.
- [ ] Subtitle: client · owner · checklist filename (when present).
- [ ] Status badge.
- [ ] "Open client link" opens `/p/<token>` in a new tab.

### H2. One-time credentials (`CredentialsPanel`)

- [ ] Only shown immediately after create or password rotation.
- [ ] Eyebrow "Shown once", h2 "Client credentials".
- [ ] Explanation that the password is hashed and cannot be shown again.
- [ ] Copy row: Link (readonly, mono).
- [ ] Copy row: Project ID (readonly, mono).
- [ ] Copy row: Password (readonly, mono).
- [ ] Each copy button shows "Copied" feedback.
- [ ] Clipboard fallback for insecure contexts.
- [ ] Invitation text textarea (readonly, ~9 rows).
- [ ] "Copy invitation" button.
- [ ] Card disappears on refresh (shown-once semantics).

### H3. Progress

- [ ] "N of M items passed or marked N/A".
- [ ] "K failed" in red when > 0.
- [ ] "R waiting for retest" when > 0.
- [ ] Percentage value.
- [ ] Large progress bar.

### H4. Signed-off card

- [ ] Visible only when signed.
- [ ] Eyebrow "Signed off", verification ID as heading.
- [ ] Signer name, designation, signed date.
- [ ] "Verify" action → `/verify?id=…`.
- [ ] "Download PDF" action.
- [ ] Record SHA-256 hashline.
- [ ] PDF SHA-256 hashline (when present).
- [ ] Signature image preview (when present).

### H5. Milestone and item list

- [ ] One card per milestone with "Milestone N", name, state badge.
- [ ] Item row: mono code.
- [ ] Item row: status badge or "Not tested".
- [ ] Item row: "Required" tag when mandatory.
- [ ] Item row: "Evidence" tag when evidence required.
- [ ] Item row: title.
- [ ] Item row: steps (pre-wrap, muted).
- [ ] Item row: "Expected: …".
- [ ] Item row: "Client note: …" when present.
- [ ] Item row: "Fix note: …" when present.
- [ ] Item row: tester name + tested date when present.
- [ ] Item row: screenshot thumbnail opens the lightbox.
- [ ] Fail item: fix form with "What was fixed?" textarea.
- [ ] Fail item: note < 3 chars is rejected with a message.
- [ ] Fail item: confirmation dialog before sending.
- [ ] Retest item: "Waiting for the client to retest."
- [ ] Pass/N/A item: "Accepted."
- [ ] Untested item: "Not tested yet."

### H6. Access panel (`AccessPanel`)

- [ ] Project ID (mono).
- [ ] Available until (formatted date).
- [ ] Status badge.
- [ ] Copy link row.
- [ ] "Generate a new password" with confirmation dialog.
- [ ] "Change end date" date input + "Update end date".
- [ ] Past date is rejected with "Choose an end date today or later."
- [ ] "Turn off client access" (danger) with confirmation.
- [ ] "Restore client access" when revoked.
- [ ] Actions reflect current revoked state.

### H7. Activity

- [ ] Last 50 events, newest first.
- [ ] Action rendered with " · " instead of dots.
- [ ] Timestamp.
- [ ] Actor.
- [ ] Detail when present.
- [ ] IP in mono when present.
- [ ] Empty state "No activity yet."

### H8. Layout

- [ ] Two-column desktop layout (main + side).
- [ ] Side column sticky on tall pages.
- [ ] Stacks below content on mobile.
- [ ] Long checklists remain performant.

---

## I. Client login by token — `/p/:token`

- [ ] Centered auth card.
- [ ] Eyebrow "Client acceptance testing".
- [ ] H1 product + version.
- [ ] "Prepared for <Client> by <owner>."
- [ ] Error notice slot.
- [ ] Field: Password from your invitation — required, autofocus.
- [ ] Submit "Open the checklist".
- [ ] KV: Project ID (mono).
- [ ] KV: Available until (date).
- [ ] Warning about forwarding and the 5-attempt / 15-minute lock.
- [ ] Link "← Switch Project ID".
- [ ] Link "Company sign in →".
- [ ] Revoked project renders the Closed screen, not the form.
- [ ] Expired project renders the Closed screen, not the form.

---

## J. Tester identity — `/p/:token/tester`

- [ ] Eyebrow "Before you start", h1 "Who is testing?".
- [ ] Explanation that name/email appear on results and the certificate.
- [ ] Field: Full name — required, autofocus.
- [ ] Field: Work email — email, required.
- [ ] Submit "Start testing".
- [ ] Error: name missing or invalid email.
- [ ] Values are preserved after an error.
- [ ] Footer: "Testing <Product version> for <Client>."

---

## K. Checklist portal — `/p/:token/portal`

### K1. Header and progress

- [ ] Eyebrow `<Client> · <owner>`.
- [ ] H1 product + version.
- [ ] Instruction about sequential milestones.
- [ ] "Overall progress" label.
- [ ] "N / M" counter.
- [ ] Large progress bar.
- [ ] "P% complete".
- [ ] "K to fix" in red when > 0.

### K2. Milestone rail (`MilestoneRail`)

- [ ] One entry per milestone.
- [ ] Number circle, or ✓ when complete.
- [ ] Milestone name.
- [ ] "N of M done".
- [ ] "· locked" suffix when locked.
- [ ] Active entry highlighted.
- [ ] Complete / open / locked visual states.
- [ ] Locked entries are not clickable and not tabbable.
- [ ] Clicking an unlocked entry navigates with `?ms=`.
- [ ] Mobile: horizontal chips or collapsible drawer.

### K3. Milestone card

- [ ] Eyebrow "Milestone N of M".
- [ ] H2 milestone name.
- [ ] "N of M items done".
- [ ] State badge: Complete / Locked / In progress.
- [ ] Locked notice + "Go to the current milestone".

### K4. Item card (`ChecklistItemCard`)

- [ ] Mono code.
- [ ] Status badge (or "Not tested").
- [ ] "Required" tag when mandatory.
- [ ] "Evidence" tag when evidence required.
- [ ] H3 title.
- [ ] Steps block (pre-wrap).
- [ ] "Expected result" eyebrow block.
- [ ] Retest notice with fix note when `retest`.
- [ ] "Your note: …" when present.
- [ ] "Last result by <tester> · <date>" when present.
- [ ] Screenshot thumbnail when an image exists.
- [ ] Thumbnail opens the lightbox.
- [ ] "Screenshot attached. Open it to check, or replace it below."
- [ ] Upload form: file input accepts PNG/JPG.
- [ ] Upload label: "Attach screenshot" / "Replace screenshot".
- [ ] "Upload" button.
- [ ] Evidence hint when the item requires evidence.
- [ ] Upload error: no file / wrong type / too large.
- [ ] Uploaded screenshot replaces the previous one.
- [ ] Deep link `#item-<id>` scrolls to the item.

### K5. Result choices (`ResultChoices`, `AutoSaveForm`)

- [ ] Pass / Fail / N/A segmented radio group.
- [ ] Semantic colours: pass green, fail red, N/A neutral.
- [ ] N/A disabled for mandatory items.
- [ ] Tooltip "Required item cannot be marked N/A".
- [ ] Comment textarea: "What happened? *Required when marking Fail*".
- [ ] Placeholder "Add the steps you took and what you saw."
- [ ] Existing comment is prefilled.
- [ ] Footer "Results save automatically on selection."
- [ ] Inline save status region.
- [ ] Selecting a radio saves immediately.
- [ ] Comment debounce ~800 ms.
- [ ] Blur saves the comment.
- [ ] Fail + empty comment does not save; shows "Add note to save fail" and
      focuses the textarea.
- [ ] Saving shows "Saving…".
- [ ] Success shows "Saved ✓" then clears.
- [ ] Server error shows the server message in red.
- [ ] 403 shows "Session expired. Reload page."
- [ ] Network failure shows "Network error".
- [ ] Rapid changes coalesce into one follow-up save.
- [ ] Badge updates without reload.
- [ ] Milestone count updates without reload.
- [ ] Rail count and ✓ update without reload.
- [ ] Milestone badge updates without reload.
- [ ] Next locked milestone unlocks without reload.
- [ ] Save status is announced via `aria-live`.
- [ ] Locked milestone shows no result form.

### K6. Bottom CTA

- [ ] All done → "All milestones are complete" + "Sign off UAT".
- [ ] Milestone complete with a next → "Milestone complete" + "Next
      milestone".
- [ ] Pending CTA is hidden until the milestone completes.
- [ ] Pending CTA reveals and scrolls into view on completion.
- [ ] Last milestone completion switches the CTA to sign-off.
- [ ] Only one CTA is visible at a time.

### K7. Edge cases

- [ ] No milestones → "No checklist items" + contact-owner message.
- [ ] Invalid `?ms=` falls back to the current milestone.
- [ ] `?ms=` pointing at a locked milestone falls back.
- [ ] Already-signed project redirects to the certificate.
- [ ] Mobile: sticky bottom bar with progress + next action.

---

## L. Sign-off wizard — `/p/:token/signoff`

### L1. Guards and stepper

- [ ] Incomplete checklist → error + redirect to portal.
- [ ] Already signed → redirect to certificate.
- [ ] Stepper with 3 steps: Signer details, Email code, Signature.
- [ ] Active / done / pending states.
- [ ] `aria-current="step"` on the active step.

### L2. Step 1 — Signer details

- [ ] H2 "Who is signing?" + explanation.
- [ ] Field: Full name — required, prefilled from tester.
- [ ] Field: Designation or role — required, placeholder "e.g. Head of
      Operations".
- [ ] Field: Work email — email, required, prefilled from tester.
- [ ] Submit "Send the one-time code".
- [ ] Error for missing name / designation / invalid email.
- [ ] Values preserved after an error.

### L3. Step 2 — Email code (`OtpInput`)

- [ ] H2 "Check your email".
- [ ] Shows the destination email.
- [ ] "Expires in 10 minutes."
- [ ] Dev-only code notice when SMTP is not configured.
- [ ] 6-digit input, numeric keyboard, `pattern="[0-9]{6}"`, maxlength 6.
- [ ] `autocomplete="one-time-code"`.
- [ ] Paste a 6-digit code works.
- [ ] Autofocus.
- [ ] Submit "Verify code".
- [ ] "Send a new code" action.
- [ ] "Change signer details" → `?restart=1`.
- [ ] Error: expired code.
- [ ] Error: wrong code.
- [ ] Error: too many attempts (5).
- [ ] Error: start again.

### L4. Step 3 — Signature

- [ ] Verified banner with signer name, designation, client, email.
- [ ] "Code verified" badge.
- [ ] Summary grid: Checklist, Passed, Not applicable, Milestones.
- [ ] Segmented control: Draw signature / Type signature.
- [ ] Drawn panel visible by default.
- [ ] Canvas signature pad, full width, ~260px tall.
- [ ] Stroke 2.2px, round caps/joins, brand ink colour.
- [ ] Works with mouse.
- [ ] Works with touch.
- [ ] Works with stylus.
- [ ] DPR-aware (sharp on retina).
- [ ] Preserves drawing on resize.
- [ ] "Sign above the line" hint and baseline.
- [ ] "Clear" button empties the pad.
- [ ] Caption "Use a mouse, trackpad, finger or stylus."
- [ ] PNG data URL exported into the hidden field on submit.
- [ ] Typed panel: "Type your full name", prefilled.
- [ ] Switching modes preserves the other mode's input.
- [ ] Consent checkbox required, with the full legal sentence + client name.
- [ ] Footer "Signed at <time> · IP and browser are recorded."
- [ ] Primary "Sign and issue certificate".
- [ ] Validation: empty drawn signature blocked.
- [ ] Validation: empty typed name blocked.
- [ ] Validation: consent required.
- [ ] No double submit.
- [ ] Success redirects to certificate with a success flash.

---

## M. Certificate — `/p/:token/certificate`

### M1. Header

- [ ] Eyebrow "Signed and stored".
- [ ] H1 "UAT completion certificate".
- [ ] "Verification ID <mono>".
- [ ] Action "Download PDF".
- [ ] Action "Print".
- [ ] Action "Public verification" → `/verify?id=…`.

### M2. Certificate sheet (`CertificateSheet`)

- [ ] Band with "UAT Desk" kicker + "UAT Completion Certificate" +
      verification ID.
- [ ] Statement naming client, product, version, item count, milestone count.
- [ ] Details: Client.
- [ ] Details: Product + version.
- [ ] Details: Project ID (mono).
- [ ] Details: Company contact.
- [ ] Details: UAT opened date.
- [ ] Details: Signed on date.
- [ ] Milestones table: Milestone, Items, Passed, Not applicable, Completed.
- [ ] "—" for milestones with no completion date.
- [ ] Signature block label "Signed for <Client>".
- [ ] Drawn signature image when present.
- [ ] Typed fallback: name + "Typed electronic signature".
- [ ] Signature line.
- [ ] Signer name, designation, client, email.
- [ ] "Email verified by one-time code on <date>".
- [ ] Meta: Signed, Signer IP (mono), Signature type (Drawn/Typed
      electronic).
- [ ] Record SHA-256 fingerprint.
- [ ] PDF SHA-256 fingerprint when present.
- [ ] Footer with verification URL + ID.
- [ ] Disclaimer notice about electronic vs certificate-based signature.

### M3. Print

- [ ] Print hides top bar, nav, footer, buttons, notices.
- [ ] Sheet stays on white regardless of theme.
- [ ] No page break inside the signature block.
- [ ] Legible at 100% on A4.
- [ ] Browser print preview matches the on-screen sheet.

---

## N. Closed / blocked screen

- [ ] Revoked: power icon + "Client access is turned off".
- [ ] Revoked: names the owner and invites contact.
- [ ] Expired: hourglass icon + "This link has expired".
- [ ] Expired: names the product, version and end date.
- [ ] Line: "Project ID <mono> · <Client>".
- [ ] Action "Verify a certificate".
- [ ] No password form is shown when blocked.

---

## O. Component library — all 46 built and reused

Tick each only if it exists as a **reusable** component (not copy-pasted markup)
and is used on the screens listed in §8.

- [ ] 1 `AppShell`
- [ ] 2 `TopBar`
- [ ] 3 `NavLink`
- [ ] 4 `ThemeToggle`
- [ ] 5 `FlashBar`
- [ ] 6 `Footer`
- [ ] 7 `PageHeader`
- [ ] 8 `Button` (primary, ghost, danger, sm, block, icon, loading)
- [ ] 9 `Field`
- [ ] 10 `Select`
- [ ] 11 `Textarea`
- [ ] 12 `Checkbox` / `Radio`
- [ ] 13 `SegmentedControl`
- [ ] 14 `Badge` (pass, fail, brand, retest, neutral)
- [ ] 15 `Tag`
- [ ] 16 `Card`
- [ ] 17 `StatTile`
- [ ] 18 `ProgressBar` (sm, big)
- [ ] 19 `DataTable` (+ mobile card mode)
- [ ] 20 `EmptyState`
- [ ] 21 `Notice` (info, ok, error, retest)
- [ ] 22 `CopyRow`
- [ ] 23 `Dropzone`
- [ ] 24 `ChecklistPreview`
- [ ] 25 `CredentialsPanel`
- [ ] 26 `AccessPanel`
- [ ] 27 `MilestoneRail`
- [ ] 28 `ChecklistItemCard`
- [ ] 29 `ResultChoices`
- [ ] 30 `AutoSaveForm`
- [ ] 31 `ScreenshotUpload`
- [ ] 32 `FixForm`
- [ ] 33 `Stepper`
- [ ] 34 `OtpInput`
- [ ] 35 `SignaturePad`
- [ ] 36 `TypedSignature`
- [ ] 37 `ConsentCheckbox`
- [ ] 38 `CertificateSheet`
- [ ] 39 `VerificationResult`
- [ ] 40 `PdfHashCheck`
- [ ] 41 `ActivityFeed`
- [ ] 42 `Lightbox`
- [ ] 43 `ConfirmDialog`
- [ ] 44 `Toast`
- [ ] 45 `Skeleton`
- [ ] 46 `ErrorState`
- [ ] Component gallery/Storybook page covers all 46.
- [ ] No screen re-implements a component inline.

---

## P. Cross-cutting behaviours

- [ ] CSRF token sent on every POST (field or header).
- [ ] All fetches send cookies (`credentials: 'include'`).
- [ ] 403 responses prompt a reload, not a silent failure.
- [ ] Copy buttons work with `navigator.clipboard` and fall back to
      `execCommand`.
- [ ] Copy feedback resets after ~1.4s.
- [ ] Confirmation dialogs replace `window.confirm` for destructive actions.
- [ ] Double-submit prevention on every form.
- [ ] Disabled state while a form is submitting.
- [ ] Flash auto-dismiss + manual dismiss.
- [ ] Lightbox: Escape, click-outside, close button, focus trap, focus
      restore.
- [ ] Theme persists and applies before first paint.
- [ ] Dates formatted for the user's locale; calendar dates never shift by a
      day.
- [ ] Long text (steps, notes, hashes) wraps and never overflows.
- [ ] Empty, loading, and error states exist for every data-driven screen.
- [ ] No console errors or warnings in any flow.

---

## Q. Business rules enforced

- [ ] Milestone complete = every item `pass` or `na`.
- [ ] Locked milestone cannot be opened or edited.
- [ ] Milestone unlocks as soon as the previous one completes (no reload).
- [ ] Sign-off blocked until `done === total` and `total > 0`.
- [ ] Fail cannot be saved without a comment.
- [ ] N/A cannot be chosen for a mandatory item.
- [ ] Only `fail` items can be sent for retest.
- [ ] Fix note requires ≥ 3 characters.
- [ ] Retest item shows the fix note to the client.
- [ ] Password shown once; only "generate new" afterwards.
- [ ] Revoked/expired links show Closed, not login.
- [ ] 5 wrong passwords → 15-minute lock with remaining minutes shown.
- [ ] OTP: 6 digits, 10 minutes, 5 attempts, resend invalidates previous.
- [ ] Sign-off issues a certificate and emails signer + company contact.
- [ ] Verification ID lookup is case-insensitive.
- [ ] PDF hash check reports match / mismatch / no fingerprint.
- [ ] Checklist is immutable after creation.
- [ ] Dashboard `ready` uses `done === total` (bug fixed).

---

## R. Accessibility, performance, security

### R1. Accessibility (WCAG 2.2 AA)

- [ ] Keyboard-only completion of all primary journeys.
- [ ] Visible focus on every interactive element.
- [ ] Logical tab order; no traps.
- [ ] Landmarks: header, nav, main, footer.
- [ ] Exactly one `h1` per page; no heading skips.
- [ ] Rail uses list + links; locked items `aria-disabled` and untabbable.
- [ ] Stepper uses `aria-current="step"`.
- [ ] Save status uses `aria-live="polite"`.
- [ ] Toasts use `role="status"`.
- [ ] Dialogs/lightbox: `role="dialog"`, `aria-modal`, focus trap, Escape.
- [ ] Form errors linked via `aria-describedby` + `aria-invalid`.
- [ ] Contrast ≥ 4.5:1 text, ≥ 3:1 UI, in both themes.
- [ ] Status never communicated by colour alone (label + icon).
- [ ] Touch targets ≥ 44×44 px.
- [ ] `prefers-reduced-motion` respected.
- [ ] Zoom to 200% without loss of function.
- [ ] Reflows at 320 px width.
- [ ] Signature pad has a visible label and a typed alternative.
- [ ] `axe-core`: zero critical/serious violations on all 14 screens, both
      themes.

### R2. Performance

- [ ] Landing LCP < 2.0s on simulated 4G.
- [ ] Dashboard LCP < 2.0s on simulated 4G.
- [ ] CLS < 0.05.
- [ ] INP < 200ms.
- [ ] Landing JS ≤ 120 KB gzipped.
- [ ] Portal JS ≤ 200 KB gzipped.
- [ ] Route-level code splitting.
- [ ] Signature pad and PDF helpers lazy-loaded.
- [ ] Images lazy with explicit dimensions.
- [ ] No webfont request.
- [ ] Lighthouse mobile: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 95.

### R3. Security

- [ ] No secrets, tokens, or dev credentials in the production bundle.
- [ ] No tokens/passwords/OTP codes logged to the console.
- [ ] All user content escaped; no raw HTML injection.
- [ ] File type + size validated client-side (server remains authoritative).
- [ ] No third-party scripts on authenticated pages.
- [ ] Dev-only demo box absent from production builds.
- [ ] Session expiry handled with a clear reload prompt.
- [ ] No sensitive data in URL query strings beyond the existing token/id
      contract.

---

## S. End-to-end acceptance journeys

Run each on desktop **and** on a 390 px mobile viewport.

- [ ] J1 Company signs in → dashboard shows stats and rows.
- [ ] J2 Create project from `.xlsx` → preview → create → credentials card →
      copy link/ID/password/invite.
- [ ] J3 Client opens link → password → tester identity → portal.
- [ ] J4 Mark Pass/Fail/N/A → fail without comment blocked → comment saves →
      milestone unlocks.
- [ ] J5 Complete all milestones → sign off → OTP → draw signature → consent →
      certificate → download PDF.
- [ ] J6 Verify by ID → valid result → upload PDF → "matches".
- [ ] J7 Company sends a failed item for retest → client re-marks it.
- [ ] J8 Revoke access → Closed screen → restore → access returns.
- [ ] J9 Expiry in the past → Closed screen with expiry copy.
- [ ] J10 Five wrong passwords → locked message with remaining minutes.
- [ ] J11 Typed signature path (instead of drawn) issues a valid certificate.
- [ ] J12 Copy invitation text into an email and follow it end to end.

---

## T. Coverage matrix — screen × components

Use this to prove nothing is missing. Every row must be fully ticked.

| Screen | Required components |
|---|---|
| `/` | AppShell, TopBar, NavLink, PageHeader, Card, Button, Footer, ThemeToggle |
| `/client` | AppShell, TopBar, PageHeader, Field, Button, Notice, DemoBox(dev) |
| `/verify` | AppShell, PageHeader, Field, Button, Card, Notice, VerificationResult, PdfHashCheck, Badge |
| `/company/login` | AppShell, TopBar, PageHeader, Field, Button, Notice |
| `/company` | AppShell, PageHeader, StatTile, DataTable, ProgressBar, Badge, EmptyState, Skeleton, Button |
| `/company/projects/new` | AppShell, PageHeader, Field, Select, SegmentedControl, Dropzone, ChecklistPreview, Notice, Button, Card |
| `/company/projects/:id` | AppShell, PageHeader, Badge, ProgressBar, CredentialsPanel, CopyRow, AccessPanel, MilestoneRail(no), ChecklistItemCard, FixForm, ActivityFeed, Lightbox, ConfirmDialog, EmptyState |
| `/p/:token` | AppShell, PageHeader, Field, Button, Notice, Card |
| `/p/:token/tester` | AppShell, PageHeader, Field, Button, Notice |
| `/p/:token/portal` | AppShell, PageHeader, ProgressBar, MilestoneRail, ChecklistItemCard, ResultChoices, AutoSaveForm, ScreenshotUpload, Badge, Tag, Notice, Lightbox, Toast, EmptyState |
| `/p/:token/signoff` | AppShell, Stepper, Field, OtpInput, SegmentedControl, SignaturePad, TypedSignature, ConsentCheckbox, Notice, Button, Card |
| `/p/:token/certificate` | AppShell, PageHeader, CertificateSheet, Button, Notice |
| Closed | AppShell, Card, Button, Notice |
| 404/403/500 | AppShell, ErrorState, Button |

---

## Sign-off

- [ ] Product owner has clicked through all 12 journeys.
- [ ] Engineering has run the Playwright suite in CI and it is green.
- [ ] Design has reviewed all 14 screens in light + dark, desktop + mobile.
- [ ] The dashboard status bug is verified fixed against a project with
      failures.
- [ ] Deferred items (marked `[-]`) are documented with owners and dates.

Verified by: ____________________  Date: __________
