import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  ShieldCheck,
  Building2,
  Users,
  Search,
  Copy,
  Check,
  Sun,
  Moon,
  AlertTriangle,
  FileCheck2,
  Printer,
  Download,
  RotateCcw,
  Eraser,
  PenTool,
  Type,
  X,
  Info,
  Upload,
  KeyRound,
  Power,
  Activity,
  FolderPlus,
  LogOut,
  Eye,
  Hourglass,
  RefreshCw,
  Layers,
  LayoutDashboard,
  ChevronRight,
  Menu,
} from 'lucide-react';

type Theme = 'dark' | 'light';
type ScreenId =
  | 'landing'
  | 'client-entry'
  | 'verify'
  | 'company-login'
  | 'company'
  | 'new-project'
  | 'project-detail'
  | 'token-login'
  | 'tester-id'
  | 'portal'
  | 'signoff'
  | 'certificate'
  | 'closed'
  | 'error';

type ItemStatus = 'pass' | 'fail' | 'na' | 'retest';
type ProjectStatus =
  | 'signed'
  | 'ready'
  | 'in-progress'
  | 'not-started'
  | 'revoked'
  | 'expired';
type MilestoneState = 'complete' | 'locked' | 'open';
type StatusTone = 'ok' | 'danger' | 'warn' | 'neutral';
type BannerTone = 'info' | 'ok' | 'warn' | 'error';

interface ChecklistItem {
  id: string;
  code: string;
  title: string;
  steps: string;
  expected: string;
  mandatory: boolean;
  evidence: boolean;
  status: ItemStatus | null;
  comment: string;
  fix_note: string | null;
  tester_name: string | null;
  tester_email?: string | null;
  tested_at: string | null;
  screenshotName: string | null;
  screenshotUrl?: string | null;
}

interface Milestone {
  id: string;
  position: number;
  name: string;
  items: ChecklistItem[];
}

interface MilestoneWithState extends Milestone {
  index: number;
  doneCount: number;
  totalCount: number;
  complete: boolean;
  unlocked: boolean;
  state: MilestoneState;
}

interface ProjectStats {
  total: number;
  done: number;
  na: number;
  fail: number;
  retest: number;
  tested: number;
}

interface Project {
  id: string;
  product_name: string;
  version: string;
  client_name: string;
  owner_name: string;
  owner_email: string | null;
  checklist_filename: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  signed_at: string | null;
  liveChecklist: boolean;
  token: string;
  current_milestone: string;
  snapshotStats?: ProjectStats;
  oneTimePassword?: string;
}

interface ActivityEvent {
  id: string;
  action: string;
  detail: string;
  actor: string;
  ip: string;
  timestamp: string;
}

interface CertificateRecord {
  verification_id: string;
  project_id?: string;
  product_name?: string;
  version?: string;
  client_name?: string;
  owner_name?: string;
  signer_name: string;
  signer_designation: string;
  signer_email: string;
  otp_verified_at?: string;
  signed_at: string;
  signature_kind: 'drawn' | 'typed';
  typed_signature: string;
  signature_data_url?: string | null;
  ip: string;
  record_hash: string;
  pdf_hash: string;
}

interface FlashMessage {
  type: 'ok' | 'error';
  message: string;
}

interface TesterInfo {
  name: string;
  email: string;
}

interface ResultPatch {
  status: ItemStatus;
  comment: string;
  tester_name: string;
  tester_email: string;
  tested_at: string;
}

interface LightboxData {
  filename: string;
  imageUrl?: string | null;
}

interface ConfirmAction {
  type: 'fix' | 'rotate' | 'revoke';
  itemId?: string;
  note?: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
}

/**
 * ============================================================================
 * 1. GRAPHITE & SIGNAL DESIGN TOKENS & STYLES
 * ============================================================================
 * Dark mode is the default (#0b0f19 base), with clean inverted light mode
 * (#f9fafb base). Indigo-Violet (#6366f1) is the sole brand accent; semantic
 * green (#22c55e), red (#ef4444), and amber (#f59e0b) carry status meaning.
 */
