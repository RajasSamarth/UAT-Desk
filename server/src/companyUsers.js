const db = require('./db');
const { uuid, scryptHash, scryptVerify, isValidEmail } = require('./security');

const MIN_PASSWORD_LENGTH = 10;

function makeError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Validate fields required to create or update a company admin account.
 */
function validateAdminInput({ email, name, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanPassword = String(password || '');

  if (!isValidEmail(cleanEmail)) {
    return { ok: false, error: 'Enter a valid work email address.' };
  }
  if (cleanName.length < 2) {
    return { ok: false, error: 'Enter the person’s full name (at least 2 characters).' };
  }
  const passCheck = validatePassword(cleanPassword);
  if (!passCheck.ok) {
    return passCheck;
  }

  return {
    ok: true,
    email: cleanEmail,
    name: cleanName,
    password: cleanPassword
  };
}

/**
 * Validate a company admin password against the minimum length rule.
 */
function validatePassword(password) {
  const value = typeof password === 'string' ? password : String(password || '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  return { ok: true };
}

/**
 * List all company admin users without exposing password hashes.
 */
async function listCompanyUsers(queryFn = db.query) {
  const { rows } = await queryFn(
    `SELECT id, email, name, created_at, last_login_at
       FROM company_users
      ORDER BY created_at ASC, email ASC`
  );
  return rows;
}

/**
 * Create a new company admin account (or update when updateIfExists is true).
 */
async function addCompanyAdmin(
  { email, name, password, updateIfExists = false },
  queryFn = db.query
) {
  const checked = validateAdminInput({ email, name, password });
  if (!checked.ok) {
    throw makeError(checked.error, 400);
  }

  const existing = await queryFn(
    'SELECT id, email, name, created_at, last_login_at FROM company_users WHERE lower(email) = lower($1)',
    [checked.email]
  );

  if (existing.rows.length) {
    if (!updateIfExists) {
      throw makeError(
        'An admin account with that email already exists. Reset or change its password in the admin list below.',
        409
      );
    }
    const { rows } = await queryFn(
      `UPDATE company_users
          SET name = $2, password_hash = $3
        WHERE id = $1
       RETURNING id, email, name, created_at, last_login_at`,
      [existing.rows[0].id, checked.name, scryptHash(checked.password)]
    );
    return { action: 'updated', user: rows[0] };
  }

  const { rows } = await queryFn(
    `INSERT INTO company_users (id, email, name, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, created_at, last_login_at`,
    [uuid(), checked.email, checked.name, scryptHash(checked.password)]
  );
  return { action: 'created', user: rows[0] };
}

/**
 * Update a company admin's password. Requires currentPassword when updating oneself.
 */
async function changeCompanyUserPassword(
  { targetUserId, newPassword, currentPassword, actingUserId },
  queryFn = db.query
) {
  const passCheck = validatePassword(newPassword);
  if (!passCheck.ok) {
    throw makeError(passCheck.error, 400);
  }

  const { rows } = await queryFn(
    'SELECT id, email, name, password_hash FROM company_users WHERE id = $1',
    [targetUserId]
  );
  const target = rows[0];
  if (!target) {
    throw makeError('Admin account not found.', 404);
  }

  if (actingUserId && String(actingUserId) === String(target.id)) {
    const provided = String(currentPassword || '');
    if (!provided || !scryptVerify(provided, target.password_hash)) {
      throw makeError('Current password is incorrect.', 400);
    }
  }

  await queryFn('UPDATE company_users SET password_hash = $2 WHERE id = $1', [
    target.id,
    scryptHash(String(newPassword))
  ]);

  return {
    id: target.id,
    email: target.email,
    name: target.name
  };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  validateAdminInput,
  validatePassword,
  listCompanyUsers,
  addCompanyAdmin,
  changeCompanyUserPassword
};
