export const statuses = ['Guardada', 'Postulada', 'Entrevista', 'Oferta', 'Descartada'];
export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateTracking(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Seguimiento inválido.');
  const result = {};
  for (const key of Object.keys(input)) {
    if (!['jobUrl', 'appliedOn', 'followUpOn', 'notes'].includes(key)) throw new Error('Campo de seguimiento desconocido.');
    if (typeof input[key] !== 'string') throw new Error('El seguimiento debe contener texto.');
    const value = input[key].trim();
    if (['appliedOn', 'followUpOn'].includes(key) && value && !validDate(value)) throw new Error('Fecha inválida. Usa AAAA-MM-DD.');
    if (key === 'notes' && value.length > 5000) throw new Error('Las notas admiten hasta 5.000 caracteres.');
    if (key === 'jobUrl' && value) {
      let url;
      try { url = new URL(value); } catch { throw new Error('El enlace debe ser una URL completa http o https.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || value.length > 2000) throw new Error('Enlace inválido: usa http o https, sin credenciales.');
    }
    result[key] = value;
  }
  return result;
}
export async function setupTracking(pool) {
  // Additive and repeatable migration; existing rows and results are preserved.
  await pool.query("ALTER TABLE analyses ADD COLUMN IF NOT EXISTS tracking JSONB NOT NULL DEFAULT '{}'::jsonb");
}
export function registerTrackingRoutes(app, pool) {
  app.get('/api/analyses', async (req, res) => {
    let sql = 'SELECT * FROM analyses';
    const args = [];
    if (req.query.followUp !== undefined) {
      if (req.query.followUp !== 'due' || !validDate(req.query.today)) return res.status(400).json({error: 'Filtro o fecha inválidos.'});
      // ISO calendar dates, not timestamps: the browser supplies its local day.
      sql += " WHERE status NOT IN ('Oferta','Descartada') AND COALESCE(tracking->>'followUpOn','') <> '' AND tracking->>'followUpOn' <= $1 ORDER BY tracking->>'followUpOn' ASC, id DESC LIMIT 100";
      args.push(req.query.today);
    } else sql += ' ORDER BY created_at DESC, id DESC LIMIT 100';
    res.json((await pool.query(sql, args)).rows);
  });
  app.patch('/api/analyses/:id', async (req, res) => {
    let tracking;
    try {
      if (!/^[1-9]\d{0,18}$/.test(req.params.id) || BigInt(req.params.id) > 9223372036854775807n) throw new Error('Identificador inválido.');
      if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object' || !Object.keys(req.body).length || Object.keys(req.body).some(k => !['status', 'tracking'].includes(k))) throw new Error('Actualización inválida.');
      if ('status' in req.body && !statuses.includes(req.body.status)) throw new Error('Estado inválido.');
      tracking = 'tracking' in req.body ? validateTracking(req.body.tracking) : {};
    } catch (error) { return res.status(400).json({error: error.message}); }
    const { rows } = await pool.query('UPDATE analyses SET status=COALESCE($1::text,status), tracking=tracking || $2::jsonb WHERE id=$3 RETURNING *', [req.body.status ?? null, JSON.stringify(tracking), req.params.id]);
    if (!rows.length) return res.status(404).json({error:'Análisis no encontrado.'});
    res.json(rows[0]);
  });
}
