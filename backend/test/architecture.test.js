import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../src/db/migrate.js';
import { createAnalysisRepository, parsePage } from '../src/modules/analyses/repository.js';
import { createApp } from '../src/app.js';
test('Migrations are serialized, skip applied versions and roll back on failure', async () => {
  const calls = [];
  let released = false;
  const client = {
    query: async (sql) => {
      calls.push(sql);
      return {
        rows:
          sql === 'SELECT version FROM schema_migrations'
            ? [{ version: 1 }, { version: 2 }, { version: 3 }]
            : [],
      };
    },
    release() {
      released = true;
    },
  };
  await migrate({ connect: async () => client });
  assert.equal(calls[0], 'BEGIN');
  assert.match(calls[1], /pg_advisory_xact_lock/);
  assert.equal(calls.at(-1), 'COMMIT');
  assert.ok(released);
  assert.ok(!calls.some((sql) => sql.includes('ALTER TABLE')));
  calls.length = 0;
  client.query = async (sql) => {
    calls.push(sql);
    if (sql === 'SELECT version FROM schema_migrations') throw Error('database unavailable');
    return { rows: [] };
  };
  await assert.rejects(() => migrate({ connect: async () => client }));
  assert.equal(calls.at(-1), 'ROLLBACK');
});
test('Page queries validate inputs and parameterize filters before limits', async () => {
  for (const query of [
    { today: '2026-02-30' },
    { today: '2026-10-16', page: '-1' },
    { today: '2026-10-16', limit: '101' },
    { today: '2026-10-16', status: 'unexpected' },
  ])
    assert.throws(() => parsePage(query));
  const calls = [];
  const repo = createAnalysisRepository({
    query: async (sql, args) => {
      calls.push({ sql, args });
      if (sql.startsWith('SELECT count(*)::int AS total FROM')) return { rows: [{ total: 41 }] };
      if (sql.startsWith('SELECT *')) return { rows: [] };
      return { rows: [{ total: 99, applied: 3, interviews: 1, offers: 0, due: 2 }] };
    },
  });
  const result = await repo.page(
    {
      today: '2026-10-16',
      page: '2',
      limit: '20',
      status: 'Entrevista',
      followUp: 'due',
    },
    '7',
  );
  assert.equal(result.pages, 3);
  assert.equal(result.stats.total, 99);
  assert.deepEqual(calls[1].args, ['7', 'Entrevista', '2026-10-16', 20, 20]);
  assert.match(calls[1].sql, /LIMIT \$4 OFFSET \$5/);
});
test('App factory starts without database side effects and reports health failures', async () => {
  const app = createApp({
    pool: {
      query: async () => {
        throw Error('offline');
      },
    },
    config: { mode: 'demo' },
    vacancies: { get: async () => ({ jobs: [] }) },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const config = await fetch(base + '/api/config');
    assert.equal((await config.json()).mode, 'demo');
    assert.ok(config.headers.get('x-request-id'));
    assert.equal((await fetch(base + '/health')).status, 503);
    assert.equal((await fetch(base + '/api/analyses/page?today=invalid')).status, 401);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
