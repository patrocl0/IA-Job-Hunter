import { validateInput, analyze } from './analyze.js';
import { validateTracking, registerTrackingRoutes } from './tracking.js';
export function registerAnalysisRoutes(app, pool, config, analyzer = analyze) {
  registerTrackingRoutes(app, pool);
  let active = false;
  let lastRun = 0;
  app.post('/api/analyses', async (req, res) => {
    let input;
    let tracking;
    try {
      input = validateInput(req.body);
      tracking = validateTracking(req.body.tracking ?? {});
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    if (active || Date.now() - lastRun < 3000)
      return res.status(429).json({ error: 'Espera unos segundos antes de otro análisis.' });
    active = true;
    lastRun = Date.now();
    try {
      const result = await analyzer(input, config);
      // Store the result, not the original CV or full vacancy.
      const { rows } = await pool.query(
        'INSERT INTO analyses(title,result,tracking) VALUES($1,$2,$3) RETURNING *',
        [input.title, result, tracking],
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('Análisis fallido:', {
        nombre: error.name,
        codigo: error.code,
        http: error.httpStatus,
        parametro: error.parameter,
        motivo: error.reason,
        codigoRed: error.cause?.code,
        requestId: error.requestId,
      });
      const noCredit = ['credit_balance_exhausted', 'insufficient_quota'].includes(error.code);
      res.status(noCredit ? 503 : 502).json({
        error: noCredit
          ? 'La API de OpenAI no tiene saldo disponible. Puedes continuar en modo demo configurando AI_MODE=demo.'
          : 'No fue posible completar o guardar el análisis. Revisa los registros del backend.',
      });
    } finally {
      active = false;
    }
  });
  app.delete('/api/analyses/:id', async (req, res) => {
    if (!/^\d+$/.test(req.params.id))
      return res.status(400).json({ error: 'Identificador inválido.' });
    const result = await pool.query('DELETE FROM analyses WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Análisis no encontrado.' });
    res.status(204).end();
  });
}
