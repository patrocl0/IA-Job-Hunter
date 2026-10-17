import { validDate, statuses } from './tracking.js';
export function parsePage(query) {
  const integer = (key, fallback, max) => {
    const value = query[key] ?? String(fallback);
    if (
      typeof value !== 'string' ||
      !/^\d{1,7}$/.test(value) ||
      Number(value) < 1 ||
      Number(value) > max
    )
      throw new Error('Paginación inválida.');
    return Number(value);
  };
  const page = integer('page', 1, 1000000),
    limit = integer('limit', 20, 100);
  if (!validDate(query.today)) throw new Error('Fecha local inválida.');
  if (query.status !== undefined && !statuses.includes(query.status))
    throw new Error('Estado inválido.');
  if (query.followUp !== undefined && query.followUp !== 'due') throw new Error('Filtro inválido.');
  return { page, limit, today: query.today, status: query.status, due: query.followUp === 'due' };
}
function analysisFilter({ status, due, today }, userId) {
  const args = [userId];
  const filters = ['user_id=$1'];
  if (status) {
    args.push(status);
    filters.push(`status=$${args.length}`);
  }
  if (due) {
    args.push(today);
    filters.push(
      `status NOT IN ('Oferta','Descartada') AND COALESCE(tracking->>'followUpOn','') <> '' AND tracking->>'followUpOn' <= $${args.length}`,
    );
  }
  const where = filters.length ? ' WHERE ' + filters.join(' AND ') : '';
  const ordering = due ? "tracking->>'followUpOn' ASC, id DESC" : 'created_at DESC, id DESC';
  return { args, where, ordering };
}
export function createAnalysisRepository(pool) {
  return {
    async exportRows(query, userId, limit) {
      const { args, where, ordering } = analysisFilter(parsePage(query), userId);
      const { rows } = await pool.query(
        `SELECT id,title,status,created_at,tracking,jsonb_build_object('mode',result->'mode','score',result->'score') AS result FROM analyses${where} ORDER BY ${ordering} LIMIT $${args.length + 1}`,
        [...args, limit + 1],
      );
      return rows;
    },
    async page(query, userId) {
      const { page, limit, today, status, due } = parsePage(query);
      const { args, where, ordering } = analysisFilter({ status, due, today }, userId);
      const { rows: count } = await pool.query(
        'SELECT count(*)::int AS total FROM analyses' + where,
        args,
      );
      const total = count[0].total,
        pages = Math.max(1, Math.ceil(total / limit)),
        current = Math.min(page, pages);
      const { rows: items } = await pool.query(
        `SELECT * FROM analyses${where} ORDER BY ${ordering} LIMIT $${args.length + 1} OFFSET $${args.length + 2}`,
        [...args, limit, (current - 1) * limit],
      );
      const { rows: stats } = await pool.query(
        `SELECT count(*)::int AS total, count(*) FILTER(WHERE status='Postulada')::int AS applied, count(*) FILTER(WHERE status='Entrevista')::int AS interviews, count(*) FILTER(WHERE status='Oferta')::int AS offers, count(*) FILTER(WHERE status NOT IN ('Oferta','Descartada') AND COALESCE(tracking->>'followUpOn','') <> '' AND tracking->>'followUpOn' <= $1)::int AS due FROM analyses WHERE user_id=$2`,
        [today, userId],
      );
      return { items, total, page: current, pages, stats: stats[0] };
    },
  };
}
