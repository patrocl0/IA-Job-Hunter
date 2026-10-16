import { createVacancyService } from './service.js';
export async function setupVacancies(pool) {
  return createVacancyService({
    async read() {
      const { rows } = await pool.query("SELECT * FROM vacancy_cache WHERE source='remotive'");
      const row = rows[0];
      return row
        ? {
            jobs: row.jobs,
            fetchedAt: row.fetched_at?.toISOString(),
            lastAttempt: row.last_attempt_at?.toISOString(),
          }
        : null;
    },
    async attempt(date) {
      await pool.query(
        "INSERT INTO vacancy_cache(source,last_attempt_at) VALUES('remotive',$1) ON CONFLICT(source) DO UPDATE SET last_attempt_at=EXCLUDED.last_attempt_at",
        [date],
      );
    },
    async write(jobs, date) {
      await pool.query("UPDATE vacancy_cache SET jobs=$1, fetched_at=$2 WHERE source='remotive'", [
        JSON.stringify(jobs),
        date,
      ]);
    },
  });
}
