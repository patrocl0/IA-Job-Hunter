import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

if (process.env.SMOKE_ALLOW_WRITES !== 'true') {
  throw new Error(
    'Este test modifica datos. Ejecuta únicamente en CI o una instalación desechable con SMOKE_ALLOW_WRITES=true.',
  );
}

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080';
let cookie = '';

async function request(path, options, expectedStatus = 200) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      ...options?.headers,
      'X-Job-Hunter': '1',
      Cookie: cookie,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (response.headers.has('set-cookie')) {
    cookie = response.headers.get('set-cookie').split(';')[0];
  }

  assert.equal(response.status, expectedStatus, `${path}: HTTP ${response.status}`);

  return response.status === 204 ? null : response.json();
}

const json = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

const email = 'smoke@example.com';
const originalPassword = 'CI only disposable password';
const newPassword = 'CI replacement password phrase';

const home = await fetch(base, {
  signal: AbortSignal.timeout(15000),
});
assert.equal(home.status, 200);
assert.match(await home.text(), /AI Job Hunter/);
assert.equal((await request('/health')).status, 'ok');
assert.equal((await request('/api/config')).mode, 'demo', 'El smoke no debe consumir OpenAI.');

await request('/api/profile', undefined, 401);
await request('/api/auth/register', json('POST', { email, password: originalPassword }), 201);

assert.equal((await request('/api/profile')).profile, null);
assert.equal((await request('/api/analyses')).length, 0);

let analysisId;

try {
  const profile = {
    name: 'Perfil CI',
    headline: 'Frontend developer',
    skills: 'React, TypeScript',
    experience: 'Proyecto de gestión de tareas con pruebas automatizadas y desarrollo de API REST.',
  };

  const saved = await request('/api/profile', json('PUT', profile));
  assert.equal((await request('/api/profile')).profile.name, profile.name);
  assert.ok(saved.cvText.length >= 80);

  const doc = await readFile(new URL('../backend/test/fixtures/cv.docx', import.meta.url));
  const form = new FormData();
  form.append('cv', new Blob([doc]), 'cv.docx');

  const imported = await request('/api/cv/import', {
    method: 'POST',
    body: form,
  });
  assert.match(imported.text, /React/);

  const analysis = await request(
    '/api/analyses',
    json('POST', {
      title: 'Vacante de prueba CI',
      cv: saved.cvText,
      job: 'Buscamos una persona con experiencia en React, TypeScript y pruebas automatizadas para desarrollar aplicaciones web.',
    }),
    201,
  );

  analysisId = analysis.id;
  assert.equal(analysis.result.mode, 'demo');
  assert.equal(analysis.result.score, null);

  const path = '/api/analyses/' + analysisId;
  const findAnalysis = async () =>
    (await request('/api/analyses')).find((item) => item.id === analysisId);

  await request(path, json('PATCH', { status: 'Postulada' }));
  assert.equal((await findAnalysis()).status, 'Postulada');

  const tracking = {
    jobUrl: 'https://example.com/jobs/test',
    appliedOn: '2026-10-10',
    followUpOn: '2026-10-16',
    notes: 'Nota CI de seguimiento',
  };

  await request(path, json('PATCH', { tracking }));
  assert.deepEqual((await findAnalysis()).tracking, tracking);

  const due = (day) => request('/api/analyses?followUp=due&today=' + day);

  assert.equal((await due('2026-10-15')).length, 0);
  assert.equal((await due('2026-10-16')).length, 1);

  await request(path, json('PATCH', { status: 'Oferta' }));
  assert.equal((await due('2026-10-17')).length, 0);

  await request(
    path,
    json('PATCH', {
      status: 'Entrevista',
      tracking: { followUpOn: '' },
    }),
  );

  const tracked = await findAnalysis();
  assert.equal(tracked.tracking.notes, tracking.notes);
  assert.equal(tracked.tracking.followUpOn, '');
  assert.equal((await due('2026-10-17')).length, 0);

  const paginated = await request('/api/analyses/page?today=2026-10-17&page=1&limit=20');
  assert.equal(paginated.total, 1);
  assert.equal(paginated.stats.total, 1);
  assert.equal(paginated.items[0].id, analysisId);

  const filtered = await request('/api/analyses/page?today=2026-10-17&status=Oferta');
  assert.equal(filtered.total, 0);
  assert.equal(filtered.stats.total, 1);
  assert.equal((await request('/api/vacancies/saved')).total, 0);

  const csv = await fetch(base + '/api/analyses/export?today=2026-10-17&status=Entrevista', {
    headers: { Cookie: cookie },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.equal(csv.headers.get('x-export-count'), '1');
  const csvText = await csv.text();
  assert.ok(csvText.includes('Nota CI de seguimiento'));
  assert.ok(csvText.includes('Vacante de prueba CI'));

  const priorCookie = cookie;

  await request(
    '/api/auth/password',
    json('POST', {
      currentPassword: originalPassword,
      newPassword,
    }),
    204,
  );

  await request('/api/profile', undefined, 401);

  cookie = priorCookie;
  await request('/api/profile', undefined, 401);

  cookie = '';
  await request('/api/auth/login', json('POST', { email, password: originalPassword }), 401);

  await request('/api/auth/login', json('POST', { email, password: newPassword }));

  assert.equal((await request('/api/profile')).profile.name, profile.name);

  console.log(
    'Smoke OK: UI, salud, perfil, importación DOCX, análisis demo, seguimiento, exportación CSV y cambio de contraseña.',
  );
} finally {
  if (analysisId) {
    await request('/api/analyses/' + analysisId, json('DELETE', {}), 204);
  }
  await request('/api/profile', json('DELETE', {}), 204);
  await request('/api/auth/logout', json('POST', {}), 204);
  await request('/api/profile', undefined, 401);
}
