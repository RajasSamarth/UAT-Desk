const ExcelJS = require('exceljs');

const COLS = [
  ['order', 'Milestone order', ['milestoneorder', 'order', 'milestoneno', 'milestonenumber']],
  ['milestone', 'Milestone name', ['milestonename', 'milestone']],
  ['code', 'Item ID', ['itemid', 'id', 'checklistid', 'itemcode']],
  ['title', 'Title', ['title', 'item', 'checklistitem', 'name']],
  ['steps', 'Description / test steps', ['descriptionteststeps', 'description', 'teststeps', 'steps', 'details']],
  ['expected', 'Expected result', ['expectedresult', 'expected', 'expectedoutcome']],
  ['mandatory', 'Mandatory (Y/N)', ['mandatoryyn', 'mandatory', 'required', 'requiredyn']],
  ['evidence', 'Evidence required (Y/N)', ['evidencerequiredyn', 'evidencerequired', 'evidence', 'screenshotrequired', 'screenshot']]
];
const REQUIRED_COLS = ['order', 'milestone', 'code', 'title'];
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

const TEMPLATE_ROWS = [
  [1, 'Access and sign-in', 'A-01', 'Sign in with your work account', 'Open the client link, sign in with the account you were given.', 'You land on the home screen and your name is shown.', 'Y', 'N'],
  [1, 'Access and sign-in', 'A-02', 'User roles and permissions', 'Sign in as each role you were given and open Settings.', 'Each role sees only the screens agreed in the scope document.', 'Y', 'Y'],
  [2, 'Core features', 'C-01', 'Main workflow end to end', 'Complete one full record from creation to closure.', 'Every step saves, and the record shows as closed.', 'Y', 'N'],
  [2, 'Core features', 'C-02', 'Validation messages', 'Leave required fields empty and try to save.', 'Each empty field shows a clear message; nothing saves.', 'Y', 'N'],
  [2, 'Core features', 'C-03', 'Email notifications', 'Trigger an action that should send an email.', 'The email arrives within 5 minutes with the right details.', 'N', 'N'],
  [3, 'Reports and handover', 'D-01', 'Reports match source data', 'Run the summary report for last week.', 'Totals match the records you created during testing.', 'Y', 'Y'],
  [3, 'Reports and handover', 'D-02', 'Export to Excel', 'Export the summary report.', 'The .xlsx file opens with the same rows and totals.', 'N', 'N']
];

const INV_ROWS = [
  [1, 'Access and roles', 'AR-01', 'Sign in with company SSO', 'Open the app link, choose Sign in with Microsoft and use your work account.', 'You land on the dashboard with your name shown in the top corner.', 'Y', 'N'],
  [1, 'Access and roles', 'AR-02', 'Warehouse manager permissions', 'Sign in as the warehouse manager test user and open Settings.', 'Settings shows Stock and Transfers only. Billing is hidden.', 'Y', 'Y'],
  [1, 'Access and roles', 'AR-03', 'Password reset email', 'On the sign-in page choose Forgot password for a non-SSO user.', 'A reset email arrives within 2 minutes.', 'N', 'N'],
  [2, 'Stock workflows', 'SW-01', 'Create a new SKU', 'Products, then New. Fill the required fields and save.', 'The SKU appears in the list and in search.', 'Y', 'N'],
  [2, 'Stock workflows', 'SW-02', 'Transfer stock between warehouses', 'Transfers, then New. Move 10 units from Pune to Mumbai and approve.', 'Source drops by 10, destination rises by 10, transfer shows Completed.', 'Y', 'Y'],
  [2, 'Stock workflows', 'SW-03', 'Low-stock alert', 'Set the reorder level above current stock for one SKU.', 'An alert appears on the dashboard and the buyer gets an email.', 'Y', 'N'],
  [2, 'Stock workflows', 'SW-04', 'Bulk import from CSV', 'Products, then Import. Upload the sample file you were sent.', 'All rows import. Any errors are listed by row.', 'N', 'N'],
  [3, 'Reports and handover', 'RH-01', 'Daily stock report', 'Reports, then Daily stock. Pick yesterday’s date.', 'Totals match the warehouse count sheet.', 'Y', 'Y'],
  [3, 'Reports and handover', 'RH-02', 'Export to Excel', 'Export the daily stock report.', 'The .xlsx file opens with the same rows and totals.', 'Y', 'N'],
  [3, 'Reports and handover', 'RH-03', 'Audit trail', 'Open any SKU, then History.', 'Every change shows user, time and old and new value.', 'Y', 'N']
];

const FS_ROWS = [
  [1, 'Job scheduling', 'JS-01', 'Create a service job', 'Jobs, then New. Enter customer, site and fault.', 'The job appears on the board as Unassigned.', 'Y', 'N'],
  [1, 'Job scheduling', 'JS-02', 'Assign a technician', 'Drag the job onto a technician for tomorrow.', 'The technician gets a notification on the mobile app.', 'Y', 'N'],
  [1, 'Job scheduling', 'JS-03', 'Reschedule a job', 'Drag an assigned job to another day.', 'Both the board and the technician’s app show the new date.', 'N', 'N'],
  [2, 'Mobile job completion', 'MC-01', 'Open a job without signal', 'Turn on airplane mode, open today’s job on the phone.', 'Job details and checklist are available offline.', 'Y', 'N'],
  [2, 'Mobile job completion', 'MC-02', 'Capture customer signature and photos', 'Finish the job, take two photos and get a signature.', 'Photos and signature are attached to the job.', 'Y', 'Y'],
  [2, 'Mobile job completion', 'MC-03', 'Sync back to the office', 'Turn signal back on.', 'The job shows Completed on the office board within a minute.', 'Y', 'N']
];

