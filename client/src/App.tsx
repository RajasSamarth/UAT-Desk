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
  testedCount: number;
  failCount: number;
  retestCount: number;
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

interface ProjectSummary {
  id: string;
  token: string;
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
  current_milestone: string;
  status?: ProjectStatus;
  expired?: boolean;
  stats?: ProjectStats;
}

interface CertificateRecord {
  verification_id: string;
  project_id?: string;
  token?: string;
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
  signature_url?: string | null;
  pdf_url?: string | null;
  has_pdf_hash?: boolean;
  ip: string;
  record_hash: string;
  pdf_hash: string;
}

interface ProjectBundle {
  project: ProjectSummary;
  milestones: Milestone[];
  stats: ProjectStats;
  status: ProjectStatus;
  expired: boolean;
  signoff: CertificateRecord | null;
}

interface ActivityEvent {
  id: string;
  action: string;
  detail: string;
  actor: string;
  ip: string;
  timestamp: string;
}

interface FlashMessage {
  type: 'ok' | 'error';
  message: string;
}

interface TesterInfo {
  name: string;
  email: string;
}

interface CompanyUser {
  id: string;
  email: string;
  name: string;
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

interface ParsedRoute {
  screen: ScreenId;
  projectId?: string;
  token?: string;
  verifyId?: string;
  errorStatus?: '403' | '404' | '500';
}

interface ChecklistPreview {
  fileName: string;
  total: number;
  milestones: Array<{ name: string; count: number; required: number }>;
}

/**
 * ============================================================================
 * 1. GRAPHITE & SIGNAL DESIGN TOKENS & STYLES
 * ============================================================================
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

  .gs-scroll {
    scrollbar-width: thin;
    scrollbar-color: var(--line-strong) var(--surface-2);
  }
  .gs-scroll::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .gs-scroll::-webkit-scrollbar-track {
    background: var(--surface-2);
    border-radius: 9999px;
  }
  .gs-scroll::-webkit-scrollbar-thumb {
    background-color: var(--line-strong);
    border-radius: 9999px;
    border: 2px solid var(--surface-2);
  }
  .gs-scroll::-webkit-scrollbar-thumb:hover {
    background-color: var(--brand);
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

function readInitialTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore storage errors
  }
  return 'dark';
}

function getTodayCalendarYmd(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

function isProjectClosed(project: ProjectSummary | null | undefined): boolean {
  if (!project) return false;
  return Boolean(project.revoked_at) || project.expires_at < getTodayCalendarYmd();
}

function parseLocation(pathname: string, search: string): ParsedRoute {
  const path = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);

  if (path === '/') return { screen: 'landing' };
  if (path === '/client') return { screen: 'client-entry' };
  if (path === '/verify') {
    return { screen: 'verify', verifyId: params.get('id')?.trim().toUpperCase() || '' };
  }
  if (path === '/company/login') return { screen: 'company-login' };
  if (path === '/company') return { screen: 'company' };
  if (path === '/company/projects/new') return { screen: 'new-project' };

  const compMatch = /^\/company\/projects\/([^/]+)$/.exec(path);
  if (compMatch) {
    return { screen: 'project-detail', projectId: decodeURIComponent(compMatch[1]) };
  }

  const clientSubMatch = /^\/p\/([^/]+)\/(tester|portal|signoff|certificate)$/.exec(
    path
  );
  if (clientSubMatch) {
    const tok = decodeURIComponent(clientSubMatch[1]).toUpperCase();
    const sub = clientSubMatch[2];
    const map: Record<string, ScreenId> = {
      tester: 'tester-id',
      portal: 'portal',
      signoff: 'signoff',
      certificate: 'certificate',
    };
    return { screen: map[sub], token: tok };
  }

  const clientTokMatch = /^\/p\/([^/]+)$/.exec(path);
  if (clientTokMatch) {
    return {
      screen: 'token-login',
      token: decodeURIComponent(clientTokMatch[1]).toUpperCase(),
    };
  }

  return { screen: 'error', errorStatus: '404' };
}

function buildPathForRoute(route: ParsedRoute): string {
  switch (route.screen) {
    case 'landing':
      return '/';
    case 'client-entry':
      return '/client';
    case 'verify':
      return route.verifyId
        ? `/verify?id=${encodeURIComponent(route.verifyId)}`
        : '/verify';
    case 'company-login':
      return '/company/login';
    case 'company':
      return '/company';
    case 'new-project':
      return '/company/projects/new';
    case 'project-detail':
      return route.projectId
        ? `/company/projects/${encodeURIComponent(route.projectId)}`
        : '/company';
    case 'token-login':
      return route.token ? `/p/${encodeURIComponent(route.token)}` : '/client';
    case 'tester-id':
      return route.token ? `/p/${encodeURIComponent(route.token)}/tester` : '/client';
    case 'portal':
      return route.token ? `/p/${encodeURIComponent(route.token)}/portal` : '/client';
    case 'signoff':
      return route.token ? `/p/${encodeURIComponent(route.token)}/signoff` : '/client';
    case 'certificate':
      return route.token
        ? `/p/${encodeURIComponent(route.token)}/certificate`
        : '/verify';
    case 'closed':
      return route.token ? `/p/${encodeURIComponent(route.token)}` : '/client';
    default:
      return '/';
  }
}

/**
 * ============================================================================
 * 2. STATUS VOCABULARY & MILESTONE STATE HELPERS
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

function buildMilestoneStates(milestones: Milestone[]): MilestoneWithState[] {
  let priorTested = true;
  return milestones.map((ms, idx) => {
    const doneCount = ms.items.filter(
      (i) => i.status === 'pass' || i.status === 'na'
    ).length;
    const testedCount = ms.items.filter((i) => i.status !== null).length;
    const failCount = ms.items.filter((i) => i.status === 'fail').length;
    const retestCount = ms.items.filter((i) => i.status === 'retest').length;
    const complete = ms.items.length > 0 && doneCount === ms.items.length;
    const allTested = ms.items.length > 0 && testedCount === ms.items.length;
    const unlocked = priorTested;
    const state: MilestoneState = complete ? 'complete' : unlocked ? 'open' : 'locked';
    if (!allTested) priorTested = false;
    return {
      ...ms,
      index: idx,
      doneCount,
      testedCount,
      failCount,
      retestCount,
      totalCount: ms.items.length,
      complete,
      unlocked,
      state,
    };
  });
}

/**
 * ============================================================================
 * 3. GRAPHITE & SIGNAL CORE COMPONENTS
 * ============================================================================
 */
function BrandMark({ size = 36 }: { size?: number }) {
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
          <span className="gs-mono font-semibold truncate">{data.filename}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence lightbox"
            style={{
              backgroundColor: 'var(--surface-2)',
              color: 'var(--ink)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus p-1.5 cursor-pointer shrink-0"
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
  companyUser,
  onCompanySignOut,
  clientSession,
  onClientSignOut,
  activeProject,
}: {
  screen: ScreenId;
  onNavigate: (route: ParsedRoute) => void;
  theme: Theme;
  onToggleTheme: () => void;
  companyUser: CompanyUser | null;
  onCompanySignOut: () => void;
  clientSession: { token: string; tester: TesterInfo | null } | null;
  onClientSignOut: () => void;
  activeProject: ProjectSummary | null;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isCompanyScreen = [
    'company',
    'company-login',
    'new-project',
    'project-detail',
  ].includes(screen);
  const isClientScreen = [
    'portal',
    'signoff',
    'certificate',
    'token-login',
    'tester-id',
    'closed',
  ].includes(screen);

  const contextualSubtitle = useMemo(() => {
    if (isCompanyScreen) return 'company workspace';
    if (isClientScreen && activeProject) {
      return `${activeProject.product_name} ${activeProject.version}`;
    }
    if (screen === 'client-entry') return 'client testing portal';
    return 'acceptance testing and sign-off';
  }, [isCompanyScreen, isClientScreen, activeProject, screen]);

  const navItems: Array<{ id: ScreenId; label: string; route: ParsedRoute }> = [
    { id: 'company', label: 'Dashboard', route: { screen: companyUser ? 'company' : 'company-login' } },
    { id: 'new-project', label: 'New UAT project', route: { screen: companyUser ? 'new-project' : 'company-login' } },
    {
      id: 'portal',
      label: 'Client portal',
      route: clientSession?.token
        ? { screen: clientSession.tester ? 'portal' : 'tester-id', token: clientSession.token }
        : { screen: 'client-entry' },
    },
    { id: 'verify', label: 'Verify certificate', route: { screen: 'verify' } },
  ];

  const handleNav = (route: ParsedRoute) => {
    setMobileMenuOpen(false);
    onNavigate(route);
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
          onClick={() => handleNav({ screen: 'landing' })}
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
            const active =
              screen === item.id ||
              (item.id === 'portal' &&
                ['client-entry', 'token-login', 'tester-id'].includes(screen));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.route)}
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
          {isClientScreen && clientSession?.tester ? (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line)',
                  color: 'var(--ink-secondary)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="px-2.5 py-1 border font-semibold"
              >
                {clientSession.tester.name}
              </span>
              <button
                type="button"
                onClick={onClientSignOut}
                style={{ color: 'var(--muted)' }}
                className="gs-focus inline-flex items-center gap-1 font-semibold hover:underline cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          ) : companyUser ? (
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
                {companyUser.email}
              </span>
              <button
                type="button"
                onClick={onCompanySignOut}
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
              onClick={() => onNavigate({ screen: 'company-login' })}
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
                onClick={() => handleNav(item.route)}
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
            {companyUser ? (
              <>
                <span className="gs-mono" style={{ color: 'var(--ink-secondary)' }}>
                  {companyUser.email}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onCompanySignOut();
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
                onClick={() => handleNav({ screen: 'company-login' })}
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
  activeProjectId,
  onNavigate,
}: {
  screen: ScreenId;
  activeProjectId?: string;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const navItems: Array<{
    id: ScreenId;
    label: string;
    Icon: typeof LayoutDashboard;
    route: ParsedRoute;
    disabled?: boolean;
  }> = [
    { id: 'company', label: 'Dashboard', Icon: LayoutDashboard, route: { screen: 'company' } },
    { id: 'new-project', label: 'New UAT project', Icon: FolderPlus, route: { screen: 'new-project' } },
    {
      id: 'project-detail',
      label: 'Project detail',
      Icon: ChevronRight,
      route: { screen: 'project-detail', projectId: activeProjectId },
      disabled: !activeProjectId,
    },
    { id: 'verify', label: 'Verify certificate', Icon: ShieldCheck, route: { screen: 'verify' } },
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
        {navItems.map(({ id, label, Icon, route, disabled }) => {
          const active = screen === id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onNavigate(route)}
              style={{
                backgroundColor: active ? 'var(--brand-soft)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-secondary)',
                borderLeft: active
                  ? '3px solid var(--brand)'
                  : '3px solid transparent',
                borderRadius: 'var(--radius-sm)',
                opacity: disabled ? 0.45 : 1,
              }}
              className="gs-focus shrink-0 lg:w-full px-3 py-2 text-[13.5px] font-semibold flex items-center gap-2.5 text-left cursor-pointer disabled:cursor-not-allowed"
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

function FooterBar({ onNavigate }: { onNavigate: (route: ParsedRoute) => void }) {
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
          UAT Desk · server-side acceptance testing, sign-off and verification
        </div>
        <div className="flex flex-wrap items-center gap-4 font-semibold">
          <button
            type="button"
            onClick={() => onNavigate({ screen: 'client-entry' })}
            style={{ color: 'var(--ink-secondary)' }}
            className="gs-focus hover:underline cursor-pointer"
          >
            Client portal
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ screen: 'company' })}
            style={{ color: 'var(--ink-secondary)' }}
            className="gs-focus hover:underline cursor-pointer"
          >
            Company portal
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ screen: 'verify' })}
            style={{ color: 'var(--ink-secondary)' }}
            className="gs-focus hover:underline cursor-pointer"
          >
            Verify a certificate
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
  onNavigate: (route: ParsedRoute) => void;
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
              <li>Drawn or typed signature with server-generated PDF certificate</li>
            </ul>
          </div>
          <ActionButton
            variant="primary"
            fullWidth
            onClick={() => onNavigate({ screen: 'client-entry' })}
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
            onClick={() =>
              onNavigate({ screen: companyEmail ? 'company' : 'company-login' })
            }
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
        <ActionButton variant="ghost" onClick={() => onNavigate({ screen: 'verify' })}>
          Verify Certificate →
        </ActionButton>
      </SignalCard>
    </div>
  );
}

function ClientEntryScreen({
  apiFetch,
  onClientAuthed,
  onNavigate,
}: {
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onClientAuthed: (payload: {
    token: string;
    signed: boolean;
    bundle: ProjectBundle;
    csrfToken?: string;
  }) => void;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const [rawInput, setRawInput] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const extractedToken = useMemo(() => {
    const trimmed = rawInput.trim();
    const match = trimmed.match(/\/p\/([A-Za-z0-9_-]+)/i);
    return (match ? match[1] : trimmed).toUpperCase();
  }, [rawInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!extractedToken) {
      setError('Enter a Project ID or paste your invitation link.');
      return;
    }
    if (!password) {
      setError('Enter the password from your invitation.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiFetch<{
        ok: boolean;
        token: string;
        signed: boolean;
        csrfToken?: string;
        bundle: ProjectBundle;
      }>('/api/client/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: rawInput, password }),
      });
      onClientAuthed(data);
    } catch (err) {
      const eObj = err as Error & { blockedReason?: string; project?: ProjectSummary };
      if (eObj.blockedReason && eObj.project) {
        onNavigate({ screen: 'closed', token: eObj.project.token });
        return;
      }
      setError(eObj.message || 'Unable to open checklist.');
    } finally {
      setSubmitting(false);
    }
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

        <ActionButton type="submit" variant="primary" fullWidth disabled={submitting}>
          {submitting ? 'Checking…' : 'Open checklist'}
        </ActionButton>
      </form>

      <div className="text-center text-[13.5px]">
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'company-login' })}
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
  initialId,
  apiFetch,
}: {
  initialId?: string;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
}) {
  const [inputId, setInputId] = useState(initialId || '');
  const [checkedId, setCheckedId] = useState(initialId || '');
  const [loading, setLoading] = useState(false);
  const [cert, setCert] = useState<CertificateRecord | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState('');
  const [pdfChecking, setPdfChecking] = useState(false);
  const [pdfResult, setPdfResult] = useState<'idle' | 'match' | 'mismatch' | 'none'>('idle');
  const [computedHash, setComputedHash] = useState<string | null>(null);

  const runLookup = useCallback(
    async (idToCheck: string) => {
      const clean = idToCheck.trim().toUpperCase();
      setCheckedId(clean);
      setPdfFile(null);
      setPdfError('');
      setPdfResult('idle');
      setComputedHash(null);
      if (!clean) {
        setCert(null);
        setNotFound(false);
        return;
      }
      setLoading(true);
      setLookupError('');
      try {
        const res = await apiFetch<{
          ok: boolean;
          found: boolean;
          cert: CertificateRecord | null;
        }>(`/api/verify?id=${encodeURIComponent(clean)}`);
        setCert(res.cert);
        setNotFound(!res.found);
      } catch (err) {
        setLookupError((err as Error).message || 'Verification failed.');
        setCert(null);
      } finally {
        setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    if (initialId) {
      setInputId(initialId);
      void runLookup(initialId);
    }
  }, [initialId, runLookup]);

  const onCheckId = (e: React.FormEvent) => {
    e.preventDefault();
    void runLookup(inputId);
  };

  const onSelectPdf = async (file: File | null) => {
    setPdfError('');
    setComputedHash(null);
    if (!file) {
      setPdfFile(null);
      setPdfResult('idle');
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
    setPdfChecking(true);
    try {
      const form = new FormData();
      form.append('verificationId', checkedId);
      form.append('pdf', file);
      const res = await apiFetch<{
        ok: boolean;
        fileCheck: 'match' | 'mismatch' | 'none';
        computedHash: string | null;
      }>('/api/verify/pdf', { method: 'POST', body: form });
      setPdfResult(res.fileCheck);
      setComputedHash(res.computedHash);
    } catch (err) {
      setPdfError((err as Error).message || 'Unable to verify PDF.');
    } finally {
      setPdfChecking(false);
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
            <ActionButton type="submit" variant="primary" disabled={loading}>
              <Search className="w-4 h-4" />
              <span>{loading ? 'Checking…' : 'Check certificate'}</span>
            </ActionButton>
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

      {lookupError && (
        <NoticeBanner tone="error" title="Verification error">
          {lookupError}
        </NoticeBanner>
      )}

      {checkedId && cert && (
        <SignalCard className="space-y-5">
          <div>
            <StatusChip label="Valid certificate" tone="ok" />
            <h2 className="text-[22px] font-bold mt-2">
              {cert.product_name} {cert.version}
            </h2>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              Signed for <strong>{cert.client_name}</strong> on{' '}
              <span className="gs-mono">{String(cert.signed_at).slice(0, 10)}</span>
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
              <div className="gs-mono font-bold">{cert.token || cert.project_id}</div>
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
            <h3 className="text-[18px] font-semibold">Check certificate PDF</h3>

            <div className="flex flex-wrap items-center gap-3">
              <label
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus inline-flex items-center gap-2 px-4 py-2 min-h-[44px] text-[14px] font-semibold border cursor-pointer hover:opacity-90"
              >
                <Upload className="w-4 h-4 shrink-0" style={{ color: 'var(--brand)' }} />
                <span>{pdfFile ? 'Choose another PDF' : 'Choose PDF file'}</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  aria-label="Certificate PDF file"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] || null;
                    e.target.value = '';
                    void onSelectPdf(selected);
                  }}
                  className="sr-only"
                />
              </label>
              <span className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
                {pdfFile
                  ? `${pdfFile.name} (${Math.max(1, Math.round(pdfFile.size / 1024))} KB)`
                  : 'No PDF selected'}
              </span>
            </div>

            {computedHash && (
              <div className="text-xs gs-mono break-all" style={{ color: 'var(--muted)' }}>
                PDF SHA-256: {computedHash}
              </div>
            )}

            {pdfChecking && (
              <NoticeBanner tone="info" title="Checking PDF…">
                Computing SHA-256 digest on server.
              </NoticeBanner>
            )}

            {pdfError && (
              <NoticeBanner tone="error" title="PDF check error">
                {pdfError}
              </NoticeBanner>
            )}

            {!pdfChecking && !pdfError && pdfResult === 'idle' && (
              <NoticeBanner tone="info" title="Upload PDF to verify">
                Select a downloaded certificate PDF above to compare its SHA-256
                digest against the stored fingerprint.
              </NoticeBanner>
            )}
            {!pdfChecking && !pdfError && pdfResult === 'match' && (
              <NoticeBanner tone="ok" title="Matches SHA-256 fingerprint">
                {pdfFile ? `${pdfFile.name} — ` : ''}PDF digest matches stored
                certificate hash.
              </NoticeBanner>
            )}
            {!pdfChecking && !pdfError && pdfResult === 'mismatch' && (
              <NoticeBanner tone="error" title="Does not match SHA-256 fingerprint">
                {pdfFile ? `${pdfFile.name} — ` : ''}PDF hash differs from the
                stored certificate record.
              </NoticeBanner>
            )}
            {!pdfChecking && !pdfError && pdfResult === 'none' && (
              <NoticeBanner tone="info" title="No fingerprint stored">
                No PDF SHA-256 fingerprint is stored on this record.
              </NoticeBanner>
            )}
          </div>
        </SignalCard>
      )}

      {checkedId && !loading && notFound && (
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
  apiFetch,
  onSignedIn,
  onNavigate,
}: {
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onSignedIn: (user: CompanyUser, csrfToken?: string) => void;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        user: CompanyUser;
        csrfToken?: string;
      }>('/api/company/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      onSignedIn(res.user, res.csrfToken);
    } catch (err) {
      setError((err as Error).message || 'That email and password do not match.');
    } finally {
      setSubmitting(false);
    }
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
            placeholder="admin@uatdesk.local"
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

        <ActionButton type="submit" variant="primary" fullWidth disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </ActionButton>
      </form>

      <div className="text-center text-[13.5px]">
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'client-entry' })}
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
  apiFetch,
  onNavigate,
}: {
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [stats, setStats] = useState({
    inTesting: 0,
    itemsToFix: 0,
    waitingSignoff: 0,
    signedOff: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{
        ok: boolean;
        projects: ProjectSummary[];
        stats: {
          inTesting: number;
          itemsToFix: number;
          waitingSignoff: number;
          signedOff: number;
        };
      }>('/api/company/projects');
      setProjects(res.projects);
      setStats(res.stats);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        onNavigate({ screen: 'company-login' });
        return;
      }
      setError(e.message || 'Could not load UAT projects.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, onNavigate]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

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
          <a
            href="/company/template.xlsx"
            style={{
              backgroundColor: 'var(--surface-2)',
              color: 'var(--ink)',
              borderColor: 'var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus inline-flex items-center justify-center gap-2 font-semibold border min-h-[44px] px-4 py-2 text-[15px]"
          >
            <Download className="w-4 h-4" />
            <span>Checklist template</span>
          </a>
          <ActionButton
            variant="primary"
            onClick={() => onNavigate({ screen: 'new-project' })}
          >
            <FolderPlus className="w-4 h-4" />
            <span>New UAT project</span>
          </ActionButton>
        </div>
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

      {loading && (
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

      {!loading && error && (
        <SignalCard className="space-y-3">
          <NoticeBanner tone="error" title="Could not load UAT projects">
            {error}
          </NoticeBanner>
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => void loadDashboard()}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </ActionButton>
        </SignalCard>
      )}

      {!loading && !error && projects.length === 0 && (
        <SignalCard className="text-center py-10 space-y-3">
          <h2 className="text-[20px] font-bold">No UAT projects yet</h2>
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            Create a project with a release checklist to generate a client
            testing link.
          </p>
          <ActionButton
            variant="primary"
            onClick={() => onNavigate({ screen: 'new-project' })}
          >
            Create the first project
          </ActionButton>
        </SignalCard>
      )}

      {!loading && !error && projects.length > 0 && (
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
                  {projects.map((row) => {
                    const rowStatus = row.status || 'not-started';
                    const meta = PROJECT_STATUS_MAP[rowStatus];
                    const rowStats = row.stats || {
                      total: 0,
                      done: 0,
                      na: 0,
                      fail: 0,
                      retest: 0,
                      tested: 0,
                    };
                    return (
                      <tr
                        key={row.id}
                        style={{ borderBottom: '1px solid var(--line)' }}
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate({ screen: 'project-detail', projectId: row.id })
                            }
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
                            {row.token}
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
                              current={rowStats.done}
                              total={rowStats.total}
                              size={38}
                            />
                            <div className="text-xs">
                              <div style={{ color: 'var(--ink-secondary)' }}>
                                {rowStats.done} of {rowStats.total} passed or N/A
                              </div>
                              {rowStats.fail > 0 && (
                                <span
                                  className="font-semibold"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  {rowStats.fail} failed
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
                            onClick={() =>
                              onNavigate({ screen: 'project-detail', projectId: row.id })
                            }
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
            {projects.map((row) => {
              const rowStatus = row.status || 'not-started';
              const meta = PROJECT_STATUS_MAP[rowStatus];
              const rowStats = row.stats || {
                total: 0,
                done: 0,
                na: 0,
                fail: 0,
                retest: 0,
                tested: 0,
              };
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
                        {row.token} · {row.client_name}
                      </div>
                    </div>
                    <StatusChip label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <ProgressRing
                      current={rowStats.done}
                      total={rowStats.total}
                      size={34}
                    />
                    <span style={{ color: 'var(--ink-secondary)' }}>
                      {rowStats.done} of {rowStats.total} passed or N/A
                    </span>
                    {rowStats.fail > 0 && (
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--danger)' }}
                      >
                        {rowStats.fail} failed
                      </span>
                    )}
                  </div>
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    fullWidth
                    onClick={() =>
                      onNavigate({ screen: 'project-detail', projectId: row.id })
                    }
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
  apiFetch,
  onCreated,
  onNavigate,
  onFlash,
}: {
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onCreated: (payload: {
    projectId: string;
    bundle: ProjectBundle;
    activity: ActivityEvent[];
    oneTimePassword: string;
    invite: string;
  }) => void;
  onNavigate: (route: ParsedRoute) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [productMode, setProductMode] = useState<'existing' | 'new'>('new');
  const [productId, setProductId] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const [version, setVersion] = useState('v1.0');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [clientId, setClientId] = useState('');
  const [newClient, setNewClient] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [checklistFile, setChecklistFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ChecklistPreview | null>(null);
  const [checklistErrors, setChecklistErrors] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const meta = await apiFetch<{
          ok: boolean;
          products: Array<{ id: string; name: string }>;
          clients: Array<{ id: string; name: string }>;
          defaults: { ownerName: string; ownerEmail: string; expiry: string };
        }>('/api/company/new-project-meta');
        if (!active) return;
        setProducts(meta.products);
        setClients(meta.clients);
        if (meta.products.length) {
          setProductMode('existing');
          setProductId(meta.products[0].id);
        }
        if (meta.clients.length) {
          setClientMode('existing');
          setClientId(meta.clients[0].id);
        }
        setOwnerName(meta.defaults.ownerName || '');
        setOwnerEmail(meta.defaults.ownerEmail || '');
        setExpiresAt(meta.defaults.expiry || '');
      } catch (err) {
        const e = err as Error & { status?: number };
        if (e.status === 401) onNavigate({ screen: 'company-login' });
      }
    })();
    return () => {
      active = false;
    };
  }, [apiFetch, onNavigate]);

  const handleFile = async (file: File | null) => {
    setChecklistFile(file);
    setPreview(null);
    setChecklistErrors([]);
    if (!file) return;

    const validExt =
      file.name.toLowerCase().endsWith('.xlsx') ||
      file.name.toLowerCase().endsWith('.csv');
    if (!validExt) {
      setChecklistErrors(['Checklist file must be .xlsx or .csv.']);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setChecklistErrors(['Checklist file exceeds the 4 MB upload limit.']);
      return;
    }

    const form = new FormData();
    form.append('checklist', file);
    try {
      const res = await apiFetch<{
        ok: boolean;
        fileName: string;
        total: number;
        milestones: Array<{ name: string; count: number; required: number }>;
      }>('/api/company/projects/preview', {
        method: 'POST',
        body: form,
      });
      setPreview({
        fileName: res.fileName,
        total: res.total,
        milestones: res.milestones,
      });
    } catch (err) {
      const e = err as Error & { errors?: string[] };
      setChecklistErrors(
        e.errors && e.errors.length ? e.errors : [e.message || 'Invalid checklist file.']
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const form = new FormData();
    form.append('productMode', productMode);
    form.append('productId', productId);
    form.append('newProduct', newProduct);
    form.append('clientMode', clientMode);
    form.append('clientId', clientId);
    form.append('newClient', newClient);
    form.append('version', version);
    form.append('ownerName', ownerName);
    form.append('ownerEmail', ownerEmail);
    form.append('expiry', expiresAt);
    if (checklistFile) {
      form.append('checklist', checklistFile);
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        projectId: string;
        bundle: ProjectBundle;
        activity: ActivityEvent[];
        oneTimePassword: string;
        invite: string;
      }>('/api/company/projects', {
        method: 'POST',
        body: form,
      });
      onFlash({
        type: 'ok',
        message: 'Project created. Copy the password now — it is shown once.',
      });
      onCreated(res);
    } catch (err) {
      const eObj = err as Error & { errors?: string[]; checklistErrors?: string[] };
      if (eObj.errors && eObj.errors.length) setErrors(eObj.errors);
      else if (eObj.message) setErrors([eObj.message]);
      if (eObj.checklistErrors && eObj.checklistErrors.length) {
        setChecklistErrors(eObj.checklistErrors);
      }
    } finally {
      setSubmitting(false);
    }
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
          <a
            href="/company/template.xlsx"
            style={{
              backgroundColor: 'var(--surface-2)',
              color: 'var(--ink)',
              borderColor: 'var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus inline-flex items-center justify-center gap-2 font-semibold border min-h-[36px] px-3 py-1.5 text-[13.5px]"
          >
            Download .xlsx template
          </a>
          <a
            href="/company/template.csv"
            style={{
              backgroundColor: 'var(--surface-2)',
              color: 'var(--ink)',
              borderColor: 'var(--line)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="gs-focus inline-flex items-center justify-center gap-2 font-semibold border min-h-[36px] px-3 py-1.5 text-[13.5px]"
          >
            Download .csv template
          </a>
        </div>
      </div>

      {errors.length > 0 && (
        <NoticeBanner
          tone="error"
          title="Check project fields before creating"
          items={errors}
        />
      )}

      {checklistErrors.length > 0 && (
        <NoticeBanner
          tone="error"
          title="The checklist was not accepted"
          items={checklistErrors}
        />
      )}

      {preview && checklistErrors.length === 0 && (
        <NoticeBanner
          tone="ok"
          title={`Checklist read successfully from ${preview.fileName}`}
        >
          {preview.total} items across {preview.milestones.length} milestones:{' '}
          {preview.milestones
            .map((m) => `${m.name} — ${m.count} items (${m.required} required)`)
            .join(', ')}.
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
                      disabled={opt.id === 'existing' && products.length === 0}
                      onClick={() => setProductMode(opt.id)}
                      style={{
                        backgroundColor:
                          productMode === opt.id ? 'var(--brand)' : 'var(--surface-2)',
                        color:
                          productMode === opt.id ? '#ffffff' : 'var(--ink-secondary)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      className="gs-focus px-2.5 py-1 font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {productMode === 'existing' && products.length > 0 ? (
                <select
                  aria-label="Existing product"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                >
                  {products.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="New product name"
                  value={newProduct}
                  onChange={(e) => setNewProduct(e.target.value)}
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
                      disabled={opt.id === 'existing' && clients.length === 0}
                      onClick={() => setClientMode(opt.id)}
                      style={{
                        backgroundColor:
                          clientMode === opt.id ? 'var(--brand)' : 'var(--surface-2)',
                        color:
                          clientMode === opt.id ? '#ffffff' : 'var(--ink-secondary)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      className="gs-focus px-2.5 py-1 font-semibold cursor-pointer disabled:opacity-45"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              {clientMode === 'existing' && clients.length > 0 ? (
                <select
                  aria-label="Existing client"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--line-strong)',
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="gs-focus w-full px-3 py-2.5 border min-h-[44px]"
                >
                  {clients.map((cli) => (
                    <option key={cli.id} value={cli.id}>
                      {cli.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="New client name"
                  value={newClient}
                  onChange={(e) => setNewClient(e.target.value)}
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
                borderColor: preview ? 'var(--brand)' : 'var(--line-strong)',
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
                  {checklistFile
                    ? `${checklistFile.name} (${Math.max(
                        1,
                        Math.round(checklistFile.size / 1024)
                      )} KB)`
                    : 'No file selected'}
                </span>
              </div>
              <label
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--line-strong)',
                  color: 'var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                }}
                className="gs-focus inline-flex items-center gap-2 px-3 py-2 min-h-[38px] text-xs font-semibold border cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
                <span>{checklistFile ? 'Replace checklist file' : 'Choose checklist file'}</span>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  aria-label="Checklist file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    e.target.value = '';
                    void handleFile(f);
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Generated client password is shown once after creation; link can be
              rotated or turned off anytime.
            </p>
          </SignalCard>
        </div>

        <div className="flex flex-wrap justify-end gap-2.5">
          <ActionButton variant="ghost" onClick={() => onNavigate({ screen: 'company' })}>
            Cancel
          </ActionButton>
          <ActionButton type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? 'Creating project…'
              : 'Create project and generate the client link'}
          </ActionButton>
        </div>
      </form>
    </div>
  );
}

function ProjectDetailScreen({
  projectId,
  initialCreated,
  onClearInitialCreated,
  apiFetch,
  onOpenLightbox,
  onNavigate,
  onFlash,
}: {
  projectId: string;
  initialCreated: {
    projectId: string;
    bundle: ProjectBundle;
    activity: ActivityEvent[];
    oneTimePassword: string;
    invite: string;
  } | null;
  onClearInitialCreated: () => void;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onOpenLightbox: (data: LightboxData) => void;
  onNavigate: (route: ParsedRoute) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const [bundle, setBundle] = useState<ProjectBundle | null>(
    initialCreated && initialCreated.projectId === projectId ? initialCreated.bundle : null
  );
  const [activity, setActivity] = useState<ActivityEvent[]>(
    initialCreated && initialCreated.projectId === projectId ? initialCreated.activity : []
  );
  const [oneTimePassword, setOneTimePassword] = useState<string | null>(
    initialCreated && initialCreated.projectId === projectId
      ? initialCreated.oneTimePassword
      : null
  );
  const [invite, setInvite] = useState<string | null>(
    initialCreated && initialCreated.projectId === projectId ? initialCreated.invite : null
  );
  const [loading, setLoading] = useState(!bundle);
  const [error, setError] = useState('');
  const [fixDrafts, setFixDrafts] = useState<Record<string, string>>({});
  const [fixErrors, setFixErrors] = useState<Record<string, string>>({});
  const [expiryVal, setExpiryVal] = useState(bundle?.project.expires_at || '');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const clearInitialCreatedRef = useRef(onClearInitialCreated);
  clearInitialCreatedRef.current = onClearInitialCreated;
  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;
  const initialCreatedRef = useRef(initialCreated);
  initialCreatedRef.current = initialCreated;

  useEffect(() => {
    const created = initialCreatedRef.current;
    if (created && created.projectId === projectId) {
      setBundle(created.bundle);
      setActivity(created.activity);
      setOneTimePassword(created.oneTimePassword);
      setInvite(created.invite);
      setExpiryVal(created.bundle.project.expires_at);
      setLoading(false);
      clearInitialCreatedRef.current();
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    setFixDrafts({});
    setFixErrors({});
    void (async () => {
      try {
        const res = await apiFetch<{
          ok: boolean;
          bundle: ProjectBundle;
          activity: ActivityEvent[];
          oneTimePassword: string | null;
          invite: string | null;
        }>(`/api/company/projects/${encodeURIComponent(projectId)}`);
        if (!active) return;
        setBundle(res.bundle);
        setActivity(res.activity);
        setOneTimePassword(res.oneTimePassword);
        setInvite(res.invite);
        setExpiryVal(res.bundle.project.expires_at);
      } catch (err) {
        const e = err as Error & { status?: number };
        if (e.status === 401) {
          onNavigateRef.current({ screen: 'company-login' });
          return;
        }
        if (active) setError(e.message || 'Project not found.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [projectId, apiFetch]);

  if (loading) {
    return (
      <SignalCard className="space-y-3">
        <div
          className="h-6 w-56 rounded animate-pulse"
          style={{ backgroundColor: 'var(--surface-3)' }}
        />
        <div
          className="h-24 w-full rounded animate-pulse"
          style={{ backgroundColor: 'var(--surface-2)' }}
        />
      </SignalCard>
    );
  }

  if (error || !bundle) {
    return (
      <SignalCard className="space-y-3">
        <NoticeBanner tone="error" title="Unable to open project">
          {error || 'Project could not be loaded.'}
        </NoticeBanner>
        <ActionButton variant="ghost" onClick={() => onNavigate({ screen: 'company' })}>
          ← Back to dashboard
        </ActionButton>
      </SignalCard>
    );
  }

  const { project, milestones, stats, status } = bundle;
  const stMeta = PROJECT_STATUS_MAP[status];
  const msList = buildMilestoneStates(milestones);
  const clientUrl = `${window.location.origin}/p/${project.token}`;

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

  const runConfirmed = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    setConfirmAction(null);
    try {
      if (action.type === 'fix' && action.itemId && action.note) {
        const res = await apiFetch<{
          ok: boolean;
          code: string;
          bundle: ProjectBundle;
          activity: ActivityEvent[];
        }>(
          `/api/company/projects/${encodeURIComponent(project.id)}/items/${encodeURIComponent(
            action.itemId
          )}/fix`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fixNote: action.note }),
          }
        );
        setBundle(res.bundle);
        setActivity(res.activity);
        onFlash({ type: 'ok', message: `${res.code} sent to client for retest.` });
      } else if (action.type === 'rotate') {
        const res = await apiFetch<{
          ok: boolean;
          oneTimePassword: string;
          invite: string;
          activity: ActivityEvent[];
        }>(`/api/company/projects/${encodeURIComponent(project.id)}/password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        setOneTimePassword(res.oneTimePassword);
        setInvite(res.invite);
        setActivity(res.activity);
        onFlash({
          type: 'ok',
          message: 'New password generated. Copy it now — it is shown once.',
        });
      } else if (action.type === 'revoke') {
        const res = await apiFetch<{
          ok: boolean;
          revoked: boolean;
          bundle: ProjectBundle;
          activity: ActivityEvent[];
        }>(`/api/company/projects/${encodeURIComponent(project.id)}/revoke`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        setBundle(res.bundle);
        setActivity(res.activity);
        onFlash({
          type: 'ok',
          message: res.revoked
            ? 'Client access turned off.'
            : 'Client access restored.',
        });
      }
    } catch (err) {
      onFlash({ type: 'error', message: (err as Error).message || 'Action failed.' });
    }
  };

  const handleUpdateExpiry = async () => {
    try {
      const res = await apiFetch<{
        ok: boolean;
        bundle: ProjectBundle;
        activity: ActivityEvent[];
      }>(`/api/company/projects/${encodeURIComponent(project.id)}/expiry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiry: expiryVal }),
      });
      setBundle(res.bundle);
      setActivity(res.activity);
      onFlash({ type: 'ok', message: `End date updated to ${expiryVal}.` });
    } catch (err) {
      onFlash({
        type: 'error',
        message: (err as Error).message || 'Could not update end date.',
      });
    }
  };

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
            <span className="gs-mono">{project.checklist_filename}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <StatusChip label={stMeta.label} tone={stMeta.tone} />
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => onNavigate({ screen: 'token-login', token: project.token })}
          >
            Open client link
          </ActionButton>
          {bundle.signoff?.pdf_url && (
            <a
              href={bundle.signoff.pdf_url}
              style={{
                backgroundColor: 'var(--surface-2)',
                color: 'var(--ink)',
                borderColor: 'var(--line)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="gs-focus inline-flex items-center justify-center gap-2 font-semibold border min-h-[36px] px-3 py-1.5 text-[13.5px]"
            >
              <Download className="w-4 h-4" />
              <span>Certificate PDF</span>
            </a>
          )}
        </div>
      </div>

      {oneTimePassword && (
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
            <CopyBlock label="Link" value={clientUrl} />
            <CopyBlock label="Project ID" value={project.token} />
            <CopyBlock label="Password" value={oneTimePassword} />
          </div>
          {invite && (
            <CopyBlock
              label="Invitation text"
              value={invite}
              mono={false}
              multiline
            />
          )}
        </SignalCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:items-stretch gap-6 items-start lg:h-[calc(100vh-15rem)] lg:min-h-[360px]">
        <div className="lg:col-span-8 lg:min-h-0 lg:h-full flex flex-col gap-4">
          <SignalCard className="flex flex-wrap items-center justify-between gap-4 shrink-0">
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

          <div
            aria-label="Project milestones"
            className="space-y-4 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2 lg:pb-2 gs-scroll"
          >
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
                              placeholder="Describe the fix before sending back for retest."
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
        </div>

        <div className="lg:col-span-4 lg:min-h-0 lg:h-full space-y-6 lg:overflow-y-auto lg:pr-1 lg:pb-2 gs-scroll">
          <SignalCard className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">Access controls</h2>
              <StatusChip label={stMeta.label} tone={stMeta.tone} />
            </div>

            <div className="space-y-1 text-[13.5px]">
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted)' }}>Project ID</span>
                <span className="gs-mono font-bold">{project.token}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--muted)' }}>Available until</span>
                <span className="gs-mono">{project.expires_at}</span>
              </div>
            </div>

            <CopyBlock label="Client link" value={clientUrl} />

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

              {oneTimePassword && (
                <div
                  style={{
                    backgroundColor: 'var(--warn-soft)',
                    borderColor: 'var(--warn-border)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                  className="border p-3 space-y-2"
                >
                  <div
                    className="text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: 'var(--warn)' }}
                  >
                    New password (shown once)
                  </div>
                  <CopyBlock label="Generated password" value={oneTimePassword} />
                </div>
              )}

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
                    onClick={() => void handleUpdateExpiry()}
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
              <ul className="space-y-2.5 text-xs max-h-96 overflow-y-auto pr-1 gs-scroll">
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
                    {ev.detail && <div>{ev.detail}</div>}
                    <div style={{ color: 'var(--muted)' }}>
                      {ev.actor} {ev.ip ? `· ${ev.ip}` : ''}
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
        onConfirm={() => void runConfirmed()}
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
  reason,
  onNavigate,
}: {
  project: ProjectSummary | null;
  reason?: string | null;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const revoked = reason === 'revoked' || Boolean(project?.revoked_at);
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
            ? `Access for this UAT checklist was turned off${
                project ? ` by ${project.owner_name}` : ''
              }.`
            : `This link stayed available until ${
                project?.expires_at || 'the expiry date'
              }.${project ? ` Contact ${project.owner_name} for assistance.` : ''}`}
        </p>
        {project && (
          <div className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
            Project ID {project.token} · {project.client_name}
          </div>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <ActionButton variant="ghost" onClick={() => onNavigate({ screen: 'landing' })}>
            Go to start page
          </ActionButton>
          <ActionButton variant="primary" onClick={() => onNavigate({ screen: 'verify' })}>
            Verify a certificate
          </ActionButton>
        </div>
      </SignalCard>
    </div>
  );
}

function TokenLoginScreen({
  token,
  project,
  apiFetch,
  onAuthed,
  onNavigate,
}: {
  token: string;
  project: ProjectSummary | null;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onAuthed: (payload: {
    token: string;
    signed: boolean;
    bundle: ProjectBundle;
    csrfToken?: string;
  }) => void;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (project && isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pass) {
      setErr('Enter the password from your invitation.');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        token: string;
        signed: boolean;
        csrfToken?: string;
        bundle: ProjectBundle;
      }>(`/api/p/${encodeURIComponent(token)}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pass }),
      });
      onAuthed(res);
    } catch (errorObj) {
      setErr((errorObj as Error).message || 'That password did not match.');
    } finally {
      setSubmitting(false);
    }
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
          {project ? `${project.product_name} ${project.version}` : token}
        </h1>
        {project && (
          <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
            Prepared for <strong>{project.client_name}</strong> by{' '}
            {project.owner_name}.
          </p>
        )}
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

        <ActionButton type="submit" variant="primary" fullWidth disabled={submitting}>
          {submitting ? 'Opening…' : 'Open the checklist'}
        </ActionButton>
      </form>

      {project && (
        <div style={{ borderTop: '1px solid var(--line)' }} className="pt-4 space-y-1.5 text-[13.5px]">
          <div className="flex justify-between">
            <span style={{ color: 'var(--muted)' }}>Project ID</span>
            <span className="gs-mono font-bold">{project.token}</span>
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
      )}

      <div className="flex justify-between text-[13.5px]">
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'client-entry' })}
          style={{ color: 'var(--ink-secondary)' }}
          className="gs-focus hover:underline cursor-pointer"
        >
          ← Switch Project ID
        </button>
        <button
          type="button"
          onClick={() => onNavigate({ screen: 'company-login' })}
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
  token,
  project,
  tester,
  apiFetch,
  onSaved,
  onNavigate,
}: {
  token: string;
  project: ProjectSummary;
  tester: TesterInfo | null;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onSaved: (t: TesterInfo) => void;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const [name, setName] = useState(tester?.name || '');
  const [email, setEmail] = useState(tester?.email || '');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.includes('@')) {
      setErr('Enter your full name and a valid work email.');
      return;
    }
    setErr('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; tester: TesterInfo }>(
        `/api/p/${encodeURIComponent(token)}/tester`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        }
      );
      onSaved(res.tester);
      onNavigate({ screen: 'portal', token });
    } catch (errorObj) {
      setErr((errorObj as Error).message || 'Could not save tester details.');
    } finally {
      setSubmitting(false);
    }
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

        <ActionButton type="submit" variant="primary" fullWidth disabled={submitting}>
          {submitting ? 'Starting…' : 'Start testing'}
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
  token,
  bundle,
  apiFetch,
  onBundleUpdate,
  onOpenLightbox,
  onNavigate,
  onFlash,
}: {
  token: string;
  bundle: ProjectBundle;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onBundleUpdate: (next: ProjectBundle) => void;
  onOpenLightbox: (data: LightboxData) => void;
  onNavigate: (route: ParsedRoute) => void;
  onFlash: (f: FlashMessage) => void;
}) {
  const { project, milestones, stats } = bundle;
  const msStates = useMemo(
    () => buildMilestoneStates(milestones),
    [milestones]
  );
  const defaultMsId =
    msStates.find(
      (m) => m.unlocked && m.items.some((i) => i.status === null || i.status === 'retest')
    )?.id ||
    msStates.find((m) => m.state === 'open')?.id ||
    msStates[0]?.id ||
    '';

  const [selectedMsId, setSelectedMsId] = useState<string>(defaultMsId);
  const [statusMessage, setStatusMessage] = useState(
    'Results save automatically on selection.'
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failAlert, setFailAlert] = useState<Record<string, string>>({});
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingQueueRef = useRef<
    Record<string, { item: ChecklistItem; status: ItemStatus; comment: string }>
  >({});
  const savingRef = useRef(false);

  useEffect(() => {
    setNotes({});
    setFailAlert({});
    setSelectedMsId(defaultMsId);
  }, [project.id]);

  useEffect(() => {
    return () => {
      Object.values(debounceTimerRef.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  const activeMs = useMemo(() => {
    const picked = msStates.find((m) => m.id === selectedMsId);
    if (picked && picked.unlocked) return picked;
    return msStates.find((m) => m.state === 'open') || msStates[0];
  }, [msStates, selectedMsId]);

  const selectMilestone = (id: string) => {
    setSelectedMsId(id);
    rightScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const allDone = stats.total > 0 && stats.done === stats.total;

  const saveResultRequest = useCallback(
    async (item: ChecklistItem, choice: ItemStatus, commentVal: string) => {
      const res = await apiFetch<{ ok: boolean; bundle: ProjectBundle }>(
        `/api/p/${encodeURIComponent(token)}/items/${encodeURIComponent(item.id)}/result`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: choice, comment: commentVal }),
        }
      );
      onBundleUpdate(res.bundle);
    },
    [apiFetch, onBundleUpdate, token]
  );

  const flushSave = useCallback(
    async (item: ChecklistItem, choice: ItemStatus, commentVal: string) => {
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

      if (savingRef.current) {
        pendingQueueRef.current[item.id] = { item, status: choice, comment: commentVal };
        return;
      }

      savingRef.current = true;
      setStatusMessage('Saving…');

      try {
        await saveResultRequest(item, choice, commentVal);
        while (Object.keys(pendingQueueRef.current).length > 0) {
          const entries = Object.values(pendingQueueRef.current);
          pendingQueueRef.current = {};
          for (const q of entries) {
            await saveResultRequest(q.item, q.status, q.comment);
          }
        }
        setStatusMessage('Saved');
      } catch (err) {
        const msg = (err as Error).message || 'Failed to save result.';
        setFailAlert((prev) => ({ ...prev, [item.id]: msg }));
        setStatusMessage(msg);
      } finally {
        savingRef.current = false;
      }
    },
    [project.signed_at, saveResultRequest]
  );

  const handleUploadScreenshot = async (item: ChecklistItem, file: File) => {
    const isImg =
      file.type === 'image/png' ||
      file.type === 'image/jpeg' ||
      /\.(png|jpe?g)$/i.test(file.name);
    if (!isImg) {
      onFlash({ type: 'error', message: 'Only PNG or JPG screenshots are accepted.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onFlash({ type: 'error', message: 'Screenshot exceeds the 4 MB upload limit.' });
      return;
    }

    const form = new FormData();
    form.append('screenshot', file);
    setStatusMessage('Uploading screenshot…');
    try {
      const res = await apiFetch<{ ok: boolean; bundle: ProjectBundle }>(
        `/api/p/${encodeURIComponent(token)}/items/${encodeURIComponent(item.id)}/screenshot`,
        {
          method: 'POST',
          body: form,
        }
      );
      onBundleUpdate(res.bundle);
      setStatusMessage('Saved');
      onFlash({ type: 'ok', message: `Screenshot attached to ${item.code}.` });
    } catch (err) {
      const msg = (err as Error).message || 'Failed to upload screenshot.';
      setStatusMessage(msg);
      onFlash({ type: 'error', message: msg });
    }
  };

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
    <div className="space-y-5 pb-20 sm:pb-4">
      <SignalCard className="space-y-3" padding="p-4 sm:p-5">
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
              style={{ fontSize: 'clamp(26px, 3vw, 34px)', lineHeight: 1.1 }}
            >
              {project.product_name} {project.version}
            </h1>
            <p className="text-[13.5px]" style={{ color: 'var(--ink-secondary)' }}>
              Work through each milestone in order. A milestone unlocks once
              every item in the previous one has been tested.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <ProgressRing current={stats.done} total={stats.total} size={50} />
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-[14px]">
                {stats.done} of {stats.total} done
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
              {stats.fail > 0 && (
                <div className="font-semibold" style={{ color: 'var(--danger)' }}>
                  {stats.fail} to fix
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
              onClick={() => onNavigate({ screen: 'certificate', token })}
              style={{ color: 'var(--ok)' }}
              className="underline font-semibold cursor-pointer"
            >
              View certificate →
            </button>
          </NoticeBanner>
        )}
      </SignalCard>

      {/* Two independent scrollable columns on desktop (lg+) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:items-stretch gap-6 items-start lg:h-[calc(100vh-18rem)] lg:min-h-[340px]">
        <aside
          aria-label="Milestone rail"
          className="lg:col-span-4 lg:min-h-0 lg:h-full flex lg:flex-col gap-2 overflow-x-auto pb-1 lg:pb-2 lg:overflow-y-auto lg:overflow-x-hidden lg:pr-2 gs-scroll"
        >
          {msStates.map((ms) => {
            const active = activeMs?.id === ms.id;
            const stMeta = MILESTONE_STATE_MAP[ms.state];
            const hasRetest = ms.retestCount > 0;
            const hasFail = ms.failCount > 0;

            const circleBg = ms.complete
              ? 'var(--ok-soft)'
              : hasRetest
              ? 'var(--warn-soft)'
              : hasFail
              ? 'var(--danger-soft)'
              : ms.unlocked
              ? 'var(--brand-soft)'
              : 'var(--surface-3)';
            const circleFg = ms.complete
              ? 'var(--ok)'
              : hasRetest
              ? 'var(--warn)'
              : hasFail
              ? 'var(--danger)'
              : ms.unlocked
              ? 'var(--ink)'
              : 'var(--muted)';

            return (
              <button
                key={ms.id}
                type="button"
                disabled={!ms.unlocked}
                aria-disabled={!ms.unlocked}
                tabIndex={ms.unlocked ? 0 : -1}
                onClick={() => ms.unlocked && selectMilestone(ms.id)}
                style={{
                  backgroundColor: active ? 'var(--surface)' : 'var(--surface-2)',
                  borderColor: active
                    ? 'var(--brand)'
                    : hasRetest
                    ? 'var(--warn-border)'
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
                      backgroundColor: circleBg,
                      color: circleFg,
                    }}
                    className="w-8 h-8 rounded-full gs-mono text-xs font-bold inline-flex items-center justify-center shrink-0"
                  >
                    {ms.complete ? (
                      <Check className="w-4 h-4" />
                    ) : !ms.unlocked ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : hasRetest ? (
                      <RotateCcw className="w-3.5 h-3.5" />
                    ) : (
                      ms.position
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] truncate">{ms.name}</div>
                    <div className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
                      {ms.doneCount} of {ms.totalCount} passed
                      {!ms.unlocked ? ' · locked' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {hasRetest ? (
                    <StatusChip
                      label={`${ms.retestCount} fixed · retest`}
                      tone="warn"
                    />
                  ) : hasFail ? (
                    <StatusChip label={`${ms.failCount} failed`} tone="danger" />
                  ) : (
                    <StatusChip label={stMeta.label} tone={stMeta.tone} />
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        <div
          ref={rightScrollRef}
          aria-label="Checklist items"
          className="lg:col-span-8 lg:min-h-0 lg:h-full space-y-4 lg:overflow-y-auto lg:pr-2 lg:pb-4 gs-scroll"
        >
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
                              if (file) void handleUploadScreenshot(item, file);
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
                                void flushSave(item, opt.key, currentNote)
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
                                void flushSave(item, 'fail', val);
                              }
                            }, 800);
                          }}
                          onBlur={() => {
                            if (item.status === 'fail' && currentNote.trim()) {
                              void flushSave(item, 'fail', currentNote);
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
                active={allDone || Boolean(nextMilestone)}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {allDone ? (
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
                      onClick={() => onNavigate({ screen: 'signoff', token })}
                    >
                      Sign off UAT
                    </ActionButton>
                  </>
                ) : nextMilestone ? (
                  <>
                    <div>
                      <div className="font-bold text-[18px]">
                        {activeMs.complete
                          ? 'Milestone complete'
                          : 'All items in this milestone tested'}
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
                      onClick={() => selectMilestone(nextMilestone.id)}
                    >
                      Next milestone
                    </ActionButton>
                  </>
                ) : (
                  <p
                    className="text-[13.5px]"
                    style={{ color: 'var(--ink-secondary)' }}
                  >
                    Test every item in this milestone (Pass, Fail, or N/A) to
                    unlock the next milestone.
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
          {stats.done} of {stats.total} done
        </span>
        {allDone ? (
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => onNavigate({ screen: 'signoff', token })}
          >
            Sign off
          </ActionButton>
        ) : nextMilestone ? (
          <ActionButton
            variant="primary"
            size="sm"
            onClick={() => selectMilestone(nextMilestone.id)}
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
 * 8. SCREENS 11–14: SIGN-OFF WIZARD, CERTIFICATE & ERROR PAGES
 * ============================================================================
 */
function SignOffWizardScreen({
  token,
  bundle,
  tester,
  apiFetch,
  onSignedOff,
  onNavigate,
}: {
  token: string;
  bundle: ProjectBundle;
  tester: TesterInfo;
  apiFetch: <T = unknown>(url: string, init?: RequestInit) => Promise<T>;
  onSignedOff: (nextBundle: ProjectBundle) => void;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const { project, milestones, stats } = bundle;
  const eligible = stats.total > 0 && stats.done === stats.total;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [signerName, setSignerName] = useState(tester.name || '');
  const [roleTitle, setRoleTitle] = useState('');
  const [signerEmail, setSignerEmail] = useState(tester.email || '');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [sigMode, setSigMode] = useState<'drawn' | 'typed'>('drawn');
  const [typedSig, setTypedSig] = useState(tester.name || '');
  const [drawnDirty, setDrawnDirty] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const padRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    let active = true;
    if (!eligible || project.signed_at) return;
    void (async () => {
      try {
        const res = await apiFetch<{
          ok: boolean;
          signed?: boolean;
          step?: 1 | 2 | 3;
          state?: { name: string; designation: string; email: string } | null;
          devCode?: string | null;
          bundle?: ProjectBundle;
        }>(`/api/p/${encodeURIComponent(token)}/signoff`);
        if (!active) return;
        if (res.signed && res.bundle) {
          onSignedOff(res.bundle);
          return;
        }
        if (res.step) setStep(res.step);
        if (res.state) {
          if (res.state.name) {
            setSignerName(res.state.name);
            setTypedSig(res.state.name);
          }
          if (res.state.designation) setRoleTitle(res.state.designation);
          if (res.state.email) setSignerEmail(res.state.email);
        }
        if (res.devCode) setDevCode(res.devCode);
      } catch {
        // stay on step 1
      }
    })();
    return () => {
      active = false;
    };
  }, [apiFetch, eligible, onSignedOff, project.signed_at, token]);

  if (isProjectClosed(project)) {
    return <ClosedBlockScreen project={project} onNavigate={onNavigate} />;
  }

  if (project.signed_at) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <NoticeBanner tone="ok" title="Already signed off">
          This UAT project already has an issued completion certificate.
        </NoticeBanner>
        <ActionButton
          variant="primary"
          onClick={() => onNavigate({ screen: 'certificate', token })}
        >
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
        <ActionButton
          variant="primary"
          onClick={() => onNavigate({ screen: 'portal', token })}
        >
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

  const requestOtp = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        step: 2;
        devCode?: string | null;
      }>(`/api/p/${encodeURIComponent(token)}/signoff/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signerName.trim(),
          designation: roleTitle.trim(),
          email: signerEmail.trim(),
        }),
      });
      setDevCode(res.devCode || null);
      setOtpDigits(['', '', '', '', '', '']);
      setStep(2);
    } catch (err) {
      setError((err as Error).message || 'Could not send verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signerName.trim() || !roleTitle.trim() || !signerEmail.includes('@')) {
      setError('Enter full name, designation, and a valid work email.');
      return;
    }
    void requestOtp();
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpDigits.join('');
    if (code.length < 6) {
      setError('Enter all 6 digits of the one-time code.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiFetch(`/api/p/${encodeURIComponent(token)}/signoff/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      setTypedSig(signerName.trim());
      setStep(3);
    } catch (err) {
      setError((err as Error).message || 'That code does not match.');
    } finally {
      setSubmitting(false);
    }
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
    setSubmitting(true);

    const pngUrl =
      sigMode === 'drawn' && padRef.current
        ? padRef.current.toDataURL('image/png')
        : null;

    try {
      const res = await apiFetch<{ ok: boolean; bundle: ProjectBundle }>(
        `/api/p/${encodeURIComponent(token)}/signoff/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consent: consentChecked,
            signatureKind: sigMode,
            signature: pngUrl,
            signatureName: typedSig.trim(),
          }),
        }
      );
      onSignedOff(res.bundle);
    } catch (err) {
      setError((err as Error).message || 'Could not complete sign-off.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <div
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: 'var(--muted)' }}
        >
          Sign-off wizard · {project.token}
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
            <ActionButton type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? 'Sending code…' : 'Send the one-time code'}
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
            {devCode && (
              <NoticeBanner tone="info" title="Development outbox code">
                No SMTP server is configured. Use code{' '}
                <strong className="gs-mono">{devCode}</strong> to verify.
              </NoticeBanner>
            )}
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
                    digitRefs.current[Math.min(5, pasted.length - 1)]?.focus();
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
            <ActionButton type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? 'Verifying…' : 'Verify code'}
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
                disabled={submitting}
                onClick={() => void requestOtp()}
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
              <ActionButton type="submit" variant="primary" disabled={submitting}>
                <FileCheck2 className="w-4 h-4" />
                <span>
                  {submitting ? 'Issuing certificate…' : 'Sign and issue certificate'}
                </span>
              </ActionButton>
            </div>
          </form>
        </SignalCard>
      )}
    </div>
  );
}

function CertificateScreen({
  bundle,
  onNavigate,
}: {
  bundle: ProjectBundle;
  onNavigate: (route: ParsedRoute) => void;
}) {
  const { project, milestones, signoff } = bundle;

  if (!signoff) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <NoticeBanner tone="warn" title="Certificate not issued yet">
          Complete all checklist items and sign off to generate a certificate.
        </NoticeBanner>
        <ActionButton
          variant="primary"
          onClick={() => onNavigate({ screen: 'portal', token: project.token })}
        >
          ← Back to checklist portal
        </ActionButton>
      </div>
    );
  }

  const rows = milestones.map((m) => ({
    name: m.name,
    total: m.items.length,
    pass: m.items.filter((i) => i.status === 'pass').length,
    na: m.items.filter((i) => i.status === 'na').length,
    completed: String(signoff.signed_at).slice(0, 10),
  }));

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
            <strong className="gs-mono">{signoff.verification_id}</strong>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ActionButton variant="primary" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </ActionButton>
          {signoff.pdf_url ? (
            <a
              href={signoff.pdf_url}
              style={{
                backgroundColor: 'var(--surface-2)',
                color: 'var(--ink)',
                borderColor: 'var(--line)',
                borderRadius: 'var(--radius-sm)',
              }}
              className="gs-focus inline-flex items-center justify-center gap-2 font-semibold border min-h-[44px] px-4 py-2 text-[15px]"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </a>
          ) : (
            <ActionButton variant="ghost" onClick={() => window.print()}>
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </ActionButton>
          )}
          <ActionButton
            variant="ghost"
            onClick={() =>
              onNavigate({ screen: 'verify', verifyId: signoff.verification_id })
            }
          >
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
              {signoff.verification_id}
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
            <div className="gs-mono font-bold">{project.token}</div>
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
            <div className="gs-mono">{String(signoff.signed_at).slice(0, 10)}</div>
          </div>
          <div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Signer IP
            </div>
            <div className="gs-mono">{signoff.ip}</div>
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

          {signoff.signature_url ? (
            <img
              src={signoff.signature_url}
              alt="Drawn electronic signature"
              className="h-20 object-contain border-b pb-2"
              style={{ borderColor: 'var(--line-strong)' }}
            />
          ) : (
            <div
              style={{ borderColor: 'var(--line-strong)' }}
              className="text-2xl italic font-serif pb-2 border-b"
            >
              {signoff.typed_signature || signoff.signer_name}
            </div>
          )}

          <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
            <div>
              <strong>{signoff.signer_name}</strong> · {signoff.signer_designation}
              <div className="gs-mono text-xs" style={{ color: 'var(--muted)' }}>
                {signoff.signer_email}
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Email verified by one-time code on{' '}
              {String(signoff.signed_at).slice(0, 10)}
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
            <span className="gs-mono break-all">{signoff.record_hash}</span>
          </div>
          {signoff.pdf_hash && (
            <div>
              <span
                className="font-bold uppercase tracking-[0.08em] block"
                style={{ color: 'var(--muted)' }}
              >
                PDF SHA-256
              </span>
              <span className="gs-mono break-all">{signoff.pdf_hash}</span>
            </div>
          )}
        </div>

        <p
          style={{ borderTop: '1px solid var(--line)', color: 'var(--muted)' }}
          className="text-xs pt-3"
        >
          Electronic signature with audit trail and SHA-256 fingerprints (not a
          certificate-authority digital signature). Verify at{' '}
          <span className="gs-mono">/verify?id={signoff.verification_id}</span>.
        </p>
      </div>
    </div>
  );
}

function ErrorStateScreen({
  code = '404',
  onNavigate,
}: {
  code?: '403' | '404' | '500';
  onNavigate: (route: ParsedRoute) => void;
}) {
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
          <ActionButton variant="primary" onClick={() => onNavigate({ screen: 'landing' })}>
            Go to the start page
          </ActionButton>
          <ActionButton variant="ghost" onClick={() => onNavigate({ screen: 'verify' })}>
            Verify a certificate
          </ActionButton>
        </div>
      </SignalCard>
    </div>
  );
}

/**
 * ============================================================================
 * 9. ROOT GRAPHITE & SIGNAL APP (CONNECTED TO EXPRESS BACKEND)
 * ============================================================================
 */
export default function App() {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  const [route, setRoute] = useState<ParsedRoute>(() =>
    parseLocation(window.location.pathname, window.location.search)
  );
  const [bootstrapped, setBootstrapped] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const csrfRef = useRef('');
  const [companyUser, setCompanyUser] = useState<CompanyUser | null>(null);
  const [clientSession, setClientSession] = useState<{
    token: string;
    tester: TesterInfo | null;
  } | null>(null);
  const [flash, setFlash] = useState<FlashMessage | null>(null);
  const [lightboxData, setLightboxData] = useState<LightboxData | null>(null);

  const [createdProjectPayload, setCreatedProjectPayload] = useState<{
    projectId: string;
    bundle: ProjectBundle;
    activity: ActivityEvent[];
    oneTimePassword: string;
    invite: string;
  } | null>(null);

  // Active client token state
  const [clientState, setClientState] = useState<{
    token: string;
    loading: boolean;
    authed: boolean;
    blockedReason: string | null;
    project: ProjectSummary | null;
    bundle: ProjectBundle | null;
    tester: TesterInfo | null;
    error: string | null;
  }>({
    token: '',
    loading: false,
    authed: false,
    blockedReason: null,
    project: null,
    bundle: null,
    tester: null,
    error: null,
  });

  const updateCsrf = useCallback((nextToken: string) => {
    csrfRef.current = nextToken;
    setCsrfToken(nextToken);
  }, []);

  const navigate = useCallback((nextRoute: ParsedRoute, replace = false) => {
    const nextUrl = buildPathForRoute(nextRoute);
    if (replace) {
      window.history.replaceState(null, '', nextUrl);
    } else if (window.location.pathname + window.location.search !== nextUrl) {
      window.history.pushState(null, '', nextUrl);
    }
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    const onPop = () => {
      setRoute(parseLocation(window.location.pathname, window.location.search));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const apiFetch = useCallback(
    async <T = unknown>(url: string, init: RequestInit = {}): Promise<T> => {
      const method = (init.method || 'GET').toUpperCase();
      const headers = new Headers(init.headers || {});
      headers.set('Accept', 'application/json');
      if (method !== 'GET' && method !== 'HEAD' && csrfRef.current) {
        headers.set('X-CSRF-Token', csrfRef.current);
      }

      const res = await fetch(url, {
        ...init,
        method,
        headers,
        credentials: 'include',
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await res.json()
        : null;

      if (!res.ok || (data && data.ok === false)) {
        const err = new Error(
          (data && data.error) || `Request failed (${res.status})`
        ) as Error & {
          status?: number;
          errors?: string[];
          checklistErrors?: string[];
          blockedReason?: string;
          project?: ProjectSummary;
        };
        err.status = res.status;
        if (data?.errors) err.errors = data.errors;
        if (data?.checklistErrors) err.checklistErrors = data.checklistErrors;
        if (data?.blockedReason) err.blockedReason = data.blockedReason;
        if (data?.project) err.project = data.project;
        throw err;
      }

      return data as T;
    },
    []
  );

  // Bootstrap CSRF + active session state
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await apiFetch<{
          ok: boolean;
          csrfToken: string;
          companyUser: CompanyUser | null;
          clientSession: { token: string; tester: TesterInfo | null } | null;
        }>('/api/bootstrap');
        if (!active) return;
        updateCsrf(res.csrfToken);
        setCompanyUser(res.companyUser);
        setClientSession(res.clientSession);
      } catch (err) {
        if (active) {
          setFlash({
            type: 'error',
            message:
              (err as Error).message || 'Could not reach the UAT Desk backend.',
          });
        }
      } finally {
        if (active) setBootstrapped(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [apiFetch, updateCsrf]);

  // Load client token bundle whenever navigating to a /p/:token* route
  const isClientRoute = [
    'token-login',
    'tester-id',
    'portal',
    'signoff',
    'certificate',
    'closed',
  ].includes(route.screen);

  useEffect(() => {
    if (!bootstrapped || !isClientRoute || !route.token) return;
    const tok = route.token;
    let active = true;
    setClientState((prev) => ({
      ...prev,
      token: tok,
      loading: prev.token !== tok || !prev.project,
      error: null,
    }));

    void (async () => {
      try {
        const res = await apiFetch<{
          ok: boolean;
          authed: boolean;
          blockedReason: string | null;
          project: ProjectSummary;
          tester: TesterInfo | null;
          bundle: ProjectBundle | null;
        }>(`/api/p/${encodeURIComponent(tok)}`);
        if (!active) return;

        setClientState({
          token: tok,
          loading: false,
          authed: res.authed,
          blockedReason: res.blockedReason,
          project: res.project,
          bundle: res.bundle,
          tester: res.tester,
          error: null,
        });

        if (res.blockedReason) {
          if (route.screen !== 'closed') {
            navigate({ screen: 'closed', token: tok }, true);
          }
          return;
        }

        if (!res.authed) {
          if (route.screen !== 'token-login') {
            navigate({ screen: 'token-login', token: tok }, true);
          }
          return;
        }

        if (res.bundle?.signoff && route.screen !== 'certificate') {
          navigate({ screen: 'certificate', token: tok }, true);
          return;
        }

        if (!res.tester && route.screen !== 'tester-id') {
          navigate({ screen: 'tester-id', token: tok }, true);
          return;
        }

        if (res.tester && route.screen === 'token-login') {
          navigate({ screen: 'portal', token: tok }, true);
        }
      } catch (err) {
        if (!active) return;
        setClientState({
          token: tok,
          loading: false,
          authed: false,
          blockedReason: null,
          project: null,
          bundle: null,
          tester: null,
          error: (err as Error).message || 'This UAT link does not exist.',
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [bootstrapped, isClientRoute, route.token, route.screen, apiFetch, navigate]);

  // Auth guard for company routes once bootstrapped
  useEffect(() => {
    if (!bootstrapped) return;
    if (
      ['company', 'new-project', 'project-detail'].includes(route.screen) &&
      !companyUser
    ) {
      navigate({ screen: 'company-login' }, true);
    } else if (route.screen === 'company-login' && companyUser) {
      navigate({ screen: 'company' }, true);
    }
  }, [bootstrapped, route.screen, companyUser, navigate]);

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

  const handleCompanySignOut = useCallback(async () => {
    try {
      const res = await apiFetch<{ ok: boolean; csrfToken?: string }>(
        '/api/company/logout',
        { method: 'POST' }
      );
      if (res.csrfToken) updateCsrf(res.csrfToken);
    } catch {
      // ignore
    }
    setCompanyUser(null);
    setFlash({ type: 'ok', message: 'Signed out.' });
    navigate({ screen: 'company-login' });
  }, [apiFetch, navigate, updateCsrf]);

  const handleClientSignOut = useCallback(async () => {
    const tok = clientSession?.token || route.token;
    if (tok) {
      try {
        const res = await apiFetch<{ ok: boolean; csrfToken?: string }>(
          `/api/p/${encodeURIComponent(tok)}/logout`,
          { method: 'POST' }
        );
        if (res.csrfToken) updateCsrf(res.csrfToken);
      } catch {
        // ignore
      }
    }
    setClientSession(null);
    setClientState({
      token: '',
      loading: false,
      authed: false,
      blockedReason: null,
      project: null,
      bundle: null,
      tester: null,
      error: null,
    });
    setFlash({ type: 'ok', message: 'Signed out of client portal.' });
    navigate(tok ? { screen: 'token-login', token: tok } : { screen: 'client-entry' });
  }, [apiFetch, clientSession?.token, navigate, route.token, updateCsrf]);

  const clearCreatedProjectPayload = useCallback(() => {
    setCreatedProjectPayload(null);
  }, []);

  const showCompanyRail = ['company', 'new-project', 'project-detail'].includes(
    route.screen
  );

  // Keep csrfToken referenced cleanly
  void csrfToken;

  return (
    <div data-theme={theme} className="gs-root flex flex-col">
      <style>{GRAPHITE_SIGNAL_CSS}</style>

      <TopBar
        screen={route.screen}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        companyUser={companyUser}
        onCompanySignOut={() => void handleCompanySignOut()}
        clientSession={clientSession}
        onClientSignOut={() => void handleClientSignOut()}
        activeProject={clientState.project}
      />

      <FlashBanner flash={flash} onDismiss={() => setFlash(null)} />

      <main className="flex-1 max-w-[1320px] w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 overflow-y-auto min-h-0">
        {!bootstrapped ? (
          <SignalCard className="space-y-3 max-w-md mx-auto">
            <div
              className="h-5 w-40 rounded animate-pulse"
              style={{ backgroundColor: 'var(--surface-3)' }}
            />
            <div
              className="h-10 w-full rounded animate-pulse"
              style={{ backgroundColor: 'var(--surface-2)' }}
            />
          </SignalCard>
        ) : (
          <div
            className={
              showCompanyRail ? 'flex flex-col lg:flex-row gap-6 items-start' : ''
            }
          >
            {showCompanyRail && (
              <CompanyLeftRail
                screen={route.screen}
                activeProjectId={route.projectId || createdProjectPayload?.projectId}
                onNavigate={navigate}
              />
            )}

            <div className={showCompanyRail ? 'flex-1 min-w-0 w-full' : 'w-full'}>
              {route.screen === 'landing' && (
                <LandingScreen
                  onNavigate={navigate}
                  companyEmail={companyUser?.email || null}
                />
              )}

              {route.screen === 'client-entry' && (
                <ClientEntryScreen
                  apiFetch={apiFetch}
                  onClientAuthed={({ token, signed, bundle, csrfToken: nextCsrf }) => {
                    if (nextCsrf) updateCsrf(nextCsrf);
                    setClientSession({ token, tester: null });
                    setClientState({
                      token,
                      loading: false,
                      authed: true,
                      blockedReason: null,
                      project: bundle.project,
                      bundle,
                      tester: null,
                      error: null,
                    });
                    setFlash({
                      type: 'ok',
                      message: `Opened ${token}.`,
                    });
                    navigate({
                      screen: signed ? 'certificate' : 'tester-id',
                      token,
                    });
                  }}
                  onNavigate={navigate}
                />
              )}

              {route.screen === 'verify' && (
                <VerifyScreen initialId={route.verifyId} apiFetch={apiFetch} />
              )}

              {route.screen === 'company-login' && (
                <CompanyLoginScreen
                  apiFetch={apiFetch}
                  onSignedIn={(user, nextCsrf) => {
                    if (nextCsrf) updateCsrf(nextCsrf);
                    setCompanyUser(user);
                    setFlash({ type: 'ok', message: `Signed in as ${user.email}.` });
                    navigate({ screen: 'company' });
                  }}
                  onNavigate={navigate}
                />
              )}

              {route.screen === 'company' && companyUser && (
                <CompanyDashboardScreen
                  apiFetch={apiFetch}
                  onNavigate={navigate}
                />
              )}

              {route.screen === 'new-project' && companyUser && (
                <NewProjectScreen
                  apiFetch={apiFetch}
                  onCreated={(payload) => {
                    setCreatedProjectPayload(payload);
                    navigate({
                      screen: 'project-detail',
                      projectId: payload.projectId,
                    });
                  }}
                  onNavigate={navigate}
                  onFlash={setFlash}
                />
              )}

              {route.screen === 'project-detail' && companyUser && route.projectId && (
                <ProjectDetailScreen
                  projectId={route.projectId}
                  initialCreated={createdProjectPayload}
                  onClearInitialCreated={clearCreatedProjectPayload}
                  apiFetch={apiFetch}
                  onOpenLightbox={setLightboxData}
                  onNavigate={navigate}
                  onFlash={setFlash}
                />
              )}

              {isClientRoute && clientState.loading && (
                <SignalCard className="space-y-3 max-w-md mx-auto">
                  <div
                    className="h-5 w-44 rounded animate-pulse"
                    style={{ backgroundColor: 'var(--surface-3)' }}
                  />
                  <div
                    className="h-12 w-full rounded animate-pulse"
                    style={{ backgroundColor: 'var(--surface-2)' }}
                  />
                </SignalCard>
              )}

              {isClientRoute && !clientState.loading && clientState.error && (
                <ErrorStateScreen code="404" onNavigate={navigate} />
              )}

              {isClientRoute &&
                !clientState.loading &&
                !clientState.error &&
                route.screen === 'closed' && (
                  <ClosedBlockScreen
                    project={clientState.project}
                    reason={clientState.blockedReason}
                    onNavigate={navigate}
                  />
                )}

              {isClientRoute &&
                !clientState.loading &&
                !clientState.error &&
                route.screen === 'token-login' &&
                route.token && (
                  <TokenLoginScreen
                    token={route.token}
                    project={clientState.project}
                    apiFetch={apiFetch}
                    onAuthed={({ token, signed, bundle, csrfToken: nextCsrf }) => {
                      if (nextCsrf) updateCsrf(nextCsrf);
                      setClientSession({ token, tester: null });
                      setClientState({
                        token,
                        loading: false,
                        authed: true,
                        blockedReason: null,
                        project: bundle.project,
                        bundle,
                        tester: null,
                        error: null,
                      });
                      setFlash({ type: 'ok', message: 'Access verified.' });
                      navigate({
                        screen: signed ? 'certificate' : 'tester-id',
                        token,
                      });
                    }}
                    onNavigate={navigate}
                  />
                )}

              {isClientRoute &&
                !clientState.loading &&
                !clientState.error &&
                route.screen === 'tester-id' &&
                route.token &&
                clientState.project && (
                  <TesterIdentityScreen
                    token={route.token}
                    project={clientState.project}
                    tester={clientState.tester}
                    apiFetch={apiFetch}
                    onSaved={(t) => {
                      setClientState((prev) => ({ ...prev, tester: t }));
                      setClientSession((prev) =>
                        prev ? { ...prev, tester: t } : { token: route.token!, tester: t }
                      );
                    }}
                    onNavigate={navigate}
                  />
                )}

              {isClientRoute &&
                !clientState.loading &&
                !clientState.error &&
                route.screen === 'portal' &&
                route.token &&
                clientState.bundle && (
                  <ChecklistPortalScreen
                    key={clientState.bundle.project.id}
                    token={route.token}
                    bundle={clientState.bundle}
                    apiFetch={apiFetch}
                    onBundleUpdate={(nextBundle) =>
                      setClientState((prev) => ({
                        ...prev,
                        bundle: nextBundle,
                        project: nextBundle.project,
                      }))
                    }
                    onOpenLightbox={setLightboxData}
                    onNavigate={navigate}
                    onFlash={setFlash}
                  />
                )}

              {isClientRoute &&
                !clientState.loading &&
                !clientState.error &&
                route.screen === 'signoff' &&
                route.token &&
                clientState.bundle &&
                clientState.tester && (
                  <SignOffWizardScreen
                    token={route.token}
                    bundle={clientState.bundle}
                    tester={clientState.tester}
                    apiFetch={apiFetch}
                    onSignedOff={(nextBundle) => {
                      setClientState((prev) => ({
                        ...prev,
                        bundle: nextBundle,
                        project: nextBundle.project,
                      }));
                      setFlash({
                        type: 'ok',
                        message: 'Signed off. The completion certificate is ready.',
                      });
                      navigate({ screen: 'certificate', token: route.token });
                    }}
                    onNavigate={navigate}
                  />
                )}

              {isClientRoute &&
                !clientState.loading &&
                !clientState.error &&
                route.screen === 'certificate' &&
                clientState.bundle && (
                  <CertificateScreen
                    bundle={clientState.bundle}
                    onNavigate={navigate}
                  />
                )}

              {route.screen === 'error' && (
                <ErrorStateScreen
                  code={route.errorStatus || '404'}
                  onNavigate={navigate}
                />
              )}
            </div>
          </div>
        )}
      </main>

      <FooterBar onNavigate={navigate} />

      <LightboxOverlay
        data={lightboxData}
        onClose={() => setLightboxData(null)}
      />
    </div>
  );
}