const GRAPHITE_SIGNAL_CSS = `
  :root, [data-theme="dark"] {
    --bg: #0b0f19;
    --surface: #111827;
    --surface-2: #182033;
    --surface-3: #1f2944;
    --ink: #e5e7eb;
    --ink-secondary: #9ca3af;
    --muted: #6b7280;
    --line: #334155;
    --line-strong: #475569;

    --brand: #6366f1;
    --brand-hover: #4f46e5;
    --brand-soft: #312e81;
    --brand-border: #818cf8;

    --ok: #22c55e;
    --ok-soft: #064e3b;
    --ok-border: #10b981;

    --danger: #ef4444;
    --danger-soft: #450a0a;
    --danger-border: #f87171;

    --warn: #f59e0b;
    --warn-soft: #451a03;
    --warn-border: #fbbf24;

    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;

    --shadow-xs: 0 1px 2px rgba(2, 6, 23, 0.35);
    --shadow-md: 0 4px 14px rgba(2, 6, 23, 0.52);
    --shadow-lg: 0 14px 32px rgba(2, 6, 23, 0.72);
  }

  [data-theme="light"] {
    --bg: #f9fafb;
    --surface: #ffffff;
    --surface-2: #f1f5f9;
    --surface-3: #e2e8f0;
    --ink: #0f172a;
    --ink-secondary: #475569;
    --muted: #64748b;
    --line: #cbd5e1;
    --line-strong: #94a3b8;

    --brand: #6366f1;
    --brand-hover: #4f46e5;
    --brand-soft: #eef2ff;
    --brand-border: #6366f1;

    --ok: #16a34a;
    --ok-soft: #ecfdf5;
    --ok-border: #86efac;

    --danger: #dc2626;
    --danger-soft: #fef2f2;
    --danger-border: #fca5a5;

    --warn: #d97706;
    --warn-soft: #fffbeb;
    --warn-border: #fcd34d;

    --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.05);
    --shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);
    --shadow-lg: 0 14px 30px rgba(15, 23, 42, 0.14);
  }

  .gs-root {
    background-color: var(--bg);
    color: var(--ink);
    font-size: 15px;
    line-height: 1.6;
    font-family: "Inter", "Geist", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    min-height: 100vh;
    transition: background-color 220ms ease-out, color 220ms ease-out;
  }

  .gs-mono {
    font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13.5px;
    font-variant-numeric: tabular-nums;
  }

  .gs-focus:focus-visible {
    outline: 2px solid var(--brand-border);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .gs-root, .gs-root * {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
  }

  @media print {
    .no-print {
      display: none !important;
    }
    .gs-root {
      background: #ffffff !important;
      color: #0f172a !important;
    }
    .gs-cert-sheet {
      background: #ffffff !important;
      color: #0f172a !important;
      border: 1px solid #cbd5e1 !important;
      box-shadow: none !important;
      max-width: 100% !important;
    }
    .no-break {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;

const THEME_STORAGE_KEY = 'uatdesk.gs.theme';
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_PDF_BYTES = 15 * 1024 * 1024;
const IS_DEV =
  typeof process !== 'undefined' && process.env && process.env.NODE_ENV
    ? process.env.NODE_ENV !== 'production'
    : typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');

function readInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

function getCalendarPlusDays(days = 30): string {
  const now = new Date();
  const utcPlus = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)
  );
  return utcPlus.toISOString().slice(0, 10);
}

function getTodayCalendarYmd(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

function isProjectClosed(project: Project): boolean {
  return Boolean(project.revoked_at) || project.expires_at < getTodayCalendarYmd();
}

function generateVerificationId(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `VC-${digits}-${suffix}`;
}

async function computeSha256Hex(data: ArrayBuffer): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return '';
}

function makeFallbackHashHex(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i += 1) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.repeat(4);
}

function downloadCsvTemplate(): void {
  const csv = [
    'Milestone,Code,Title,Steps,Expected,Mandatory,Evidence',
    '"Session Security & Lockout Policy","SEC-01","HttpOnly SameSite=Lax session cookie","1. Sign in. 2. Inspect cookie.","Cookie has HttpOnly and SameSite=Lax",YES,YES',
    '"Session Security & Lockout Policy","SEC-02","Five failed attempts trigger lockout","1. Enter wrong password 5 times.","Locked for 15 minutes",YES,NO',
    '"Ledger Reconciliation & Exports","REC-01","CSV totals match ledger control total","1. Export settlement CSV.","Sums match to the cent",YES,YES',
    '"Sign-Off & Certificate Issuance","CERT-01","Email OTP + signature issues certificate","1. Complete prior milestones. 2. Verify OTP and sign.","Certificate issued with SHA-256",YES,NO',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'uat-checklist-template.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ============================================================================
 * 2. STATUS VOCABULARY, READY METRIC (done === total) & SEED DATA
 * ============================================================================
 */
const PROJECT_STATUS_MAP: Record<ProjectStatus, { label: string; tone: StatusTone }> = {
  signed: { label: 'Signed off', tone: 'ok' },
  ready: { label: 'Waiting for signature', tone: 'ok' },
  'in-progress': { label: 'In testing', tone: 'neutral' },
  'not-started': { label: 'Not started', tone: 'neutral' },
  revoked: { label: 'Access turned off', tone: 'danger' },
  expired: { label: 'Link expired', tone: 'danger' },
};

const ITEM_STATUS_MAP: Record<ItemStatus, { label: string; tone: StatusTone }> = {
  pass: { label: 'Passed', tone: 'ok' },
  fail: { label: 'Failed', tone: 'danger' },
  na: { label: 'Not applicable', tone: 'neutral' },
  retest: { label: 'Ready for retest', tone: 'warn' },
};

const MILESTONE_STATE_MAP: Record<MilestoneState, { label: string; tone: StatusTone }> = {
  complete: { label: 'Complete', tone: 'ok' },
  locked: { label: 'Locked', tone: 'neutral' },
  open: { label: 'In progress', tone: 'neutral' },
};

function deriveProjectMetrics(
  project: Project,
  milestones: Milestone[]
): { stats: ProjectStats; status: ProjectStatus; expired: boolean } {
  if (project.snapshotStats && !project.liveChecklist) {
    const s = project.snapshotStats;
    const isExpired = project.expires_at < getTodayCalendarYmd();
    let status: ProjectStatus = 'not-started';
    if (project.signed_at) status = 'signed';
    else if (project.revoked_at) status = 'revoked';
    else if (isExpired) status = 'expired';
    else if (s.total > 0 && s.done === s.total) status = 'ready';
    else if (s.tested > 0 || s.retest > 0) status = 'in-progress';
    return { stats: s, status, expired: isExpired };
  }

  const items = milestones.flatMap((m) => m.items);
  const total = items.length;
  const done = items.filter((i) => i.status === 'pass' || i.status === 'na').length;
  const na = items.filter((i) => i.status === 'na').length;
  const fail = items.filter((i) => i.status === 'fail').length;
  const retest = items.filter((i) => i.status === 'retest').length;
  const tested = items.filter(
    (i) => i.status === 'pass' || i.status === 'fail' || i.status === 'na'
  ).length;
  const isExpired = project.expires_at < getTodayCalendarYmd();

  let status: ProjectStatus = 'not-started';
  if (project.signed_at) status = 'signed';
  else if (project.revoked_at) status = 'revoked';
  else if (isExpired) status = 'expired';
  else if (total > 0 && done === total) status = 'ready';
  else if (tested > 0 || retest > 0) status = 'in-progress';

  return {
    stats: { total, done, na, fail, retest, tested },
    status,
    expired: isExpired,
  };
}

function buildMilestoneStates(milestones: Milestone[]): MilestoneWithState[] {
  let priorComplete = true;
  return milestones.map((ms, idx) => {
    const doneCount = ms.items.filter(
      (i) => i.status === 'pass' || i.status === 'na'
    ).length;
    const complete = ms.items.length > 0 && doneCount === ms.items.length;
    const unlocked = priorComplete;
    const state: MilestoneState = complete ? 'complete' : unlocked ? 'open' : 'locked';
    if (!complete) priorComplete = false;
    return {
      ...ms,
      index: idx,
      doneCount,
      totalCount: ms.items.length,
      complete,
      unlocked,
      state,
    };
  });
}

const SEED_MILESTONES: Milestone[] = [
  {
    id: 'ms-1',
    position: 1,
    name: 'Session Security & Lockout Policy',
    items: [
      {
        id: 'it-1',
        code: 'SEC-01',
        title: 'HttpOnly SameSite=Lax session cookie & CSRF token enforcement',
        steps:
          '1. Sign in to client portal.\n2. Inspect session cookie attributes and submit a mutating request without CSRF token.',
        expected:
          'Session cookie is HttpOnly + SameSite=Lax; missing CSRF token is rejected.',
        mandatory: true,
        evidence: true,
        status: 'pass',
        comment: 'Verified cookie attributes and CSRF rejection.',
        fix_note: null,
        tester_name: 'Nadia Patel',
        tested_at: '2026-11-24T09:15:00Z',
        screenshotName: 'auth-cookie-csrf.png',
      },
      {
        id: 'it-2',
        code: 'SEC-02',
        title: 'Five failed password attempts trigger 15-minute lockout',
        steps:
          '1. Enter an invalid password 5 times.\n2. Attempt a 6th login.',
        expected:
          'Access locks for 15 minutes with explicit remaining lockout notice.',
        mandatory: true,
        evidence: false,
        status: 'pass',
        comment: 'Locked cleanly on attempt 5.',
        fix_note: null,
        tester_name: 'Nadia Patel',
        tested_at: '2026-11-24T09:28:00Z',
        screenshotName: null,
      },
      {
        id: 'it-3',
        code: 'SEC-03',
        title: 'Optional SAML bridge for external read-only auditors',
        steps: '1. Check if SAML bridge is enabled for this release.',
        expected: 'Marked Not applicable when SAML bridge is disabled.',
        mandatory: false,
        evidence: false,
        status: 'na',
        comment: 'Not required for this client release.',
        fix_note: null,
        tester_name: 'Nadia Patel',
        tested_at: '2026-11-24T09:42:00Z',
        screenshotName: null,
      },
    ],
  },
  {
    id: 'ms-2',
    position: 2,
    name: 'Ledger Reconciliation & Exports',
    items: [
      {
        id: 'it-4',
        code: 'REC-01',
        title: 'Batch settlement CSV totals match general ledger control total',
        steps:
          '1. Select settlement batch #804.\n2. Export CSV and compare sum against batch control total.',
        expected: 'CSV total matches general ledger control total to the cent.',
        mandatory: true,
        evidence: true,
        status: 'fail',
        comment: 'Multi-currency fee rounding differed by $0.02 in exported CSV.',
        fix_note: null,
        tester_name: 'Nadia Patel',
        tested_at: '2026-11-24T10:12:00Z',
        screenshotName: 'csv-rounding-diff.png',
      },
      {
        id: 'it-5',
        code: 'REC-02',
        title: 'Idempotent settlement retry prevents duplicate posting',
        steps:
          '1. Re-send settlement command with matching idempotency key.\n2. Verify posted entries.',
        expected: 'Single ledger posting exists with no duplicate entry.',
        mandatory: true,
        evidence: false,
        status: null,
        comment: '',
        fix_note: null,
        tester_name: null,
        tested_at: null,
        screenshotName: null,
      },
    ],
  },
  {
    id: 'ms-3',
    position: 3,
    name: 'Sign-Off & Certificate Issuance',
    items: [
      {
        id: 'it-6',
        code: 'CERT-01',
        title: '6-digit email OTP + signature issues verifiable VC certificate',
        steps:
          '1. Finish all prior milestones.\n2. Verify 6-digit OTP, sign, and view certificate.',
        expected:
          'Certificate displays VC-XXXX-XXXX, record SHA-256, and PDF SHA-256.',
        mandatory: true,
        evidence: false,
        status: null,
        comment: '',
        fix_note: null,
        tester_name: null,
        tested_at: null,
        screenshotName: null,
      },
    ],
  },
];

const SEED_PROJECTS: Project[] = [
  {
    id: 'UAT-ACME23',
    product_name: 'LedgerCore',
    version: 'v2.4.0',
    client_name: 'Acme Financial Corp',
    owner_name: 'Rohan Kulkarni',
    owner_email: 'rohan.k@uatdesk.io',
    checklist_filename: 'ledgercore-2.4.0.xlsx',
    created_at: '2026-11-20T08:00:00Z',
    expires_at: '2026-12-25',
    revoked_at: null,
    signed_at: null,
    liveChecklist: true,
    token: 'UAT-ACME23',
    current_milestone: 'Ledger Reconciliation & Exports',
  },
  {
    id: 'UAT-NORTH88',
    product_name: 'PayBridge Gateway',
    version: 'v4.1.2',
    client_name: 'Northstar Logistics',
    owner_name: 'Meera Nair',
    owner_email: 'meera.n@uatdesk.io',
    checklist_filename: 'paybridge-412.csv',
    created_at: '2026-11-18T11:30:00Z',
    expires_at: '2026-12-22',
    revoked_at: null,
    signed_at: null,
    liveChecklist: false,
    token: 'UAT-NORTH88',
    current_milestone: 'Settlement Verification',
    // tested === total (4/4), but done === 3/4 (1 fail) -> NOT ready
    snapshotStats: { total: 4, done: 3, na: 0, fail: 1, retest: 0, tested: 4 },
  },
  {
    id: 'UAT-VERDE09',
    product_name: 'VaultShield IAM',
    version: 'v1.9.0',
    client_name: 'Verde Health Systems',
    owner_name: 'Rohan Kulkarni',
    owner_email: 'rohan.k@uatdesk.io',
    checklist_filename: 'vaultshield-190.xlsx',
    created_at: '2026-11-15T14:10:00Z',
    expires_at: '2026-12-20',
    revoked_at: null,
    signed_at: null,
    liveChecklist: false,
    token: 'UAT-VERDE09',
    current_milestone: 'Ready for Sign-Off',
    // done === total (5/5) -> truly "Waiting for signature"
    snapshotStats: { total: 5, done: 5, na: 1, fail: 0, retest: 0, tested: 5 },
  },
  {
    id: 'UAT-KINETIC7',
    product_name: 'LedgerCore',
    version: 'v2.3.1',
    client_name: 'Kinetic Retail Group',
    owner_name: 'Meera Nair',
    owner_email: 'meera.n@uatdesk.io',
    checklist_filename: 'ledgercore-231.xlsx',
    created_at: '2026-11-01T10:00:00Z',
    expires_at: '2026-12-10',
    revoked_at: null,
    signed_at: '2026-11-08T16:42:00Z',
    liveChecklist: false,
    token: 'UAT-KINETIC7',
    current_milestone: 'Signed off',
    snapshotStats: { total: 6, done: 6, na: 1, fail: 0, retest: 0, tested: 6 },
  },
  {
    id: 'UAT-APEX04',
    product_name: 'PayBridge Gateway',
    version: 'v3.8.0',
    client_name: 'Apex Freight Ltd',
    owner_name: 'Rohan Kulkarni',
    owner_email: 'rohan.k@uatdesk.io',
    checklist_filename: 'apex-380.xlsx',
    created_at: '2026-09-05T09:00:00Z',
    expires_at: '2026-10-01',
    revoked_at: null,
    signed_at: null,
    liveChecklist: false,
    token: 'UAT-APEX04',
    current_milestone: 'Milestone 1',
    snapshotStats: { total: 4, done: 1, na: 0, fail: 0, retest: 0, tested: 1 },
  },
  {
    id: 'UAT-SOLAR12',
    product_name: 'VaultShield IAM',
    version: 'v1.8.2',
    client_name: 'Solaris Energy Co.',
    owner_name: 'Meera Nair',
    owner_email: 'meera.n@uatdesk.io',
    checklist_filename: 'solaris-182.csv',
    created_at: '2026-11-12T13:00:00Z',
    expires_at: '2026-12-28',
    revoked_at: '2026-11-19T09:00:00Z',
    signed_at: null,
    liveChecklist: false,
    token: 'UAT-SOLAR12',
    current_milestone: 'Access Revoked',
    snapshotStats: { total: 3, done: 2, na: 0, fail: 0, retest: 0, tested: 2 },
  },
];

const SEED_ACTIVITY: ActivityEvent[] = [
  {
    id: 'ev-1',
    action: 'item · result',
    detail: 'REC-01 marked Failed — Multi-currency fee rounding differed by $0.02',
    actor: 'Nadia Patel (nadia.patel@acme.example)',
    ip: '203.0.113.19',
    timestamp: '2026-11-24 10:12 UTC',
  },
  {
    id: 'ev-2',
    action: 'item · result',
    detail: 'SEC-03 marked Not applicable',
    actor: 'Nadia Patel (nadia.patel@acme.example)',
    ip: '203.0.113.19',
    timestamp: '2026-11-24 09:42 UTC',
  },
  {
    id: 'ev-3',
    action: 'project · created',
    detail: 'Snapshot imported from ledgercore-2.4.0.xlsx (6 items)',
    actor: 'Rohan Kulkarni (rohan.k@uatdesk.io)',
    ip: '198.51.100.8',
    timestamp: '2026-11-20 08:00 UTC',
  },
];

const SEED_CERTIFICATES: Record<string, CertificateRecord> = {
  'VC-8492-KLMN': {
    verification_id: 'VC-8492-KLMN',
    project_id: 'UAT-KINETIC7',
    product_name: 'LedgerCore',
    version: 'v2.3.1',
    client_name: 'Kinetic Retail Group',
    owner_name: 'Meera Nair',
    signer_name: 'David Alvarez',
    signer_designation: 'VP of Finance & Operations',
    signer_email: 'd.alvarez@kineticretail.example',
    otp_verified_at: '2026-11-08T16:39:12Z',
    signed_at: '2026-11-08T16:42:00Z',
    signature_kind: 'typed',
    typed_signature: 'David Alvarez',
    ip: '198.51.100.42',
    record_hash:
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    pdf_hash:
      '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
  },
};

function buildFreshProjectMilestones(prefix = 'NEW'): Milestone[] {
  return [
    {
      id: `${prefix}-ms-1`,
      position: 1,
      name: 'Access & Core Workflow',
      items: [
        {
          id: `${prefix}-it-1`,
          code: 'CORE-01',
          title: 'Primary login and role permissions enforce access boundaries',
          steps: '1. Sign in with client credentials.\n2. Verify role permissions.',
          expected: 'Only authorized modules are accessible.',
          mandatory: true,
          evidence: true,
          status: null,
          comment: '',
          fix_note: null,
          tester_name: null,
          tested_at: null,
          screenshotName: null,
        },
        {
          id: `${prefix}-it-2`,
          code: 'CORE-02',
          title: 'Core transaction flow completes without validation errors',
          steps: '1. Submit a standard test transaction.\n2. Confirm confirmation state.',
          expected: 'Transaction persists and shows accurate summary.',
          mandatory: true,
          evidence: false,
          status: null,
          comment: '',
          fix_note: null,
          tester_name: null,
          tested_at: null,
          screenshotName: null,
        },
      ],
    },
    {
      id: `${prefix}-ms-2`,
      position: 2,
      name: 'Reporting & Sign-Off Readiness',
      items: [
        {
          id: `${prefix}-it-3`,
          code: 'RPT-01',
          title: 'Exported audit report matches on-screen totals',
          steps: '1. Export summary report.\n2. Compare row count and totals.',
          expected: 'Export matches UI totals exactly.',
          mandatory: true,
          evidence: false,
          status: null,
          comment: '',
          fix_note: null,
          tester_name: null,
          tested_at: null,
          screenshotName: null,
        },
        {
          id: `${prefix}-it-4`,
          code: 'RPT-02',
          title: 'Optional webhook notification delivery',
          steps: '1. Trigger event webhook if enabled for this environment.',
          expected: 'Delivered or marked N/A if webhooks are disabled.',
          mandatory: false,
          evidence: false,
          status: null,
          comment: '',
          fix_note: null,
          tester_name: null,
          tested_at: null,
          screenshotName: null,
        },
      ],
    },
  ];
}

function makePresetMilestones(
  prefix: string,
  statuses: Array<ItemStatus | null>,
  testerName: string | null = 'Client Tester'
): Milestone[] {
  const base = buildFreshProjectMilestones(prefix);
  let idx = 0;
  return base.map((ms) => ({
    ...ms,
    items: ms.items.map((it) => {
      const st = statuses[idx] ?? null;
      idx += 1;
      return {
        ...it,
        status: st,
        comment:
          st === 'fail'
            ? 'Observed discrepancy during UAT verification.'
            : st === 'na'
            ? 'Not applicable for this deployment.'
            : st === 'pass'
            ? 'Verified as expected.'
            : '',
        tester_name: st ? testerName : null,
        tested_at: st ? '2026-11-18T10:00:00Z' : null,
      };
    }),
  }));
}

function createSeedMilestonesByProject(): Record<string, Milestone[]> {
  return {
    'UAT-ACME23': SEED_MILESTONES,
    'UAT-NORTH88': makePresetMilestones('NORTH88', ['pass', 'pass', 'pass', 'fail'], 'Samira Rao'),
    'UAT-VERDE09': [
      ...makePresetMilestones('VERDE09', ['pass', 'pass', 'pass', 'na'], 'Elena Brooks'),
      {
        id: 'VERDE09-ms-3',
        position: 3,
        name: 'Final Verification',
        items: [
          {
            id: 'VERDE09-it-5',
            code: 'FIN-01',
            title: 'Production readiness checklist verified',
            steps: '1. Confirm release notes and rollback plan.',
            expected: 'All readiness checks pass.',
            mandatory: true,
            evidence: false,
            status: 'pass',
            comment: 'Ready for final sign-off.',
            fix_note: null,
            tester_name: 'Elena Brooks',
            tested_at: '2026-11-19T14:20:00Z',
            screenshotName: null,
          },
        ],
      },
    ],
    'UAT-KINETIC7': [
      {
        id: 'KINETIC7-ms-1',
        position: 1,
        name: 'Core Ledger & Security',
        items: [
          {
            id: 'KINETIC7-it-1',
            code: 'SEC-01',
            title: 'Authentication and role isolation verified',
            steps: '1. Test admin and standard roles.',
            expected: 'Role boundaries enforced.',
            mandatory: true,
            evidence: true,
            status: 'pass',
            comment: 'Passed.',
            fix_note: null,
            tester_name: 'David Alvarez',
            tested_at: '2026-11-08T15:10:00Z',
            screenshotName: 'kinetic-auth.png',
          },
          {
            id: 'KINETIC7-it-2',
            code: 'SEC-02',
            title: 'Session expiry and audit logging verified',
            steps: '1. Verify audit log entries on sign-in.',
            expected: 'Events logged accurately.',
            mandatory: true,
            evidence: false,
            status: 'pass',
            comment: 'Passed.',
            fix_note: null,
            tester_name: 'David Alvarez',
            tested_at: '2026-11-08T15:25:00Z',
            screenshotName: null,
          },
          {
            id: 'KINETIC7-it-3',
            code: 'SEC-03',
            title: 'Optional SSO metadata import',
            steps: '1. Verify if SSO is enabled.',
            expected: 'Marked N/A if using standard credentials.',
            mandatory: false,
            evidence: false,
            status: 'na',
            comment: 'Not enabled for this release.',
            fix_note: null,
            tester_name: 'David Alvarez',
            tested_at: '2026-11-08T15:30:00Z',
            screenshotName: null,
          },
        ],
      },
      {
        id: 'KINETIC7-ms-2',
        position: 2,
        name: 'Settlement & Final Sign-Off',
        items: [
          {
            id: 'KINETIC7-it-4',
            code: 'SET-01',
            title: 'Daily batch settlement export totals match ledger',
            steps: '1. Export settlement CSV and reconcile.',
            expected: 'Totals match exactly.',
            mandatory: true,
            evidence: true,
            status: 'pass',
            comment: 'Reconciled to the cent.',
            fix_note: null,
            tester_name: 'David Alvarez',
            tested_at: '2026-11-08T16:05:00Z',
            screenshotName: 'kinetic-reconcile.png',
          },
          {
            id: 'KINETIC7-it-5',
            code: 'SET-02',
            title: 'Retry protection prevents duplicate postings',
            steps: '1. Re-submit batch with same key.',
            expected: 'No duplicate entries.',
            mandatory: true,
            evidence: false,
            status: 'pass',
            comment: 'Idempotency confirmed.',
            fix_note: null,
            tester_name: 'David Alvarez',
            tested_at: '2026-11-08T16:20:00Z',
            screenshotName: null,
          },
          {
            id: 'KINETIC7-it-6',
            code: 'CERT-01',
            title: 'Certificate issuance and SHA-256 verification',
            steps: '1. Complete OTP and signature.',
            expected: 'Verifiable VC certificate issued.',
            mandatory: true,
            evidence: false,
            status: 'pass',
            comment: 'Signed and verified.',
            fix_note: null,
            tester_name: 'David Alvarez',
            tested_at: '2026-11-08T16:40:00Z',
            screenshotName: null,
          },
        ],
      },
    ],
    'UAT-APEX04': makePresetMilestones('APEX04', ['pass', null, null, null], 'Alex Rivera'),
    'UAT-SOLAR12': [
      {
        id: 'SOLAR12-ms-1',
        position: 1,
        name: 'IAM Access Baseline',
        items: makePresetMilestones('SOLAR12', ['pass', 'pass', null], 'Priya Nair')[0].items.concat(
          makePresetMilestones('SOLAR12', ['pass', 'pass', null], 'Priya Nair')[1].items[0]
        ),
      },
    ],
  };
}

/**
 * ============================================================================
 * 3. GRAPHITE & SIGNAL CORE COMPONENTS
 * ============================================================================
 */
function BrandMark({ size = 36 }) {
  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: 'var(--brand)',
        borderRadius: 'var(--radius-sm)',
        boxShadow: 'var(--shadow-xs)',
      }}
      className="inline-flex items-center justify-center text-white shrink-0"
      aria-hidden="true"
    >
      <svg
        width={Math.round(size * 0.56)}
        height={Math.round(size * 0.56)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
      </svg>
    </span>
  );
}

function ProgressRing({
  current,
  total,
  size = 44,
}: {
  current: number;
  total: number;
  size?: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (pct / 100) * circ;

  return (
    <div
      className="inline-flex items-center gap-2.5"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90 shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth="3.5"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3.5"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="gs-mono font-bold text-xs">{pct}%</span>
    </div>
  );
}

function StatusChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: StatusTone;
}) {
  const styles: Record<
    StatusTone,
    { bg: string; border: string; color: string; Icon: typeof CheckCircle2 }
  > = {
    ok: {
      bg: 'var(--ok-soft)',
      border: 'var(--ok-border)',
      color: 'var(--ok)',
      Icon: CheckCircle2,
    },
    danger: {
      bg: 'var(--danger-soft)',
      border: 'var(--danger-border)',
      color: 'var(--danger)',
      Icon: XCircle,
    },
    warn: {
      bg: 'var(--warn-soft)',
      border: 'var(--warn-border)',
      color: 'var(--warn)',
      Icon: RotateCcw,
    },
    neutral: {
      bg: 'var(--surface-2)',
      border: 'var(--line)',
      color: 'var(--ink-secondary)',
      Icon: Clock,
    },
  };
  const cfg = styles[tone] || styles.neutral;
  const Icon = cfg.Icon;

  return (
    <span
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        color: cfg.color,
        borderRadius: 'var(--radius-sm)',
      }}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold border whitespace-nowrap"
    >
      <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={1.85} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function MetaTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: 'var(--line)',
        color: 'var(--muted)',
        borderRadius: 'var(--radius-sm)',
      }}
      className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] border"
    >
      {children}
    </span>
  );
}

function ActionButton({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  fullWidth = false,
  onClick,
  title,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
}) {
  const sizing =
    size === 'sm'
      ? 'min-h-[36px] px-3 py-1.5 text-[13.5px]'
      : 'min-h-[44px] px-4 py-2 text-[15px]';

  const toneStyle =
    variant === 'primary'
      ? {
          backgroundColor: disabled ? 'var(--surface-3)' : 'var(--brand)',
          color: disabled ? 'var(--muted)' : '#ffffff',
          borderColor: disabled ? 'var(--line)' : 'var(--brand)',
        }
      : variant === 'danger'
      ? {
          backgroundColor: 'var(--danger-soft)',
          color: 'var(--danger)',
          borderColor: 'var(--danger-border)',
        }
      : {
          backgroundColor: 'var(--surface-2)',
          color: 'var(--ink)',
          borderColor: 'var(--line)',
        };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      title={title}
      style={{
        ...toneStyle,
        borderRadius: 'var(--radius-sm)',
      }}
      className={`gs-focus inline-flex items-center justify-center gap-2 font-semibold border transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed ${sizing} ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      {children}
    </button>
  );
}

function SignalCard({
  children,
  className = '',
  padding = 'p-5 sm:p-6',
  active = false,
}: {
  children: React.ReactNode;
  className?: string;
  padding?: string;
  active?: boolean;
}) {
  return (
    <section
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: active ? 'var(--brand)' : 'var(--line)',
        boxShadow: 'var(--shadow-xs)',
        borderRadius: 'var(--radius-md)',
      }}
      className={`border ${padding} ${className}`}
    >
      {children}
    </section>
  );
}

function FocusPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[480px] mx-auto">
      <SignalCard className="space-y-5">{children}</SignalCard>
    </div>
  );
}

