-- UAT Desk production schema.
-- Every table that holds client data is scoped to a project so a project can be
-- exported or deleted as one unit.

CREATE TABLE IF NOT EXISTS company_users (
  id            uuid PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  name          text NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE IF NOT EXISTS products (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id                 uuid PRIMARY KEY,
  product_id         uuid NOT NULL REFERENCES products(id),
  client_id          uuid NOT NULL REFERENCES clients(id),
  version            text NOT NULL,
  owner_name         text NOT NULL,
  owner_email        text,
  created_by         uuid REFERENCES company_users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  checklist_key      text,
  checklist_filename text
);

CREATE INDEX IF NOT EXISTS projects_client_idx ON projects (client_id);
CREATE INDEX IF NOT EXISTS projects_product_idx ON projects (product_id);

CREATE TABLE IF NOT EXISTS access_links (
  id              uuid PRIMARY KEY,
  project_id      uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  token           text NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  expires_at      date NOT NULL,
  revoked_at      timestamptz,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  rotated_at      timestamptz
);

CREATE TABLE IF NOT EXISTS milestones (
  id         uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   integer NOT NULL,
  name       text NOT NULL
);

CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones (project_id, position);

CREATE TABLE IF NOT EXISTS checklist_items (
  id          uuid PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  code        text NOT NULL,
  title       text NOT NULL,
  steps       text NOT NULL DEFAULT '',
  expected    text NOT NULL DEFAULT '',
  mandatory   boolean NOT NULL DEFAULT true,
  evidence    boolean NOT NULL DEFAULT false,
  position    integer NOT NULL,
  image_key   text,
  UNIQUE (project_id, code)
);

CREATE INDEX IF NOT EXISTS items_project_idx ON checklist_items (project_id);
CREATE INDEX IF NOT EXISTS items_milestone_idx ON checklist_items (milestone_id, position);

-- Append-only result history. The current result for an item is the newest row.
CREATE TABLE IF NOT EXISTS item_results (
  id           uuid PRIMARY KEY,
  item_id      uuid NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('pass', 'fail', 'na', 'retest')),
  comment      text NOT NULL DEFAULT '',
  fix_note     text NOT NULL DEFAULT '',
  image_key    text,
  tester_name  text,
  tester_email text,
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS results_item_idx ON item_results (item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS testers (
  id            uuid PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name          text NOT NULL,
  email         text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, email)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id          uuid PRIMARY KEY,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  verified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_project_idx ON otp_challenges (project_id, email, created_at DESC);

CREATE TABLE IF NOT EXISTS signoffs (
  id                 uuid PRIMARY KEY,
  project_id         uuid NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  verification_id    text NOT NULL UNIQUE,
  signer_name        text NOT NULL,
  signer_designation text NOT NULL,
  signer_email       text NOT NULL,
  otp_verified_at    timestamptz NOT NULL,
  signature_kind     text NOT NULL CHECK (signature_kind IN ('drawn', 'typed')),
  signature_key      text,
  signed_at          timestamptz NOT NULL,
  ip                 text,
  user_agent         text,
  record_json        jsonb NOT NULL,
  record_hash        text NOT NULL,
  summary            jsonb NOT NULL,
  pdf_key            text,
  pdf_hash           text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         bigserial PRIMARY KEY,
  project_id uuid,
  actor      text NOT NULL,
  action     text NOT NULL,
  detail     text NOT NULL DEFAULT '',
  ip         text,
  user_agent text,
  at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_project_idx ON audit_log (project_id, at DESC);

-- Used only when SMTP is not configured, so the dev environment can read OTP
-- codes and notification emails. The app never writes here in production.
CREATE TABLE IF NOT EXISTS dev_outbox (
  id         bigserial PRIMARY KEY,
  to_email   text NOT NULL,
  subject    text NOT NULL,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
