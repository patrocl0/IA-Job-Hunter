import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.js';
import { migrate, migrations } from '../src/db/migrate.js';
import { activateOwner } from '../src/modules/auth/owner.js';
import { credentials, hashPassword, verifyPassword } from '../src/modules/auth/passwords.js';
import { readAuthConfig } from '../src/modules/auth/routes.js';
import { createAuthService, tokenHash } from '../src/modules/auth/service.js';

test('Passwords and auth configuration reject unsafe inputs', async () => {
  assert.throws(() => credentials({ email: 'bad', password: 'a'.repeat(12) }));
  assert.throws(() => credentials({ email: 'a@example.com', password: 'short' }));
  assert.throws(() => credentials({ email: 'a@example.com', password: '😀'.repeat(100) }));
  assert.equal(
    credentials({ email: ' A@Example.com ', password: 'long password phrase' }).email,
    'a@example.com',
  );
  const hash = await hashPassword('long password phrase');
  assert.ok(!hash.includes('long password phrase'));
  assert.ok(await verifyPassword('long password phrase', hash));
  assert.ok(!(await verifyPassword('wrong password phrase', hash)));
  assert.ok(!(await verifyPassword('long password phrase', null)));
  assert.throws(() => readAuthConfig({ APP_ORIGIN: 'http://example.com' }));
  assert.throws(() => readAuthConfig({ APP_ORIGIN: 'https://example.com/path' }));
  assert.equal(readAuthConfig({ APP_ORIGIN: 'https://example.com' }).secure, true);
  assert.equal(readAuthConfig().registration, false);
});

