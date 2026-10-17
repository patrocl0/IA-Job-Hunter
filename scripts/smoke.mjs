import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
if (process.env.SMOKE_ALLOW_WRITES !== 'true') {
  throw new Error('Este smoke test requiere una base vacía y modifica datos. Ejecuta en CI o una instalación desechable con SMOKE_ALLOW_WRITES=true.');
}
let cookie = '';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080';
async function request(path, options, status=200) {
  const response = await fetch(base+path, { ...options, headers: { ...options?.headers, 'X-Job-Hunter':'1', Cookie:cookie }, signal: AbortSignal.timeout(15000) });
  if (response.headers.has('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
  assert.equal(response.status,status,`${path}: HTTP ${response.status}`);
  return response.status===204 ? null : response.json();
}
const json = (method,body) => ({method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const home=await fetch(base,{signal:AbortSignal.timeout(15000)});
assert.equal(home.status,200);assert.match(await home.text(),/AI Job Hunter/);
assert.equal((await request('/health')).status,'ok');
assert.equal((await request('/api/config')).mode,'demo','Smoke tests must never consume OpenAI');
await request('/api/profile',undefined,401);
await request('/api/auth/register',json('POST',{email:'smoke@example.com',password:'CI only disposable password'}),201);
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
  const tracking={jobUrl:'https://example.com/jobs/test',appliedOn:'2026-10-10',followUpOn:'2026-10-16',notes:'Nota CI de seguimiento'};
  await request('/api/analyses/'+analysisId,json('PATCH',{tracking}));
  let tracked=(await request('/api/analyses')).find(x=>x.id===analysisId);
  assert.deepEqual(tracked.tracking,tracking);assert.equal(tracked.status,'Postulada');
  assert.equal((await request('/api/analyses?followUp=due&today=2026-10-15')).length,0);
  assert.equal((await request('/api/analyses?followUp=due&today=2026-10-16')).length,1);
  await request('/api/analyses/'+analysisId,json('PATCH',{status:'Oferta'}));
  assert.equal((await request('/api/analyses?followUp=due&today=2026-10-17')).length,0);
  await request('/api/analyses/'+analysisId,json('PATCH',{status:'Entrevista',tracking:{followUpOn:''}}));
  tracked=(await request('/api/analyses')).find(x=>x.id===analysisId);
  assert.equal(tracked.tracking.notes,tracking.notes);assert.equal(tracked.tracking.followUpOn,'');
  assert.equal((await request('/api/analyses?followUp=due&today=2026-10-17')).length,0);
  const paginated=await request('/api/analyses/page?today=2026-10-17&page=1&limit=20');
  assert.equal(paginated.total,1);assert.equal(paginated.stats.total,1);assert.equal(paginated.items[0].id,analysisId);
  const filtered=await request('/api/analyses/page?today=2026-10-17&status=Oferta');assert.equal(filtered.total,0);assert.equal(filtered.stats.total,1);
  const vacancies=await request('/api/vacancies/saved');assert.equal(vacancies.total,0);
  console.log('Smoke OK: UI, salud, perfil persistente, importación DOCX, análisis demo y seguimiento.');
} finally {
  if(analysisId) await request('/api/analyses/'+analysisId,json('DELETE',{}),204);
  await request('/api/profile',json('DELETE',{}),204);
  await request('/api/auth/logout',json('POST',{}),204);
  await request('/api/profile',undefined,401);
}
