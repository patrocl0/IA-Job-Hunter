import { credentials, hashPassword } from './passwords.js';
export async function activateOwner(pool, input) {
  const { email, password } = credentials(input);
  const hash = await hashPassword(password);
  // The reserved owner is never claimed by HTTP registration.
  const { rows } = await pool.query(
    `UPDATE users SET email=$1,password_hash=$2 WHERE id=1 AND password_hash IS NULL RETURNING id,email`,
    [email, hash],
  );
  if (!rows.length) throw new Error('La cuenta propietaria ya está activada. No se modificó.');
  return rows[0];
}
