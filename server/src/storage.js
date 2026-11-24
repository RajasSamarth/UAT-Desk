const fs = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const config = require('./config');

let s3Client = null;
let s3Module = null;

function safeLocalPath(key) {
  const root = path.resolve(config.storageDir);
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error('Invalid storage key');
  }
  return full;
}

async function getS3() {
  if (!s3Module) s3Module = await import('@aws-sdk/client-s3');
  if (!s3Client) {
    s3Client = new s3Module.S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint || undefined,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: config.s3.accessKeyId
        ? { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey }
        : undefined
    });
  }
  return { client: s3Client, lib: s3Module };
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  if (Buffer.isBuffer(stream)) return stream;
  if (stream instanceof Uint8Array) return Buffer.from(stream);
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function init() {
  if (config.storageDriver === 's3') {
    const { client, lib } = await getS3();
    try {
      await client.send(new lib.HeadBucketCommand({ Bucket: config.s3.bucket }));
    } catch {
      try {
        await client.send(new lib.CreateBucketCommand({ Bucket: config.s3.bucket }));
        console.log(`Created S3 bucket ${config.s3.bucket}`);
      } catch (err) {
        console.warn(`Could not create S3 bucket ${config.s3.bucket} (${err.message}). Ensure bucket is created in Supabase Storage Dashboard.`);
      }
    }
    return;
  }
  await fs.mkdir(config.storageDir, { recursive: true });
}

async function put(key, buffer, contentType = 'application/octet-stream') {
  if (config.storageDriver === 's3') {
    const { client, lib } = await getS3();
    await client.send(new lib.PutObjectCommand({
      Bucket: config.s3.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    return;
  }
  const full = safeLocalPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
}

async function get(key) {
  if (config.storageDriver === 's3') {
    const { client, lib } = await getS3();
    const out = await client.send(new lib.GetObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    return streamToBuffer(out.Body);
  }
  return fs.readFile(safeLocalPath(key));
}

async function remove(key) {
  if (config.storageDriver === 's3') {
    const { client, lib } = await getS3();
    await client.send(new lib.DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
    return;
  }
  await fs.rm(safeLocalPath(key), { force: true });
}

async function sendFile(res, key, { contentType = 'application/octet-stream', filename = null } = {}) {
  const buffer = await get(key);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'private, no-store');
  if (filename) {
    res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/[^\w.\-]+/g, '-')}"`);
  }
  res.end(buffer);
}

// Kept for callers that prefer a stream; local and S3 both end up buffered
// because screenshots and certificates are small.
function toStream(buffer) {
  return Readable.from(buffer);
}

module.exports = { init, put, get, remove, sendFile, toStream };
