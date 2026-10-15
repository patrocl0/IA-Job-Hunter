import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const root=resolve('frontend/dist');
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    const content=await readFile(path);
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(content);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser=await chromium.launch({headless:true, ...(process.env.SCREENSHOT_BROWSER_PATH ? {executablePath:process.env.SCREENSHOT_BROWSER_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']} : {})});
  const page=await browser.newPage({viewport:{width:1400,height:1000},deviceScaleFactor:1,locale:'es-CO',timezoneId:'America/Bogota'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const profile={name:'Perfil de ejemplo',headline:'Desarrollador Frontend',location:'Medellín · Trabajo remoto',summary:'Desarrollo interfaces web con React y TypeScript. Me interesa crear aplicaciones claras, accesibles y útiles.',skills:'React, TypeScript, JavaScript, HTML, CSS, Node.js, Git, Docker',experience:'Ejemplo: desarrollo de una aplicación de gestión de tareas, integración de API REST y pruebas de sus flujos principales.',projects:'AI Job Hunter: perfil profesional, importación de documentos y seguimiento de oportunidades.',education:'Formación en desarrollo web.',languages:'Español: nativo. Inglés: en formación.'};
  const cvText=Object.values(profile).join('\n\n');
  const jobs=[{id:'900001',title:'Ejemplo · Frontend Developer (React)',company:'Empresa de ejemplo',location:'Latin America',salary:'Salario no publicado',jobType:'full_time',category:'Software Development',description:'Oferta ficticia para documentación. Desarrollo de interfaces en React y TypeScript, integración de servicios REST y pruebas automatizadas.',tags:['React','TypeScript'],url:'https://remotive.com',publishedAt:'2026-10-15T10:00:00',source:'Remotive'},{id:'900002',title:'Ejemplo · Full Stack Developer',company:'Equipo de ejemplo',location:'Worldwide',salary:'Salario no publicado',jobType:'contract',category:'Software Development',description:'Oferta ficticia para documentación. Aplicaciones web con React, Node.js y PostgreSQL. Trabajo colaborativo con Git y Docker.',tags:['React','Node.js'],url:'https://remotive.com',publishedAt:'2026-10-14T10:00:00',source:'Remotive'}];
  const saved=[];
  await page.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url());let body;let status=200;
    if(url.pathname==='/api/config')body={mode:'demo'};
    else if(url.pathname==='/api/profile')body={profile,cvText,updatedAt:'2026-10-15T15:00:00Z'};
    else if(url.pathname==='/api/analyses')body=[];
    else if(url.pathname==='/api/vacancies')body={jobs,total:jobs.length,page:1,pages:1,fetchedAt:'2026-10-15T15:00:00Z',stale:false,nextRefreshAt:'2026-10-15T21:00:00Z'};
    else if(url.pathname==='/api/vacancies/saved'){
      if(request.method()==='POST'){
        const id=request.postDataJSON().id;const item={source_id:id,data:jobs.find(j=>j.id===id),status:'Guardada',created_at:'2026-10-15T15:00:00Z'};
        if(!saved.find(x=>x.source_id===id))saved.push(item);body=item;status=201;
      }else body={items:saved,total:saved.length,page:1,pages:1};
    }else{body={error:'Unexpected mock route'};status=500;}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(origin);await page.getByText('Modo demostración',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Buscar vacantes',exact:true}).click();
  await page.getByRole('heading',{name:'Ejemplo · Frontend Developer (React)',exact:true}).waitFor();
  await mkdir('docs/screenshots',{recursive:true});
  await page.locator('.vacancy-panel').screenshot({path:'docs/screenshots/vacantes.png'});
  await page.locator('.profile-panel summary').click();
  await page.locator('#profile-name').waitFor({state:'visible'});
  await page.locator('.profile-panel').screenshot({path:'docs/screenshots/perfil.png'});
  await page.getByRole('button',{name:'Guardar vacante',exact:true}).first().click();
  await page.getByRole('heading',{name:'Vacantes guardadas (1)',exact:true}).waitFor();
  await page.getByRole('button',{name:'Preparar análisis',exact:true}).first().click();
  assert.match(await page.locator('#job').inputValue(),/Oferta ficticia/);
  assert.equal(await page.locator('#cv').inputValue(),cvText);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile overflow');
  await page.locator('.vacancy-panel').screenshot({path:'docs/screenshots/movil.png'});
  assert.deepEqual(errors,[]);
  console.log('Capturas y comprobación UI correctas: búsqueda, guardado, preparación de análisis y ancho móvil. Datos ficticios; ninguna API externa.');
} finally {
  await browser?.close();await new Promise(r=>server.close(r));
}
