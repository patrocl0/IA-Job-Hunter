import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
if (process.env.SMOKE_ALLOW_WRITES !== 'true') {
  throw new Error('Este smoke test requiere una base vacía y modifica datos. Ejecuta en CI o una instalación desechable con SMOKE_ALLOW_WRITES=true.');
}
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080';
async function request(path, options, status=200) {
  const response = await fetch(base+path, { ...options, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status,status,`${path}: HTTP ${response.status}`);
  return response.status===204 ? null : response.json();
}
const json = (method,body) => ({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const home=await fetch(base,{signal:AbortSignal.timeout(15000)});
assert.equal(home.status,200);assert.match(await home.text(),/AI Job Hunter/);
assert.equal((await request('/health')).status,'ok');
assert.equal((await request('/api/config')).mode,'demo','Smoke tests must never consume OpenAI');
const initial=await request('/api/profile');
assert.equal(initial.profile,null,'Refusing to replace an existing profile. Use an empty database.');
const before=await request('/api/analyses');assert.equal(before.length,0,'Use an empty database.');
let analysisId;
try {
  const profile={name:'Perfil CI',headline:'Frontend developer',skills:'React, TypeScript',experience:'Proyecto de gestión de tareas con pruebas automatizadas y desarrollo de API REST.'};
  const saved=await request('/api/profile',json('PUT',profile));
  assert.equal((await request('/api/profile')).profile.name,profile.name);
  assert.ok(saved.cvText.length>=80);
  const form=new FormData();
  const doc=await readFile(new URL('../backend/test/fixtures/cv.docx',import.meta.url));
  form.append('cv',new Blob([doc]),'cv.docx');
  const imported=await request('/api/cv/import',{method:'POST',body:form});assert.match(imported.text,/React/);
  const analysis=await request('/api/analyses',json('POST',{title:'Vacante de prueba CI',cv:saved.cvText,job:'Buscamos una persona con experiencia en React, TypeScript y pruebas automatizadas para desarrollar aplicaciones web.'}),201);
  analysisId=analysis.id;assert.equal(analysis.result.mode,'demo');assert.equal(analysis.result.score,null);
  await request('/api/analyses/'+analysisId,json('PATCH',{status:'Postulada'}));
  const list=await request('/api/analyses');assert.equal(list.find(x=>x.id===analysisId).status,'Postulada');
  const vacancies=await request('/api/vacancies/saved');assert.equal(vacancies.total,0);
  console.log('Smoke OK: UI, salud, perfil persistente, importación DOCX, análisis demo y seguimiento.');
} finally {
  if(analysisId) await request('/api/analyses/'+analysisId,json('DELETE',{}),204);
  await request('/api/profile',json('DELETE',{}),204);
}
