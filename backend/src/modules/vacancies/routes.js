import { searchJobs } from './domain.js';
export function registerVacancyRoutes(app, pool, service) {
  const statuses = ['Guardada', 'Postulada', 'Entrevista', 'Oferta', 'Descartada'];
  const validId = (id) => typeof id === 'string' && /^\d{1,20}$/.test(id);
  const handle = (action) => async (req, res, next) => {
    try {
      await action(req, res);
    } catch (error) {
      if (error.status)
        res.status(error.status).json({ error: error.message, nextRefreshAt: error.nextRefreshAt });
      else next(error);
    }
  };
  app.get(
    '/api/vacancies',
    handle(async (req, res) => {
      searchJobs([], req.query); // Validate before contacting the provider.
      const snapshot = await service.get();
      res.json({
        ...searchJobs(snapshot.jobs, req.query),
        source: 'Remotive',
        fetchedAt: snapshot.fetchedAt,
        stale: snapshot.stale,
        nextRefreshAt: snapshot.nextRefreshAt,
      });
    }),
  );
  app.get(
    '/api/vacancies/saved',
    handle(async (req, res) => {
      const page = /^\d+$/.test(String(req.query.page ?? '1'))
        ? Math.max(1, Number(req.query.page ?? 1))
        : 1;
      const { rows: counts } = await pool.query(
        'SELECT count(*)::int AS total FROM saved_vacancies',
      );
      const total = counts[0].total;
      const pages = Math.max(1, Math.ceil(total / 12));
      const current = Math.min(page, pages);
      const { rows } = await pool.query(
        'SELECT * FROM saved_vacancies ORDER BY created_at DESC, source_id DESC LIMIT 12 OFFSET $1',
        [(current - 1) * 12],
      );
      res.json({ items: rows, total, page: current, pages });
    }),
  );
  app.post(
    '/api/vacancies/saved',
    handle(async (req, res) => {
      const id = req.body?.id;
      if (!validId(id)) return res.status(400).json({ error: 'Identificador inválido.' });
      const existing = await pool.query('SELECT * FROM saved_vacancies WHERE source_id=$1', [id]);
      if (existing.rows.length) return res.json(existing.rows[0]);
      const snapshot = await service.get();
      const job = snapshot.jobs.find((j) => j.id === id);
      if (!job)
        return res
          .status(404)
          .json({ error: 'La oferta ya no aparece en la fuente. Vuelve a buscar.' });
      const { rows } = await pool.query(
        `INSERT INTO saved_vacancies(source_id,data) VALUES($1,$2)
      ON CONFLICT(source_id) DO UPDATE SET source_id=EXCLUDED.source_id RETURNING *`,
        [id, job],
      );
      res.status(201).json(rows[0]);
    }),
  );
  app.patch(
    '/api/vacancies/saved/:id',
    handle(async (req, res) => {
      if (!validId(req.params.id) || !statuses.includes(req.body?.status))
        return res.status(400).json({ error: 'Identificador o estado inválido.' });
      const { rows } = await pool.query(
        'UPDATE saved_vacancies SET status=$1 WHERE source_id=$2 RETURNING *',
        [req.body.status, req.params.id],
      );
      if (!rows.length) return res.status(404).json({ error: 'Vacante no encontrada.' });
      res.json(rows[0]);
    }),
  );
  app.delete(
    '/api/vacancies/saved/:id',
    handle(async (req, res) => {
      if (!validId(req.params.id))
        return res.status(400).json({ error: 'Identificador inválido.' });
      await pool.query('DELETE FROM saved_vacancies WHERE source_id=$1', [req.params.id]);
      res.status(204).end();
    }),
  );
}
