const db = require('./db');
const { addCompanyAdmin } = require('./companyUsers');

// Usage: npm run user:add -- someone@company.com "Full Name" "a long password"
const [emailArg, nameArg, passwordArg] = process.argv.slice(2);

if (!emailArg || !nameArg || !passwordArg) {
  console.error('Usage: npm run user:add -- email@company.com "Full Name" "password"');
  process.exit(1);
}

(async () => {
  const { action, user } = await addCompanyAdmin({
    email: emailArg,
    name: nameArg,
    password: passwordArg,
    updateIfExists: true
  });
  console.log(
    action === 'updated'
      ? `Updated company user ${user.email}.`
      : `Created company user ${user.email}.`
  );
  await db.pool.end();
})().catch(async err => {
  console.error(err.status === 400 ? err.message : 'Could not add the user', err.status === 400 ? '' : err);
  try { await db.pool.end(); } catch (e) { /* ignore */ }
  process.exit(1);
});
