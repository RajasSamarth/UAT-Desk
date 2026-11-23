const config = require('./config');

const isoDate = ts => new Date(ts).toISOString().slice(0, 10);

function fmt(ts) {
  if (!ts) return '';
  return `${new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC'
  }).format(new Date(ts))} UTC`;
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(ts));
}

function inviteText(bundle, password) {
  const expiry = new Date(`${bundle.link.expires_at}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  return [
    'Hello,',
    '',
    `${bundle.product.name} ${bundle.project.version} is ready for user acceptance testing.`,
    '',
    `Link: ${config.appBaseUrl}/p/${bundle.link.token}`,
    `Project ID: ${bundle.link.token}`,
    `Password: ${password}`,
    `Available until: ${expiry}`,
    '',
    'Please work through each milestone in order and mark every item. When all milestones are complete, you will be asked to sign off digitally.',
    '',
    'If anything is unclear, reply to this email.',
    '',
    bundle.project.owner_name
  ].join('\n');
}

function safeFilename(name) {
  return String(name || 'file').replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'file';
}

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

module.exports = { isoDate, fmt, fmtDate, inviteText, safeFilename, csvEscape };
