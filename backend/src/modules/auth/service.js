import { createHash, randomBytes } from 'node:crypto';
export const tokenHash = (value) => createHash('sha256').update(value).digest('hex');
export const sessionAge = 7 * 24 * 60 * 60 * 1000;
export function createAuthService(pool) {
  return {
    async limited(key, limit) {
      const { rows } = await pool.query(
        `INSERT INTO auth_attempts(key, attempts, expires_at)
        VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key) DO UPDATE SET
        attempts=CASE WHEN auth_attempts.expires_at <= NOW() THEN 1 ELSE auth_attempts.attempts+1 END,
        expires_at=CASE WHEN auth_attempts.expires_at <= NOW() THEN NOW()+INTERVAL '15 minutes' ELSE auth_attempts.expires_at END
        RETURNING attempts`,
        [tokenHash(key)],
      );
      return rows[0].attempts > limit;
    },
    async createSession(userId, oldToken) {
      const token = randomBytes(32).toString('hex');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        if (oldToken)
          await client.query('DELETE FROM auth_sessions WHERE token_hash=$1', [
            tokenHash(oldToken),
          ]);
        await client.query(
          "INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '7 days')",
          [tokenHash(token), userId],
        );
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      return token;
    },
    async findSession(token) {
      if (!token) return null;
      const { rows } = await pool.query(
        `SELECT u.id,u.email FROM auth_sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.password_hash IS NOT NULL`,
        [tokenHash(token)],
      );
      return rows[0] ?? null;
    },
    async revoke(token) {
      if (token)
        await pool.query('DELETE FROM auth_sessions WHERE token_hash=$1', [tokenHash(token)]);
    },
    async cleanup() {
      await pool.query('DELETE FROM auth_sessions WHERE expires_at <= NOW()');
      await pool.query('DELETE FROM auth_attempts WHERE expires_at <= NOW()');
    },
  };
}
