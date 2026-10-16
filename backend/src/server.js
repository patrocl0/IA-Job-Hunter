import pg from 'pg';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { readConfig } from './modules/analyses/analyze.js';
import { setupVacancies } from './modules/vacancies/vacancies.js';
const config = readConfig(process.env);
for (const key of ['PGHOST', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'])
  if (!process.env[key]?.trim()) throw new Error(`Falta la variable ${key}.`);
const pool = new pg.Pool({
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statement_timeout: 15000,
  max: 5,
});
pool.on('error', (error) =>
  console.error(JSON.stringify({ event: 'pool_error', name: error.name })),
);
await migrate(pool);
const vacancies = await setupVacancies(pool);
const app = createApp({ pool, config, vacancies });
const server = app.listen(3000, '0.0.0.0', () =>
  console.log(`API lista en puerto 3000. Modo: ${config.mode}`),
);
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 15000);
  deadline.unref();
  server.close(() =>
    pool.end().then(() => {
      clearTimeout(deadline);
      process.exit(0);
    }),
  );
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