function parseCsv(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 1; } else { quoted = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function readXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const maxCol = Math.max(sheet.columnCount || 0, 8);
  const matrix = [];
  sheet.eachRow({ includeEmpty: false }, row => {
    const arr = [];
    for (let c = 1; c <= maxCol; c += 1) arr.push(row.getCell(c).text || '');
    matrix.push(arr);
  });
  return matrix;
}

function validateMatrix(matrix) {
  const errors = [];
  const isBlank = r => !r || r.every(c => String(c == null ? '' : c).trim() === '');
  const headerIndex = matrix.findIndex(r => !isBlank(r));
  if (headerIndex < 0) return { rows: [], errors: ['The file is empty. Download the template to see the expected layout.'] };

  const header = matrix[headerIndex].map(norm);
  const idx = {};
  for (const [key, , aliases] of COLS) {
    const i = header.findIndex(x => aliases.includes(x));
    if (i >= 0) idx[key] = i;
  }
  const missing = COLS.filter(c => REQUIRED_COLS.includes(c[0]) && idx[c[0]] == null).map(c => `“${c[1]}”`);
  if (missing.length) {
    return { rows: [], errors: [`Missing column${missing.length > 1 ? 's ' : ' '}${missing.join(', ')}. Download the template to see the expected columns.`] };
  }

  const rows = [];
  const codes = new Map();
  const nameByOrder = new Map();
  const orderByName = new Map();

  const yn = (v, def, rowNum, label) => {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (s === '') return def;
    if (['y', 'yes', 'true', '1'].includes(s)) return true;
    if (['n', 'no', 'false', '0'].includes(s)) return false;
    errors.push(`Row ${rowNum}: “${label}” must be Y or N, not “${v}”.`);
    return def;
  };

  for (let r = headerIndex + 1; r < matrix.length; r += 1) {
    const row = matrix[r];
    if (isBlank(row)) continue;
    const rowNum = r + 1;
    const get = k => (idx[k] == null ? '' : String(row[idx[k]] == null ? '' : row[idx[k]]).trim());
    const orderRaw = get('order');
    const order = Number(orderRaw);
    const milestone = get('milestone');
    const code = get('code');
    const title = get('title');

    if (!orderRaw || !Number.isInteger(order) || order < 1) errors.push(`Row ${rowNum}: Milestone order must be a whole number like 1, 2 or 3${orderRaw ? `, not “${orderRaw}”` : ''}.`);
    if (!milestone) errors.push(`Row ${rowNum}: Milestone name is empty.`);
    if (!code) errors.push(`Row ${rowNum}: Item ID is empty.`);
    else if (codes.has(code.toLowerCase())) errors.push(`Row ${rowNum}: Item ID “${code}” is already used on row ${codes.get(code.toLowerCase())}.`);
    else codes.set(code.toLowerCase(), rowNum);
    if (!title) errors.push(`Row ${rowNum}: Title is empty.`);

    if (Number.isInteger(order) && milestone) {
      if (nameByOrder.has(order) && nameByOrder.get(order).toLowerCase() !== milestone.toLowerCase()) {
        errors.push(`Row ${rowNum}: Milestone ${order} is called “${nameByOrder.get(order)}” on an earlier row but “${milestone}” here.`);
      } else if (!nameByOrder.has(order)) {
        nameByOrder.set(order, milestone);
      }
      const k = milestone.toLowerCase();
      if (orderByName.has(k) && orderByName.get(k) !== order) {
        errors.push(`Row ${rowNum}: “${milestone}” appears with two different milestone orders.`);
      } else {
        orderByName.set(k, order);
      }
    }

    rows.push({
      order,
      milestone,
      code,
      title,
      steps: get('steps'),
      expected: get('expected'),
      mandatory: yn(idx.mandatory == null ? '' : row[idx.mandatory], true, rowNum, 'Mandatory'),
      evidence: yn(idx.evidence == null ? '' : row[idx.evidence], false, rowNum, 'Evidence required')
    });
  }

  if (!rows.length && !errors.length) errors.push('No checklist items were found under the header row.');
  return { rows: errors.length ? [] : rows, errors };
}

async function parseChecklist(buffer, filename) {
  if (/\.csv$/i.test(filename)) return validateMatrix(parseCsv(buffer.toString('utf8')));
  if (/\.xlsx$/i.test(filename)) return validateMatrix(await readXlsx(buffer));
  throw new Error('Upload an .xlsx or .csv file built from the template.');
}

function rowsToMilestones(rows) {
  const byOrder = new Map();
  for (const r of rows) {
    if (!byOrder.has(r.order)) byOrder.set(r.order, { order: r.order, name: r.milestone, items: [] });
    byOrder.get(r.order).items.push(r);
  }
  return [...byOrder.values()].sort((a, b) => a.order - b.order);
}

function rowsFromArrays(arr) {
  return arr.map(r => ({
    order: Number(r[0]),
    milestone: r[1],
    code: r[2],
    title: r[3],
    steps: r[4],
    expected: r[5],
    mandatory: r[6] === 'Y',
    evidence: r[7] === 'Y'
  }));
}

module.exports = {
  COLS,
  TEMPLATE_ROWS,
  INV_ROWS,
  FS_ROWS,
  parseCsv,
  parseChecklist,
  validateMatrix,
  rowsToMilestones,
  rowsFromArrays
};
