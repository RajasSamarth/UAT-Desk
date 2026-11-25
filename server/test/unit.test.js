const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  scryptHash,
  scryptVerify,
  hashOtp,
  verifyOtpHash,
  generateOtp,
  generateProjectId,
  generateVerificationId,
  canonicalJson,
  isValidEmail,
  decodeImageDataUrl,
  imageKindFromBuffer
} = require('../src/security');

const {
  fmt,
  fmtDate,
  safeFilename,
  csvEscape,
  isoDate,
  inviteText
} = require('../src/helpers');

const {
  parseChecklist,
  rowsToMilestones,
  rowsFromArrays,
  INV_ROWS,
  FS_ROWS,
  TEMPLATE_ROWS,
  COLS
} = require('../src/checklist');

const {
  itemTested,
  itemDone,
  milestoneComplete,
  computeStats,
  milestoneState,
  currentMilestoneIndex,
  isExpired,
  projectStatus
} = require('../src/projectService');

const {
  validateAdminInput,
  validatePassword,
  addCompanyAdmin,
  changeCompanyUserPassword
} = require('../src/companyUsers');

describe('Security module', () => {
  test('scryptHash produces verifiable hashes', () => {
    const password = 'CorrectHorseBatteryStaple123!';
    const hash = scryptHash(password);
    assert.ok(hash.startsWith('scrypt$'), 'Hash should start with scrypt$');
    assert.ok(scryptVerify(password, hash), 'Correct password should verify');
    assert.ok(!scryptVerify('WrongPassword', hash), 'Wrong password should fail');
  });

  test('generateOtp returns a 6-digit numeric string', () => {
    for (let i = 0; i < 20; i++) {
      const otp = generateOtp();
      assert.match(otp, /^\d{6}$/, 'OTP must be exactly 6 digits');
    }
  });

  test('hashOtp and verifyOtpHash work with timing-safe comparison', () => {
    const otp = '849201';
    const hash = hashOtp(otp);
    assert.ok(verifyOtpHash(otp, hash), 'Correct OTP must match hash');
    assert.ok(!verifyOtpHash('123456', hash), 'Incorrect OTP must not match');
  });

  test('generateProjectId and generateVerificationId produce expected formats', () => {
    const projId = generateProjectId();
    assert.match(projId, /^UAT-[A-Z0-9]{6}$/, 'Project ID should be UAT-XXXXXX');

    const verId = generateVerificationId();
    assert.match(verId, /^VC-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Verification ID should be VC-XXXX-XXXX');
  });

  test('canonicalJson produces stable key-sorted output', () => {
    const a = { z: 1, a: 2, m: { y: 10, x: 20 } };
    const b = { a: 2, m: { x: 20, y: 10 }, z: 1 };
    assert.equal(canonicalJson(a), canonicalJson(b), 'Key ordering should be normalized');
  });

  test('isValidEmail correctly identifies valid and invalid emails', () => {
    assert.ok(isValidEmail('test@example.com'));
    assert.ok(isValidEmail('user.name+tag@sub.domain.co.uk'));
    assert.ok(!isValidEmail(''));
    assert.ok(!isValidEmail('plainaddress'));
    assert.ok(!isValidEmail('@missinguser.com'));
    assert.ok(!isValidEmail('missingdomain@.com'));
  });

  test('decodeImageDataUrl rejects non-data URLs and invalid MIME types', () => {
    assert.equal(decodeImageDataUrl('not-a-data-url'), null);
    assert.equal(decodeImageDataUrl('data:text/plain;base64,aGVsbG8='), null);
  });

  test('imageKindFromBuffer detects PNG and JPEG magic bytes', () => {
    const pngBuffer = Buffer.from('89504e470d0a1a0a000000', 'hex');
    assert.equal(imageKindFromBuffer(pngBuffer), 'png');

    const jpegBuffer = Buffer.from('ffd8ffe000104a46', 'hex');
    assert.equal(imageKindFromBuffer(jpegBuffer), 'jpeg');

    const unknownBuffer = Buffer.from('1234567890abcdef', 'hex');
    assert.equal(imageKindFromBuffer(unknownBuffer), null);
  });
});

describe('Helpers module', () => {
  test('fmt and fmtDate format UTC dates properly', () => {
    const d = new Date('2026-03-15T14:30:00Z');
    assert.equal(fmt(d), '15 Mar 2026, 14:30 UTC');
    assert.equal(fmtDate(d), '15 Mar 2026');
    assert.equal(fmt(null), '');
    assert.equal(fmtDate(null), '');
  });

  test('safeFilename cleans dangerous characters', () => {
    assert.equal(safeFilename('my cool file!@#$.csv'), 'my-cool-file-.csv');
    assert.equal(safeFilename('../../../etc/passwd'), '..-..-..-etc-passwd');
    assert.equal(safeFilename(''), 'file');
  });

  test('csvEscape quotes strings containing commas, quotes, or newlines', () => {
    assert.equal(csvEscape('normal'), 'normal');
    assert.equal(csvEscape('hello, world'), '"hello, world"');
    assert.equal(csvEscape('with "quotes"'), '"with ""quotes"""');
    assert.equal(csvEscape('with\nnewline'), '"with\nnewline"');
  });

  test('isoDate formats YYYY-MM-DD', () => {
    assert.equal(isoDate(new Date('2026-11-23T00:00:00Z')), '2026-11-23');
  });
});

describe('Checklist parser module', () => {
  test('rowsFromArrays creates valid row objects from TEMPLATE_ROWS', () => {
    const rows = rowsFromArrays(TEMPLATE_ROWS);
    assert.ok(rows.length > 0);
    assert.ok(rows[0].milestone);
    assert.ok(rows[0].code);
    assert.ok(rows[0].title);
  });

  test('rowsToMilestones groups rows into milestones preserving order', () => {
    const rows = rowsFromArrays(INV_ROWS);
    const milestones = rowsToMilestones(rows);
    assert.ok(milestones.length >= 2);
    assert.equal(milestones[0].name, 'Access and roles');
    assert.ok(milestones[0].items.length >= 3);
  });

  test('parseChecklist parses valid CSV buffer', async () => {
    const csvContent = [
      COLS.map(c => c[1]).join(','),
      '1,Milestone One,T-01,Test One,Steps here,Expected here,Y,N',
      '1,Milestone One,T-02,Test Two,Steps here,Expected here,N,Y'
    ].join('\n');

    const result = await parseChecklist(
      Buffer.from(csvContent),
      'test.csv'
    );

    assert.equal(result.errors.length, 0);
    assert.equal(result.rows.length, 2);
    assert.equal(result.rows[0].code, 'T-01');
    assert.equal(result.rows[0].mandatory, true);
    assert.equal(result.rows[0].evidence, false);
    assert.equal(result.rows[1].code, 'T-02');
    assert.equal(result.rows[1].mandatory, false);
    assert.equal(result.rows[1].evidence, true);
  });

  test('parseChecklist catches duplicate item codes', async () => {
    const csvContent = [
      COLS.map(c => c[1]).join(','),
      '1,Milestone One,DUP-01,First,Steps,Expected,Y,N',
      '1,Milestone One,DUP-01,Second duplicate,Steps,Expected,N,N'
    ].join('\n');

    const result = await parseChecklist(
      Buffer.from(csvContent),
      'duplicate.csv'
    );

    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some(e => e.includes('already used on row')));
  });
});

