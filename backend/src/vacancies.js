import { convert } from 'html-to-text';
export const CACHE_MS = 6 * 60 * 60 * 1000;
const SOURCE_URL = 'https://remotive.com/api/remote-jobs';
const clean = value => typeof value === 'string' ? convert(value, { wordwrap: false, selectors: [{selector:'a',options:{ignoreHref:true}},{selector:'img',format:'skip'}] }).trim() : '';
const fold = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function normalizeJob(raw) {
  if (!raw || !/^\d+$/.test(String(raw.id))) return null;
  let url;
  try { url = new URL(raw.url); } catch { return null; }
  if (url.protocol !== 'https:' || !['remotive.com','www.remotive.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
  if (typeof raw.description !== 'string' || raw.description.length > 150000) return null;
  const title = clean(raw.title).slice(0,300), company = clean(raw.company_name).slice(0,300);
  if (!title || !company) return null;
  const date = typeof raw.publication_date === 'string' ? raw.publication_date : '';
  return { id: String(raw.id), source: 'Remotive', url: url.href, title, company,
    location: clean(raw.candidate_required_location).slice(0,500) || 'No especificada',
    category: clean(raw.category).slice(0,160), jobType: clean(raw.job_type).slice(0,80),
    salary: clean(raw.salary).slice(0,500), publishedAt: Number.isFinite(Date.parse(date)) ? date : null,
    description: clean(raw.description), tags: Array.isArray(raw.tags) ? raw.tags.filter(v=>typeof v==='string').slice(0,30).map(v=>clean(v).slice(0,80)) : [] };
}
export function searchJobs(jobs, query) {
  const get = (key, limit) => {
    const value = query[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) throw Object.assign(new Error('Filtros inválidos o demasiado largos.'),{status:400});
    return value.trim();
  };
  const words = fold(get('q',100)).split(/\s+/).filter(Boolean);
  const location = fold(get('location',100));
  const worldwide = get('worldwide',5) !== 'false';
  const rawPage = get('page',6) || '1';
  if (!/^[1-9]\d*$/.test(rawPage)) throw Object.assign(new Error('Página inválida.'),{status:400});
  const filtered = jobs.filter(job => {
    const haystack = fold(`${job.title} ${job.company} ${job.tags.join(' ')} ${job.description}`);
    const place = fold(job.location);
    const global = /^(worldwide|anywhere|global|anywhere in the world)$/.test(place);
    return words.every(word=>haystack.includes(word)) && (!location || place.includes(location) || (worldwide && global));
  });
  const pages = Math.max(1,Math.ceil(filtered.length/12));
  const page = Math.min(Number(rawPage),pages);
  return { jobs: filtered.slice((page-1)*12,page*12), total: filtered.length, page, pages };
}
async function fetchSource(request) {
  const response = await request(SOURCE_URL, { signal: AbortSignal.timeout(20000), headers: { Accept:'application/json' }, redirect:'error' });
  if (!response.ok) throw new Error('Source unavailable');
  // Bound decompressed response size, independent of the Content-Length header.
  const reader = response.body.getReader(); const chunks = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 25*1024*1024) throw new Error('Response too large');
      chunks.push(Buffer.from(part.value));
    }
  } finally { await reader.cancel().catch(()=>{}); }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(data.jobs) || data.jobs.length > 10000) throw new Error('Invalid source response');
  const byId = new Map();
  for (const raw of data.jobs) { const job = normalizeJob(raw); if (job) byId.set(job.id,job); }
  if (data.jobs.length && !byId.size) throw new Error('No valid source records');
  return [...byId.values()].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
}
export function createVacancyService(repository, request = fetch, clock = Date.now) {
  let inflight;
  async function refresh() {
    const cached = await repository.read(); const now = clock();
    const next = cached?.lastAttempt ? Date.parse(cached.lastAttempt)+CACHE_MS : 0;
    if (now < next) {
      if (!cached.jobs) throw Object.assign(new Error('La fuente no está disponible. Se reintentará a partir de la hora indicada.'),{status:503,nextRefreshAt:new Date(next).toISOString()});
      return {...cached, stale:!cached.fetchedAt || now-Date.parse(cached.fetchedAt)>=CACHE_MS,nextRefreshAt:new Date(next).toISOString()};
    }
    const attemptedAt = new Date(now).toISOString();
    // Persist the attempt before fetching; restarting the API does not bypass the cooldown.
    await repository.attempt(attemptedAt);
    try {
      const jobs = await fetchSource(request); const fetchedAt = new Date(clock()).toISOString();
      await repository.write(jobs,fetchedAt);
      return {jobs,fetchedAt,stale:false,nextRefreshAt:new Date(now+CACHE_MS).toISOString()};
    } catch {
      if (cached?.jobs) return {...cached,stale:true,nextRefreshAt:new Date(now+CACHE_MS).toISOString()};
      throw Object.assign(new Error('No se pudo consultar Remotive. Revisa la conexión; no se muestran vacantes simuladas.'),{status:503,nextRefreshAt:new Date(now+CACHE_MS).toISOString()});
    }
  }
  return { get() { if (!inflight) inflight=refresh().finally(()=>{inflight=undefined;}); return inflight; } };
}
export async function setupVacancies(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS vacancy_cache (
    source TEXT PRIMARY KEY, jobs JSONB, fetched_at TIMESTAMPTZ, last_attempt_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS saved_vacancies (
    source_id TEXT PRIMARY KEY, data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'Guardada', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  return createVacancyService({
    async read() { const {rows}=await pool.query("SELECT * FROM vacancy_cache WHERE source='remotive'"); const row=rows[0]; return row ? {jobs:row.jobs,fetchedAt:row.fetched_at?.toISOString(),lastAttempt:row.last_attempt_at?.toISOString()} : null; },
    async attempt(date) { await pool.query("INSERT INTO vacancy_cache(source,last_attempt_at) VALUES('remotive',$1) ON CONFLICT(source) DO UPDATE SET last_attempt_at=EXCLUDED.last_attempt_at",[date]); },
    async write(jobs,date) { await pool.query("UPDATE vacancy_cache SET jobs=$1, fetched_at=$2 WHERE source='remotive'",[JSON.stringify(jobs),date]); },
  });
}
export function registerVacancyRoutes(app,pool,service) {
  const statuses=['Guardada','Postulada','Entrevista','Oferta','Descartada'];
  const validId = id => typeof id === 'string' && /^\d{1,20}$/.test(id);
  const handle = action => async(req,res,next)=>{
    try { await action(req,res); } catch(error) { if(error.status) res.status(error.status).json({error:error.message,nextRefreshAt:error.nextRefreshAt}); else next(error); }
  };
  app.get('/api/vacancies',handle(async(req,res)=>{
    searchJobs([],req.query); // Validate before contacting the provider.
    const snapshot=await service.get();
    res.json({...searchJobs(snapshot.jobs,req.query),source:'Remotive',fetchedAt:snapshot.fetchedAt,stale:snapshot.stale,nextRefreshAt:snapshot.nextRefreshAt});
  }));
  app.get('/api/vacancies/saved',handle(async(req,res)=>{
    const page = /^\d+$/.test(String(req.query.page??'1')) ? Math.max(1,Number(req.query.page??1)) : 1;
    const {rows:counts}=await pool.query('SELECT count(*)::int AS total FROM saved_vacancies');
    const total=counts[0].total; const pages=Math.max(1,Math.ceil(total/12)); const current=Math.min(page,pages);
    const {rows}=await pool.query('SELECT * FROM saved_vacancies ORDER BY created_at DESC, source_id DESC LIMIT 12 OFFSET $1',[(current-1)*12]);
    res.json({items:rows,total,page:current,pages});
  }));
  app.post('/api/vacancies/saved',handle(async(req,res)=>{
    const id=req.body?.id;
    if(!validId(id)) return res.status(400).json({error:'Identificador inválido.'});
    const existing=await pool.query('SELECT * FROM saved_vacancies WHERE source_id=$1',[id]);
    if(existing.rows.length) return res.json(existing.rows[0]);
    const snapshot=await service.get(); const job=snapshot.jobs.find(j=>j.id===id);
    if(!job) return res.status(404).json({error:'La oferta ya no aparece en la fuente. Vuelve a buscar.'});
    const {rows}=await pool.query(`INSERT INTO saved_vacancies(source_id,data) VALUES($1,$2)
      ON CONFLICT(source_id) DO UPDATE SET source_id=EXCLUDED.source_id RETURNING *`,[id,job]);
    res.status(201).json(rows[0]);
  }));
  app.patch('/api/vacancies/saved/:id',handle(async(req,res)=>{
    if(!validId(req.params.id)||!statuses.includes(req.body?.status)) return res.status(400).json({error:'Identificador o estado inválido.'});
    const {rows}=await pool.query('UPDATE saved_vacancies SET status=$1 WHERE source_id=$2 RETURNING *',[req.body.status,req.params.id]);
    if(!rows.length) return res.status(404).json({error:'Vacante no encontrada.'});res.json(rows[0]);
  }));
  app.delete('/api/vacancies/saved/:id',handle(async(req,res)=>{
    if(!validId(req.params.id)) return res.status(400).json({error:'Identificador inválido.'});
    await pool.query('DELETE FROM saved_vacancies WHERE source_id=$1',[req.params.id]);res.status(204).end();
  }));
}
