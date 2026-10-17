import { analysesCsv, EXPORT_LIMIT } from '../../shared/analyses-csv.mjs';
import { registerAuth } from './modules/auth/routes.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { requestGuard } from './http/request-guard.js';
import { registerProfileRoutes } from './modules/profile/profile.js';
import { registerImportRoutes } from './modules/documents/import-cv.js';
import { registerVacancyRoutes } from './modules/vacancies/vacancies.js';
import { registerAnalysisRoutes } from './modules/analyses/routes.js';
import { createAnalysisRepository, parsePage } from './modules/analyses/repository.js';
export function createApp({ pool, config, vacancies, analyzer, authConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set('X-Request-Id', req.requestId);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '128kb' }));
  app.use(requestGuard);
  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ error: 'Base de datos no disponible.' });
    }
  });
  app.get('/api/config', (_req, res) => res.json({ mode: config.mode }));
  registerAuth(app, pool, authConfig);
  const analyses = createAnalysisRepository(pool);
  app.get('/api/analyses/export', async (req, res) => {
    try {
      if (Object.keys(req.query).some((key) => !['today', 'status', 'followUp'].includes(key)))
        throw new Error('Filtros de exportación inválidos.');
      parsePage(req.query);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const rows = await analyses.exportRows(req.query, req.user.id, EXPORT_LIMIT);
    if (rows.length > EXPORT_LIMIT)
      return res
        .status(413)
        .json({
          error: `La exportación supera ${EXPORT_LIMIT} registros. Aplica filtros; no se ha generado un archivo parcial.`,
        });
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="postulaciones-${req.query.today}.csv"`);
    res.set('X-Export-Count', String(rows.length));
    res.send(analysesCsv(rows));
  });
  app.get('/api/analyses/page', async (req, res) => {
    try {
      parsePage(req.query);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json(await analyses.page(req.query, req.user.id));
  });
  registerAnalysisRoutes(app, pool, config, analyzer);
  registerProfileRoutes(app, pool);
  registerImportRoutes(app);
  registerVacancyRoutes(app, pool, vacancies);
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, _next) => {
    const status =
      error.type === 'entity.too.large' ? 413 : error instanceof SyntaxError ? 400 : 500;
    console.error(
      JSON.stringify({
        event: 'request_failed',
        requestId: req.requestId,
        name: error.name,
        status,
      }),
    );
    res.status(status).json({
      error:
        status === 500 ? 'Error interno. Intenta de nuevo.' : 'JSON inválido o demasiado grande.',
      requestId: req.requestId,
    });
  });
  return app;
}