describe('Project service business logic', () => {
  const dummyMilestones = [
    {
      id: 'm1',
      name: 'Milestone 1',
      items: [
        { id: 'i1', code: 'T1', status: 'pass', mandatory: true },
        { id: 'i2', code: 'T2', status: 'na', mandatory: false }
      ]
    },
    {
      id: 'm2',
      name: 'Milestone 2',
      items: [
        { id: 'i3', code: 'T3', status: 'fail', mandatory: true },
        { id: 'i4', code: 'T4', status: null, mandatory: true }
      ]
    }
  ];

  test('itemTested recognizes pass, fail, na as tested', () => {
    assert.ok(itemTested({ status: 'pass' }));
    assert.ok(itemTested({ status: 'fail' }));
    assert.ok(itemTested({ status: 'na' }));
    assert.ok(!itemTested({ status: null }));
    assert.ok(!itemTested({ status: 'retest' }));
  });

  test('itemDone only counts pass and na', () => {
    assert.ok(itemDone({ status: 'pass' }));
    assert.ok(itemDone({ status: 'na' }));
    assert.ok(!itemDone({ status: 'fail' }));
    assert.ok(!itemDone({ status: null }));
  });

  test('milestoneComplete checks if all items in milestone are tested', () => {
    assert.ok(milestoneComplete(dummyMilestones[0]));
    assert.ok(!milestoneComplete(dummyMilestones[1]));
  });

  test('computeStats correctly tallies counts', () => {
    const stats = computeStats({ milestones: dummyMilestones });
    assert.equal(stats.total, 4);
    assert.equal(stats.done, 2);
    assert.equal(stats.fail, 1);
    assert.equal(stats.tested, 3);
  });

  test('milestoneState locks milestones if earlier ones are untested, not when failed', () => {
    const bundle = { milestones: dummyMilestones };
    assert.equal(milestoneState(bundle, 0), 'complete');
    assert.equal(milestoneState(bundle, 1), 'open');

    const withFailure = {
      milestones: [
        {
          id: 'm1',
          name: 'Milestone 1',
          items: [
            { id: 'i1', code: 'T1', status: 'pass', mandatory: true },
            { id: 'i2', code: 'T2', status: 'fail', mandatory: true }
          ]
        },
        {
          id: 'm2',
          name: 'Milestone 2',
          items: [{ id: 'i3', code: 'T3', status: null, mandatory: true }]
        },
        {
          id: 'm3',
          name: 'Milestone 3',
          items: [{ id: 'i4', code: 'T4', status: null, mandatory: true }]
        }
      ]
    };
    assert.equal(milestoneState(withFailure, 1), 'open');
    assert.equal(milestoneState(withFailure, 2), 'locked');
  });

  test('isExpired checks expiration date', () => {
    const futureBundle = { link: { expires_at: '2099-12-31' } };
    assert.equal(isExpired(futureBundle), false);

    const pastBundle = { link: { expires_at: '2020-01-01' } };
    assert.equal(isExpired(pastBundle), true);
  });
});

