import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '..', 'dist');
const serverSpa = path.resolve(__dirname, '..', '..', 'server', 'spa');

fs.rmSync(serverSpa, { recursive: true, force: true });
fs.cpSync(clientDist, serverSpa, { recursive: true });
console.log(`Synced ${clientDist} -> ${serverSpa}`);
