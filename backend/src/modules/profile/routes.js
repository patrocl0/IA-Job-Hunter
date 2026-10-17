import { validateProfile, profileToText } from './domain.js';
export function registerProfileRoutes(app, pool) {
  app.get('/api/profile', async (req, res) => {
    const { rows } = await pool.query(
      'SELECT data, updated_at FROM professional_profile WHERE user_id = $1',
      [req.user.id],
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
      `INSERT INTO professional_profile (user_id, data) VALUES ($2, $1)
      ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      RETURNING data, updated_at`,
      [profile, req.user.id],
    );
    res.json({
      profile: rows[0].data,
      updatedAt: rows[0].updated_at,
      cvText: profileToText(rows[0].data),
    });
  });
  app.delete('/api/profile', async (req, res) => {
    await pool.query('DELETE FROM professional_profile WHERE user_id = $1', [req.user.id]);
    res.status(204).end();
  });
}
