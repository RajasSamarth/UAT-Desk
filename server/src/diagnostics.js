const config = require('./config');
const { networkProbe, withTimeout } = require('./net-probe');

// Runs once per cold start, in the background, and logs the result. The point is
// to answer "where does the database connection stall?" without depending on a
// response ever coming back — a hung request still leaves these lines in the
// platform logs.
let started = false;

async function probe() {
  if (started) return;
  started = true;
  const startedAt = Date.now();
  console.log('[probe] start host=' + (config.databaseHost || '(unset)'));

  let result;
  try {
    result = await networkProbe(config.databaseUrl);
  } catch (err) {
    result = { error: err.code || err.message };
  }
  console.log('[probe] network ' + JSON.stringify(result));

  if (!result || !result.tcp || !result.tcp.ok) {
    console.log('[probe] stop: TCP to the database is not reachable from this runtime');
    return;
  }

  const pgStarted = Date.now();
  try {
    const db = require('./db');
    await withTimeout(db.query('SELECT 1'), 10000, 'probe query');
    console.log('[probe] postgres ok in ' + (Date.now() - pgStarted) + 'ms');
  } catch (err) {
    console.log('[probe] postgres FAILED after ' + (Date.now() - pgStarted) + 'ms: ' + (err.code || err.message));
  }
  console.log('[probe] done in ' + (Date.now() - startedAt) + 'ms');
}

module.exports = { probe };
