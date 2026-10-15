import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProfile, profileToText } from '../src/profile.js';
const valid = { name: ' Ana ', headline: 'Frontend developer', skills: 'React, TypeScript', experience: 'Proyecto personal de gestión de tareas.' };
test('Normaliza el perfil y descarta campos ajenos', () => {
  const profile = validateProfile({...valid, apiKey: 'no-almacenar'});
  assert.equal(profile.name, 'Ana'); assert.equal(profile.projects, ''); assert.equal(profile.apiKey, undefined);
});
test('Rechaza datos inválidos y campos excesivos', () => {
  for (const value of [null, [], {}, {...valid,name:2}, {...valid,name:' '}, {...valid,skills:'x'.repeat(2001)}]) assert.throws(() => validateProfile(value));
});
test('Genera texto solo con la información proporcionada', () => {
  const profile = validateProfile(valid); const text = profileToText(profile);
  assert.match(text,/Habilidades:\nReact, TypeScript/);
  assert.ok(!text.includes('Idiomas:')); assert.ok(!text.includes('undefined')); assert.ok(text.length < 16000);
});
test('El texto completo respeta el límite del analizador', () => {
  assert.ok(profileToText(validateProfile({name:'a'.repeat(120),headline:'h'.repeat(160),location:'l'.repeat(200),summary:'s'.repeat(2000),skills:'s'.repeat(2000),experience:'e'.repeat(5000),projects:'p'.repeat(4000),education:'e'.repeat(1000),languages:'l'.repeat(500)})).length <= 16000);
});
