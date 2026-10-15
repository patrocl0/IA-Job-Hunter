import express from "express";
import pg from "pg";
import { readConfig, validateInput, analyze } from "./analyze.js";
import { registerProfileRoutes } from "./profile.js";
import { registerImportRoutes } from "./import-cv.js";
import { requestGuard } from "./request-guard.js";
import { setupVacancies, registerVacancyRoutes } from "./vacancies.js";
const config = readConfig(process.env);
for (const key of ["PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD"]) {
  if (!process.env[key]?.trim()) throw new Error(`Falta la variable ${key}.`);
}
const pool = new pg.Pool({ connectionTimeoutMillis: 5000, max: 5 });
await pool.query(`CREATE TABLE IF NOT EXISTS analyses (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  result JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'Guardada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
await pool.query(`CREATE TABLE IF NOT EXISTS professional_profile (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`);
const vacancies = await setupVacancies(pool);
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "128kb" }));
app.use(requestGuard);
registerImportRoutes(app);
registerVacancyRoutes(app, pool, vacancies);
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ error: "Base de datos no disponible." });
  }
});
app.get("/api/config", (_req, res) => res.json({ mode: config.mode }));
registerProfileRoutes(app, pool);
app.get("/api/analyses", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT * FROM analyses ORDER BY created_at DESC, id DESC LIMIT 100",
  );
  res.json(rows);
});
let active = false;
let lastRun = 0;
app.post("/api/analyses", async (req, res) => {
  let input;
  try {
    input = validateInput(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (active || Date.now() - lastRun < 3000)
    return res
      .status(429)
      .json({ error: "Espera unos segundos antes de otro análisis." });
  active = true;
  lastRun = Date.now();
  try {
    const result = await analyze(input, config);
    // Store the result, not the original CV or full vacancy.
    const { rows } = await pool.query(
      "INSERT INTO analyses(title,result) VALUES($1,$2) RETURNING *",
      [input.title, result],
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Análisis fallido:", {
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
const statuses = [
  "Guardada",
  "Postulada",
  "Entrevista",
  "Oferta",
  "Descartada",
];
app.patch("/api/analyses/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id) || !statuses.includes(req.body?.status))
    return res.status(400).json({ error: "Estado o identificador inválido." });
  const { rows } = await pool.query(
    "UPDATE analyses SET status=$1 WHERE id=$2 RETURNING *",
    [req.body.status, req.params.id],
  );
  if (!rows.length)
    return res.status(404).json({ error: "Análisis no encontrado." });
  res.json(rows[0]);
});
app.delete("/api/analyses/:id", async (req, res) => {
  if (!/^\d+$/.test(req.params.id))
    return res.status(400).json({ error: "Identificador inválido." });
  const result = await pool.query("DELETE FROM analyses WHERE id=$1", [
    req.params.id,
  ]);
  if (!result.rowCount)
    return res.status(404).json({ error: "Análisis no encontrado." });
  res.status(204).end();
});
app.use((_req, res) => res.status(404).json({ error: "Ruta no encontrada." }));
app.use((error, _req, res, _next) => {
  const status =
    error.type === "entity.too.large"
      ? 413
      : error instanceof SyntaxError
        ? 400
        : 500;
  console.error("Solicitud fallida:", error.name);
  res
    .status(status)
    .json({
      error:
        status === 500
          ? "Error interno. Intenta de nuevo."
          : "JSON inválido o demasiado grande.",
    });
});
const server = app.listen(3000, "0.0.0.0", () =>
  console.log(`API lista en puerto 3000. Modo: ${config.mode}`),
);
process.on("SIGTERM", () =>
  server.close(() => pool.end().then(() => process.exit(0))),
);
