export const profileFields = {
  name: { label: 'Nombre', max: 120 },
  headline: { label: 'Cargo objetivo', max: 160 },
  location: { label: 'Ubicación y disponibilidad', max: 200 },
  summary: { label: 'Resumen profesional', max: 2000 },
  skills: { label: 'Habilidades', max: 2000 },
  experience: { label: 'Experiencia', max: 5000 },
  projects: { label: 'Proyectos', max: 4000 },
  education: { label: 'Formación', max: 1000 },
  languages: { label: 'Idiomas', max: 500 },
};
export function profileToText(profile) {
  return Object.entries(profileFields)
    .filter(([key]) => profile[key]?.trim())
    .map(([key, field]) => `${field.label}:\n${profile[key].trim()}`).join('\n\n');
}
export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Perfil inválido.');
  const profile = {};
  for (const [key, field] of Object.entries(profileFields)) {
    if (input[key] !== undefined && typeof input[key] !== 'string') throw new Error(`${field.label}: debe ser texto.`);
    const value = (input[key] ?? '').trim();
    if (value.length > field.max) throw new Error(`${field.label}: máximo ${field.max} caracteres.`);
    profile[key] = value;
  }
  if (profile.name.length < 2) throw new Error('Escribe un nombre de al menos 2 caracteres.');
  if (profile.headline.length < 3) throw new Error('Escribe un cargo objetivo de al menos 3 caracteres.');
  if (profileToText(profile).length > 16000) throw new Error('El perfil completo supera los 16.000 caracteres.');
  return profile;
}
export function registerProfileRoutes(app, pool) {
  app.get('/api/profile', async (_req, res) => {
    const { rows } = await pool.query('SELECT data, updated_at FROM professional_profile WHERE id = 1');
    const row = rows[0];
    res.json(row ? { profile: row.data, updatedAt: row.updated_at, cvText: profileToText(row.data) } : { profile: null, updatedAt: null, cvText: '' });
  });
  app.put('/api/profile', async (req, res) => {
    let profile;
    try { profile = validateProfile(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    const { rows } = await pool.query(`INSERT INTO professional_profile (id, data) VALUES (1, $1)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      RETURNING data, updated_at`, [profile]);
    res.json({ profile: rows[0].data, updatedAt: rows[0].updated_at, cvText: profileToText(rows[0].data) });
  });
  app.delete('/api/profile', async (_req, res) => {
    await pool.query('DELETE FROM professional_profile WHERE id = 1');
    res.status(204).end();
  });
}
