import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  normalizeJob,
  searchJobs,
  createVacancyService,
  registerVacancyRoutes,
  CACHE_MS,
} from '../src/modules/vacancies/vacancies.js';
const raw = (id, location = 'Worldwide') => ({
  id,
  url: `https://remotive.com/remote-jobs/software-dev/react-${id}`,
  title: 'React Developer',
  company_name: 'Demo &amp; Co',
  candidate_required_location: location,
  description: '<p>Build React applications with TypeScript.</p><script>alert(1)</script>',
  publication_date: '2026-10-15T10:00:00',
  tags: ['React'],
  salary: '',
});
const payload = () =>
  new Response(JSON.stringify({ jobs: [raw(1), raw(2, 'Colombia'), raw(3, 'USA'), raw(1)] }), {
    headers: { 'Content-Type': 'application/json' },
  });
function repository() {
  let row = null;
  return {
    read: async () => row,
    attempt: async (date) => {
      row = { ...row, lastAttempt: date };
    },
    write: async (jobs, date) => {
      row = { ...row, jobs, fetchedAt: date };
    },
  };
}
test('Normaliza HTML, conserva fuente y rechaza enlaces inseguros', () => {
  const job = normalizeJob(raw(1));
  assert.equal(job.company, 'Demo & Co');
  assert.ok(!job.description.includes('<p>'));
  assert.ok(!job.description.includes('alert'));
  for (const url of [
    'javascript:alert(1)',
    'https://evil.test',
    'https://remotive.com.evil.test',
    'http://remotive.com/x',
    'https://user:pass@remotive.com/x',
  ])
    assert.equal(normalizeJob({ ...raw(1), url }), null);
  assert.equal(job.salary, '');
  assert.equal(normalizeJob({ ...raw(1), title: '' }), null);
});
test('Filtros de texto y ubicación, mundial explícito y paginación', () => {
  const jobs = Array.from({ length: 26 }, (_, i) =>
    normalizeJob(raw(i + 1, i === 0 ? 'Colombia' : 'USA')),
  );
  jobs.push(normalizeJob(raw(27)));
  assert.equal(searchJobs(jobs, { q: 'react typescript', location: 'Colombia' }).total, 2);
  assert.equal(searchJobs(jobs, { location: 'Colombia', worldwide: 'false' }).total, 1);
  assert.equal(searchJobs(jobs, { location: 'Medellín', worldwide: 'false' }).total, 0);
  assert.equal(searchJobs(jobs, { page: '2' }).jobs.length, 12);
  assert.equal(searchJobs(jobs, { page: '999' }).page, 3);
  assert.throws(() => searchJobs(jobs, { q: ['bad'] }));
  assert.throws(() => searchJobs(jobs, { page: '-1' }));
});
test('Caché persistente seis horas, una llamada concurrente y sin duplicados', async () => {
  let now = Date.parse('2026-10-15T10:00:00Z'),
    calls = 0;
  const repo = repository();
  const request = async () => {
    calls++;
    return payload();
  };
  const service = createVacancyService(repo, request, () => now);
  const results = await Promise.all([service.get(), service.get(), service.get()]);
  assert.equal(calls, 1);
  assert.equal(results[0].jobs.length, 3);
  const restarted = createVacancyService(repo, request, () => now);
  await restarted.get();
  assert.equal(calls, 1);
  now += CACHE_MS;
  await restarted.get();
  assert.equal(calls, 2);
});
test('Fallo de fuente conserva copia y marca antigüedad; sin copia no inventa datos', async () => {
  let now = Date.now();
  const repo = repository();
  let fail = false,
    calls = 0;
  const request = async () => {
    calls++;
    if (fail) throw new Error('offline');
    return payload();
  };
  const service = createVacancyService(repo, request, () => now);
  await service.get();
  now += CACHE_MS;
  fail = true;
  const stale = await service.get();
  assert.equal(stale.stale, true);
  assert.equal(stale.jobs.length, 3);
  await service.get();
  assert.equal(calls, 2);
  let attempts = 0;
  const empty = createVacancyService(
    repository(),
    async () => {
      attempts++;
      throw new Error('offline');
    },
    () => now,
  );
  await assert.rejects(() => empty.get(), { status: 503 });
  await assert.rejects(() => empty.get(), { status: 503 });
  assert.equal(attempts, 1);
});
test('HTTP: guarda solo ofertas de la fuente, deduplica y conserva el estado', async () => {
  const saved = new Map();
  const pool = {
    query: async (sql, args = []) => {
      if (sql.startsWith('SELECT count')) return { rows: [{ total: saved.size }] };
      if (sql.startsWith('SELECT *') && sql.includes('WHERE'))
        return { rows: saved.has(args[0]) ? [saved.get(args[0])] : [] };
      if (sql.startsWith('SELECT *'))
        return { rows: [...saved.values()].slice(args[0], args[0] + 12) };
      if (sql.startsWith('INSERT')) {
        if (!saved.has(args[0]))
          saved.set(args[0], {
            source_id: args[0],
            data: args[1],
            status: 'Guardada',
            created_at: new Date().toISOString(),
          });
        return { rows: [saved.get(args[0])] };
      }
      if (sql.startsWith('UPDATE')) {
        const item = saved.get(args[1]);
        if (item) item.status = args[0];
        return { rows: item ? [item] : [] };
      }
      if (sql.startsWith('DELETE')) {
        saved.delete(args[0]);
        return { rowCount: 1 };
      }
      throw new Error('Unexpected SQL');
    },
  };
  const app = express();
  app.use(express.json());
  registerVacancyRoutes(app, pool, {
    get: async () => ({
      jobs: [normalizeJob(raw(1))],
      fetchedAt: new Date().toISOString(),
      stale: false,
      nextRefreshAt: new Date().toISOString(),
    }),
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/vacancies`;
  const request = (path, method, body) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  try {
    assert.equal((await (await fetch(base + '?q=React')).json()).total, 1);
    assert.equal((await request('/saved', 'POST', { id: '999' })).status, 404);
    assert.equal(
      (await request('/saved', 'POST', { id: '1', url: 'https://evil.test' })).status,
      201,
    );
    const item = await (await request('/saved/1', 'PATCH', { status: 'Postulada' })).json();
    assert.equal(item.status, 'Postulada');
    const repeated = await (await request('/saved', 'POST', { id: '1' })).json();
    assert.equal(repeated.status, 'Postulada');
    assert.match(repeated.data.url, /remotive.com/);
    const list = await (await fetch(base + '/saved')).json();
    assert.equal(list.total, 1);
    assert.equal((await request('/saved/1', 'PATCH', { status: 'otro' })).status, 400);
    assert.equal((await request('/saved/1', 'DELETE', {})).status, 204);
    assert.equal((await (await fetch(base + '/saved')).json()).total, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