function NoticeBanner({
  tone = 'info',
  title,
  children,
  items = [],
}: {
  tone?: BannerTone;
  title?: string;
  children?: React.ReactNode;
  items?: string[];
}) {
  const map: Record<
    BannerTone,
    { bg: string; border: string; fg: string; Icon: typeof Info }
  > = {
    info: {
      bg: 'var(--surface-2)',
      border: 'var(--line)',
      fg: 'var(--ink)',
      Icon: Info,
    },
    ok: {
      bg: 'var(--ok-soft)',
      border: 'var(--ok-border)',
      fg: 'var(--ok)',
      Icon: CheckCircle2,
    },
    warn: {
      bg: 'var(--warn-soft)',
      border: 'var(--warn-border)',
      fg: 'var(--warn)',
      Icon: AlertTriangle,
    },
    error: {
      bg: 'var(--danger-soft)',
      border: 'var(--danger-border)',
      fg: 'var(--danger)',
      Icon: AlertTriangle,
    },
  };
  const cfg = map[tone] || map.info;
  const Icon = cfg.Icon;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        backgroundColor: cfg.bg,
        borderColor: cfg.border,
        borderRadius: 'var(--radius-sm)',
      }}
      className="border p-3.5 text-[13.5px] flex items-start gap-2.5"
    >
      <Icon
        className="w-4 h-4 mt-0.5 shrink-0"
        style={{ color: cfg.fg }}
        aria-hidden="true"
      />
      <div className="space-y-1 flex-1 min-w-0">
        {title && (
          <div className="font-semibold" style={{ color: cfg.fg }}>
            {title}
          </div>
        )}
        {children && <div style={{ color: 'var(--ink-secondary)' }}>{children}</div>}
        {items.length > 0 && (
          <ul
            className="list-disc pl-5 space-y-0.5 text-xs"
            style={{ color: 'var(--ink-secondary)' }}
          >
            {items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CopyBlock({
  label,
  value,
  mono = true,
  multiline = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
          {label}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            backgroundColor: copied ? 'var(--ok-soft)' : 'var(--surface-2)',
            borderColor: copied ? 'var(--ok-border)' : 'var(--line)',
            color: copied ? 'var(--ok)' : 'var(--ink)',
            borderRadius: 'var(--radius-sm)',
          }}
          className="gs-focus inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold border cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      {multiline ? (
        <textarea
          readOnly
          rows={6}
          value={value}
          aria-label={label}
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
            borderRadius: 'var(--radius-sm)',
          }}
          className={`w-full px-3 py-2 text-xs border ${mono ? 'gs-mono' : ''}`}
        />
      ) : (
        <input
          type="text"
          readOnly
          value={value}
          aria-label={label}
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--line)',
            color: 'var(--ink)',
            borderRadius: 'var(--radius-sm)',
          }}
          className={`w-full px-3 py-2 border min-h-[38px] ${
            mono ? 'gs-mono' : 'text-[13.5px]'
          }`}
        />
      )}
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gs-confirm-title"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.68)' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line-strong)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-md)',
        }}
        className="max-w-md w-full border p-5 space-y-4"
      >
        <h2 id="gs-confirm-title" className="text-[18px] font-semibold">
          {title}
        </h2>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          {description}
        </p>
        <div className="flex justify-end gap-2 pt-1">
          <ActionButton variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </ActionButton>
          <ActionButton
            variant={destructive ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

function LightboxOverlay({
  data,
  onClose,
}: {
  data: LightboxData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, onClose]);

  if (!data) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Evidence screenshot lightbox"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.78)' }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line-strong)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-md)',
        }}
        className="max-w-2xl w-full border p-5 space-y-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="gs-mono font-semibold">{data.filename}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence lightbox"
            style={{
              backgroundColor: 'var(--surface-2)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {data.imageUrl ? (
          <div
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="border p-3 flex items-center justify-center overflow-hidden"
          >
            <img
              src={data.imageUrl}
              alt={`Evidence screenshot ${data.filename}`}
              className="max-h-[65vh] w-auto object-contain rounded"
            />
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="border p-8 min-h-[200px] flex flex-col items-center justify-center text-center space-y-2"
          >
            <Eye className="w-7 h-7" style={{ color: 'var(--brand)' }} />
            <div className="font-semibold">
              Evidence file: <span className="gs-mono">{data.filename}</span>
            </div>
            <p className="text-xs max-w-md" style={{ color: 'var(--muted)' }}>
              Attached evidence record linked to this checklist item.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * 4. SHELL, TOP BAR, LEFT NAV, FLASH BAR & FOOTER
 * ============================================================================
 */
function TopBar({
  screen,
  onNavigate,
  theme,
  onToggleTheme,
  companyEmail,
  onSignOut,
  activeProject,
}: {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
  theme: Theme;
  onToggleTheme: () => void;
  companyEmail: string | null;
  onSignOut: () => void;
  activeProject: Project;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const contextualSubtitle = useMemo(() => {
    if (['company', 'company-login', 'new-project', 'project-detail'].includes(screen)) {
      return 'company workspace';
    }
    if (['portal', 'signoff', 'certificate', 'token-login', 'tester-id'].includes(screen)) {
      return `${activeProject.product_name} ${activeProject.version}`;
    }
    if (screen === 'client-entry') return 'client testing portal';
    return 'acceptance testing and sign-off';
  }, [screen, activeProject]);

  const navItems: Array<{ id: ScreenId; label: string }> = [
    { id: 'company', label: 'Dashboard' },
    { id: 'new-project', label: 'New UAT project' },
    { id: 'portal', label: 'Client portal' },
    { id: 'verify', label: 'Verify certificate' },
  ];

  const handleMobileNav = (id: ScreenId) => {
    setMobileMenuOpen(false);
    onNavigate(id);
  };

  return (
    <header
      className="no-print sticky top-0 z-30 border-b"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => handleMobileNav('landing')}
          className="gs-focus flex items-center gap-3 text-left cursor-pointer shrink-0"
        >
          <BrandMark size={36} />
          <div>
            <div className="font-bold text-[15px] leading-tight">UAT Desk</div>
            <div className="text-xs leading-tight" style={{ color: 'var(--muted)' }}>
              {contextualSubtitle}
            </div>
          </div>
        </button>

        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-1 text-[13.5px] font-semibold"
        >
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                style={{
                  backgroundColor: active ? 'var(--brand-soft)' : 'transparent',
                  color: active ? 'var(--brand-border)' : 'var(--ink-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus px-3 py-1.5 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          {companyEmail ? (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-mono px-2.5 py-1 border"
              >
                {companyEmail}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                style={{ color: 'var(--muted)' }}
                className="gs-focus inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('company-login')}
              style={{ color: 'var(--ink-secondary)' }}
              className="gs-focus hidden sm:inline-flex text-xs font-semibold hover:underline cursor-pointer px-2"
            >
              Company sign in
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border min-h-[36px] cursor-pointer"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4" />
                <span>Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4" />
                <span>Dark</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus md:hidden inline-flex items-center justify-center p-2 border min-h-[36px] min-w-[36px] cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          style={{
            backgroundColor: 'var(--surface)',
            borderTop: '1px solid var(--line)',
          }}
          className="md:hidden px-4 py-3 space-y-1.5"
        >
          {navItems.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleMobileNav(item.id)}
                style={{
                  backgroundColor: active ? 'var(--brand-soft)' : 'var(--surface-2)',
                  color: active ? 'var(--brand-border)' : 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus w-full text-left px-3 py-2.5 text-[14px] font-semibold cursor-pointer block"
              >
                {item.label}
              </button>
            );
          })}
          <div
            style={{ borderTop: '1px solid var(--line)' }}
            className="pt-2 mt-2 flex items-center justify-between text-xs"
          >
            {companyEmail ? (
              <>
                <span className="gs-mono" style={{ color: 'var(--ink-secondary)' }}>
                  {companyEmail}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onSignOut();
                  }}
                  style={{ color: 'var(--danger)' }}
                  className="gs-focus font-semibold cursor-pointer"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleMobileNav('company-login')}
                style={{ color: 'var(--brand)' }}
                className="gs-focus font-semibold cursor-pointer"
              >
                Company sign in →
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function CompanyLeftRail({
  screen,
  onNavigate,
}: {
  screen: ScreenId;
  onNavigate: (s: ScreenId) => void;
}) {
  const navItems: Array<{
    id: ScreenId;
    label: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { id: 'company', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'new-project', label: 'New UAT project', Icon: FolderPlus },
    { id: 'project-detail', label: 'Project detail', Icon: ChevronRight },
    { id: 'verify', label: 'Verify certificate', Icon: ShieldCheck },
  ];

  return (
    <aside aria-label="Company workspace rail" className="w-full lg:w-56 shrink-0">
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
          borderRadius: 'var(--radius-md)',
        }}
        className="border p-2 flex lg:flex-col gap-1 overflow-x-auto"
      >
        {navItems.map(({ id, label, Icon }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              style={{
                backgroundColor: active ? 'var(--brand-soft)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-secondary)',
                borderLeft: active
                  ? '3px solid var(--brand)'
                  : '3px solid transparent',
                borderRadius: 'var(--radius-sm)',
              }}
              className="gs-focus shrink-0 lg:w-full px-3 py-2 text-[13.5px] font-semibold flex items-center gap-2.5 text-left cursor-pointer"
            >
              <Icon
                className="w-4 h-4 shrink-0"
                style={{ color: active ? 'var(--brand)' : 'var(--muted)' }}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function FlashBanner({
  flash,
  onDismiss,
}: {
  flash: FlashMessage | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [flash, onDismiss]);

  if (!flash) return null;
  const err = flash.type === 'error';

  return (
    <div className="no-print max-w-[1320px] w-full mx-auto px-4 sm:px-6 pt-4">
      <div
        role="status"
        style={{
          backgroundColor: err ? 'var(--danger-soft)' : 'var(--ok-soft)',
          borderColor: err ? 'var(--danger-border)' : 'var(--ok-border)',
          color: err ? 'var(--danger)' : 'var(--ok)',
          borderRadius: 'var(--radius-sm)',
        }}
        className="border px-4 py-2.5 text-[13.5px] font-semibold flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          {err ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{flash.message}</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="gs-focus p-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FooterBar({
  onNavigate,
  onOpenInspector,
}: {
  onNavigate: (s: ScreenId) => void;
  onOpenInspector: () => void;
}) {
  return (
    <footer
      className="no-print border-t mt-12"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--line)',
      }}
    >
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[13.5px]">
        <div style={{ color: 'var(--muted)' }}>
          UAT Desk · Graphite &amp; Signal acceptance testing and verification
        </div>
        <div className="flex flex-wrap items-center gap-4 font-semibold">
          <button
            type="button"
            onClick={() => onNavigate('client-entry')}
            style={{ color: 'var(--ink-secondary)' }}
            className="gs-focus hover:underline cursor-pointer"
          >
            Client portal
          </button>
          <button
            type="button"
            onClick={() => onNavigate('company')}
            style={{ color: 'var(--ink-secondary)' }}
            className="gs-focus hover:underline cursor-pointer"
          >
            Company portal
          </button>
          <button
            type="button"
            onClick={() => onNavigate('verify')}
            style={{ color: 'var(--ink-secondary)' }}
            className="gs-focus hover:underline cursor-pointer"
          >
            Verify a certificate
          </button>
          <button
            type="button"
            onClick={onOpenInspector}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line)',
              color: 'var(--brand)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus inline-flex items-center gap-1.5 px-2.5 py-1 text-xs border cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Components &amp; States</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

/**
 * ============================================================================
 * 5. SCREENS 1–4: LANDING, CLIENT ENTRY, VERIFY, COMPANY SIGN-IN
 * ============================================================================
 */
function LandingScreen({
  onNavigate,
  companyEmail,
}: {
  onNavigate: (s: ScreenId) => void;
  companyEmail: string | null;
}) {
  return (
    <div className="space-y-6">
      <div style={{ borderBottom: '1px solid var(--line)' }} className="pb-5 space-y-2">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--muted)' }}
        >
          Acceptance Testing &amp; Verification
        </div>
        <h1
          className="font-extrabold tracking-[-0.03em]"
          style={{ fontSize: 'clamp(30px, 3.6vw, 40px)', lineHeight: 1.1 }}
        >
          UAT Desk Portals
        </h1>
        <p className="max-w-2xl" style={{ color: 'var(--ink-secondary)' }}>
          Run sequential milestone testing and issue verifiable completion
          certificates backed by a tamper-evident audit log.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <SignalCard className="flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                style={{
                  backgroundColor: 'var(--brand-soft)',
                  borderColor: 'var(--brand-border)',
                  color: 'var(--brand)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="w-10 h-10 inline-flex items-center justify-center border"
              >
                <Users className="w-5 h-5" />
              </span>
              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--muted)' }}
                >
                  For Clients &amp; Testers
                </div>
                <h2 className="text-[20px] font-bold">Client Portal</h2>
              </div>
            </div>
            <p style={{ color: 'var(--ink-secondary)' }}>
              Enter a Project ID or invitation link, test milestones in order,
              attach screenshots, and sign off with a 6-digit email code.
            </p>
            <ul
              className="list-disc pl-5 space-y-1 text-[13.5px]"
              style={{ color: 'var(--ink-secondary)' }}
            >
              <li>Sequential milestone unlocking as items pass or are N/A</li>
              <li>Auto-saved results with required notes when marking Fail</li>
              <li>Drawn or typed signature with instant certificate view</li>
            </ul>
          </div>
          <ActionButton
            variant="primary"
            fullWidth
            onClick={() => onNavigate('client-entry')}
          >
            Open Client Portal →
          </ActionButton>
        </SignalCard>

        <SignalCard className="flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="w-10 h-10 inline-flex items-center justify-center border"
              >
                <Building2 className="w-5 h-5" />
              </span>
              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--muted)' }}
                >
                  For Project Managers &amp; Release Teams
                </div>
                <h2 className="text-[20px] font-bold">Company Workspace</h2>
              </div>
            </div>
            <p style={{ color: 'var(--ink-secondary)' }}>
              Create release projects from checklists, share one-time access
              credentials, send failed items back for retest, and manage access.
            </p>
            <ul
              className="list-disc pl-5 space-y-1 text-[13.5px]"
              style={{ color: 'var(--ink-secondary)' }}
            >
              <li>Immutable checklist snapshot per release project</li>
              <li>Remediation fix loop requiring ≥ 3 character fix notes</li>
              <li>Password rotation, expiry updates, and access revocation</li>
            </ul>
            {companyEmail && (
              <div className="gs-mono text-xs" style={{ color: 'var(--brand)' }}>
                Signed in: {companyEmail}
              </div>
            )}
          </div>
          <ActionButton
            variant="ghost"
            fullWidth
            onClick={() => onNavigate('company')}
          >
            {companyEmail ? 'Go to Dashboard →' : 'Open Company Workspace →'}
          </ActionButton>
        </SignalCard>
      </div>

      <SignalCard className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <span
            style={{
              backgroundColor: 'var(--ok-soft)',
              borderColor: 'var(--ok-border)',
              color: 'var(--ok)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="w-10 h-10 inline-flex items-center justify-center border shrink-0"
          >
            <ShieldCheck className="w-5 h-5" />
          </span>
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--muted)' }}
            >
              Public Verification
            </div>
            <h2 className="text-[18px] font-semibold">
              Verify a Completion Certificate
            </h2>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              Check a <span className="gs-mono">VC-XXXX-XXXX</span> ID or compare a
              downloaded PDF against its SHA-256 fingerprint.
            </p>
          </div>
        </div>
        <ActionButton variant="ghost" onClick={() => onNavigate('verify')}>
          Verify Certificate →
        </ActionButton>
      </SignalCard>
    </div>
  );
}

function ClientEntryScreen({
  projects,
  onSelectProject,
  onNavigate,
  onFlash,
}: {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onNavigate: (s: ScreenId) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const [rawInput, setRawInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const extractedToken = useMemo(() => {
    const trimmed = rawInput.trim();
    const match = trimmed.match(/\/p\/([A-Za-z0-9_-]+)/i);
    return (match ? match[1] : trimmed).toUpperCase();
  }, [rawInput]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!extractedToken) {
      setError('Enter a Project ID or paste your invitation link.');
      return;
    }
    if (!password.trim()) {
      setError('Enter the password from your invitation.');
      return;
    }
    if (password.trim().toLowerCase() === 'locked') {
      setError('Too many failed attempts. Access is locked for 15 minutes.');
      return;
    }
    if (password.trim().toLowerCase() === 'wrong') {
      setError('That password did not match this Project ID.');
      return;
    }

    const found = projects.find((p) => p.id === extractedToken);
    if (!found) {
      setError(
        `Project ID “${extractedToken}” was not found. Check your Project ID or paste the full link.`
      );
      return;
    }

    onSelectProject(found.id);
    if (found.revoked_at || found.expires_at < getTodayCalendarYmd()) {
      onNavigate('closed');
      return;
    }
    onFlash({
      type: 'ok',
      message: `Opened ${found.id}. Enter tester details to begin.`,
    });
    onNavigate('tester-id');
  };

  return (
    <FocusPanel>
      <div className="space-y-1">
        <BrandMark size={36} />
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em] pt-2"
          style={{ color: 'var(--muted)' }}
        >
          Client Acceptance Testing
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] leading-tight">
          Open your UAT checklist
        </h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          Enter your Project ID (or paste a full{' '}
          <span className="gs-mono">/p/&lt;token&gt;</span> link) and password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="gs-client-id"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Project ID <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-client-id"
            type="text"
            autoFocus
            required
            autoComplete="username"
            placeholder="e.g. UAT-ACME23"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus gs-mono uppercase w-full px-3 py-2.5 border min-h-[44px]"
          />
          {rawInput.includes('/p/') && extractedToken && (
            <div className="gs-mono text-xs mt-1" style={{ color: 'var(--brand)' }}>
              Extracted token: {extractedToken}
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor="gs-client-pass"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Password <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-client-pass"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
          />
        </div>

        {error && (
          <NoticeBanner tone="error" title="Unable to open checklist">
            {error}
          </NoticeBanner>
        )}

        <ActionButton type="submit" variant="primary" fullWidth>
          Open checklist
        </ActionButton>
      </form>

      {IS_DEV && (
        <div style={{ borderTop: '1px solid var(--line)' }} className="pt-4 space-y-2">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Dev demo fill
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setRawInput('https://app.uatdesk.example/p/UAT-ACME23');
                setPassword('demo-pass');
                setError('');
              }}
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--line)',
                color: 'var(--ink-secondary)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="gs-focus text-xs gs-mono px-2.5 py-1.5 border cursor-pointer"
            >
              Fill UAT-ACME23
            </button>
            <button
              type="button"
              onClick={() => {
                setRawInput('UAT-ACME23');
                setPassword('locked');
                setError('');
              }}
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--line)',
                color: 'var(--ink-secondary)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="gs-focus text-xs px-2.5 py-1.5 border cursor-pointer"
            >
              Fill Locked (15m)
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-[13.5px]">
        <button
          type="button"
          onClick={() => onNavigate('company-login')}
          style={{ color: 'var(--brand)' }}
          className="gs-focus font-semibold hover:underline cursor-pointer"
        >
          Company sign in →
        </button>
      </div>
    </FocusPanel>
  );
}

function VerifyScreen({
  certificates,
}: {
  certificates: Record<string, CertificateRecord>;
}) {
  const [inputId, setInputId] = useState('VC-8492-KLMN');
  const [checkedId, setCheckedId] = useState('VC-8492-KLMN');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfMode, setPdfMode] = useState<'idle' | 'match' | 'mismatch' | 'none'>('idle');
  const [computedHash, setComputedHash] = useState<string | null>(null);

  const cert = useMemo(() => {
    const key = checkedId.trim().toUpperCase();
    return key ? certificates[key] || null : null;
  }, [checkedId, certificates]);

  const onCheckId = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckedId(inputId.trim().toUpperCase());
  };

  const onSelectPdf = async (file: File | null) => {
    setPdfError('');
    setComputedHash(null);
    if (!file) {
      setPdfFile(null);
      setPdfMode('idle');
      return;
    }
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setPdfError('Select a valid .pdf file.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setPdfError('That PDF exceeds the 15 MB verification limit.');
      return;
    }
    setPdfFile(file);
    try {
      const buf = await file.arrayBuffer();
      const digest = await computeSha256Hex(buf);
      setComputedHash(digest || null);
      if (!cert?.pdf_hash) {
        setPdfMode('none');
      } else if (digest && digest.toLowerCase() === cert.pdf_hash.toLowerCase()) {
        setPdfMode('match');
      } else {
        setPdfMode('mismatch');
      }
    } catch {
      setPdfError('Unable to read the selected PDF file.');
    }
  };

  return (
    <div className="space-y-6">
      <div style={{ borderBottom: '1px solid var(--line)' }} className="pb-4 space-y-1.5">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--muted)' }}
        >
          Public check
        </div>
        <h1
          className="font-extrabold tracking-[-0.03em]"
          style={{ fontSize: 'clamp(30px, 3.6vw, 40px)', lineHeight: 1.1 }}
        >
          Verify a UAT certificate
        </h1>
        <p style={{ color: 'var(--ink-secondary)' }}>
          Look up a verification ID or check a downloaded certificate PDF
          against its SHA-256 fingerprint.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SignalCard>
          <form onSubmit={onCheckId} className="space-y-4">
            <h2 className="text-[20px] font-bold">Check a verification ID</h2>
            <div>
              <label
                htmlFor="gs-verify-id"
                className="block text-[13.5px] font-semibold mb-1.5"
              >
                Verification ID <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="gs-verify-id"
                type="text"
                required
                autoFocus
                autoComplete="off"
                placeholder="VC-XXXX-XXXX"
                value={inputId}
                onChange={(e) => setInputId(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus gs-mono uppercase w-full px-3 py-2.5 border min-h-[44px]"
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              The check reads the stored sign-off record. It does not expose
              the client&apos;s checklist answers.
            </p>
            <div className="flex flex-wrap gap-2">
              <ActionButton type="submit" variant="primary">
                <Search className="w-4 h-4" />
                <span>Check certificate</span>
              </ActionButton>
              <ActionButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInputId('VC-8492-KLMN');
                  setCheckedId('VC-8492-KLMN');
                }}
              >
                Sample valid
              </ActionButton>
              <ActionButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInputId('VC-0000-NONE');
                  setCheckedId('VC-0000-NONE');
                }}
              >
                Sample unknown
              </ActionButton>
            </div>
          </form>
        </SignalCard>

        <SignalCard className="space-y-3">
          <h2 className="text-[20px] font-bold">What this proves</h2>
          <ul className="space-y-2 text-[13.5px]">
            {[
              'Signed on the recorded UTC date after completion',
              'Signer email confirmed via a 6-digit one-time code',
              'Canonical sign-off record hashed with SHA-256',
              'Downloaded PDF can be checked against its stored fingerprint',
            ].map((pt) => (
              <li key={pt} className="flex items-start gap-2.5">
                <CheckCircle2
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: 'var(--ok)' }}
                />
                <span style={{ color: 'var(--ink-secondary)' }}>{pt}</span>
              </li>
            ))}
          </ul>
        </SignalCard>
      </div>

      {checkedId && cert && (
        <SignalCard className="space-y-5">
          <div>
            <StatusChip label="Valid certificate" tone="ok" />
            <h2 className="text-[22px] font-bold mt-2">
              {cert.product_name} {cert.version}
            </h2>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              Signed for <strong>{cert.client_name}</strong> on{' '}
              <span className="gs-mono">{cert.signed_at.slice(0, 10)}</span>
            </p>
          </div>

          <div
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border text-[13.5px]"
          >
            <div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Verification ID
              </div>
              <div className="gs-mono font-bold">{cert.verification_id}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Project ID
              </div>
              <div className="gs-mono font-bold">{cert.project_id}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Signed by
              </div>
              <div className="font-semibold">{cert.signer_name}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Designation
              </div>
              <div>{cert.signer_designation}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Email verified
              </div>
              <div className="gs-mono">{cert.signer_email}</div>
            </div>
          </div>

          <CopyBlock label="Record SHA-256" value={cert.record_hash} />

          <div style={{ borderTop: '1px solid var(--line)' }} className="pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[18px] font-semibold">Check certificate PDF</h3>
              <div className="flex items-center gap-1.5 text-xs">
                <span style={{ color: 'var(--muted)' }}>Preview state:</span>
                {(['match', 'mismatch', 'none'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPdfMode(m)}
                    style={{
                      backgroundColor:
                        pdfMode === m ? 'var(--brand-soft)' : 'var(--surface-2)',
                      borderColor:
                        pdfMode === m ? 'var(--brand)' : 'var(--line)',
                      color: pdfMode === m ? 'var(--ink)' : 'var(--ink-secondary)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="gs-focus px-2 py-1 border font-semibold cursor-pointer"
                  >
                    {m === 'none' ? 'No hash' : m}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="file"
              accept=".pdf,application/pdf"
              aria-label="Certificate PDF file"
              onChange={(e) => {
                void onSelectPdf(e.target.files?.[0] || null);
              }}
              className="text-[13.5px]"
            />

            {computedHash && (
              <div className="text-xs gs-mono break-all" style={{ color: 'var(--muted)' }}>
                Computed SHA-256: {computedHash}
              </div>
            )}

            {pdfError && (
              <NoticeBanner tone="error" title="PDF check error">
                {pdfError}
              </NoticeBanner>
            )}

            {!pdfError && pdfMode === 'idle' && (
              <NoticeBanner tone="info" title="Ready to verify PDF">
                Select a downloaded certificate PDF above to compare its SHA-256
                digest against the stored fingerprint.
              </NoticeBanner>
            )}
            {!pdfError && pdfMode === 'match' && (
              <NoticeBanner tone="ok" title="Matches SHA-256 fingerprint">
                {pdfFile ? `${pdfFile.name} — ` : ''}PDF digest matches stored
                certificate hash.
              </NoticeBanner>
            )}
            {!pdfError && pdfMode === 'mismatch' && (
              <NoticeBanner tone="error" title="Does not match SHA-256 fingerprint">
                {pdfFile ? `${pdfFile.name} — ` : ''}PDF hash differs from the
                stored certificate record.
              </NoticeBanner>
            )}
            {!pdfError && pdfMode === 'none' && (
              <NoticeBanner tone="info" title="No fingerprint stored">
                No PDF SHA-256 fingerprint is stored on this record.
              </NoticeBanner>
            )}
          </div>
        </SignalCard>
      )}

      {checkedId && !cert && (
        <SignalCard className="space-y-2">
          <StatusChip label="Not found" tone="danger" />
          <h2 className="text-[20px] font-bold">
            No certificate matches “{checkedId}”
          </h2>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            Re-check the verification ID characters or contact the release team
            that issued the certificate.
          </p>
        </SignalCard>
      )}
    </div>
  );
}

function CompanyLoginScreen({
  onSignIn,
  onNavigate,
}: {
  onSignIn: (email: string) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const [email, setEmail] = useState('rohan.k@uatdesk.io');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('That email and password do not match.');
      return;
    }
    setError('');
    onSignIn(email.trim());
    onNavigate('company');
  };

  return (
    <FocusPanel>
      <div className="space-y-1">
        <BrandMark size={36} />
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em] pt-2"
          style={{ color: 'var(--muted)' }}
        >
          Company side
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] leading-tight">
          Sign in to UAT Desk
        </h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          Manage checklists, client access, and retest handoffs.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label
            htmlFor="gs-login-email"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Work email <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-login-email"
            type="email"
            required
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
          />
        </div>

        <div>
          <label
            htmlFor="gs-login-pass"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Password <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-login-pass"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
          />
        </div>

        {error && (
          <NoticeBanner tone="error" title="Sign in failed">
            {error}
          </NoticeBanner>
        )}

        <ActionButton type="submit" variant="primary" fullWidth>
          Sign in
        </ActionButton>
      </form>

      <div className="text-center text-[13.5px]">
        <button
          type="button"
          onClick={() => onNavigate('client-entry')}
          style={{ color: 'var(--brand)' }}
          className="gs-focus font-semibold hover:underline cursor-pointer"
        >
          Open Client Portal →
        </button>
      </div>
    </FocusPanel>
  );
}

