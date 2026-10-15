import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { ProfilePanel } from "./ProfilePanel";
import { ImportCv } from "./ImportCv";
import { VacancySearch } from "./VacancySearch";
type Result = {
  mode: "demo" | "openai";
  score: number | null;
  summary: string;
  matches: string[];
  gaps: string[];
  nextSteps: string[];
  tailoredSummary: string;
  recruiterMessage: string;
};
type Analysis = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  result: Result;
};
const statuses = [
  "Guardada",
  "Postulada",
  "Entrevista",
  "Oferta",
  "Descartada",
];
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "No se pudo conectar con el servidor.");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
function App() {
  const [mode, setMode] = useState<string>("");
  const [items, setItems] = useState<Analysis[]>([]);
  const [selected, setSelected] = useState<Analysis | null>(null);
  const [cv, setCv] = useState("");
  const [job, setJob] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("Todas");
  async function load() {
    setError("");
    setLoading(true);
    try {
      const [cfg, list] = await Promise.all([
        api<{ mode: string }>("/api/config"),
        api<Analysis[]>("/api/analyses"),
      ]);
      setMode(cfg.mode);
      setItems(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const item = await api<Analysis>("/api/analyses", {
        method: "POST",
        body: JSON.stringify({ cv, job, title }),
      });
      setItems((old) => [item, ...old].slice(0, 100));
      setSelected(item);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(item: Analysis, status: string) {
    setBusy(true);
    setError("");
    try {
      const next = await api<Analysis>(`/api/analyses/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setItems((old) => old.map((x) => (x.id === next.id ? next : x)));
      if (selected?.id === next.id) setSelected(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(item: Analysis) {
    if (!window.confirm(`¿Eliminar «${item.title}» y su análisis?`)) return;
    setBusy(true);
    setError("");
    try {
      await api<void>(`/api/analyses/${item.id}`, {
        method: "DELETE",
        body: "{}",
      });
      setItems((old) => old.filter((x) => x.id !== item.id));
      if (selected?.id === item.id) setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header>
        <a className="brand" href="/">
          AI<span>↗</span> Job Hunter
        </a>
        <span className="badge">
          {mode === "openai"
            ? "IA conectada"
            : mode === "demo"
              ? "Modo demostración"
              : "Conectando…"}
        </span>
      </header>
      <main>
        <section className="intro">
          <p className="eyebrow">TU PRÓXIMO PASO PROFESIONAL</p>
          <h1>
            Encuentra tu encaje.
            <br />
            <span>Postúlate con intención.</span>
          </h1>
          <p>
            Compara tu experiencia con una oportunidad y convierte el análisis
            en un siguiente paso claro.
          </p>
        </section>
        {error && (
          <div className="error" role="alert">
            {error}{" "}
            <button type="button" disabled={busy} onClick={() => void load()}>
              Recargar datos
            </button>
          </div>
        )}
        <ProfilePanel
          onSaved={(data) => setCv(current => current || data.cvText)}
          onUse={(text) => {
            if (cv.trim() && cv !== text && !window.confirm('¿Reemplazar el CV de esta vacante por tu perfil guardado?')) return false;
            setCv(text);
            document.getElementById('cv')?.focus();
            return true;
          }}
          onDelete={(previousCv) => setCv(current => current === previousCv ? '' : current)}
        />
        <VacancySearch onUse={(vacancy) => {
          if ((job.trim() || title.trim()) && !window.confirm('¿Reemplazar el cargo y la descripción del formulario por esta oferta? Tu CV se conserva.')) return false;
          const description = `${vacancy.title} — ${vacancy.company}\nUbicación: ${vacancy.location}\nFuente: Remotive\n${vacancy.url}\n\n${vacancy.description}`;
          setTitle(`${vacancy.title} · ${vacancy.company}`.slice(0,160));
          setJob(description);
          setError('');
          document.getElementById('job')?.focus();
          return true;
        }} />
        <div className="layout">
          <section className="panel">
            <div className="section-head">
              <h2>01 / Nueva oportunidad</h2>
              <span>CV + vacante</span>
            </div>
            <ImportCv onUse={(text) => {
              if (cv.trim() && cv !== text && !window.confirm('¿Reemplazar el CV de esta vacante por el texto importado? Tu perfil guardado se conserva.')) return false;
              setCv(text);
              document.getElementById('cv')?.focus();
              return true;
            }} />
            <form onSubmit={submit}>
              <label htmlFor="title">Cargo y empresa</label>
              <input
                id="title"
                required
                minLength={3}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Frontend Developer · Empresa"
              />
              <label htmlFor="cv">
                Tu CV en texto <small>80–16.000 caracteres</small>
              </label>
              <textarea
                id="cv"
                required
                minLength={80}
                maxLength={16000}
                rows={8}
                value={cv}
                onChange={(e) => setCv(e.target.value)}
                placeholder="Pega tu experiencia, habilidades, proyectos e idiomas…"
              />
              <p className="muted">Editar este texto no modifica tu perfil guardado.</p>
              <label htmlFor="job">
                Descripción de la vacante <small>80–16.000 caracteres</small>
              </label>
              <textarea
                id="job"
                required
                minLength={80}
                maxLength={16000}
                rows={8}
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="Pega responsabilidades, requisitos y condiciones…"
              />
              {job.length > 16000 && <p className="error" role="alert">La oferta supera los 16.000 caracteres. Resume o recorta su descripción antes de analizarla.</p>}
              <p className="notice">
                {mode === "openai"
                  ? "Al analizar, el CV y la vacante se envían a OpenAI. Se guarda el resultado, no los textos originales. Revisa los borradores antes de usarlos."
                  : "La demostración guarda un ejemplo de resultado. No evalúa tu perfil ni envía datos a una IA."}
              </p>
              <button className="primary" disabled={busy || loading || !mode || job.length > 16000}>
                {busy
                  ? "Procesando…"
                  : mode === "openai"
                    ? "Analizar y guardar ↗"
                    : "Probar demostración ↗"}
              </button>
            </form>
          </section>
          <section className="panel result" aria-live="polite">
            <div className="section-head">
              <h2>02 / Tu análisis</h2>
            </div>
            {selected ? (
              <>
                <p className="eyebrow">{selected.title}</p>
                <div className="score">
                  {selected.result.score ?? "—"}
                  <small>
                    {selected.result.mode === "demo"
                      ? "DEMO · SIN EVALUACIÓN"
                      : "/ 100 · COMPATIBILIDAD"}
                  </small>
                </div>
                <p>{selected.result.summary}</p>
                <p className="muted">
                  Orientación basada en el texto; no es una probabilidad de
                  contratación.
                </p>
                {(
                  [
                    ["Coincidencias", selected.result.matches],
                    ["Por reforzar o verificar", selected.result.gaps],
                    ["Próximos pasos", selected.result.nextSteps],
                  ] as [string, string[]][]
                ).map(([heading, values]) => (
                  <div className="result-section" key={heading}>
                    <h3>{heading}</h3>
                    <ul>
                      {values.map((value, i) => (
                        <li key={i}>{value}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                <details>
                  <summary>Resumen profesional adaptado</summary>
                  <p className="preserve">{selected.result.tailoredSummary}</p>
                </details>
                <details>
                  <summary>Mensaje para el reclutador</summary>
                  <p className="preserve">{selected.result.recruiterMessage}</p>
                </details>
              </>
            ) : (
              <div className="empty">
                <div className="empty-icon">↗</div>
                <h3>Una oportunidad, un plan.</h3>
                <p>
                  Completa el formulario para ver coincidencias, brechas y
                  acciones sugeridas.
                </p>
              </div>
            )}
          </section>
        </div>
        <section className="panel history">
          <div className="section-head">
            <div>
              <p className="eyebrow">TU SEGUIMIENTO</p>
              <h2>Oportunidades guardadas</h2>
            </div>
            <label className="filter">
              Estado
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {["Todas", ...statuses].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          {loading ? (
            <p role="status">Cargando oportunidades…</p>
          ) : items.filter((x) => filter === "Todas" || x.status === filter)
              .length === 0 ? (
            <p className="muted">
              No hay oportunidades en esta vista. Tu primer análisis aparecerá
              aquí.
            </p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Oportunidad</th>
                    <th>Compatibilidad</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items
                    .filter((x) => filter === "Todas" || x.status === filter)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.title}</strong>
                          <small>
                            {new Date(item.created_at).toLocaleDateString(
                              "es-CO",
                            )}
                            {item.result.mode === "demo" ? " · Demo" : ""}
                          </small>
                        </td>
                        <td>
                          {item.result.score === null
                            ? "—"
                            : `${item.result.score}/100`}
                        </td>
                        <td>
                          <select
                            aria-label={`Estado de ${item.title}`}
                            disabled={busy}
                            value={item.status}
                            onChange={(e) => void update(item, e.target.value)}
                          >
                            {statuses.map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="actions">
                          <button
                            disabled={busy}
                            onClick={() => setSelected(item)}
                          >
                            Ver análisis
                          </button>
                          <button
                            className="delete"
                            disabled={busy}
                            onClick={() => void remove(item)}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted">
            Se muestran las 100 oportunidades más recientes. Cambiar el estado
            no envía una postulación.
          </p>
        </section>
      </main>
      <footer>
        AI Job Hunter · Versión inicial local · Construye tu siguiente
        oportunidad.
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