test('Migration preserves owner data; HTTP sessions isolate two accounts and deny cross-user writes', async () => {
  const db = new PGlite();
  // Execute actual PostgreSQL SQL in an embedded engine, not a SQL string mock.
  const query = async (sql, args) => {
    if (sql.includes(';') && !args?.length) return (await db.exec(sql)).at(-1);
    const result = await db.query(sql, args);
    return { ...result, rowCount: result.affectedRows };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  await db.exec(
    'CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  );
  for (const migration of migrations.filter((m) => m.version < 3)) {
    await db.exec(migration.sql);
    await query('INSERT INTO schema_migrations(version) VALUES($1)', [migration.version]);
  }
  const oldProfile = {
    name: 'Propietario anterior',
    headline: 'Frontend developer',
    skills: 'React',
    experience: 'Experiencia de ejemplo conservada tras la migración.',
  };
  await query('INSERT INTO professional_profile(id,data) VALUES(1,$1)', [oldProfile]);
  await query(
    "INSERT INTO analyses(title,result,tracking) VALUES('Análisis anterior','{}','{\"notes\":\"Nota anterior\"}')",
  );
  await query(
    'INSERT INTO saved_vacancies(source_id,data) VALUES(\'10\',\'{"title":"Vacante anterior"}\')',
  );
  await migrate(pool);
  await migrate(pool);
  assert.equal((await query('SELECT count(*)::int AS n FROM users')).rows[0].n, 1);
  const owner = await activateOwner(pool, {
    email: 'owner@example.com',
    password: 'owner password phrase',
  });
  await assert.rejects(
    () =>
      activateOwner(pool, { email: 'intruder@example.com', password: 'another password phrase' }),
    /ya está activada/,
  );
  const app = createApp({
    pool,
    config: { mode: 'demo' },
    authConfig: { origin: 'http://localhost:8080', registration: true, secure: false },
    vacancies: {
      get: async () => ({
        jobs: [
          {
            id: '10',
            title: 'Frontend',
            company: 'Ejemplo',
            url: 'https://example.com',
            description: 'React',
          },
        ],
      }),
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const makeClient = () => {
    let cookie = '';
    return {
      get cookie() {
        return cookie;
      },
      async request(path, method = 'GET', body, expected = 200, headers = {}) {
        const response = await fetch(base + path, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Job-Hunter': '1',
            Cookie: cookie,
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        const raw = await response.text();
        assert.equal(response.status, expected, `${method} ${path}: ${raw}`);
        if (response.headers.has('set-cookie'))
          cookie = response.headers.get('set-cookie').split(';')[0];
        return { data: raw ? JSON.parse(raw) : null, response };
      },
    };
  };
  const a = makeClient(),
    b = makeClient(),
    guest = makeClient();
  try {
    for (const path of [
      '/api/profile',
      '/api/analyses',
      '/api/analyses/page?today=2026-10-17',
      '/api/vacancies/saved',
      '/api/vacancies',
    ])
      await guest.request(path, 'GET', undefined, 401);
    await guest.request('/api/analyses', 'POST', {}, 401);
    assert.equal((await guest.request('/api/auth/session')).data.user, null);
    await guest.request(
      '/api/auth/login',
      'POST',
      { email: 'owner@example.com', password: 'wrong password phrase' },
      401,
    );
    const login = await a.request('/api/auth/login', 'POST', {
      email: 'owner@example.com',
      password: 'owner password phrase',
    });
    assert.match(login.response.headers.get('set-cookie'), /HttpOnly/);
    assert.match(login.response.headers.get('set-cookie'), /SameSite=Strict/);
    assert.equal(String(login.data.user.id), String(owner.id));
    assert.equal(login.data.user.password_hash, undefined);
    assert.equal((await a.request('/api/profile')).data.profile.name, oldProfile.name);
    const oldAnalyses = (await a.request('/api/analyses')).data;
    assert.equal(oldAnalyses.length, 1);
    assert.equal(oldAnalyses[0].tracking.notes, 'Nota anterior');
    const oldId = oldAnalyses[0].id;
    assert.equal((await a.request('/api/vacancies/saved')).data.total, 1);
    const registered = await b.request(
      '/api/auth/register',
      'POST',
      { email: 'b@example.com', password: 'second password phrase' },
      201,
    );
    assert.notEqual(registered.data.user.id, owner.id);
    assert.equal((await b.request('/api/profile')).data.profile, null);
    assert.equal((await b.request('/api/analyses')).data.length, 0);
    assert.equal((await b.request('/api/analyses/page?today=2026-10-17')).data.stats.total, 0);
    assert.equal((await b.request('/api/vacancies/saved')).data.total, 0);
    await b.request('/api/analyses/' + oldId, 'PATCH', { status: 'Oferta' }, 404);
    await b.request('/api/analyses/' + oldId, 'DELETE', {}, 404);
    await b.request('/api/vacancies/saved/10', 'PATCH', { status: 'Oferta' }, 404);
    await b.request('/api/vacancies/saved/10', 'DELETE', {}, 204);
    await b.request('/api/profile', 'DELETE', {}, 204);
    assert.equal((await a.request('/api/profile')).data.profile.name, oldProfile.name);
    assert.equal((await a.request('/api/vacancies/saved')).data.total, 1);
    await b.request('/api/profile', 'PUT', {
      name: 'Otra persona',
      headline: 'Backend developer',
      skills: 'Node.js',
    });
    assert.equal((await a.request('/api/profile')).data.profile.name, oldProfile.name);
    await b.request('/api/vacancies/saved', 'POST', { id: '10' }, 201);
    await b.request('/api/vacancies/saved/10', 'PATCH', { status: 'Entrevista' });
    assert.equal((await a.request('/api/vacancies/saved')).data.items[0].status, 'Guardada');
    const created = await b.request(
      '/api/analyses',
      'POST',
      {
        title: 'Vacante nueva',
        cv: 'Experiencia desarrollando aplicaciones con React, Node.js y pruebas automatizadas para proyectos web.',
        job: 'Buscamos una persona con experiencia desarrollando aplicaciones con React, Node.js y pruebas automatizadas.',
      },
      201,
    );
    await b.request('/api/analyses/' + created.data.id, 'PATCH', {
      status: 'Entrevista',
      tracking: { followUpOn: '2026-10-16', notes: 'Privado B' },
    });
    assert.equal((await b.request('/api/analyses?followUp=due&today=2026-10-17')).data.length, 1);
    const stats = (await b.request('/api/analyses/page?today=2026-10-17')).data.stats;
    assert.equal(stats.total, 1);
    assert.equal(stats.interviews, 1);
    assert.equal(stats.due, 1);
    assert.equal((await a.request('/api/analyses/page?today=2026-10-17')).data.stats.interviews, 0);
    await b.request('/api/profile', 'DELETE', {}, 403, { 'X-Job-Hunter': '' });
    await b.request('/api/auth/logout', 'POST', {}, 403, { Origin: 'https://evil.example' });
    const cookieBefore = b.cookie;
    await b.request('/api/auth/login', 'POST', {
      email: 'b@example.com',
      password: 'second password phrase',
    });
    assert.notEqual(b.cookie, cookieBefore);
    await guest.request('/api/profile', 'GET', undefined, 401, { Cookie: cookieBefore });
    const logoutCookie = b.cookie;
    await b.request('/api/auth/logout', 'POST', {}, 204);
    await guest.request('/api/profile', 'GET', undefined, 401, { Cookie: logoutCookie });
    // A forged cookie never authenticates; header checks also cover login CSRF.
    await guest.request('/api/profile', 'GET', undefined, 401, {
      Cookie: 'jobhunter_session=' + 'a'.repeat(64),
    });
    await guest.request(
      '/api/auth/login',
      'POST',
      { email: 'owner@example.com', password: 'owner password phrase' },
      403,
      { 'X-Job-Hunter': '' },
    );
    // The HTTP limiter runs before password work.
    for (let i = 0; i < 10; i++)
      await createAuthService(pool).limited('email:limited@example.com', 10);
    await guest.request(
      '/api/auth/login',
      'POST',
      { email: 'limited@example.com', password: 'a long password phrase' },
      429,
    );
    const sessionCookie = a.cookie;
    const raw = sessionCookie.split('=')[1];
    assert.equal(
      (await query('SELECT token_hash FROM auth_sessions WHERE user_id=$1', [owner.id])).rows[0]
        .token_hash,
      tokenHash(raw),
    );
    await query("UPDATE auth_sessions SET expires_at=NOW()-INTERVAL '1 minute' WHERE user_id=$1", [
      owner.id,
    ]);
    await a.request('/api/profile', 'GET', undefined, 401);
    const auth = createAuthService(pool);
    assert.equal(await auth.limited('limit-test', 1), false);
    assert.equal(await auth.limited('limit-test', 1), true);
    await query("UPDATE auth_attempts SET expires_at=NOW()-INTERVAL '1 minute'");
    assert.equal(await auth.limited('limit-test', 1), false);
    await auth.cleanup();
    assert.equal((await query('SELECT * FROM auth_sessions')).rows.length, 0);
  } finally {
    await new Promise((r) => server.close(r));
    await db.close();
  }
});

test('Registration is closed by default and upload endpoints require a session', async () => {
  const app = createApp({
    pool: { query: async () => ({ rows: [{ attempts: 1 }] }) },
    config: { mode: 'demo' },
    vacancies: {},
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const registration = await fetch(url + '/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Job-Hunter': '1' },
      body: JSON.stringify({ email: 'a@example.com', password: 'a long password phrase' }),
    });
    assert.equal(registration.status, 403);
    const form = new FormData();
    form.append('cv', new Blob(['text']), 'cv.pdf');
    const upload = await fetch(url + '/api/cv/import', {
      method: 'POST',
      headers: { 'X-Job-Hunter': '1' },
      body: form,
    });
    assert.equal(upload.status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
