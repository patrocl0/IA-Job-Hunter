import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  validateTracking,
  validDate,
  registerTrackingRoutes,
} from '../src/modules/analyses/tracking.js';
test('Tracking validates calendar dates, links, lengths and field clearing', () => {
  assert.ok(validDate('2024-02-29'));
  assert.ok(!validDate('2025-02-29'));
  assert.ok(!validDate('2026-04-31'));
  assert.ok(!validDate('2026-1-01'));
  assert.ok(!validDate('0000-01-01'));
  assert.deepEqual(
    validateTracking({
      notes: '  Contactar mañana  ',
      followUpOn: '',
      jobUrl: 'https://example.com/job',
    }),
    { notes: 'Contactar mañana', followUpOn: '', jobUrl: 'https://example.com/job' },
  );
  for (const input of [
    { jobUrl: 'javascript:alert(1)' },
    { jobUrl: 'ftp://example.com' },
    { jobUrl: 'https://user:pass@example.com' },
    { notes: 'x'.repeat(5001) },
    { notes: null },
    { followUpOn: '2026-02-30' },
    { unknown: 'x' },
    [],
  ])
    assert.throws(() => validateTracking(input));
});
test('HTTP tracking: partial edits preserve status and fields, due query precedes limit', async () => {
  let row = {
    id: '1',
    status: 'Postulada',
    tracking: { notes: 'Nota anterior', appliedOn: '2026-10-10', followUpOn: '2026-10-16' },
    result: { mode: 'demo' },
  };
  let lastQuery;
  const pool = {
    query: async (sql, args) => {
      lastQuery = { sql, args };
      if (sql.startsWith('UPDATE')) {
        if (args[2] !== '1') return { rows: [] };
        row = {
          ...row,
          status: args[0] ?? row.status,
          tracking: { ...row.tracking, ...JSON.parse(args[1]) },
        };
      }
      return { rows: [structuredClone(row)] };
    },
  };
  const app = express();
  app.use(express.json());
  registerTrackingRoutes(app, pool);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const patch = (body, id = '1') =>
    fetch(base + '/api/analyses/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    let res = await patch({ tracking: { notes: 'Actualizada' } });
    assert.equal(res.status, 200);
    let data = await res.json();
    assert.equal(data.status, 'Postulada');
    assert.equal(data.tracking.appliedOn, '2026-10-10');
    assert.equal(data.tracking.notes, 'Actualizada');
    data = await (await patch({ status: 'Entrevista' })).json();
    assert.equal(data.tracking.notes, 'Actualizada');
    data = await (await patch({ tracking: { followUpOn: '' } })).json();
    assert.equal(data.tracking.followUpOn, '');
    assert.equal(data.status, 'Entrevista');
    for (const body of [
      {},
      { status: 'bad' },
      { tracking: { followUpOn: '2026-02-30' } },
      { title: 'unexpected' },
    ])
      assert.equal((await patch(body)).status, 400);
    assert.equal((await patch({ status: 'Oferta' }, '2')).status, 404);
    assert.equal((await patch({ status: 'Oferta' }, '99999999999999999999')).status, 400);
    assert.equal((await fetch(base + '/api/analyses?followUp=due&today=2026-02-30')).status, 400);
    assert.equal((await fetch(base + '/api/analyses?followUp=due&today=2026-10-16')).status, 200);
    assert.deepEqual(lastQuery.args, ['2026-10-16']);
    assert.match(lastQuery.sql, /WHERE.*NOT IN.*<= \$1 ORDER BY.*LIMIT 100/);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