describe('CSRF and Middleware behavior', () => {
  const { requireCsrf } = require('../src/auth');

  test('requireCsrf blocks requests without CSRF token (returns 403 JSON for AJAX)', () => {
    let statusCode = null;
    let jsonResult = null;
    let nextCalled = false;

    const req = {
      body: { status: 'pass' },
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      session: { csrfToken: 'valid-token-123' }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { jsonResult = data; return this; },
      render() { throw new Error('Should not render HTML for AJAX'); }
    };

    requireCsrf(req, res, () => { nextCalled = true; });

    assert.equal(statusCode, 403);
    assert.equal(jsonResult.ok, false);
    assert.match(jsonResult.error, /Session expired/);
    assert.equal(nextCalled, false);
  });

  test('requireCsrf accepts valid CSRF token in body', () => {
    let nextCalled = false;
    let statusCode = null;

    const req = {
      body: { _csrf: 'valid-token-123', status: 'pass' },
      headers: {},
      session: { csrfToken: 'valid-token-123' }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      render() { throw new Error('Should not render error on success'); }
    };

    requireCsrf(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(statusCode, null);
  });

  test('requireCsrf accepts valid CSRF token in X-CSRF-Token header', () => {
    let nextCalled = false;
    let statusCode = null;

    const req = {
      body: { status: 'pass' },
      headers: {
        'x-csrf-token': 'valid-token-123',
        'x-requested-with': 'XMLHttpRequest'
      },
      session: { csrfToken: 'valid-token-123' }
    };
    const res = {
      status(code) { statusCode = code; return this; },
      json() { throw new Error('Should not return error JSON on success'); }
    };

    requireCsrf(req, res, () => { nextCalled = true; });

    assert.equal(nextCalled, true);
    assert.equal(statusCode, null);
  });
});

describe('Portal views and routing logic', () => {
  const ejs = require('ejs');
  const path = require('node:path');

  test('views/public/index.ejs renders both Client and Company portals', async () => {
    const templatePath = path.join(__dirname, '..', 'src', 'views', 'public', 'index.ejs');
    const html = await ejs.renderFile(templatePath, {
      title: 'UAT Desk',
      side: 'public',
      companyUser: null,
      csrfToken: 'test-csrf',
      assetVersion: '1.0.0'
    }, {
      views: [path.join(__dirname, '..', 'src', 'views')]
    });

    assert.match(html, /Client Portal/);
    assert.match(html, /Company Workspace/);
    assert.match(html, /href="\/client"/);
    assert.match(html, /href="\/company"/);
    assert.match(html, /href="\/verify"/);
  });

  test('views/public/client-portal.ejs renders client checklist access form', async () => {
    const templatePath = path.join(__dirname, '..', 'src', 'views', 'public', 'client-portal.ejs');
    const html = await ejs.renderFile(templatePath, {
      title: 'Client Portal',
      side: 'client',
      token: 'UAT-ACME23',
      error: null,
      csrfToken: 'test-csrf',
      assetVersion: '1.0.0',
      isDev: true
    }, {
      views: [path.join(__dirname, '..', 'src', 'views')]
    });

    assert.match(html, /Open your UAT checklist/);
    assert.match(html, /name="token"/);
    assert.match(html, /name="password"/);
    assert.match(html, /UAT-ACME23/);
    assert.match(html, /Demo Shortcuts/);
    assert.match(html, /Company sign in/);
  });

  test('Client token parser handles both plain tokens and full URLs', () => {
    const parse = raw => {
      const match = /(?:^|\/p\/)([A-Za-z0-9-]+)\/?$/.exec(String(raw || '').trim());
      return match ? match[1].toUpperCase() : String(raw || '').trim().toUpperCase();
    };

    assert.equal(parse('UAT-ACME23'), 'UAT-ACME23');
    assert.equal(parse('uat-acme23'), 'UAT-ACME23');
    assert.equal(parse('http://localhost:3100/p/UAT-ACME23'), 'UAT-ACME23');
    assert.equal(parse('https://example.com/p/UAT-NWFS10/'), 'UAT-NWFS10');
  });

  test('views/company/login.ejs renders company login form', async () => {
    const templatePath = path.join(__dirname, '..', 'src', 'views', 'company', 'login.ejs');
    const html = await ejs.renderFile(templatePath, {
      title: 'Company Sign In',
      side: 'public',
      email: 'admin@uatdesk.local',
      error: null,
      csrfToken: 'test-csrf',
      assetVersion: '1.0.0',
      companyUser: null
    }, {
      views: [path.join(__dirname, '..', 'src', 'views')]
    });

    assert.match(html, /Sign in to UAT Desk/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="password"/);
    assert.match(html, /Open Client Portal/);
  });

  test('views/error.ejs renders gracefully', async () => {
    const templatePath = path.join(__dirname, '..', 'src', 'views', 'error.ejs');
    const html = await ejs.renderFile(templatePath, {
      title: 'Not found',
      side: 'public',
      status: 404,
      message: 'That page does not exist.',
      csrfToken: 'test-csrf',
      assetVersion: '1.0.0',
      companyUser: null
    }, {
      views: [path.join(__dirname, '..', 'src', 'views')]
    });

    assert.match(html, /Not found/);
    assert.match(html, /404/);
    assert.match(html, /That page does not exist/);
  });

  test('views/public/verify.ejs renders certificate search and details', async () => {
    const templatePath = path.join(__dirname, '..', 'src', 'views', 'public', 'verify.ejs');
    const html = await ejs.renderFile(templatePath, {
      title: 'Verify Certificate',
      side: 'public',
      id: 'VC-ABCD-1234',
      error: null,
      result: {
        found: true,
        row: {
          product_name: 'Acme Portal',
          version: '1.0',
          client_name: 'Acme Corp',
          signed_at: new Date('2026-03-01T12:00:00Z'),
          verification_id: 'VC-ABCD-1234',
          token: 'UAT-ACME23',
          signer_name: 'Jane Doe',
          signer_designation: 'VP Quality',
          otp_verified_at: new Date('2026-03-01T11:55:00Z'),
          record_hash: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        }
      },
      fileCheck: null,
      csrfToken: 'test-csrf',
      assetVersion: '1.0.0',
      companyUser: null,
      fmt: (d) => d ? d.toISOString() : ''
    }, {
      views: [path.join(__dirname, '..', 'src', 'views')]
    });

    assert.match(html, /Verify a UAT certificate/);
    assert.match(html, /VC-ABCD-1234/);
    assert.match(html, /Acme Portal/);
    assert.match(html, /Jane Doe/);
    assert.match(html, /Record SHA-256/);
  });
});

describe('Company users management', () => {
  test('validateAdminInput normalizes email/name and checks password length', () => {
    const badEmail = validateAdminInput({
      email: 'not-an-email',
      name: 'Ada Lovelace',
      password: 'longpassword123'
    });
    assert.equal(badEmail.ok, false);

    const shortPass = validateAdminInput({
      email: 'Ada@Company.com',
      name: 'Ada Lovelace',
      password: 'short'
    });
    assert.equal(shortPass.ok, false);

    const valid = validateAdminInput({
      email: '  Ada@Company.COM ',
      name: '  Ada Lovelace ',
      password: 'longpassword123'
    });
    assert.deepEqual(valid, {
      ok: true,
      email: 'ada@company.com',
      name: 'Ada Lovelace',
      password: 'longpassword123'
    });
    assert.equal(validatePassword('1234567890').ok, true);
    assert.equal(validatePassword('123456789').ok, false);
  });

  test('addCompanyAdmin creates new admins and rejects duplicates unless updateIfExists is true', async () => {
    const store = [];
    const mockQuery = async (sql, params = []) => {
      if (sql.includes('SELECT') && sql.includes('lower(email)')) {
        return { rows: store.filter(u => u.email === params[0]) };
      }
      if (sql.includes('INSERT INTO company_users')) {
        const row = {
          id: params[0],
          email: params[1],
          name: params[2],
          password_hash: params[3],
          created_at: new Date('2026-11-25T10:00:00Z'),
          last_login_at: null
        };
        store.push(row);
        return { rows: [row] };
      }
      if (sql.includes('UPDATE company_users')) {
        const user = store.find(u => u.id === params[0]);
        user.name = params[1];
        user.password_hash = params[2];
        return { rows: [user] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    };

    const created = await addCompanyAdmin(
      { email: 'NewAdmin@Acme.com', name: 'New Admin', password: 'StrongPassword123' },
      mockQuery
    );
    assert.equal(created.action, 'created');
    assert.equal(created.user.email, 'newadmin@acme.com');

    await assert.rejects(
      () =>
        addCompanyAdmin(
          { email: 'newadmin@acme.com', name: 'Duplicate', password: 'AnotherPassword123' },
          mockQuery
        ),
      err => err.status === 409
    );

    const updated = await addCompanyAdmin(
      {
        email: 'newadmin@acme.com',
        name: 'Updated Name',
        password: 'UpdatedPassword123',
        updateIfExists: true
      },
      mockQuery
    );
    assert.equal(updated.action, 'updated');
    assert.equal(updated.user.name, 'Updated Name');
  });

  test('changeCompanyUserPassword enforces currentPassword for self but lets another admin reset', async () => {
    const oldHash = scryptHash('OldPassword123');
    const otherHash = scryptHash('OtherOldPass123');
    const store = [
      { id: 'u1', email: 'old@acme.com', name: 'Old Admin', password_hash: oldHash },
      { id: 'u2', email: 'new@acme.com', name: 'New Admin', password_hash: otherHash }
    ];
    const mockQuery = async (sql, params = []) => {
      if (sql.includes('SELECT id, email, name, password_hash')) {
        return { rows: store.filter(u => u.id === params[0]) };
      }
      if (sql.includes('UPDATE company_users SET password_hash')) {
        const u = store.find(row => row.id === params[0]);
        u.password_hash = params[1];
        return { rows: [] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    };

    await assert.rejects(
      () =>
        changeCompanyUserPassword(
          {
            targetUserId: 'u1',
            currentPassword: 'WrongPassword123',
            newPassword: 'NewSelfPassword123',
            actingUserId: 'u1'
          },
          mockQuery
        ),
      err => err.status === 400
    );

    const selfUpdated = await changeCompanyUserPassword(
      {
        targetUserId: 'u1',
        currentPassword: 'OldPassword123',
        newPassword: 'NewSelfPassword123',
        actingUserId: 'u1'
      },
      mockQuery
    );
    assert.equal(selfUpdated.email, 'old@acme.com');

    const adminReset = await changeCompanyUserPassword(
      {
        targetUserId: 'u1',
        newPassword: 'ResetByPeerPassword123',
        actingUserId: 'u2'
      },
      mockQuery
    );
    assert.equal(adminReset.email, 'old@acme.com');
  });
});
