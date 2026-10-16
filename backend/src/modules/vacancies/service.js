import { normalizeJob } from './domain.js';
export const CACHE_MS = 6 * 60 * 60 * 1000;
const SOURCE_URL = 'https://remotive.com/api/remote-jobs';
async function fetchSource(request) {
  const response = await request(SOURCE_URL, {
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error('Source unavailable');
  // Bound decompressed response size, independent of the Content-Length header.
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 25 * 1024 * 1024) throw new Error('Response too large');
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(data.jobs) || data.jobs.length > 10000)
    throw new Error('Invalid source response');
  const byId = new Map();
  for (const raw of data.jobs) {
    const job = normalizeJob(raw);
    if (job) byId.set(job.id, job);
  }
  if (data.jobs.length && !byId.size) throw new Error('No valid source records');
  return [...byId.values()].sort(
    (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0),
  );
}
export function createVacancyService(repository, request = fetch, clock = Date.now) {
  let inflight;
  async function refresh() {
    const cached = await repository.read();
    const now = clock();
    const next = cached?.lastAttempt ? Date.parse(cached.lastAttempt) + CACHE_MS : 0;
    if (now < next) {
      if (!cached.jobs)
        throw Object.assign(
          new Error('La fuente no está disponible. Se reintentará a partir de la hora indicada.'),
          { status: 503, nextRefreshAt: new Date(next).toISOString() },
        );
      return {
        ...cached,
        stale: !cached.fetchedAt || now - Date.parse(cached.fetchedAt) >= CACHE_MS,
        nextRefreshAt: new Date(next).toISOString(),
      };
    }
    const attemptedAt = new Date(now).toISOString();
    // Persist the attempt before fetching; restarting the API does not bypass the cooldown.
    await repository.attempt(attemptedAt);
    try {
      const jobs = await fetchSource(request);
      const fetchedAt = new Date(clock()).toISOString();
      await repository.write(jobs, fetchedAt);
      return {
        jobs,
        fetchedAt,
        stale: false,
        nextRefreshAt: new Date(now + CACHE_MS).toISOString(),
      };
    } catch {
      if (cached?.jobs)
        return { ...cached, stale: true, nextRefreshAt: new Date(now + CACHE_MS).toISOString() };
      throw Object.assign(
        new Error(
          'No se pudo consultar Remotive. Revisa la conexión; no se muestran vacantes simuladas.',
        ),
        { status: 503, nextRefreshAt: new Date(now + CACHE_MS).toISOString() },
      );
    }
  }
  return {
    get() {
      if (!inflight)
        inflight = refresh().finally(() => {
          inflight = undefined;
        });
      return inflight;
    },
  };
}
