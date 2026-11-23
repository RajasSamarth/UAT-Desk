const crypto = require('node:crypto');
const config = require('./config');

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LOWER = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomString(length, alphabet = UPPER) {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

const uuid = () => crypto.randomUUID();
const generateProjectId = () => `UAT-${randomString(6)}`;
const generateVerificationId = () => `VC-${randomString(4)}-${randomString(4)}`;
const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const generateClientPassword = () => [4, 4, 4].map(n => randomString(n, LOWER)).join('-');

function scryptHash(password, salt = crypto.randomBytes(16)) {
  const key = crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

function scryptVerify(password, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(N), r: Number(r), p: Number(p)
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function hashOtp(code) {
  return crypto.createHmac('sha256', config.sessionSecret).update(String(code)).digest('hex');
}

function verifyOtpHash(code, stored) {
  try {
    const actual = Buffer.from(hashOtp(code), 'hex');
    const expected = Buffer.from(String(stored), 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Stable serialisation so the same record always produces the same hash.
function canonicalJson(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

const isValidEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

// Accepts data:image/png;base64,... and returns a Buffer after checking the
// magic bytes, so a mislabelled file cannot reach the PDF renderer.
function decodeImageDataUrl(dataUrl, allowed = ['png', 'jpeg', 'webp']) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) return null;
  const kind = match[1] === 'jpg' ? 'jpeg' : match[1];
  if (!allowed.includes(kind)) return null;
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 4 * 1024 * 1024) return null;
  const isPng = buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if ((kind === 'png' && !isPng) || (kind === 'jpeg' && !isJpeg) || (kind === 'webp' && !isWebp)) return null;
  return { kind, buffer };
}

function imageKindFromBuffer(buffer) {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.length > 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

module.exports = {
  randomString,
  uuid,
  generateProjectId,
  generateVerificationId,
  generateOtp,
  generateClientPassword,
  scryptHash,
  scryptVerify,
  hashOtp,
  verifyOtpHash,
  sha256Hex,
  canonicalJson,
  isValidEmail,
  decodeImageDataUrl,
  imageKindFromBuffer
};
