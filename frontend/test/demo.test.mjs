import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoApi, STORAGE_KEY, jobs } from '../src/data/demo/demo-store.mjs';
function setup() {
  const data = new Map();
  return {
    data,
    api: createDemoApi({ getItem: (k) => data.get(k), setItem: (k, v) => data.set(k, v) }),
  };
}
const call = async (api, url, method = 'GET', body) => {
  const res = await api(url, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
test('Visitors remain isolated; saved vacancies deduplicate and persist', async () => {
  const a = setup(),
    b = setup();
  await call(a.api, '/api/vacancies/saved', 'POST', { id: jobs[0].id });
  await call(a.api, '/api/vacancies/saved', 'POST', { id: jobs[0].id });
  assert.equal((await call(a.api, '/api/vacancies/saved')).body.total, 1);
  assert.equal((await call(b.api, '/api/vacancies/saved')).body.total, 0);
  await call(a.api, '/api/vacancies/saved/' + jobs[0].id, 'PATCH', { status: 'Entrevista' });
  assert.equal((await call(a.api, '/api/vacancies/saved')).body.items[0].status, 'Entrevista');
  await call(a.api, '/api/vacancies/saved/' + jobs[0].id, 'DELETE');
  assert.equal((await call(a.api, '/api/vacancies/saved')).body.total, 0);
});
test('Profile update, deletion and reset have distinct behavior', async () => {
  const { api, data } = setup();
  await call(api, '/api/profile', 'PUT', { name: 'Visitante Uno', headline: 'Frontend Developer' });
  assert.match((await call(api, '/api/profile')).body.cvText, /Visitante Uno/);
  await call(api, '/api/profile', 'DELETE');
  assert.equal((await call(api, '/api/profile')).body.profile, null);
  data.delete(STORAGE_KEY);
  assert.match((await call(api, '/api/profile')).body.profile.name, /ejemplo/);
});
test('Demo has no score, does not store raw CV, validates input and status', async () => {
  const { api, data } = setup();
  assert.equal((await call(api, '/api/analyses', 'POST', { title: 'x' })).status, 400);
  const item = (
    await call(api, '/api/analyses', 'POST', {
      title: 'React developer',
      cv: 'SECRET-CV '.repeat(10),
      job: 'Example job '.repeat(10),
    })
  ).body;
  assert.equal(item.result.score, null);
  assert.equal(item.result.mode, 'demo');
  assert.ok(!data.get(STORAGE_KEY).includes('SECRET-CV'));
  assert.equal(
    (await call(api, '/api/analyses/' + item.id, 'PATCH', { status: 'bad' })).status,
    400,
  );
  assert.equal(
    (await call(api, '/api/analyses/' + item.id, 'PATCH', { status: 'Oferta' })).body.status,
    'Oferta',
  );
  await call(api, '/api/analyses/' + item.id, 'DELETE');
  assert.equal((await call(api, '/api/analyses')).body.length, 0);
});
test('Search filters and storage errors produce expected results', async () => {
  const { api } = setup();
  assert.equal((await call(api, '/api/vacancies?q=python&location=colombia')).body.total, 1);
  assert.equal((await call(api, '/api/vacancies?q=nonexistent')).body.total, 0);
  const broken = createDemoApi({
    getItem() {
      throw Error('blocked');
    },
  });
  assert.equal((await broken('/api/profile')).status, 500);
});

test('Follow-up: dates, notes and URL persist independently of status; due filtering excludes closed states', async () => {
  const { api, data } = setup();
  const tracking = {
    jobUrl: 'https://example.com/job',
    appliedOn: '2026-10-10',
    followUpOn: '2026-10-16',
    notes: 'Llamar al contacto de ejemplo',
  };
  const item = (
    await call(api, '/api/analyses', 'POST', {
      title: 'Ejemplo React',
      cv: 'Texto de CV '.repeat(10),
      job: 'Oferta ficticia '.repeat(10),
      tracking,
    })
  ).body;
  assert.deepEqual(item.tracking, tracking);
  const due = (today) => call(api, '/api/analyses?followUp=due&today=' + today);
  assert.equal((await due('2026-10-15')).body.length, 0);
  assert.equal((await due('2026-10-16')).body.length, 1);
  assert.equal((await due('2026-10-17')).body.length, 1);
  assert.equal(
    (await call(api, '/api/analyses/' + item.id, 'PATCH', { tracking: { notes: 'Nueva nota' } }))
      .body.status,
    'Guardada',
  );
  await call(api, '/api/analyses/' + item.id, 'PATCH', { status: 'Oferta' });
  assert.equal((await due('2026-10-17')).body.length, 0);
  await call(api, '/api/analyses/' + item.id, 'PATCH', { status: 'Entrevista' });
  assert.equal((await due('2026-10-17')).body.length, 1);
  await call(api, '/api/analyses/' + item.id, 'PATCH', { tracking: { followUpOn: '' } });
  assert.equal((await due('2026-10-17')).body.length, 0);
  const reloaded = createDemoApi({
    getItem: (k) => data.get(k),
    setItem: (k, v) => data.set(k, v),
  });
  const saved = (await call(reloaded, '/api/analyses')).body[0];
  assert.equal(saved.tracking.notes, 'Nueva nota');
  assert.equal(saved.tracking.appliedOn, tracking.appliedOn);
  for (const invalid of [
    { jobUrl: 'javascript:alert(1)' },
    { followUpOn: '2026-02-30' },
    { notes: 'x'.repeat(5001) },
  ])
    assert.equal(
      (await call(api, '/api/analyses/' + item.id, 'PATCH', { tracking: invalid })).status,
      400,
    );
  assert.equal((await due('2026-02-30')).status, 400);
});
test('Existing demo records remain editable without clearing visitor storage', async () => {
  const { api, data } = setup();
  const old = (
    await call(api, '/api/analyses', 'POST', {
      title: 'Registro antiguo',
      cv: 'Ejemplo CV '.repeat(10),
      job: 'Ejemplo oferta '.repeat(10),
    })
  ).body;
  const state = JSON.parse(data.get(STORAGE_KEY));
  delete state.analyses[0].tracking;
  data.set(STORAGE_KEY, JSON.stringify(state));
  assert.equal((await call(api, '/api/analyses?followUp=due&today=2026-10-16')).body.length, 0);
  const next = (
    await call(api, '/api/analyses/' + old.id, 'PATCH', {
      tracking: { notes: 'Compatible con datos anteriores' },
    })
  ).body;
  assert.equal(next.tracking.notes, 'Compatible con datos anteriores');
  assert.equal(next.title, 'Registro antiguo');
});
test('Pagination keeps global statistics while filtering a page', async () => {
  const { api } = setup();
  for (let i = 0; i < 23; i++)
    await call(api, '/api/analyses', 'POST', {
      title: 'Ejemplo ' + i,
      cv: 'CV de ejemplo '.repeat(10),
      job: 'Vacante ficticia '.repeat(10),
    });
  const page = (await call(api, '/api/analyses/page?page=2&today=2026-10-16')).body;
  assert.equal(page.items.length, 3);
  assert.equal(page.total, 23);
  assert.equal(page.stats.total, 23);
  assert.equal(page.pages, 2);
  const none = (await call(api, '/api/analyses/page?status=Oferta&today=2026-10-16')).body;
  assert.equal(none.items.length, 0);
  assert.equal(none.stats.total, 23);
});
