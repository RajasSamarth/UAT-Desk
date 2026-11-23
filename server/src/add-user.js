const db = require('./db');
const { uuid, scryptHash, isValidEmail } = require('./security');

// Usage: npm run user:add -- someone@company.com "Full Name" "a long password"
const [emailArg, nameArg, passwordArg] = process.argv.slice(2);

if (!emailArg || !nameArg || !passwordArg) {
  console.error('Usage: npm run user:add -- email@company.com "Full Name" "password"');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const name = nameArg.trim();
const password = passwordArg;

if (!isValidEmail(email)) {
  console.error('That email address is not valid.');
  process.exit(1);
}
if (name.length < 2) {
  console.error('Enter the person’s full name.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Use a password of at least 10 characters.');
  process.exit(1);
}

(async () => {
  const existing = await db.query('SELECT id FROM company_users WHERE lower(email) = lower($1)', [email]);
  if (existing.rows.length) {
    await db.query('UPDATE company_users SET name = $2, password_hash = $3 WHERE id = $1', [
      existing.rows[0].id, name, scryptHash(password)
    ]);
    console.log(`Updated company user ${email}.`);
  } else {
    await db.query(
      'INSERT INTO company_users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)',
      [uuid(), email, name, scryptHash(password)]
    );
    console.log(`Created company user ${email}.`);
  }
  await db.pool.end();
})().catch(async err => {
  console.error('Could not add the user', err);
  try { await db.pool.end(); } catch (e) { /* ignore */ }
  process.exit(1);
});
