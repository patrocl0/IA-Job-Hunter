const migrations = [
  {
    version: 1,
    sql: `
 CREATE TABLE IF NOT EXISTS analyses (id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,result JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'Guardada',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS professional_profile (id SMALLINT PRIMARY KEY CHECK (id=1),data JSONB NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS vacancy_cache (source TEXT PRIMARY KEY,jobs JSONB,fetched_at TIMESTAMPTZ,last_attempt_at TIMESTAMPTZ);
 CREATE TABLE IF NOT EXISTS saved_vacancies (source_id TEXT PRIMARY KEY,data JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'Guardada',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 ALTER TABLE analyses ADD COLUMN IF NOT EXISTS tracking JSONB NOT NULL DEFAULT '{}'::jsonb;`,
  },
  {
    version: 2,
    sql: `
 CREATE INDEX IF NOT EXISTS analyses_created_idx ON analyses(created_at DESC,id DESC);
 CREATE INDEX IF NOT EXISTS analyses_status_created_idx ON analyses(status,created_at DESC,id DESC);
 CREATE INDEX IF NOT EXISTS analyses_followup_idx ON analyses((tracking->>'followUpOn'),id DESC) WHERE status NOT IN ('Oferta','Descartada') AND COALESCE(tracking->>'followUpOn','') <> '';
 CREATE INDEX IF NOT EXISTS saved_vacancies_created_idx ON saved_vacancies(created_at DESC,source_id DESC);`,
  },
];
export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(1421420647)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    );
    const { rows } = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.version));
    for (const migration of migrations)
      if (!applied.has(migration.version)) {
        await client.query(migration.sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [
          migration.version,
        ]);
      }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
