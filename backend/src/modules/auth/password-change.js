import { credentials, hashPassword, validatePassword, verifyPassword } from './passwords.js';
import { tokenHash } from './service.js';

export class PasswordChangeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validateChange(body) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !['currentPassword', 'newPassword'].includes(key))
  )
    throw new PasswordChangeError('Solicitud de cambio inválida.');
  try {
    validatePassword(body.currentPassword);
    validatePassword(body.newPassword);
  } catch (error) {
    throw new PasswordChangeError(error.message);
  }
  if (body.currentPassword === body.newPassword)
    throw new PasswordChangeError('La nueva contraseña debe ser diferente a la actual.');
  return { currentPassword: body.currentPassword, newPassword: body.newPassword };
}

export async function changePassword(pool, userId, sessionToken, body) {
  const { currentPassword, newPassword } = validateChange(body);
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [userId]);
  const previous = rows[0]?.password_hash;
  if (!(await verifyPassword(currentPassword, previous)))
    throw new PasswordChangeError('La contraseña actual no es correcta.', 403);
  const nextHash = await hashPassword(newPassword);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // This is the same row lock used when issuing a login session and by local recovery.
    const { rows: locked } = await client.query(
      'SELECT password_hash FROM users WHERE id=$1 FOR UPDATE',
      [userId],
    );
    if (!locked[0] || locked[0].password_hash !== previous)
      throw new PasswordChangeError(
        'La cuenta cambió durante la operación. Inicia sesión de nuevo.',
        401,
      );
    const { rows: sessions } = await client.query(
      'SELECT 1 FROM auth_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>NOW()',
      [tokenHash(sessionToken || ''), userId],
    );
    if (!sessions.length)
      throw new PasswordChangeError('La sesión venció. Inicia sesión de nuevo.', 401);
    await client.query('UPDATE users SET password_hash=$1 WHERE id=$2', [nextHash, userId]);
    await client.query('DELETE FROM auth_sessions WHERE user_id=$1', [userId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Administrative local recovery only. Never expose this function through an HTTP endpoint.
export async function resetPasswordLocally(pool, input) {
  const { email, password } = credentials(input);
  const nextHash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE users SET password_hash=$1 WHERE email=$2 AND password_hash IS NOT NULL RETURNING id',
      [nextHash, email],
    );
    if (!rows.length)
      throw new PasswordChangeError('No existe una cuenta activada con ese correo.');
    await client.query('DELETE FROM auth_sessions WHERE user_id=$1', [rows[0].id]);
    await client.query('DELETE FROM auth_attempts WHERE key=$1 OR key=$2', [
      tokenHash('email:' + email),
      tokenHash('password-change:' + rows[0].id),
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
