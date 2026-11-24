const net = require('node:net');
const dns = require('node:dns').promises;

// A hard ceiling around any promise. pg's own connectionTimeoutMillis calls
// `con.stream.destroy()` and throws when the socket was never created (stalled
// DNS), which leaves the request hanging until the platform kills it.
function withTimeout(promise, ms, label) {
  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: 'APP_TIMEOUT' }));
    }, ms);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

function parseDbTarget(url) {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port || 5432) };
  } catch {
    return { host: null, port: 5432 };
  }
}

function probeTcp(host, port, timeoutMs) {
  return new Promise(resolve => {
    const started = Date.now();
    const socket = new net.Socket();
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ...result, ms: Date.now() - started });
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ ok: true }));
    socket.once('timeout', () => finish({ ok: false, error: 'TCP_TIMEOUT' }));
    socket.once('error', err => finish({ ok: false, error: err.code || err.message }));
    socket.connect(port, host);
  });
}

// Diagnoses the exact hop that fails: DNS, then TCP. Used by /healthz?net=1.
async function networkProbe(url) {
  const { host, port } = parseDbTarget(url);
  if (!host) return { host, port, dns: { ok: false, error: 'no host in DATABASE_URL' }, tcp: { ok: false } };

  const dnsStarted = Date.now();
  let dnsResult;
  try {
    const addresses = await withTimeout(dns.lookup(host, { all: true }), 5000, 'dns lookup');
    dnsResult = { ok: true, addresses, ms: Date.now() - dnsStarted };
  } catch (err) {
    dnsResult = { ok: false, error: err.code || err.message, ms: Date.now() - dnsStarted };
  }
  if (!dnsResult.ok) return { host, port, dns: dnsResult, tcp: { ok: false, error: 'skipped' } };

  const tcp = await probeTcp(host, port, 8000);
  return { host, port, dns: dnsResult, tcp };
}

module.exports = { withTimeout, parseDbTarget, probeTcp, networkProbe };
