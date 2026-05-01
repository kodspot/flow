import { webcrypto } from 'node:crypto';
const subtle = webcrypto.subtle;
const b64 = (b) => Buffer.from(b).toString('base64url');

const password = process.argv[2];
if (!password) { console.error('Usage: node gen-hash.mjs <password>'); process.exit(1); }

const ITERS = 100_000;
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERS, hash: 'SHA-256' }, key, 256);
const hash = new Uint8Array(bits);
console.log(`pbkdf2$${ITERS}$${b64(salt)}$${b64(hash)}`);
