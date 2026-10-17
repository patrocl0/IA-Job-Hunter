import test from 'node:test';
import assert from 'node:assert/strict';
import { CV_RESULT, readCvMessage, validateImportedCv } from '../src/data/demo/import-protocol.ts';

test('PDF.js ready messages are ignored until the actual CV result arrives', () => {
  const ready = { sourceName: 'worker', targetName: 'main', action: 'ready', data: null };
  assert.equal(readCvMessage(ready), null);
  assert.equal(readCvMessage(null), null);
  const result = { text: 'Experiencia en React y Node.js', warnings: ['Revisa las columnas.'] };
  assert.deepEqual(readCvMessage({ type: CV_RESULT, result }), result);
});

test('extraction errors reach the form instead of an undefined preview', () => {
  assert.throws(
    () => readCvMessage({ type: CV_RESULT, error: 'No se encontró texto.' }),
    /No se encontró texto/,
  );
  for (const result of [
    undefined,
    {},
    { text: 4, warnings: [] },
    { text: ' ', warnings: [] },
    { text: 'CV', warnings: [null] },
  ]) {
    assert.throws(() => readCvMessage({ type: CV_RESULT, result }), /texto válido/);
    assert.throws(() => validateImportedCv(result), /texto válido/);
  }
});