/**
 * ============================================================================
 * 6. SCREENS 5–7: COMPANY DASHBOARD, NEW PROJECT, PROJECT DETAIL
 * ============================================================================
 */
function CompanyDashboardScreen({
  projects,
  milestonesByProject,
  onSelectProject,
  onNavigate,
  onFlash,
}: {
  projects: Project[];
  milestonesByProject: Record<string, Milestone[]>;
  onSelectProject: (id: string) => void;
  onNavigate: (s: ScreenId) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const [viewState, setViewState] = useState<'populated' | 'empty' | 'loading' | 'error'>(
    'populated'
  );

  const rows = useMemo(() => {
    return projects.map((p) => {
      const pMilestones = milestonesByProject[p.id] || SEED_MILESTONES;
      const derived = deriveProjectMetrics(p, pMilestones);
      return { ...p, ...derived };
    });
  }, [projects, milestonesByProject]);

  const stats = useMemo(() => {
    return {
      inTesting: rows.filter(
        (r) => r.status === 'in-progress' || r.status === 'not-started'
      ).length,
      itemsToFix: rows.reduce((acc, r) => acc + r.stats.fail, 0),
      waitingSignoff: rows.filter((r) => r.status === 'ready').length,
      signedOff: rows.filter((r) => r.status === 'signed').length,
    };
  }, [rows]);

  const visibleRows = viewState === 'empty' ? [] : rows;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Company workspace
          </div>
          <h1
            className="font-extrabold tracking-[-0.03em]"
            style={{ fontSize: 'clamp(30px, 3.6vw, 40px)', lineHeight: 1.1 }}
          >
            UAT projects
          </h1>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            Release readiness uses <span className="gs-mono">done === total</span>{' '}
            so open failures never appear ready for signature.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="ghost"
            onClick={() => {
              downloadCsvTemplate();
              onFlash({ type: 'ok', message: 'Downloaded uat-checklist-template.csv' });
            }}
          >
            <Download className="w-4 h-4" />
            <span>Checklist template</span>
          </ActionButton>
          <ActionButton
            variant="primary"
            onClick={() => onNavigate('new-project')}
          >
            <FolderPlus className="w-4 h-4" />
            <span>New UAT project</span>
          </ActionButton>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span style={{ color: 'var(--muted)' }}>Workspace view state:</span>
        {(
          [
            { id: 'populated', label: 'Populated' },
            { id: 'empty', label: 'Empty' },
            { id: 'loading', label: 'Loading' },
            { id: 'error', label: 'Error' },
          ] as const
        ).map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setViewState(st.id)}
            style={{
              backgroundColor:
                viewState === st.id ? 'var(--brand-soft)' : 'var(--surface)',
              borderColor: viewState === st.id ? 'var(--brand)' : 'var(--line)',
              color: viewState === st.id ? 'var(--ink)' : 'var(--ink-secondary)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus px-2.5 py-1 border font-semibold cursor-pointer"
          >
            {st.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'In testing', val: stats.inTesting },
          { label: 'Items to fix', val: stats.itemsToFix },
          { label: 'Waiting for signature', val: stats.waitingSignoff },
          { label: 'Signed off', val: stats.signedOff },
        ].map((t) => (
          <SignalCard key={t.label} padding="p-4">
            <div
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--muted)' }}
            >
              {t.label}
            </div>
            <div className="gs-mono text-3xl font-extrabold mt-1">{t.val}</div>
          </SignalCard>
        ))}
      </div>

      {viewState === 'loading' && (
        <SignalCard className="space-y-3">
          <div
            className="h-5 w-48 rounded animate-pulse"
            style={{ backgroundColor: 'var(--surface-3)' }}
          />
          <div
            className="h-12 w-full rounded animate-pulse"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
          <div
            className="h-12 w-full rounded animate-pulse"
            style={{ backgroundColor: 'var(--surface-2)' }}
          />
        </SignalCard>
      )}

      {viewState === 'error' && (
        <SignalCard className="space-y-3">
          <NoticeBanner tone="error" title="Could not load UAT projects">
            The project query failed. Retry to refresh the table.
          </NoticeBanner>
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => setViewState('populated')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </ActionButton>
        </SignalCard>
      )}

      {viewState === 'empty' && (
        <SignalCard className="text-center py-10 space-y-3">
          <h2 className="text-[20px] font-bold">No UAT projects yet</h2>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            Create a project with a release checklist to generate a client
            testing link.
          </p>
          <ActionButton
            variant="primary"
            onClick={() => onNavigate('new-project')}
          >
            Create the first project
          </ActionButton>
        </SignalCard>
      )}

      {viewState === 'populated' && visibleRows.length > 0 && (
        <>
          <SignalCard padding="p-0" className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      borderBottom: '1px solid var(--line)',
                      color: 'var(--muted)',
                    }}
                    className="text-[11px] font-bold uppercase tracking-[0.08em]"
                  >
                    <th className="py-3 px-4">Product and release</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Completion</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Current milestone</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => {
                    const meta = PROJECT_STATUS_MAP[row.status];
                    return (
                      <tr
                        key={row.id}
                        style={{ borderBottom: '1px solid var(--line)' }}
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(row.id);
                              onNavigate('project-detail');
                            }}
                            className="gs-focus font-bold hover:underline text-left cursor-pointer"
                          >
                            {row.product_name}{' '}
                            <span
                              className="font-normal text-[13.5px]"
                              style={{ color: 'var(--muted)' }}
                            >
                              {row.version}
                            </span>
                          </button>
                          <div
                            className="gs-mono text-xs"
                            style={{ color: 'var(--muted)' }}
                          >
                            {row.id}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium">{row.client_name}</div>
                          <div
                            className="text-xs"
                            style={{ color: 'var(--muted)' }}
                          >
                            {row.owner_name}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <ProgressRing
                              current={row.stats.done}
                              total={row.stats.total}
                              size={38}
                            />
                            <div className="text-xs">
                              <div style={{ color: 'var(--ink-secondary)' }}>
                                {row.stats.done} of {row.stats.total} passed or N/A
                              </div>
                              {row.stats.fail > 0 && (
                                <span
                                  className="font-semibold"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  {row.stats.fail} failed
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusChip label={meta.label} tone={meta.tone} />
                        </td>
                        <td
                          className="py-3.5 px-4 text-[13.5px]"
                          style={{ color: 'var(--ink-secondary)' }}
                        >
                          {row.current_milestone}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <ActionButton
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onSelectProject(row.id);
                              onNavigate('project-detail');
                            }}
                          >
                            Open
                          </ActionButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SignalCard>

          <div className="grid grid-cols-1 gap-3 md:hidden">
            {visibleRows.map((row) => {
              const meta = PROJECT_STATUS_MAP[row.status];
              return (
                <SignalCard key={row.id} padding="p-4" className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold">
                        {row.product_name} {row.version}
                      </div>
                      <div
                        className="gs-mono text-xs"
                        style={{ color: 'var(--muted)' }}
                      >
                        {row.id} · {row.client_name}
                      </div>
                    </div>
                    <StatusChip label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <ProgressRing
                      current={row.stats.done}
                      total={row.stats.total}
                      size={34}
                    />
                    <span style={{ color: 'var(--ink-secondary)' }}>
                      {row.stats.done} of {row.stats.total} passed or N/A
                    </span>
                    {row.stats.fail > 0 && (
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--danger)' }}
                      >
                        {row.stats.fail} failed
                      </span>
                    )}
                  </div>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() => {
                      onSelectProject(row.id);
                      onNavigate('project-detail');
                    }}
                  >
                    Open
                  </ActionButton>
                </SignalCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function NewProjectScreen({
  projects,
  onCreateProject,
  onNavigate,
  onFlash,
}: {
  projects: Project[];
  onCreateProject: (created: Project) => void;
  onNavigate: (s: ScreenId) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const existingProducts = useMemo(
    () =>
      Array.from(
        new Set(['LedgerCore', 'PayBridge Gateway', 'VaultShield IAM', ...projects.map((p) => p.product_name)])
      ),
    [projects]
  );
  const existingClients = useMemo(
    () =>
      Array.from(
        new Set([
          'Acme Financial Corp',
          'Northstar Logistics',
          'Verde Health Systems',
          ...projects.map((p) => p.client_name),
        ])
      ),
    [projects]
  );

  const [productMode, setProductMode] = useState<'existing' | 'new'>('existing');
  const [productName, setProductName] = useState('LedgerCore');
  const [version, setVersion] = useState('v2.5.0');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [clientName, setClientName] = useState('Acme Financial Corp');
  const [ownerName, setOwnerName] = useState('Rohan Kulkarni');
  const [ownerEmail, setOwnerEmail] = useState('rohan.k@uatdesk.io');
  const [expiresAt, setExpiresAt] = useState(() => getCalendarPlusDays(30));
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null);
  const [previewState, setPreviewState] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [errors, setErrors] = useState<string[]>([]);

  const handleFile = (file: File | null) => {
    if (!file) {
      setFileInfo(null);
      setPreviewState('idle');
      return;
    }
    setFileInfo({ name: file.name, size: file.size });
    const validExt =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.csv');
    if (!validExt || file.size > MAX_UPLOAD_BYTES) {
      setPreviewState('invalid');
    } else {
      setPreviewState('valid');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const list: string[] = [];
    if (!productName.trim()) list.push('Choose or enter a product name.');
    if (!version.trim()) list.push('Release or version is required.');
    if (!clientName.trim()) list.push('Choose or enter a client name.');
    if (!ownerName.trim()) list.push('Company contact is required.');
    if (!expiresAt) list.push('Expiry date (YYYY-MM-DD) is required.');
    if (previewState === 'invalid') {
      list.push('Checklist file must be .xlsx or .csv and within size limits.');
    }

    if (list.length > 0) {
      setErrors(list);
      return;
    }

    setErrors([]);
    const newId = `UAT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    onCreateProject({
      id: newId,
      product_name: productName.trim(),
      version: version.trim(),
      client_name: clientName.trim(),
      owner_name: ownerName.trim(),
      owner_email: ownerEmail.trim() || null,
      checklist_filename: fileInfo ? fileInfo.name : 'checklist-snapshot.xlsx',
      created_at: new Date().toISOString(),
      expires_at: expiresAt,
      revoked_at: null,
      signed_at: null,
      liveChecklist: true,
      token: newId,
      current_milestone: 'Access & Core Workflow',
      snapshotStats: { total: 4, done: 0, na: 0, fail: 0, retest: 0, tested: 0 },
      oneTimePassword: `pw-${Math.random().toString(36).substring(2, 10)}`,
    });
    onFlash({
      type: 'ok',
      message: `Project ${newId} created. Copy the one-time client credentials below.`,
    });
    onNavigate('project-detail');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Dashboard / New project
          </div>
          <h1
            className="font-extrabold tracking-[-0.03em]"
            style={{ fontSize: 'clamp(30px, 3.6vw, 40px)', lineHeight: 1.1 }}
          >
            New UAT project
          </h1>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            The uploaded checklist is snapshotted into the project and becomes
            immutable upon creation.
          </p>
        </div>

        <div className="flex gap-2">
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => {
              downloadCsvTemplate();
              onFlash({ type: 'ok', message: 'Downloaded uat-checklist-template.csv' });
            }}
          >
            Download .csv template
          </ActionButton>
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => {
              downloadCsvTemplate();
              onFlash({
                type: 'ok',
                message: 'Downloaded checklist template (.csv)',
              });
            }}
          >
            Download .xlsx template
          </ActionButton>
        </div>
      </div>

      {errors.length > 0 && (
        <NoticeBanner
          tone="error"
          title="Check project fields before creating"
          items={errors}
        />
      )}

      {previewState === 'invalid' && (
        <NoticeBanner
          tone="error"
          title="The checklist was not accepted"
          items={[
            'Accepted formats: .xlsx or .csv within upload size limit.',
            'Nothing was imported.',
          ]}
        />
      )}

      {previewState === 'valid' && (
        <NoticeBanner
          tone="ok"
          title={`Checklist read successfully from ${
            fileInfo ? fileInfo.name : 'checklist.xlsx'
          }`}
        >
          6 items across 3 milestones: Milestone 1 — 3 items (2 required),
          Milestone 2 — 2 items (2 required), Milestone 3 — 1 item (1 required).
        </NoticeBanner>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SignalCard className="space-y-4">
            <h2 className="text-[18px] font-semibold">Release &amp; Client</h2>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold">Product</span>
                <div role="radiogroup" aria-label="Product option" className="flex gap-1 text-xs">
                  {(
                    [
                      { id: 'existing', label: 'Existing product' },
                      { id: 'new', label: 'Add a product' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={productMode === opt.id}
                      onClick={() => {
                        setProductMode(opt.id);
                        setProductName(
                          opt.id === 'new' ? '' : existingProducts[0] || 'LedgerCore'
                        );
                      }}
                      style={{
                        backgroundColor:
                          productMode === opt.id ? 'var(--brand)' : 'var(--surface-2)',
                        color:
                          productMode === opt.id ? '#ffffff' : 'var(--ink-secondary)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      className="gs-focus px-2.5 py-1 font-semibold cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {productMode === 'existing' ? (
                <select
                  aria-label="Existing product"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                >
                  {existingProducts.map((prod) => (
                    <option key={prod} value={prod}>
                      {prod}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="New product name"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                />
              )}
            </div>

            <div>
              <label
                htmlFor="gs-np-ver"
                className="block text-[13.5px] font-semibold mb-1.5"
              >
                Release or version <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="gs-np-ver"
                type="text"
                placeholder="v1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus gs-mono w-full px-3 py-2.5 border min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13.5px] font-semibold">Client</span>
                <div role="radiogroup" aria-label="Client option" className="flex gap-1 text-xs">
                  {(
                    [
                      { id: 'existing', label: 'Existing client' },
                      { id: 'new', label: 'Add a client' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={clientMode === opt.id}
                      onClick={() => {
                        setClientMode(opt.id);
                        setClientName(
                          opt.id === 'new'
                            ? ''
                            : existingClients[0] || 'Acme Financial Corp'
                        );
                      }}
                      style={{
                        backgroundColor:
                          clientMode === opt.id ? 'var(--brand)' : 'var(--surface-2)',
                        color:
                          clientMode === opt.id ? '#ffffff' : 'var(--ink-secondary)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      className="gs-focus px-2.5 py-1 font-semibold cursor-pointer"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {clientMode === 'existing' ? (
                <select
                  aria-label="Existing client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                >
                  {existingClients.map((cli) => (
                    <option key={cli} value={cli}>
                      {cli}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="New client name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                />
              )}
            </div>
          </SignalCard>

          <SignalCard className="space-y-4">
            <h2 className="text-[18px] font-semibold">Access, Expiry &amp; Checklist</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="gs-np-owner"
                  className="block text-[13.5px] font-semibold mb-1.5"
                >
                  Company contact <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  id="gs-np-owner"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                />
              </div>

              <div>
                <label
                  htmlFor="gs-np-email"
                  className="block text-[13.5px] font-semibold mb-1.5"
                >
                  Company contact email
                </label>
                <input
                  id="gs-np-email"
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="gs-np-exp"
                className="block text-[13.5px] font-semibold mb-1.5"
              >
                Link stays available until{' '}
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="gs-np-exp"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus gs-mono w-full px-3 py-2.5 border min-h-[44px]"
              />
            </div>

            <div
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor:
                  previewState === 'valid'
                    ? 'var(--brand)'
                    : 'var(--line-strong)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="border border-dashed p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold flex items-center gap-1.5">
                  <Upload className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                  <span>Checklist file (.xlsx / .csv)</span>
                </span>
                <span className="gs-mono" style={{ color: 'var(--muted)' }}>
                  {fileInfo
                    ? `${fileInfo.name} (${Math.max(
                        1,
                        Math.round(fileInfo.size / 1024)
                      )} KB)`
                    : 'No file selected'}
                </span>
              </div>
              <input
                type="file"
                accept=".xlsx,.csv"
                aria-label="Checklist file"
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
                className="text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewState('valid')}
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus text-xs px-2.5 py-1 border font-semibold cursor-pointer"
                >
                  Preview valid checklist
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewState('invalid')}
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--line)',
                    color: 'var(--danger)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus text-xs px-2.5 py-1 border font-semibold cursor-pointer"
                >
                  Preview invalid file
                </button>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Generated client password is shown once after creation; link can be
              rotated or turned off anytime.
            </p>
          </SignalCard>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <ActionButton variant="ghost" onClick={() => onNavigate('company')}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" variant="primary">
            Create project and generate the client link
          </ActionButton>
        </div>
      </form>
    </div>
  );
}

function ProjectDetailScreen({
  project,
  milestones,
  activity,
  onSendFix,
  onRotatePassword,
  onUpdateExpiry,
  onToggleRevoke,
  onOpenLightbox,
  onNavigate,
}: {
  project: Project;
  milestones: Milestone[];
  activity: ActivityEvent[];
  onSendFix: (itemId: string, note: string) => void;
  onRotatePassword: () => void;
  onUpdateExpiry: (newYmd: string) => void;
  onToggleRevoke: () => void;
  onOpenLightbox: (data: LightboxData) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const [fixDrafts, setFixDrafts] = useState<Record<string, string>>({});
  const [fixErrors, setFixErrors] = useState<Record<string, string>>({});
  const [expiryVal, setExpiryVal] = useState(project.expires_at);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  useEffect(() => {
    setExpiryVal(project.expires_at);
    setFixDrafts({});
    setFixErrors({});
  }, [project.id, project.expires_at]);

  const { stats, status } = deriveProjectMetrics(project, milestones);
  const stMeta = PROJECT_STATUS_MAP[status];
  const msList = useMemo(() => buildMilestoneStates(milestones), [milestones]);

  const submitFix = (e: React.FormEvent, itemId: string) => {
    e.preventDefault();
    const note = (fixDrafts[itemId] || '').trim();
    if (note.length < 3) {
      setFixErrors((prev) => ({
        ...prev,
        [itemId]: 'Enter at least 3 characters describing the fix.',
      }));
      return;
    }
    setFixErrors((prev) => ({ ...prev, [itemId]: '' }));
    setConfirmAction({
      type: 'fix',
      itemId,
      note,
      title: 'Mark fixed & send for retest?',
      description:
        'This item will become Ready for retest and the client must test it again.',
      confirmLabel: 'Mark fixed & send for retest',
      destructive: false,
    });
  };

  const runConfirmed = () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'fix' && confirmAction.itemId && confirmAction.note) {
      onSendFix(confirmAction.itemId, confirmAction.note);
    } else if (confirmAction.type === 'rotate') {
      onRotatePassword();
    } else if (confirmAction.type === 'revoke') {
      onToggleRevoke();
    }
    setConfirmAction(null);
  };

  const invitationText = [
    `UAT Review: ${project.product_name} ${project.version} (${project.client_name})`,
    `Portal Link: https://app.uatdesk.example/p/${project.token}`,
    `Project ID: ${project.id}`,
    `Password: ${project.oneTimePassword || '(shown once on creation/rotation)'}`,
    `Available until: ${project.expires_at}`,
  ].join('\n');

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Dashboard / {project.client_name}
          </div>
          <h1
            className="font-extrabold tracking-[-0.03em]"
            style={{ fontSize: 'clamp(28px, 3.4vw, 38px)', lineHeight: 1.1 }}
          >
            {project.product_name} {project.version}
          </h1>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            {project.client_name} · {project.owner_name} · checklist:{' '}
            <span className="gs-mono">
              {project.checklist_filename || 'snapshot.xlsx'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <StatusChip label={stMeta.label} tone={stMeta.tone} />
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('portal')}
          >
            Open client link
          </ActionButton>
          {project.signed_at && (
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('certificate')}
            >
              View certificate
            </ActionButton>
          )}
        </div>
      </div>

      {project.oneTimePassword && (
        <SignalCard active className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
                style={{ color: 'var(--warn)' }}
              >
                Shown once
              </div>
              <h2 className="text-[20px] font-bold">Client credentials</h2>
            </div>
            <StatusChip label="One-time view" tone="warn" />
          </div>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            The password is hashed on the server and will not be displayed again
            after you leave this view.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CopyBlock
              label="Link"
              value={`https://app.uatdesk.example/p/${project.token}`}
            />
            <CopyBlock label="Project ID" value={project.id} />
            <CopyBlock label="Password" value={project.oneTimePassword} />
          </div>
          <CopyBlock
            label="Invitation text"
            value={invitationText}
            mono={false}
            multiline
          />
        </SignalCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-6">
          <SignalCard className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <ProgressRing current={stats.done} total={stats.total} size={52} />
              <div>
                <div className="font-bold text-[18px]">
                  {stats.done} of {stats.total} items passed or marked N/A
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-semibold mt-0.5">
                  <span
                    style={{
                      color: stats.fail > 0 ? 'var(--danger)' : 'var(--muted)',
                    }}
                  >
                    {stats.fail} failed
                  </span>
                  <span style={{ color: 'var(--warn)' }}>
                    {stats.retest} waiting for retest
                  </span>
                </div>
              </div>
            </div>
          </SignalCard>

          {msList.map((ms) => {
            const msMeta = MILESTONE_STATE_MAP[ms.state];
            return (
              <SignalCard key={ms.id} className="space-y-4">
                <div
                  style={{ borderBottom: '1px solid var(--line)' }}
                  className="pb-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <div
                      className="text-[11px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: 'var(--muted)' }}
                    >
                      Milestone {ms.position}
                    </div>
                    <h2 className="text-[20px] font-bold">{ms.name}</h2>
                  </div>
                  <StatusChip label={msMeta.label} tone={msMeta.tone} />
                </div>

                <div className="space-y-3.5">
                  {ms.items.map((item) => {
                    const itemMeta = item.status
                      ? ITEM_STATUS_MAP[item.status]
                      : null;
                    return (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--line)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        className="border p-4 space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="gs-mono font-bold">{item.code}</span>
                            {itemMeta ? (
                              <StatusChip
                                label={itemMeta.label}
                                tone={itemMeta.tone}
                              />
                            ) : (
                              <StatusChip label="Not tested" tone="neutral" />
                            )}
                            {item.mandatory && <MetaTag>Required</MetaTag>}
                            {item.evidence && <MetaTag>Evidence</MetaTag>}
                          </div>
                          {item.screenshotName && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenLightbox({
                                  filename: item.screenshotName!,
                                  imageUrl: item.screenshotUrl,
                                })
                              }
                              style={{ color: 'var(--brand)' }}
                              className="gs-focus inline-flex items-center gap-1 text-xs font-semibold hover:underline cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="gs-mono">{item.screenshotName}</span>
                            </button>
                          )}
                        </div>

                        <div className="font-bold">{item.title}</div>
                        <pre
                          className="whitespace-pre-wrap text-xs font-sans"
                          style={{ color: 'var(--ink-secondary)' }}
                        >
                          {item.steps}
                        </pre>
                        <div
                          className="text-xs"
                          style={{ color: 'var(--ink-secondary)' }}
                        >
                          <strong>Expected:</strong> {item.expected}
                        </div>

                        {item.comment && (
                          <div
                            className="text-xs p-2.5 border"
                            style={{
                              backgroundColor: 'var(--surface)',
                              borderColor: 'var(--line)',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <strong>Client note:</strong> {item.comment}
                          </div>
                        )}

                        {item.fix_note && (
                          <NoticeBanner tone="warn" title="Fix note">
                            {item.fix_note}
                          </NoticeBanner>
                        )}

                        {item.status === 'fail' && !project.signed_at && (
                          <form
                            onSubmit={(e) => submitFix(e, item.id)}
                            className="pt-2 space-y-2"
                          >
                            <label
                              htmlFor={`gs-fix-${item.id}`}
                              className="block text-xs font-semibold"
                            >
                              What was fixed?
                            </label>
                            <textarea
                              id={`gs-fix-${item.id}`}
                              rows={2}
                              placeholder="Build 2.4.1 corrects decimal rounding in CSV export."
                              value={fixDrafts[item.id] || ''}
                              onChange={(e) =>
                                setFixDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              style={{
                                backgroundColor: 'var(--surface)',
                                borderColor: fixErrors[item.id]
                                  ? 'var(--danger)'
                                  : 'var(--line-strong)',
                                color: 'var(--ink)',
                                borderRadius: 'var(--radius-sm)',
                              }}
                              className="gs-focus w-full px-3 py-2 border text-xs"
                            />
                            {fixErrors[item.id] && (
                              <p
                                className="text-xs font-semibold"
                                style={{ color: 'var(--danger)' }}
                              >
                                {fixErrors[item.id]}
                              </p>
                            )}
                            <ActionButton type="submit" variant="primary" size="sm">
                              Mark fixed &amp; send for retest
                            </ActionButton>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </SignalCard>
            );
          })}
        </div>

        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <SignalCard className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">Access controls</h2>
              <StatusChip label={stMeta.label} tone={stMeta.tone} />
            </div>

            <div className="space-y-1 text-[13.5px]">
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted)' }}>Project ID</span>
                <span className="gs-mono font-bold">{project.id}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted)' }}>Available until</span>
                <span className="gs-mono">{project.expires_at}</span>
              </div>
            </div>

            <CopyBlock
              label="Client link"
              value={`https://app.uatdesk.example/p/${project.token}`}
            />

            <div style={{ borderTop: '1px solid var(--line)' }} className="pt-3 space-y-2.5">
              <ActionButton
                variant="ghost"
                size="sm"
                fullWidth
                onClick={() =>
                  setConfirmAction({
                    type: 'rotate',
                    title: 'Generate a new password?',
                    description:
                      'Previous client password stops working immediately and a new one-time password is shown once.',
                    confirmLabel: 'Generate a new password',
                    destructive: false,
                  })
                }
              >
                <KeyRound className="w-4 h-4" />
                <span>Generate a new password</span>
              </ActionButton>

              <div className="space-y-1.5">
                <label
                  htmlFor="gs-detail-exp"
                  className="block text-xs font-semibold"
                >
                  Change end date
                </label>
                <div className="flex gap-2">
                  <input
                    id="gs-detail-exp"
                    type="date"
                    value={expiryVal}
                    onChange={(e) => setExpiryVal(e.target.value)}
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      borderColor: 'var(--line-strong)',
                      color: 'var(--ink)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="gs-focus gs-mono flex-1 px-2.5 py-1.5 text-xs border min-h-[36px]"
                  />
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    onClick={() => onUpdateExpiry(expiryVal)}
                  >
                    Update end date
                  </ActionButton>
                </div>
              </div>

              <div className="pt-1">
                <ActionButton
                  variant={project.revoked_at ? 'primary' : 'danger'}
                  size="sm"
                  fullWidth
                  onClick={() =>
                    setConfirmAction({
                      type: 'revoke',
                      title: project.revoked_at
                        ? 'Restore client access?'
                        : 'Turn off client access?',
                      description: project.revoked_at
                        ? 'Client testers can access the portal again.'
                        : 'Client testers see the Closed screen immediately.',
                      confirmLabel: project.revoked_at
                        ? 'Restore client access'
                        : 'Turn off client access',
                      destructive: !project.revoked_at,
                    })
                  }
                >
                  <Power className="w-4 h-4" />
                  <span>
                    {project.revoked_at
                      ? 'Restore client access'
                      : 'Turn off client access'}
                  </span>
                </ActionButton>
              </div>
            </div>
          </SignalCard>

          <SignalCard className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <h2 className="text-[18px] font-semibold">Recent activity</h2>
            </div>
            {activity.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                No activity yet.
              </p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {activity.slice(0, 50).map((ev) => (
                  <li
                    key={ev.id}
                    style={{ borderBottom: '1px solid var(--line)' }}
                    className="pb-2 last:border-b-0 space-y-0.5"
                  >
                    <div className="flex justify-between gap-2">
                      <span
                        className="gs-mono font-bold"
                        style={{ color: 'var(--brand)' }}
                      >
                        {ev.action}
                      </span>
                      <span className="gs-mono" style={{ color: 'var(--muted)' }}>
                        {ev.timestamp}
                      </span>
                    </div>
                    <div>{ev.detail}</div>
                    <div style={{ color: 'var(--muted)' }}>
                      {ev.actor} · <span className="gs-mono">{ev.ip}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SignalCard>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        description={confirmAction?.description || ''}
        confirmLabel={confirmAction?.confirmLabel || 'Confirm'}
        destructive={Boolean(confirmAction?.destructive)}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

/**
 * ============================================================================
 * 7. SCREENS 8–10: TOKEN LOGIN, TESTER IDENTITY & CHECKLIST PORTAL
 * ============================================================================
 */
function ClosedBlockScreen({
  project,
  onNavigate,
}: {
  project: Project;
  onNavigate: (s: ScreenId) => void;
}) {
  const revoked = Boolean(project.revoked_at);
  const Icon = revoked ? Power : Hourglass;

  return (
    <div className="max-w-lg mx-auto">
      <SignalCard className="text-center space-y-4">
        <span
          style={{
            backgroundColor: 'var(--danger-soft)',
            borderColor: 'var(--danger-border)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-sm)',
          }}
          className="w-12 h-12 mx-auto inline-flex items-center justify-center border"
        >
          <Icon className="w-6 h-6" />
        </span>
        <h1 className="text-2xl font-extrabold">
          {revoked ? 'Client access is turned off' : 'This link has expired'}
        </h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          {revoked
            ? `Access for this UAT checklist was turned off by ${project.owner_name}.`
            : `This link stayed available until ${project.expires_at}. Contact ${project.owner_name} for assistance.`}
        </p>
        <div className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
          Project ID {project.id} · {project.client_name}
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <ActionButton variant="ghost" onClick={() => onNavigate('landing')}>
            Go to start page
          </ActionButton>
          <ActionButton variant="primary" onClick={() => onNavigate('verify')}>
            Verify a certificate
          </ActionButton>
        </div>
      </SignalCard>
    </div>
  );
}

function TokenLoginScreen({
  project,
  onNavigate,
  onFlash,
}: {
  project: Project;
  onNavigate: (s: ScreenId) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  if (isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  if (project.signed_at) {
    return (
      <FocusPanel>
        <StatusChip label="Signed off" tone="ok" />
        <h1 className="text-[24px] font-extrabold tracking-[-0.03em] leading-tight">
          {project.product_name} {project.version} is signed off
        </h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          Acceptance testing for <strong>{project.client_name}</strong> is
          complete and a verification certificate has been issued.
        </p>
        <ActionButton
          variant="primary"
          fullWidth
          onClick={() => onNavigate('certificate')}
        >
          View completion certificate
        </ActionButton>
      </FocusPanel>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass.trim()) {
      setErr('Enter the password from your invitation.');
      return;
    }
    setErr('');
    onFlash({ type: 'ok', message: 'Access verified.' });
    onNavigate('tester-id');
  };

  return (
    <FocusPanel>
      <div className="space-y-1">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--muted)' }}
        >
          Client acceptance testing
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] leading-tight">
          {project.product_name} {project.version}
        </h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          Prepared for <strong>{project.client_name}</strong> by{' '}
          {project.owner_name}.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="gs-tok-pass"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Password from your invitation{' '}
            <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-tok-pass"
            type="password"
            required
            autoFocus
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
          />
        </div>

        {err && (
          <NoticeBanner tone="error" title="Sign in failed">
            {err}
          </NoticeBanner>
        )}

        <ActionButton type="submit" variant="primary" fullWidth>
          Open the checklist
        </ActionButton>
      </form>

      <div style={{ borderTop: '1px solid var(--line)' }} className="pt-4 space-y-1.5 text-[13.5px]">
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Project ID</span>
          <span className="gs-mono font-bold">{project.id}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--muted)' }}>Available until</span>
          <span className="gs-mono">{project.expires_at}</span>
        </div>
        <p className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
          Personal to your organisation; do not forward. Five wrong
          passwords lock access for 15 minutes.
        </p>
      </div>

      <div className="flex justify-between text-[13.5px]">
        <button
          type="button"
          onClick={() => onNavigate('client-entry')}
          style={{ color: 'var(--ink-secondary)' }}
          className="gs-focus hover:underline cursor-pointer"
        >
          ← Switch Project ID
        </button>
        <button
          type="button"
          onClick={() => onNavigate('company-login')}
          style={{ color: 'var(--brand)' }}
          className="gs-focus font-semibold hover:underline cursor-pointer"
        >
          Company sign in →
        </button>
      </div>
    </FocusPanel>
  );
}

function TesterIdentityScreen({
  project,
  tester,
  onSaveTester,
  onNavigate,
}: {
  project: Project;
  tester: TesterInfo;
  onSaveTester: (t: TesterInfo) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const [name, setName] = useState(tester.name);
  const [email, setEmail] = useState(tester.email);
  const [err, setErr] = useState('');

  if (isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.includes('@')) {
      setErr('Enter your full name and a valid work email.');
      return;
    }
    setErr('');
    onSaveTester({ name: name.trim(), email: email.trim() });
    onNavigate('portal');
  };

  return (
    <FocusPanel>
      <div className="space-y-1">
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--muted)' }}
        >
          Before you start
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.03em] leading-tight">
          Who is testing?
        </h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          Your name and email appear on test results and sign-off sends a
          one-time code to this email.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="gs-t-name"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Full name <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-t-name"
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
          />
        </div>

        <div>
          <label
            htmlFor="gs-t-email"
            className="block text-[13.5px] font-semibold mb-1.5"
          >
            Work email <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <input
            id="gs-t-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--line-strong)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
          />
        </div>

        {err && (
          <NoticeBanner tone="error" title="Check tester details">
            {err}
          </NoticeBanner>
        )}

        <ActionButton type="submit" variant="primary" fullWidth>
          Start testing
        </ActionButton>
      </form>

      <p
        style={{ borderTop: '1px solid var(--line)', color: 'var(--muted)' }}
        className="text-xs pt-3"
      >
        Testing{' '}
        <strong>
          {project.product_name} {project.version}
        </strong>{' '}
        for {project.client_name}.
      </p>
    </FocusPanel>
  );
}

function ChecklistPortalScreen({
  project,
  milestones,
  tester,
  onSaveResult,
  onAttachScreenshot,
  onOpenLightbox,
  onNavigate,
  onFlash,
}: {
  project: Project;
  milestones: Milestone[];
  tester: TesterInfo;
  onSaveResult: (msId: string, itemId: string, patch: ResultPatch) => void;
  onAttachScreenshot: (
    msId: string,
    itemId: string,
    filename: string,
    imageUrl?: string | null
  ) => void;
  onOpenLightbox: (data: LightboxData) => void;
  onNavigate: (s: ScreenId) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const msStates = useMemo(
    () => buildMilestoneStates(milestones),
    [milestones]
  );
  const [selectedMsId, setSelectedMsId] = useState<string>(msStates[0]?.id || '');
  const [statusMessage, setStatusMessage] = useState(
    'Results save automatically on selection.'
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failAlert, setFailAlert] = useState<Record<string, string>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const debounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingQueueRef = useRef<
    Record<string, { msId: string; item: ChecklistItem; payload: ResultPatch }>
  >({});
  const savingRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes({});
    setFailAlert({});
    setSelectedMsId(msStates[0]?.id || '');
  }, [project.id]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimerRef.current).forEach((t) => clearTimeout(t));
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const activeMs = useMemo(() => {
    const picked = msStates.find((m) => m.id === selectedMsId);
    if (picked && picked.unlocked) return picked;
    return msStates.find((m) => m.state === 'open') || msStates[0];
  }, [msStates, selectedMsId]);

  const progress = useMemo(() => {
    const all = milestones.flatMap((m) => m.items);
    const total = all.length;
    const done = all.filter((i) => i.status === 'pass' || i.status === 'na').length;
    const fail = all.filter((i) => i.status === 'fail').length;
    const allDone = total > 0 && done === total;
    return { total, done, fail, allDone };
  }, [milestones]);

  const flushSave = useCallback(
    (msId: string, item: ChecklistItem, choice: ItemStatus, commentVal: string) => {
      if (project.signed_at) return;

      if (debounceTimerRef.current[item.id]) {
        clearTimeout(debounceTimerRef.current[item.id]);
        delete debounceTimerRef.current[item.id];
      }

      if (choice === 'fail' && (!commentVal || !commentVal.trim())) {
        setFailAlert((prev) => ({ ...prev, [item.id]: 'Add note to save fail' }));
        setStatusMessage('Add note to save fail');
        setTimeout(() => noteRefs.current[item.id]?.focus(), 10);
        return;
      }

      setFailAlert((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      const payload: ResultPatch = {
        status: choice,
        comment: commentVal ?? '',
        tester_name: tester.name,
        tester_email: tester.email,
        tested_at: new Date().toISOString(),
      };

      if (savingRef.current) {
        pendingQueueRef.current[item.id] = { msId, item, payload };
        return;
      }

      savingRef.current = true;
      setStatusMessage('Saving…');

      saveTimerRef.current = setTimeout(() => {
        onSaveResult(msId, item.id, payload);
        const queuedEntries = Object.values(pendingQueueRef.current);
        pendingQueueRef.current = {};
        for (const q of queuedEntries) {
          onSaveResult(q.msId, q.item.id, q.payload);
        }
        savingRef.current = false;
        setStatusMessage('Saved');
      }, 120);
    },
    [onSaveResult, project.signed_at, tester]
  );

  const nextMilestone = useMemo(() => {
    if (!activeMs) return null;
    const candidate = msStates[activeMs.index + 1];
    return candidate && candidate.unlocked ? candidate : null;
  }, [activeMs, msStates]);

  if (isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  const isLockedSigned = Boolean(project.signed_at);

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <SignalCard className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--muted)' }}
            >
              {project.client_name} · {project.owner_name}
            </div>
            <h1
              className="font-extrabold tracking-[-0.03em]"
              style={{ fontSize: 'clamp(28px, 3.4vw, 36px)', lineHeight: 1.1 }}
            >
              {project.product_name} {project.version}
            </h1>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              Work through each milestone in order. A milestone unlocks when
              every item in the one before it has a result.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <ProgressRing
              current={progress.done}
              total={progress.total}
              size={50}
            />
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-[14px]">
                {progress.done} of {progress.total} done
              </div>
              <div
                role="status"
                aria-live="polite"
                className="font-semibold"
                style={{
                  color: statusMessage.includes('Add note')
                    ? 'var(--danger)'
                    : 'var(--brand)',
                }}
              >
                {statusMessage}
              </div>
              {progress.fail > 0 && (
                <div
                  className="font-semibold"
                  style={{ color: 'var(--danger)' }}
                >
                  {progress.fail} to fix
                </div>
              )}
            </div>
          </div>
        </div>
        {isLockedSigned && (
          <NoticeBanner tone="ok" title="This UAT project is signed off">
            Results are locked because a completion certificate has been issued.{' '}
            <button
              type="button"
              onClick={() => onNavigate('certificate')}
              style={{ color: 'var(--ok)' }}
              className="underline font-semibold cursor-pointer"
            >
              View certificate →
            </button>
          </NoticeBanner>
        )}
      </SignalCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside
          aria-label="Milestone rail"
          className="lg:col-span-4 flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-0"
        >
          {msStates.map((ms) => {
            const active = activeMs?.id === ms.id;
            const stMeta = MILESTONE_STATE_MAP[ms.state];
            return (
              <button
                key={ms.id}
                type="button"
                disabled={!ms.unlocked}
                aria-disabled={!ms.unlocked}
                tabIndex={ms.unlocked ? 0 : -1}
                onClick={() => ms.unlocked && setSelectedMsId(ms.id)}
                style={{
                  backgroundColor: active ? 'var(--surface)' : 'var(--surface-2)',
                  borderColor: active
                    ? 'var(--brand)'
                    : ms.unlocked
                    ? 'var(--line-strong)'
                    : 'var(--line)',
                  opacity: ms.unlocked ? 1 : 0.6,
                  borderRadius: 'var(--radius-md)',
                }}
                className="gs-focus w-72 lg:w-full shrink-0 text-left p-3.5 border cursor-pointer disabled:cursor-not-allowed flex items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    style={{
                      backgroundColor: ms.complete
                        ? 'var(--ok-soft)'
                        : ms.unlocked
                        ? 'var(--brand-soft)'
                        : 'var(--surface-3)',
                      color: ms.complete
                        ? 'var(--ok)'
                        : ms.unlocked
                        ? 'var(--ink)'
                        : 'var(--muted)',
                    }}
                    className="w-8 h-8 rounded-full gs-mono text-xs font-bold inline-flex items-center justify-center shrink-0"
                  >
                    {ms.complete ? (
                      <Check className="w-4 h-4" />
                    ) : !ms.unlocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      ms.position
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] truncate">{ms.name}</div>
                    <div
                      className="gs-mono text-xs"
                      style={{ color: 'var(--muted)' }}
                    >
                      {ms.doneCount} of {ms.totalCount} done
                      {!ms.unlocked ? ' · locked' : ''}
                    </div>
                  </div>
                </div>
                <StatusChip label={stMeta.label} tone={stMeta.tone} />
              </button>
            );
          })}
        </aside>

        <div className="lg:col-span-8 space-y-4">
          {activeMs && (
            <>
              <SignalCard className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--muted)' }}
                  >
                    Milestone {activeMs.position} of {msStates.length}
                  </div>
                  <h2 className="text-[20px] font-bold">{activeMs.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
                    {activeMs.doneCount} of {activeMs.totalCount} items done
                  </span>
                  <StatusChip
                    label={MILESTONE_STATE_MAP[activeMs.state].label}
                    tone={MILESTONE_STATE_MAP[activeMs.state].tone}
                  />
                </div>
              </SignalCard>

              {activeMs.items.map((item) => {
                const itMeta = item.status ? ITEM_STATUS_MAP[item.status] : null;
                const currentNote =
                  notes[item.id] !== undefined ? notes[item.id] : item.comment || '';
                const alertText = failAlert[item.id];

                return (
                  <SignalCard key={item.id} className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            color: 'var(--ink-secondary)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          className="gs-mono font-bold px-2 py-0.5"
                        >
                          {item.code}
                        </span>
                        {itMeta ? (
                          <StatusChip label={itMeta.label} tone={itMeta.tone} />
                        ) : (
                          <StatusChip label="Not tested" tone="neutral" />
                        )}
                        {item.mandatory && <MetaTag>Required</MetaTag>}
                        {item.evidence && <MetaTag>Evidence</MetaTag>}
                      </div>
                      {item.tester_name && (
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          Last result by {item.tester_name}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-[18px] font-semibold">{item.title}</h3>
                      <pre
                        className="whitespace-pre-wrap text-[13.5px] font-sans"
                        style={{ color: 'var(--ink-secondary)' }}
                      >
                        {item.steps}
                      </pre>
                      <div
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor: 'var(--line)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        className="p-2.5 text-[13.5px] border"
                      >
                        <div
                          className="text-[11px] font-bold uppercase tracking-[0.08em] mb-0.5"
                          style={{ color: 'var(--muted)' }}
                        >
                          Expected result
                        </div>
                        <div>{item.expected}</div>
                      </div>
                    </div>

                    {item.fix_note && (
                      <NoticeBanner tone="warn" title="Your team marked this fixed.">
                        Please retest and mark it again.{' '}
                        <strong>{item.fix_note}</strong>
                      </NoticeBanner>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <label
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--line-strong)',
                            color: 'var(--ink)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          className="gs-focus inline-flex items-center gap-1.5 px-2.5 py-1.5 font-semibold border cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {item.screenshotName
                              ? 'Replace screenshot'
                              : 'Attach screenshot'}
                          </span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg"
                            disabled={isLockedSigned}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const isImg =
                                file.type === 'image/png' ||
                                file.type === 'image/jpeg' ||
                                /\.(png|jpe?g)$/i.test(file.name);
                              if (!isImg) {
                                onFlash({
                                  type: 'error',
                                  message: 'Only PNG or JPG screenshots are accepted.',
                                });
                                return;
                              }
                              if (file.size > MAX_UPLOAD_BYTES) {
                                onFlash({
                                  type: 'error',
                                  message: 'Screenshot exceeds the 4 MB upload limit.',
                                });
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => {
                                onAttachScreenshot(
                                  activeMs.id,
                                  item.id,
                                  file.name,
                                  typeof reader.result === 'string'
                                    ? reader.result
                                    : null
                                );
                              };
                              reader.onerror = () => {
                                onAttachScreenshot(activeMs.id, item.id, file.name, null);
                              };
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        {item.screenshotName && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenLightbox({
                                filename: item.screenshotName!,
                                imageUrl: item.screenshotUrl,
                              })
                            }
                            style={{ color: 'var(--brand)' }}
                            className="gs-focus gs-mono font-semibold hover:underline cursor-pointer"
                          >
                            {item.screenshotName}
                          </button>
                        )}
                      </div>
                      {item.evidence && (
                        <span style={{ color: 'var(--muted)' }}>
                          Evidence recommended
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div
                        role="radiogroup"
                        aria-label={`Result for ${item.code}`}
                        className="grid grid-cols-3 gap-2"
                      >
                        {(
                          [
                            { key: 'pass', label: 'Pass' },
                            { key: 'fail', label: 'Fail' },
                            { key: 'na', label: 'N/A' },
                          ] as const
                        ).map((opt) => {
                          const naBlocked = opt.key === 'na' && item.mandatory;
                          const disabledChoice = naBlocked || isLockedSigned;
                          const chosen = item.status === opt.key;

                          let btnColors = {
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--line-strong)',
                            color: 'var(--ink)',
                          };
                          if (chosen && opt.key === 'pass') {
                            btnColors = {
                              backgroundColor: 'var(--ok-soft)',
                              borderColor: 'var(--ok)',
                              color: 'var(--ok)',
                            };
                          } else if (chosen && opt.key === 'fail') {
                            btnColors = {
                              backgroundColor: 'var(--danger-soft)',
                              borderColor: 'var(--danger)',
                              color: 'var(--danger)',
                            };
                          } else if (chosen && opt.key === 'na') {
                            btnColors = {
                              backgroundColor: 'var(--surface-3)',
                              borderColor: 'var(--line-strong)',
                              color: 'var(--ink)',
                            };
                          }

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              role="radio"
                              aria-checked={chosen}
                              disabled={disabledChoice}
                              title={
                                naBlocked
                                  ? 'Required item cannot be marked N/A'
                                  : undefined
                              }
                              onClick={() =>
                                flushSave(activeMs.id, item, opt.key, currentNote)
                              }
                              style={{
                                ...btnColors,
                                opacity: disabledChoice ? 0.45 : 1,
                                borderRadius: 'var(--radius-sm)',
                              }}
                              className="gs-focus min-h-[44px] px-3 py-2 text-[14px] font-bold border cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
                            >
                              <span>{opt.label}</span>
                              {naBlocked && (
                                <span className="text-[11px] font-normal">
                                  (Required)
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div>
                        <label
                          htmlFor={`gs-note-${item.id}`}
                          className="block text-xs font-semibold mb-1"
                        >
                          What happened?{' '}
                          <span style={{ color: 'var(--muted)' }}>
                            (Required when marking Fail)
                          </span>
                        </label>
                        <textarea
                          id={`gs-note-${item.id}`}
                          ref={(el) => {
                            noteRefs.current[item.id] = el;
                          }}
                          rows={2}
                          readOnly={isLockedSigned}
                          placeholder="Add the steps you took and what you saw."
                          value={currentNote}
                          aria-invalid={Boolean(alertText)}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNotes((prev) => ({ ...prev, [item.id]: val }));
                            clearTimeout(debounceTimerRef.current[item.id]);
                            debounceTimerRef.current[item.id] = setTimeout(() => {
                              if (item.status === 'fail' && val.trim().length > 0) {
                                flushSave(activeMs.id, item, 'fail', val);
                              }
                            }, 800);
                          }}
                          onBlur={() => {
                            if (item.status === 'fail' && currentNote.trim()) {
                              flushSave(activeMs.id, item, 'fail', currentNote);
                            }
                          }}
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: alertText
                              ? 'var(--danger)'
                              : 'var(--line-strong)',
                            color: 'var(--ink)',
                            borderRadius: 'var(--radius-sm)',
                          }}
                          className="gs-focus w-full px-3 py-2 border text-[13.5px]"
                        />
                        {alertText && (
                          <p
                            role="alert"
                            className="text-xs font-semibold mt-1"
                            style={{ color: 'var(--danger)' }}
                          >
                            {alertText}
                          </p>
                        )}
                      </div>
                    </div>
                  </SignalCard>
                );
              })}

              <SignalCard
                active={progress.allDone || Boolean(nextMilestone)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {progress.allDone ? (
                  <>
                    <div>
                      <div className="font-bold text-[18px]">
                        All milestones are complete
                      </div>
                      <p
                        className="text-[13.5px]"
                        style={{ color: 'var(--ink-secondary)' }}
                      >
                        Every item is Passed or N/A. Proceed to sign off.
                      </p>
                    </div>
                    <ActionButton
                      variant="primary"
                      onClick={() => onNavigate('signoff')}
                    >
                      Sign off UAT
                    </ActionButton>
                  </>
                ) : nextMilestone ? (
                  <>
                    <div>
                      <div className="font-bold text-[18px]">
                        Milestone complete
                      </div>
                      <p
                        className="text-[13.5px]"
                        style={{ color: 'var(--ink-secondary)' }}
                      >
                        Next unlocked milestone: {nextMilestone.name}.
                      </p>
                    </div>
                    <ActionButton
                      variant="primary"
                      onClick={() => setSelectedMsId(nextMilestone.id)}
                    >
                      Next milestone
                    </ActionButton>
                  </>
                ) : (
                  <p
                    className="text-[13.5px]"
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    Mark every item in this milestone Passed or N/A to unlock the
                    next milestone.
                  </p>
                )}
              </SignalCard>
            </>
          )}
        </div>
      </div>

      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-20 border-t px-4 py-2.5 flex items-center justify-between gap-3"
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <span className="gs-mono text-xs font-bold">
          {progress.done} of {progress.total} done
        </span>
        {progress.allDone ? (
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => onNavigate('signoff')}
          >
            Sign off
          </ActionButton>
        ) : nextMilestone ? (
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => setSelectedMsId(nextMilestone.id)}
          >
            Next milestone
          </ActionButton>
        ) : (
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            In progress
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * 8. SCREENS 11–14: SIGN-OFF WIZARD, CERTIFICATE, ERROR PAGES & INSPECTOR
 * ============================================================================
 */
function SignOffWizardScreen({
  project,
  milestones,
  tester,
  onCompleteSignoff,
  onNavigate,
}: {
  project: Project;
  milestones: Milestone[];
  tester: TesterInfo;
  onCompleteSignoff: (cert: CertificateRecord) => void;
  onNavigate: (s: ScreenId) => void;
}) {
  const { stats } = deriveProjectMetrics(project, milestones);
  const eligible = stats.total > 0 && stats.done === stats.total;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [signerName, setSignerName] = useState(tester.name || 'Nadia Patel');
  const [roleTitle, setRoleTitle] = useState('Head of Operations');
  const [signerEmail, setSignerEmail] = useState(
    tester.email || 'nadia.patel@acme.example'
  );
  const [otpDigits, setOtpDigits] = useState<string[]>(['4', '8', '2', '9', '1', '5']);
  const [sigMode, setSigMode] = useState<'drawn' | 'typed'>('drawn');
  const [typedSig, setTypedSig] = useState(tester.name || 'Nadia Patel');
  const [drawnDirty, setDrawnDirty] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState('');

  const padRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  if (isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  if (project.signed_at) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <NoticeBanner tone="ok" title="Already signed off">
          This UAT project already has an issued completion certificate.
        </NoticeBanner>
        <ActionButton variant="primary" onClick={() => onNavigate('certificate')}>
          View completion certificate
        </ActionButton>
      </div>
    );
  }

  if (!eligible) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <NoticeBanner tone="warn" title="Sign-off not ready yet">
          All milestones must have every item Passed or N/A before signing off (
          {stats.done} of {stats.total} complete).
        </NoticeBanner>
        <ActionButton variant="primary" onClick={() => onNavigate('portal')}>
          ← Back to checklist portal
        </ActionButton>
      </div>
    );
  }

  const localPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = padRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = padRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = localPoint(e);
    drawingRef.current = true;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(canvas).color || '#6366f1';
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = padRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pt = localPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    setDrawnDirty(true);
  };

  const handlePointerUp = () => {
    drawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = padRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setDrawnDirty(false);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !roleTitle.trim() || !signerEmail.includes('@')) {
      setError('Enter full name, designation, and a valid work email.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpDigits.join('').length < 6) {
      setError('Enter all 6 digits of the one-time code.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sigMode === 'drawn' && !drawnDirty) {
      setError('Draw your signature above the line or switch to Type signature.');
      return;
    }
    if (sigMode === 'typed' && !typedSig.trim()) {
      setError('Type your full name to sign.');
      return;
    }
    if (!consentChecked) {
      setError('Check the consent confirmation before issuing the certificate.');
      return;
    }
    setError('');

    const pngUrl =
      sigMode === 'drawn' && padRef.current
        ? padRef.current.toDataURL('image/png')
        : null;

    const signedAt = new Date().toISOString();
    const verificationId = generateVerificationId();
    const canonicalPayload = JSON.stringify({
      verification_id: verificationId,
      project_id: project.id,
      signer_name: signerName.trim(),
      signer_email: signerEmail.trim(),
      signed_at: signedAt,
    });
    const encoded = new TextEncoder().encode(canonicalPayload);
    const computedRecordHash =
      (await computeSha256Hex(encoded.buffer)) ||
      makeFallbackHashHex(canonicalPayload);
    const computedPdfHash = makeFallbackHashHex(`${canonicalPayload}:pdf`);

    onCompleteSignoff({
      verification_id: verificationId,
      signer_name: signerName.trim(),
      signer_designation: roleTitle.trim(),
      signer_email: signerEmail.trim(),
      signature_kind: sigMode,
      typed_signature: typedSig.trim(),
      signature_data_url: pngUrl,
      signed_at: signedAt,
      ip: '203.0.113.19',
      record_hash: computedRecordHash,
      pdf_hash: computedPdfHash,
    });
    onNavigate('certificate');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--muted)' }}
        >
          Sign-off wizard · {project.id}
        </div>
        <h1
          className="font-extrabold tracking-[-0.03em]"
          style={{ fontSize: 'clamp(28px, 3.4vw, 36px)', lineHeight: 1.1 }}
        >
          Sign off {project.product_name} {project.version}
        </h1>
      </div>

      <nav aria-label="Sign-off steps">
        <ol className="grid grid-cols-3 gap-2">
          {[
            { n: 1, label: '1. Signer details' },
            { n: 2, label: '2. Email code' },
            { n: 3, label: '3. Signature' },
          ].map((s) => {
            const cur = step === s.n;
            const done = step > s.n;
            return (
              <li
                key={s.n}
                aria-current={cur ? 'step' : undefined}
                style={{
                  backgroundColor: cur
                    ? 'var(--brand-soft)'
                    : done
                    ? 'var(--ok-soft)'
                    : 'var(--surface)',
                  borderColor: cur
                    ? 'var(--brand)'
                    : done
                    ? 'var(--ok-border)'
                    : 'var(--line)',
                  color: cur
                    ? 'var(--ink)'
                    : done
                    ? 'var(--ok)'
                    : 'var(--muted)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="p-3 border text-xs sm:text-[13.5px] font-bold flex items-center justify-between"
              >
                <span>{s.label}</span>
                {done && <Check className="w-4 h-4" />}
              </li>
            );
          })}
        </ol>
      </nav>

      {error && (
        <NoticeBanner tone="error" title="Sign-off error">
          {error}
        </NoticeBanner>
      )}

      {step === 1 && (
        <SignalCard>
          <form onSubmit={handleSendOtp} className="space-y-4">
            <h2 className="text-[20px] font-bold">Who is signing?</h2>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              Your name and designation appear on the certificate.
            </p>
            <div>
              <label
                htmlFor="gs-so-name"
                className="block text-[13.5px] font-semibold mb-1.5"
              >
                Full name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="gs-so-name"
                type="text"
                required
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
              />
            </div>
            <div>
              <label
                htmlFor="gs-so-role"
                className="block text-[13.5px] font-semibold mb-1.5"
              >
                Designation or role{' '}
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="gs-so-role"
                type="text"
                required
                placeholder="e.g. Head of Operations"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
              />
            </div>
            <div>
              <label
                htmlFor="gs-so-email"
                className="block text-[13.5px] font-semibold mb-1.5"
              >
                Work email for the one-time code{' '}
                <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="gs-so-email"
                type="email"
                required
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
              />
            </div>
            <ActionButton type="submit" variant="primary" fullWidth>
              Send the one-time code
            </ActionButton>
          </form>
        </SignalCard>
      )}

      {step === 2 && (
        <SignalCard>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <h2 className="text-[20px] font-bold">Check your email</h2>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              A six-digit code was sent to{' '}
              <strong className="gs-mono">{signerEmail}</strong>. It expires in
              10 minutes.
            </p>
            <div className="flex justify-center gap-2 py-2">
              {otpDigits.map((d, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    digitRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  aria-label={`OTP digit ${idx + 1}`}
                  value={d}
                  onChange={(e) => {
                    const ch = e.target.value.replace(/\D/g, '').slice(-1);
                    const next = [...otpDigits];
                    next[idx] = ch;
                    setOtpDigits(next);
                    if (ch && idx < 5) digitRefs.current[idx + 1]?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
                      digitRefs.current[idx - 1]?.focus();
                    } else if (e.key === 'ArrowLeft' && idx > 0) {
                      digitRefs.current[idx - 1]?.focus();
                    } else if (e.key === 'ArrowRight' && idx < 5) {
                      digitRefs.current[idx + 1]?.focus();
                    }
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData
                      .getData('text')
                      .replace(/\D/g, '')
                      .slice(0, 6);
                    if (!pasted) return;
                    e.preventDefault();
                    const next = [...otpDigits];
                    for (let i = 0; i < 6; i += 1) {
                      if (pasted[i]) next[i] = pasted[i];
                    }
                    setOtpDigits(next);
                    const focusIdx = Math.min(5, pasted.length - 1);
                    digitRefs.current[focusIdx]?.focus();
                  }}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus gs-mono text-xl font-bold w-11 h-12 sm:w-12 sm:h-14 text-center border"
                />
              ))}
            </div>
            <ActionButton type="submit" variant="primary" fullWidth>
              Verify code
            </ActionButton>
            <div className="flex justify-between text-[13.5px]">
              <button
                type="button"
                onClick={() => setStep(1)}
                style={{ color: 'var(--ink-secondary)' }}
                className="gs-focus hover:underline cursor-pointer"
              >
                Change signer details
              </button>
              <button
                type="button"
                onClick={() => setOtpDigits(['7', '1', '5', '3', '9', '0'])}
                style={{ color: 'var(--brand)' }}
                className="gs-focus font-semibold hover:underline cursor-pointer"
              >
                Send a new code
              </button>
            </div>
          </form>
        </SignalCard>
      )}

      {step === 3 && (
        <SignalCard>
          <form onSubmit={handleIssue} className="space-y-5">
            <div
              style={{
                backgroundColor: 'var(--ok-soft)',
                borderColor: 'var(--ok-border)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="p-3.5 border flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: 'var(--ok)' }}
                >
                  Email verified
                </div>
                <div className="font-bold text-[18px]">{signerName}</div>
                <div
                  className="text-xs"
                  style={{ color: 'var(--ink-secondary)' }}
                >
                  {roleTitle}, {project.client_name} · {signerEmail}
                </div>
              </div>
              <StatusChip label="Code verified" tone="ok" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Checklist', val: `${stats.total} items` },
                { label: 'Passed', val: stats.total - stats.na },
                { label: 'Not applicable', val: stats.na },
                { label: 'Milestones', val: milestones.length },
              ].map((cell) => (
                <div
                  key={cell.label}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="p-3 border"
                >
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>
                    {cell.label}
                  </div>
                  <div className="gs-mono font-bold text-base">{cell.val}</div>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[18px] font-semibold">Your signature</h2>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSigMode('drawn')}
                    style={{
                      backgroundColor:
                        sigMode === 'drawn' ? 'var(--brand)' : 'var(--surface-2)',
                      borderColor:
                        sigMode === 'drawn' ? 'var(--brand)' : 'var(--line)',
                      color:
                        sigMode === 'drawn' ? '#ffffff' : 'var(--ink)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="gs-focus inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border cursor-pointer"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Draw signature</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSigMode('typed')}
                    style={{
                      backgroundColor:
                        sigMode === 'typed' ? 'var(--brand)' : 'var(--surface-2)',
                      borderColor:
                        sigMode === 'typed' ? 'var(--brand)' : 'var(--line)',
                      color:
                        sigMode === 'typed' ? '#ffffff' : 'var(--ink)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="gs-focus inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border cursor-pointer"
                  >
                    <Type className="w-3.5 h-3.5" />
                    <span>Type signature</span>
                  </button>
                </div>
              </div>

              {sigMode === 'drawn' ? (
                <div className="space-y-2">
                  <div
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      borderColor: 'var(--line-strong)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-xs)',
                      color: 'var(--brand)',
                    }}
                    className="relative border overflow-hidden"
                  >
                    <canvas
                      ref={padRef}
                      width={640}
                      height={220}
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      aria-label="Signature pad"
                      className="w-full h-[210px] touch-none block cursor-crosshair"
                    />
                    <div
                      style={{
                        borderColor: 'var(--line-strong)',
                        color: 'var(--muted)',
                      }}
                      className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed text-[11px]"
                    >
                      Sign above the line
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--muted)' }}>
                      Use a mouse, trackpad, finger or stylus.
                    </span>
                    <button
                      type="button"
                      onClick={clearCanvas}
                      style={{ color: 'var(--ink-secondary)' }}
                      className="gs-focus inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
                    >
                      <Eraser className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="gs-so-typed"
                    className="block text-[13.5px] font-semibold mb-1.5"
                  >
                    Type your full name
                  </label>
                  <input
                    id="gs-so-typed"
                    type="text"
                    value={typedSig}
                    onChange={(e) => setTypedSig(e.target.value)}
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      borderColor: 'var(--line-strong)',
                      color: 'var(--ink)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    className="gs-focus w-full px-3 py-2.5 border min-h-[44px] italic font-serif text-lg"
                  />
                </div>
              )}
            </div>

            <label
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--line)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="flex items-start gap-3 p-3.5 border cursor-pointer"
            >
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 w-4 h-4 shrink-0"
              />
              <span
                className="text-[13.5px]"
                style={{ color: 'var(--ink-secondary)' }}
              >
                I confirm that I have reviewed the results above and that I
                accept this release on behalf of{' '}
                <strong>{project.client_name}</strong>. I understand this is an
                electronic signature.
              </span>
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                IP and browser metadata are recorded with sign-off.
              </span>
              <ActionButton type="submit" variant="primary">
                <FileCheck2 className="w-4 h-4" />
                <span>Sign and issue certificate</span>
              </ActionButton>
            </div>
          </form>
        </SignalCard>
      )}
    </div>
  );
}

function CertificateScreen({
  project,
  milestones,
  certOverride,
  onNavigate,
}: {
  project: Project;
  milestones: Milestone[];
  certOverride: CertificateRecord | null;
  onNavigate: (s: ScreenId) => void;
}) {
  const cert: CertificateRecord = certOverride || {
    verification_id: 'VC-8492-KLMN',
    signer_name: 'David Alvarez',
    signer_designation: 'VP of Finance & Operations',
    signer_email: 'd.alvarez@kineticretail.example',
    signed_at: project.signed_at || '2026-11-08T16:42:00Z',
    signature_kind: 'typed',
    typed_signature: 'David Alvarez',
    signature_data_url: null,
    ip: '198.51.100.42',
    record_hash:
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    pdf_hash:
      '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
  };

  const rows = useMemo(
    () =>
      milestones.map((m) => ({
        name: m.name,
        total: m.items.length,
        pass: m.items.filter((i) => i.status === 'pass').length,
        na: m.items.filter((i) => i.status === 'na').length,
        completed: cert.signed_at.slice(0, 10),
      })),
    [milestones, cert.signed_at]
  );

  const totalItems = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--ok)' }}
          >
            Signed and stored
          </div>
          <h1
            className="font-extrabold tracking-[-0.03em]"
            style={{ fontSize: 'clamp(28px, 3.4vw, 36px)', lineHeight: 1.1 }}
          >
            UAT completion certificate
          </h1>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            Verification ID{' '}
            <strong className="gs-mono">{cert.verification_id}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton variant="primary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => window.print()}>
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => onNavigate('verify')}>
            Public verification
          </ActionButton>
        </div>
      </div>

      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line-strong)',
          boxShadow: 'var(--shadow-md)',
          borderRadius: 'var(--radius-lg)',
        }}
        className="gs-cert-sheet border p-6 sm:p-10 space-y-6 max-w-4xl mx-auto"
      >
        <div
          style={{ borderBottom: '1px solid var(--line)' }}
          className="pb-4 flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--brand)' }}
            >
              UAT Desk
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight">
              UAT Completion Certificate
            </h2>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Verification ID
            </div>
            <div className="gs-mono font-bold text-base">
              {cert.verification_id}
            </div>
          </div>
        </div>

        <p style={{ color: 'var(--ink-secondary)' }}>
          This certificate confirms that <strong>{project.client_name}</strong>{' '}
          completed acceptance testing for{' '}
          <strong>
            {project.product_name} {project.version}
          </strong>{' '}
          across <strong>{totalItems}</strong> items in{' '}
          <strong>{rows.length}</strong> milestones.
        </p>

        <div
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--line)',
            borderRadius: 'var(--radius-sm)',
          }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 border text-[13.5px]"
        >
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Client
            </div>
            <div className="font-semibold">{project.client_name}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Product
            </div>
            <div className="font-semibold">
              {project.product_name} {project.version}
            </div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Project ID
            </div>
            <div className="gs-mono font-bold">{project.id}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Company contact
            </div>
            <div>{project.owner_name}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Signed on
            </div>
            <div className="gs-mono">{cert.signed_at.slice(0, 10)}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Signer IP
            </div>
            <div className="gs-mono">{cert.ip}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13.5px]">
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderBottom: '1px solid var(--line)',
                  color: 'var(--muted)',
                }}
                className="text-[11px] font-bold uppercase tracking-[0.08em]"
              >
                <th className="py-2.5 px-3">Milestone</th>
                <th className="py-2.5 px-3">Items</th>
                <th className="py-2.5 px-3">Passed</th>
                <th className="py-2.5 px-3">Not applicable</th>
                <th className="py-2.5 px-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.name}
                  style={{ borderBottom: '1px solid var(--line)' }}
                >
                  <td className="py-2.5 px-3 font-medium">{r.name}</td>
                  <td className="py-2.5 px-3 gs-mono">{r.total}</td>
                  <td className="py-2.5 px-3 gs-mono">{r.pass}</td>
                  <td className="py-2.5 px-3 gs-mono">{r.na}</td>
                  <td className="py-2.5 px-3 gs-mono">{r.completed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--line)',
            borderRadius: 'var(--radius-sm)',
          }}
          className="no-break p-4 border space-y-3"
        >
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Signed for {project.client_name}
          </div>

          {cert.signature_data_url ? (
            <img
              src={cert.signature_data_url}
              alt="Drawn electronic signature"
              className="h-20 object-contain border-b pb-2"
              style={{ borderColor: 'var(--line-strong)' }}
            />
          ) : (
            <div
              style={{ borderColor: 'var(--line-strong)' }}
              className="text-2xl italic font-serif pb-2 border-b"
            >
              {cert.typed_signature || cert.signer_name}
            </div>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
            <div>
              <strong>{cert.signer_name}</strong> · {cert.signer_designation}
              <div className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
                {cert.signer_email}
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Email verified by one-time code on {cert.signed_at.slice(0, 10)}
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs">
          <div>
            <span
              className="font-bold uppercase tracking-[0.08em] block"
              style={{ color: 'var(--muted)' }}
            >
              Record SHA-256
            </span>
            <span className="gs-mono break-all">{cert.record_hash}</span>
          </div>
          <div>
            <span
              className="font-bold uppercase tracking-[0.08em] block"
              style={{ color: 'var(--muted)' }}
            >
              PDF SHA-256
            </span>
            <span className="gs-mono break-all">{cert.pdf_hash}</span>
          </div>
        </div>

        <p
          style={{ borderTop: '1px solid var(--line)', color: 'var(--muted)' }}
          className="text-xs pt-3"
        >
          Electronic signature with audit trail and SHA-256 fingerprints (not a
          certificate-authority digital signature). Verify at{' '}
          <span className="gs-mono">/verify?id={cert.verification_id}</span>.
        </p>
      </div>
    </div>
  );
}

function ErrorStateScreen({ onNavigate }: { onNavigate: (s: ScreenId) => void }) {
  const [code, setCode] = useState<'403' | '404' | '500'>('404');

  const details: Record<'403' | '404' | '500', { title: string; body: string }> = {
    403: {
      title: 'Access restricted',
      body: 'Your session expired or this resource is locked. Reload or sign in again.',
    },
    404: {
      title: 'Page not found',
      body: 'The requested route or UAT record could not be found.',
    },
    500: {
      title: 'Service unavailable',
      body: 'The database is not reachable right now. Please try again in a moment.',
    },
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="flex justify-center gap-2">
        {(['403', '404', '500'] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCode(c)}
            style={{
              backgroundColor:
                code === c ? 'var(--brand-soft)' : 'var(--surface)',
              borderColor: code === c ? 'var(--brand)' : 'var(--line)',
              color: code === c ? 'var(--ink)' : 'var(--ink-secondary)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus gs-mono px-3 py-1 text-xs font-bold border cursor-pointer"
          >
            {c}
          </button>
        ))}
      </div>

      <SignalCard className="text-center space-y-3">
        <div
          className="gs-mono text-4xl font-extrabold"
          style={{ color: 'var(--muted)' }}
        >
          {code}
        </div>
        <h1 className="text-2xl font-extrabold">{details[code].title}</h1>
        <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
          {details[code].body}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <ActionButton variant="primary" onClick={() => onNavigate('landing')}>
            Go to the start page
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => onNavigate('verify')}>
            Verify a certificate
          </ActionButton>
        </div>
      </SignalCard>
    </div>
  );
}

function ComponentInspectorDrawer({
  open,
  onClose,
  onNavigate,
  onTriggerClosed,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (s: ScreenId) => void;
  onTriggerClosed: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Component and state inspector"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.72)' }}
      className="fixed inset-0 z-50 flex justify-end"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--surface)',
          borderColor: 'var(--line-strong)',
          boxShadow: 'var(--shadow-lg)',
        }}
        className="w-full max-w-md h-full border-l p-5 overflow-y-auto space-y-6"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.08em]"
              style={{ color: 'var(--brand)' }}
            >
              Graphite &amp; Signal
            </div>
            <h2 className="text-[20px] font-bold">Component &amp; State Inspector</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            style={{
              backgroundColor: 'var(--surface-2)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Status chips &amp; progress ring
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusChip label="Signed off" tone="ok" />
            <StatusChip label="Waiting for signature" tone="ok" />
            <StatusChip label="In testing" tone="neutral" />
            <StatusChip label="Failed" tone="danger" />
            <StatusChip label="Ready for retest" tone="warn" />
            <StatusChip label="Access turned off" tone="danger" />
            <StatusChip label="Link expired" tone="danger" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <MetaTag>Required</MetaTag>
            <MetaTag>Evidence</MetaTag>
            <ProgressRing current={4} total={6} size={40} />
          </div>
        </div>

        <div className="space-y-2.5">
          <div
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: 'var(--muted)' }}
          >
            Jump to screen or blocked state
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(
              [
                { id: 'landing', label: 'Landing (/)' },
                { id: 'client-entry', label: 'Client Entry (/client)' },
                { id: 'verify', label: 'Verify (/verify)' },
                { id: 'company-login', label: 'Company Login' },
                { id: 'company', label: 'Dashboard (/company)' },
                { id: 'new-project', label: 'New Project' },
                { id: 'project-detail', label: 'Project Detail' },
                { id: 'token-login', label: 'Token Login (/p/:t)' },
                { id: 'tester-id', label: 'Tester Identity' },
                { id: 'portal', label: 'Checklist Portal' },
                { id: 'signoff', label: 'Sign-Off Wizard' },
                { id: 'certificate', label: 'Certificate' },
                { id: 'error', label: '403 / 404 / 500' },
              ] as Array<{ id: ScreenId; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus px-2.5 py-2 border font-semibold text-left cursor-pointer"
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                onTriggerClosed();
                onClose();
              }}
              style={{
                backgroundColor: 'var(--danger-soft)',
                borderColor: 'var(--danger-border)',
                color: 'var(--danger)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="gs-focus px-2.5 py-2 border font-semibold text-left cursor-pointer"
            >
              Closed (Revoked/Exp)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================================
 * 9. ROOT GRAPHITE & SIGNAL APP
 * ============================================================================
 */
export default function App() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [screen, setScreen] = useState<ScreenId>('landing');
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [companyEmail, setCompanyEmail] = useState<string | null>('rohan.k@uatdesk.io');
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('UAT-ACME23');
  const [milestonesByProject, setMilestonesByProject] = useState<
    Record<string, Milestone[]>
  >(createSeedMilestonesByProject);
  const [activity, setActivity] = useState<ActivityEvent[]>(SEED_ACTIVITY);
  const [certificates, setCertificates] =
    useState<Record<string, CertificateRecord>>(SEED_CERTIFICATES);
  const [tester, setTester] = useState<TesterInfo>({
    name: 'Nadia Patel',
    email: 'nadia.patel@acme.example',
  });
  const [activeCert, setActiveCert] = useState<CertificateRecord | null>(null);
  const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === selectedProjectId) || projects[0],
    [projects, selectedProjectId]
  );

  const activeMilestones = useMemo(
    () => milestonesByProject[activeProject.id] || SEED_MILESTONES,
    [milestonesByProject, activeProject.id]
  );

  const activeCertificate = useMemo(() => {
    const matched = Object.values(certificates).find(
      (c) => c.project_id === activeProject.id
    );
    if (matched) return matched;
    if (activeCert && activeCert.project_id === activeProject.id) return activeCert;
    return null;
  }, [certificates, activeProject.id, activeCert]);

  const logEvent = useCallback(
    (action: string, detail: string, actor: string, ip = '198.51.100.14') => {
      setActivity((prev) => [
        {
          id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action,
          detail,
          actor,
          ip,
          timestamp:
            new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
        },
        ...prev,
      ]);
    },
    []
  );

  const handleSaveResult = useCallback(
    (msId: string, itemId: string, patch: ResultPatch) => {
      let itemCode = '';
      setMilestonesByProject((prev) => {
        const currentList = prev[activeProject.id] || SEED_MILESTONES;
        const updatedList = currentList.map((ms) => {
          if (ms.id !== msId) return ms;
          return {
            ...ms,
            items: ms.items.map((it) => {
              if (it.id !== itemId) return it;
              itemCode = it.code;
              return { ...it, ...patch, fix_note: null };
            }),
          };
        });
        return { ...prev, [activeProject.id]: updatedList };
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id ? { ...p, liveChecklist: true } : p
        )
      );
      if (itemCode) {
        logEvent(
          'item · result',
          `${itemCode} marked ${patch.status.toUpperCase()}`,
          `${patch.tester_name} (${patch.tester_email})`,
          '203.0.113.19'
        );
      }
    },
    [activeProject.id, logEvent]
  );

  const handleAttachScreenshot = useCallback(
    (msId: string, itemId: string, filename: string, imageUrl?: string | null) => {
      setMilestonesByProject((prev) => {
        const currentList = prev[activeProject.id] || SEED_MILESTONES;
        const updatedList = currentList.map((ms) => {
          if (ms.id !== msId) return ms;
          return {
            ...ms,
            items: ms.items.map((it) =>
              it.id === itemId
                ? { ...it, screenshotName: filename, screenshotUrl: imageUrl ?? null }
                : it
            ),
          };
        });
        return { ...prev, [activeProject.id]: updatedList };
      });
      setFlash({ type: 'ok', message: `Attached ${filename}.` });
    },
    [activeProject.id]
  );

  const handleSendFix = useCallback(
    (itemId: string, fixNote: string) => {
      let code = '';
      setMilestonesByProject((prev) => {
        const currentList = prev[activeProject.id] || SEED_MILESTONES;
        const updatedList = currentList.map((ms) => ({
          ...ms,
          items: ms.items.map((it) => {
            if (it.id !== itemId) return it;
            code = it.code;
            return { ...it, status: 'retest' as ItemStatus, fix_note: fixNote };
          }),
        }));
        return { ...prev, [activeProject.id]: updatedList };
      });
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id ? { ...p, liveChecklist: true } : p
        )
      );
      logEvent(
        'item · fix',
        `${code} sent for retest: ${fixNote}`,
        companyEmail || 'Company user'
      );
      setFlash({ type: 'ok', message: `${code} marked Ready for retest.` });
    },
    [activeProject.id, logEvent, companyEmail]
  );

  const handleRotatePassword = useCallback(() => {
    const nextPass = `pw-${Math.random().toString(36).substring(2, 10)}`;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id ? { ...p, oneTimePassword: nextPass } : p
      )
    );
    logEvent(
      'access · password',
      `Rotated password for ${activeProject.id}`,
      companyEmail || 'Company user'
    );
    setFlash({ type: 'ok', message: 'Generated new one-time client password.' });
  }, [activeProject.id, logEvent, companyEmail]);

  const handleUpdateExpiry = useCallback(
    (newYmd: string) => {
      if (!newYmd) return;
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id ? { ...p, expires_at: newYmd } : p
        )
      );
      logEvent(
        'access · expiry',
        `Updated expiry date to ${newYmd}`,
        companyEmail || 'Company user'
      );
      setFlash({ type: 'ok', message: `Updated expiry date to ${newYmd}.` });
    },
    [activeProject.id, logEvent, companyEmail]
  );

  const handleToggleRevoke = useCallback(() => {
    const nextRevoked = activeProject.revoked_at
      ? null
      : new Date().toISOString();
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProject.id ? { ...p, revoked_at: nextRevoked } : p
      )
    );
    logEvent(
      'access · revoke',
      nextRevoked ? 'Turned off client access' : 'Restored client access',
      companyEmail || 'Company user'
    );
    setFlash({
      type: 'ok',
      message: nextRevoked ? 'Client access turned off.' : 'Client access restored.',
    });
  }, [activeProject.id, activeProject.revoked_at, logEvent, companyEmail]);

  const handleCreateProject = useCallback(
    (created: Project) => {
      setProjects((prev) => [created, ...prev]);
      setMilestonesByProject((prev) => ({
        ...prev,
        [created.id]: buildFreshProjectMilestones(created.id),
      }));
      setSelectedProjectId(created.id);
      logEvent(
        'project · created',
        `Created ${created.id} (${created.product_name} ${created.version})`,
        companyEmail || 'Company user'
      );
    },
    [logEvent, companyEmail]
  );

  const handleCompleteSignoff = useCallback(
    (issued: CertificateRecord) => {
      const fullRecord: CertificateRecord = {
        ...issued,
        project_id: activeProject.id,
        product_name: activeProject.product_name,
        version: activeProject.version,
        client_name: activeProject.client_name,
        owner_name: activeProject.owner_name,
      };
      setActiveCert(fullRecord);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === activeProject.id
            ? { ...p, signed_at: issued.signed_at, current_milestone: 'Signed off' }
            : p
        )
      );
      setCertificates((prev) => ({
        ...prev,
        [issued.verification_id]: fullRecord,
      }));
      logEvent(
        'project · signed',
        `Signed with certificate ${issued.verification_id}`,
        `${issued.signer_name} (${issued.signer_email})`,
        issued.ip
      );
      setFlash({
        type: 'ok',
        message: `Certificate ${issued.verification_id} issued.`,
      });
    },
    [activeProject, logEvent]
  );

  const showCompanyRail = ['company', 'new-project', 'project-detail'].includes(
    screen
  );

  return (
    <div data-theme={theme} className="gs-root flex flex-col">
      <style>{GRAPHITE_SIGNAL_CSS}</style>

      <TopBar
        screen={screen}
        onNavigate={setScreen}
        theme={theme}
        onToggleTheme={toggleTheme}
        companyEmail={companyEmail}
        onSignOut={() => {
          setCompanyEmail(null);
          setFlash({ type: 'ok', message: 'Signed out.' });
          setScreen('company-login');
        }}
        activeProject={activeProject}
      />

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className={showCompanyRail ? 'flex flex-col lg:flex-row gap-6 items-start' : ''}>
          {showCompanyRail && (
            <CompanyLeftRail screen={screen} onNavigate={setScreen} />
          )}

          <div className={showCompanyRail ? 'flex-1 min-w-0 w-full' : 'w-full'}>
            {screen === 'landing' && (
              <LandingScreen
                onNavigate={setScreen}
                companyEmail={companyEmail}
              />
            )}
            {screen === 'client-entry' && (
              <ClientEntryScreen
                projects={projects}
                onSelectProject={setSelectedProjectId}
                onNavigate={setScreen}
                onFlash={setFlash}
              />
            )}
            {screen === 'verify' && (
              <VerifyScreen certificates={certificates} />
            )}
            {screen === 'company-login' && (
              <CompanyLoginScreen
                onSignIn={(em) => {
                  setCompanyEmail(em);
                  setFlash({ type: 'ok', message: `Signed in as ${em}.` });
                }}
                onNavigate={setScreen}
              />
            )}
            {screen === 'company' && (
              <CompanyDashboardScreen
                projects={projects}
                milestonesByProject={milestonesByProject}
                onSelectProject={setSelectedProjectId}
                onNavigate={setScreen}
                onFlash={setFlash}
              />
            )}
            {screen === 'new-project' && (
              <NewProjectScreen
                projects={projects}
                onCreateProject={handleCreateProject}
                onNavigate={setScreen}
                onFlash={setFlash}
              />
            )}
            {screen === 'project-detail' && (
              <ProjectDetailScreen
                project={activeProject}
                milestones={activeMilestones}
                activity={activity}
                onSendFix={handleSendFix}
                onRotatePassword={handleRotatePassword}
                onUpdateExpiry={handleUpdateExpiry}
                onToggleRevoke={handleToggleRevoke}
                onOpenLightbox={setLightboxData}
                onNavigate={setScreen}
              />
            )}
            {screen === 'token-login' && (
              <TokenLoginScreen
                project={activeProject}
                onNavigate={setScreen}
                onFlash={setFlash}
              />
            )}
            {screen === 'tester-id' && (
              <TesterIdentityScreen
                project={activeProject}
                tester={tester}
                onSaveTester={setTester}
                onNavigate={setScreen}
              />
            )}
            {screen === 'portal' && (
              <ChecklistPortalScreen
                key={activeProject.id}
                project={activeProject}
                milestones={activeMilestones}
                tester={tester}
                onSaveResult={handleSaveResult}
                onAttachScreenshot={handleAttachScreenshot}
                onOpenLightbox={setLightboxData}
                onNavigate={setScreen}
                onFlash={setFlash}
              />
            )}
            {screen === 'signoff' && (
              <SignOffWizardScreen
                project={activeProject}
                milestones={activeMilestones}
                tester={tester}
                onCompleteSignoff={handleCompleteSignoff}
                onNavigate={setScreen}
              />
            )}
            {screen === 'certificate' && (
              <CertificateScreen
                project={activeProject}
                milestones={activeMilestones}
                certOverride={activeCertificate}
                onNavigate={setScreen}
              />
            )}
            {screen === 'closed' && (
              <ClosedBlockScreen
                project={activeProject}
                onNavigate={setScreen}
              />
            )}
            {screen === 'error' && (
              <ErrorStateScreen onNavigate={setScreen} />
            )}
          </div>
        </div>
      </main>

      <FooterBar
        onNavigate={setScreen}
        onOpenInspector={() => setInspectorOpen(true)}
      />

      <ComponentInspectorDrawer
        open={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        onNavigate={setScreen}
        onTriggerClosed={() => {
          setSelectedProjectId('UAT-SOLAR12');
          setScreen('closed');
        }}
      />

      <LightboxOverlay
        data={lightboxData}
        onClose={() => setLightboxData(null)}
      />
    </div>
  );
}