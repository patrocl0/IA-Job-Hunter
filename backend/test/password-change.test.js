import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { migrate } from '../src/db/migrate.js';
import { createApp } from '../src/app.js';
import { activateOwner } from '../src/modules/auth/owner.js';
import {
  changePassword,
  resetPasswordLocally,
  validateChange,
} from '../src/modules/auth/password-change.js';
import { createAuthService } from '../src/modules/auth/service.js';
import { verifyPassword } from '../src/modules/auth/passwords.js';

const original = 'Original password phrase';
const replacement = 'Replacement password phrase';
async function database(t) {
  const db = new PGlite();
  const query = async (sql, args) => {
    if (sql.includes(';') && !args?.length) return (await db.exec(sql)).at(-1);
    const result = await db.query(sql, args);
    return { ...result, rowCount: result.affectedRows };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  t.after(() => db.close());
  await migrate(pool);
  const user = await activateOwner(pool, { email: 'owner@example.com', password: original });
  const hash = async () =>
    (await query('SELECT password_hash FROM users WHERE id=$1', [user.id])).rows[0].password_hash;
  return { pool, user, hash };
}

test('Password change validates its two fields and keeps whitespace in passwords', () => {
  for (const body of [
    null,
    [],
    {},
    { currentPassword: original, newPassword: 'short' },
    { currentPassword: original, newPassword: original },
    { currentPassword: original, newPassword: replacement, userId: '2' },
    { currentPassword: original, newPassword: '😀'.repeat(100) },
  ])
    assert.throws(() => validateChange(body));
  assert.equal(
    validateChange({ currentPassword: original, newPassword: ' ' + replacement + ' ' }).newPassword,
    ' ' + replacement + ' ',
  );
});

test('HTTP password change requires current password, revokes every session and preserves user data', async (t) => {
  const { pool, user, hash } = await database(t);
  await pool.query('INSERT INTO professional_profile(user_id,data) VALUES($1,$2)', [
    user.id,
    { name: 'Perfil conservado', headline: 'Developer', skills: 'React' },
  ]);
  const app = createApp({
    pool,
    config: { mode: 'demo' },
    authConfig: { origin: 'http://localhost:8080', registration: true, secure: false },
    vacancies: {},
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  t.after(() => new Promise((r) => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, body, cookie = '', status = 200, extraHeaders = {}) {
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Job-Hunter': '1',
        Cookie: cookie,
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    assert.equal(response.status, status, `${path}: ${text}`);
    return {
      data: text ? JSON.parse(text) : null,
      cookie: response.headers.get('set-cookie')?.split(';')[0],
      headers: response.headers,
    };
  }
  const login = async (password = original) =>
    request('/api/auth/login', { email: 'owner@example.com', password });
  await request(
    '/api/auth/password',
    { currentPassword: original, newPassword: replacement },
    '',
    401,
  );
  const first = await login(),
    second = await login();
  const other = await request(
    '/api/auth/register',
    { email: 'other@example.com', password: original },
    '',
    201,
  );
  await request(
    '/api/auth/password',
    { currentPassword: 'incorrect password phrase', newPassword: replacement },
    first.cookie,
    403,
  );
  await request(
    '/api/auth/password',
    { currentPassword: original, newPassword: replacement },
    first.cookie,
    403,
    { 'X-Job-Hunter': '' },
  );
  await request(
    '/api/auth/password',
    { currentPassword: original, newPassword: replacement },
    first.cookie,
    403,
    { Origin: 'https://evil.example' },
  );
  await request(
    '/api/auth/password',
    { currentPassword: original, newPassword: replacement, userId: other.data.user.id },
    first.cookie,
    400,
  );
  assert.ok(await verifyPassword(original, await hash()));
  await request('/api/profile', undefined, second.cookie);
  const result = await request(
    '/api/auth/password',
    { currentPassword: original, newPassword: replacement },
    first.cookie,
    204,
  );
  assert.match(result.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/);
  await request('/api/profile', undefined, first.cookie, 401);
  await request('/api/profile', undefined, second.cookie, 401);
  await request('/api/profile', undefined, other.cookie, 200);
  await request('/api/auth/login', { email: 'owner@example.com', password: original }, '', 401);
  const fresh = await login(replacement);
  assert.equal(
    (await request('/api/profile', undefined, fresh.cookie)).data.profile.name,
    'Perfil conservado',
  );
  assert.ok(await verifyPassword(replacement, await hash()));
  // Password attempts are bounded separately from sign-in attempts.
  for (let i = 0; i < 10; i++)
    await createAuthService(pool).limited('password-change:' + user.id, 10);
  await request(
    '/api/auth/password',
    { currentPassword: replacement, newPassword: original },
    fresh.cookie,
    429,
  );
});

test('Local recovery revokes sessions, does not create accounts and rejects stale login credentials', async (t) => {
  const { pool, user, hash } = await database(t);
  const auth = createAuthService(pool);
  const previous = await hash();
  const token = await auth.createSession(user.id, null, previous);
  await assert.rejects(
    () => resetPasswordLocally(pool, { email: 'absent@example.com', password: replacement }),
    /No existe/,
  );
  assert.ok(await auth.findSession(token));
  await auth.limited('email:owner@example.com', 10);
  await resetPasswordLocally(pool, { email: ' OWNER@example.com ', password: replacement });
  assert.equal(await auth.findSession(token), null);
  assert.ok(await verifyPassword(replacement, await hash()));
  assert.equal((await pool.query('SELECT * FROM auth_attempts')).rows.length, 0);
  // A login verified before recovery cannot issue a new session afterwards.
  await assert.rejects(
    () => auth.createSession(user.id, null, previous),
    (error) => error.status === 401,
  );
  assert.equal((await pool.query('SELECT * FROM auth_sessions')).rows.length, 0);
  assert.equal((await pool.query('SELECT * FROM users')).rows.length, 1);
});

test('Password change rechecks a revoked session and rolls back when session revocation fails', async (t) => {
  const { pool, user, hash } = await database(t);
  const auth = createAuthService(pool);
  const previous = await hash();
  const token = await auth.createSession(user.id, null, previous);
  await auth.revoke(token);
  await assert.rejects(
    () =>
      changePassword(pool, user.id, token, { currentPassword: original, newPassword: replacement }),
    (error) => error.status === 401,
  );
  assert.equal(await hash(), previous);
  const validToken = await auth.createSession(user.id, null, previous);
  let released = false;
  const failurePool = {
    ...pool,
    connect: async () => ({
      async query(sql, args) {
        if (sql === 'DELETE FROM auth_sessions WHERE user_id=$1')
          throw Error('simulated storage failure');
        return pool.query(sql, args);
      },
      release() {
        released = true;
      },
    }),
  };
  await assert.rejects(
    () =>
      changePassword(failurePool, user.id, validToken, {
        currentPassword: original,
        newPassword: replacement,
      }),
    /simulated storage failure/,
  );
  assert.equal(await hash(), previous);
  assert.ok(await auth.findSession(validToken));
  assert.ok(released);
  await assert.rejects(
    () => resetPasswordLocally(failurePool, { email: 'owner@example.com', password: replacement }),
    /simulated storage failure/,
  );
  assert.equal(await hash(), previous);
  assert.ok(await auth.findSession(validToken));
});
