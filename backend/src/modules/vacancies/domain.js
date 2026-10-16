import { convert } from 'html-to-text';
const clean = (value) =>
  typeof value === 'string'
    ? convert(value, {
        wordwrap: false,
        selectors: [
          { selector: 'a', options: { ignoreHref: true } },
          { selector: 'img', format: 'skip' },
        ],
      }).trim()
    : '';
const fold = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function normalizeJob(raw) {
  if (!raw || !/^\d+$/.test(String(raw.id))) return null;
  let url;
  try {
    url = new URL(raw.url);
  } catch {
    return null;
  }
  if (
    url.protocol !== 'https:' ||
    !['remotive.com', 'www.remotive.com'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    return null;
  if (typeof raw.description !== 'string' || raw.description.length > 150000) return null;
  const title = clean(raw.title).slice(0, 300),
    company = clean(raw.company_name).slice(0, 300);
  if (!title || !company) return null;
  const date = typeof raw.publication_date === 'string' ? raw.publication_date : '';
  return {
    id: String(raw.id),
    source: 'Remotive',
    url: url.href,
    title,
    company,
    location: clean(raw.candidate_required_location).slice(0, 500) || 'No especificada',
    category: clean(raw.category).slice(0, 160),
    jobType: clean(raw.job_type).slice(0, 80),
    salary: clean(raw.salary).slice(0, 500),
    publishedAt: Number.isFinite(Date.parse(date)) ? date : null,
    description: clean(raw.description),
    tags: Array.isArray(raw.tags)
      ? raw.tags
          .filter((v) => typeof v === 'string')
          .slice(0, 30)
          .map((v) => clean(v).slice(0, 80))
      : [],
  };
}
export function searchJobs(jobs, query) {
  const get = (key, limit) => {
    const value = query[key] ?? '';
    if (typeof value !== 'string' || value.length > limit)
      throw Object.assign(new Error('Filtros inválidos o demasiado largos.'), { status: 400 });
    return value.trim();
  };
  const words = fold(get('q', 100)).split(/\s+/).filter(Boolean);
  const location = fold(get('location', 100));
  const worldwide = get('worldwide', 5) !== 'false';
  const rawPage = get('page', 6) || '1';
  if (!/^[1-9]\d*$/.test(rawPage))
    throw Object.assign(new Error('Página inválida.'), { status: 400 });
  const filtered = jobs.filter((job) => {
    const haystack = fold(`${job.title} ${job.company} ${job.tags.join(' ')} ${job.description}`);
    const place = fold(job.location);
    const global = /^(worldwide|anywhere|global|anywhere in the world)$/.test(place);
    return (
      words.every((word) => haystack.includes(word)) &&
      (!location || place.includes(location) || (worldwide && global))
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const page = Math.min(Number(rawPage), pages);
  return { jobs: filtered.slice((page - 1) * 12, page * 12), total: filtered.length, page, pages };
}
