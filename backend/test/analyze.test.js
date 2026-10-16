import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readConfig,
  validateInput,
  analyze,
  validateResult,
} from '../src/modules/analyses/analyze.js';
const input = {
  title: 'Frontend developer',
  cv: 'Experiencia con React y TypeScript. '.repeat(4),
  job: 'Buscamos desarrollo frontend con React. '.repeat(4),
};
const result = {
  score: 70,
  summary: 'Hay evidencia parcial.',
  matches: ['React'],
  gaps: ['Idioma sin evidencia'],
  nextSteps: ['Verificar idioma'],
  tailoredSummary: 'Desarrollador React.',
  recruiterMessage: 'Hola, me interesa la vacante.',
};
test('La demo no inventa una puntuación y no llama al proveedor', async () => {
  const output = await analyze(input, { mode: 'demo' }, () => {
    throw new Error('No debe llamarse');
  });
  assert.equal(output.score, null);
  assert.equal(output.mode, 'demo');
});
test('Rechaza CV vacío, demasiado corto o demasiado grande', () => {
  for (const cv of ['', 'corto', 'x'.repeat(16001)])
    assert.throws(() => validateInput({ ...input, cv }));
  assert.deepEqual(validateInput(input), { ...input, cv: input.cv.trim(), job: input.job.trim() });
});
test('El modo real exige clave y modelo', () => {
  assert.throws(() => readConfig({ AI_MODE: 'openai' }));
  assert.throws(() => readConfig({ AI_MODE: 'otro' }));
  assert.equal(readConfig({}).mode, 'demo');
});
test('Valida límites de puntuación y estructura', () => {
  for (const score of [-1, 101, NaN, 4.5])
    assert.throws(() => validateResult({ ...result, score }));
  assert.throws(() => validateResult({ ...result, matches: 'React' }));
});
test('Envía datos separados de instrucciones, sin almacenamiento del proveedor', async () => {
  const output = await analyze(
    input,
    { mode: 'openai', key: 'test', model: 'test' },
    async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.deepEqual(JSON.parse(body.input), { cv: input.cv, vacancy: input.job });
      return {
        ok: true,
        json: async () => ({
          status: 'completed',
          output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }],
        }),
      };
    },
  );
  assert.equal(output.score, 70);
  assert.equal(output.mode, 'openai');
});
test('Gestiona cuota, rechazo e incompletitud sin resultados fabricados', async () => {
  const config = { mode: 'openai', key: 'test', model: 'test' };
  await assert.rejects(
    () =>
      analyze(input, config, async () => ({
        ok: false,
        status: 429,
        headers: new Headers(),
        json: async () => ({ error: { code: 'credit_balance_exhausted' } }),
      })),
    { code: 'credit_balance_exhausted', httpStatus: 429 },
  );
  for (const data of [
    { status: 'incomplete' },
    { status: 'completed', output: [{ content: [{ type: 'refusal' }] }] },
    { status: 'completed', output: [] },
  ]) {
    await assert.rejects(() =>
      analyze(input, config, async () => ({ ok: true, json: async () => data })),
    );
  }
});
