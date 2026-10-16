import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import express from 'express';
import {
  extractCv,
  identifyDocument,
  MAX_FILE_BYTES,
  registerImportRoutes,
} from '../src/modules/documents/import-cv.js';
import { requestGuard } from '../src/http/request-guard.js';
const fixture = (name) => readFile(new URL(`./fixtures/${name}`, import.meta.url));
test('Extrae texto real de PDF y DOCX sin IA', async () => {
  for (const filename of ['cv.pdf', 'cv.docx']) {
    const result = await extractCv(filename, await fixture(filename));
    assert.match(result.text, /React/);
    assert.match(result.text, /Ana Demo/);
    assert.ok(result.text.length > 80);
    if (filename.endsWith('docx')) assert.match(result.text, /Español: información/);
  }
});
test('No trunca el CV: advierte cuando supera 16.000 caracteres', async () => {
  const result = await extractCv('long.docx', await fixture('long.docx'));
  assert.ok(result.text.length > 16000);
  assert.ok(result.warnings.length);
});
test('Rechaza PDF vacío, excesivo, corrupto y ZIP que no es DOCX', async () => {
  await assert.rejects(() => extractCv('blank.pdf', fixtureBuffer.blank), /OCR/);
  await assert.rejects(() => extractCv('many-pages.pdf', fixtureBuffer.many), /30 páginas/);
  await assert.rejects(() => extractCv('not-docx.docx', fixtureBuffer.fake), /No se pudo leer/);
  await assert.rejects(
    () => extractCv('broken.pdf', Buffer.from('%PDF-1.4\nbroken')),
    /No se pudo leer/,
  );
});
const fixtureBuffer = {
  blank: await fixture('blank.pdf'),
  many: await fixture('many-pages.pdf'),
  fake: await fixture('not-docx.docx'),
};
test('Valida extensión, firma, tamaño y archivo vacío', () => {
  assert.throws(() => identifyDocument('cv.doc', Buffer.from('abc')), /no está admitido/);
  assert.throws(() => identifyDocument('cv.pdf', Buffer.from('not a PDF')), /extensión/);
  assert.throws(() => identifyDocument('cv.pdf', Buffer.alloc(0)), /vacío/);
  assert.throws(() => identifyDocument('cv.pdf', Buffer.alloc(MAX_FILE_BYTES + 1)), /5 MiB/);
});
test('HTTP: admite multipart solo para importar y devuelve errores claros', async () => {
  const app = express();
  app.use(express.json());
  app.use(requestGuard);
  registerImportRoutes(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = (name, buffer, extra = false, headers = {}) => {
    const form = new FormData();
    form.append('cv', new Blob([buffer]), name);
    if (extra) form.append('extra', 'not allowed');
    return fetch(base + '/api/cv/import', { method: 'POST', body: form, headers });
  };
  try {
    let response = await send('cv.docx', await fixture('cv.docx'));
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
    assert.match((await response.json()).text, /React/);
    response = await send('cv.pdf', Buffer.alloc(MAX_FILE_BYTES + 1));
    assert.equal(response.status, 413);
    response = await send('cv.docx', await fixture('cv.docx'), true);
    assert.equal(response.status, 400);
    response = await send('cv.docx', await fixture('cv.docx'), false, {
      'sec-fetch-site': 'cross-site',
    });
    assert.equal(response.status, 403);
    response = await fetch(base + '/api/cv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 415);
    const form = new FormData();
    form.append('other', 'x');
    response = await fetch(base + '/api/profile', { method: 'PUT', body: form });
    assert.equal(response.status, 415);
    response = await send('cv.pdf', await fixture('cv.pdf'));
    assert.equal(response.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
