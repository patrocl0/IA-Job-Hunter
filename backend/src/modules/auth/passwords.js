import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(derive);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
// Same work factor for unknown accounts; never a usable credential.
const dummy = 'scrypt:' + '00'.repeat(16) + ':' + '00'.repeat(64);
export function credentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new Error('Introduce un correo válido.');
  validatePassword(password);
  return { email, password };
}
export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password) > 256)
    throw new Error('Usa una contraseña de al menos 12 caracteres y como máximo 256 bytes.');
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const valid = typeof encoded === 'string' && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(encoded);
  const [, salt, digest] = (valid ? encoded : dummy).split(':');
  const key = await scrypt(password, salt, 64, options);
  return timingSafeEqual(key, Buffer.from(digest, 'hex')) && valid;
}
