import { validateProfile, profileToText } from './domain.js';
export function registerProfileRoutes(app, pool) {
  app.get('/api/profile', async (_req, res) => {
    const { rows } = await pool.query(
      'SELECT data, updated_at FROM professional_profile WHERE id = 1',
    );
    const row = rows[0];
    res.json(
      row
        ? { profile: row.data, updatedAt: row.updated_at, cvText: profileToText(row.data) }
        : { profile: null, updatedAt: null, cvText: '' },
    );
  });
  app.put('/api/profile', async (req, res) => {
    let profile;
    try {
      profile = validateProfile(req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
    const { rows } = await pool.query(
      `INSERT INTO professional_profile (id, data) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      RETURNING data, updated_at`,
      [profile],
    );
    res.json({
      profile: rows[0].data,
      updatedAt: rows[0].updated_at,
      cvText: profileToText(rows[0].data),
    });
  });
  app.delete('/api/profile', async (_req, res) => {
    await pool.query('DELETE FROM professional_profile WHERE id = 1');
    res.status(204).end();
  });
}
