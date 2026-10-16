import { isPublicDemo, requestResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
export type Vacancy = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  jobType: string;
  category: string;
  description: string;
  tags: string[];
  url: string;
  publishedAt: string | null;
  source: string;
};
type Search = {
  jobs: Vacancy[];
  total: number;
  page: number;
  pages: number;
  fetchedAt: string;
  stale: boolean;
  nextRefreshAt: string;
};
type Saved = { source_id: string; data: Vacancy; status: string; created_at: string };
type SavedPage = { items: Saved[]; total: number; page: number; pages: number };
const statuses = ['Guardada', 'Postulada', 'Entrevista', 'Oferta', 'Descartada'];
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await requestResponse(url, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
  const body =
    response.status === 204
      ? null
      : await response.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }));
  if (!response.ok)
    throw new Error(
      (body.error || 'No se pudo completar la solicitud.') +
        (body.nextRefreshAt
          ? ' Próximo intento: ' + new Date(body.nextRefreshAt).toLocaleString('es-CO')
          : ''),
    );
  return body;
}
export function VacancySearch({ onUse }: { onUse: (job: Vacancy) => boolean }) {
  const [q, setQ] = useState('React');
  const [location, setLocation] = useState('');
  const [worldwide, setWorldwide] = useState(true);
  const [result, setResult] = useState<Search | null>(null);
  const [saved, setSaved] = useState<SavedPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedLoading, setSavedLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedError, setSavedError] = useState('');
  const [notice, setNotice] = useState('');
  const [knownSaved, setKnownSaved] = useState<Set<string>>(new Set());
  const filters = useRef({ q: 'React', location: '', worldwide: true });
  async function loadSaved(page = 1) {
    setSavedLoading(true);
    setSavedError('');
    try {
      const data = await api<SavedPage>('/api/vacancies/saved?page=' + page);
      setSaved(data);
      setKnownSaved((old) => new Set([...old, ...data.items.map((x) => x.source_id)]));
    } catch (e) {
      setSavedError((e as Error).message);
    } finally {
      setSavedLoading(false);
    }
  }
  useEffect(() => {
    void loadSaved();
  }, []);
  async function search(page = 1, newFilters = false) {
    setLoading(true);
    setError('');
    setNotice('');
    if (newFilters) filters.current = { q, location, worldwide };
    const f = filters.current;
    try {
      const params = new URLSearchParams({
        q: f.q,
        location: f.location,
        worldwide: String(f.worldwide),
        page: String(page),
      });
      setResult(await api<Search>('/api/vacancies?' + params));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }
  async function save(job: Vacancy) {
    setSaving(true);
    setSavedError('');
    setNotice('');
    try {
      await api('/api/vacancies/saved', { method: 'POST', body: JSON.stringify({ id: job.id }) });
      setKnownSaved((old) => new Set([...old, job.id]));
      setNotice('Vacante guardada. Puedes seguir su estado en «Vacantes guardadas».');
      await loadSaved();
    } catch (e) {
      setSavedError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function change(item: Saved, status: string) {
    setSaving(true);
    setSavedError('');
    try {
      const updated = await api<Saved>('/api/vacancies/saved/' + item.source_id, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setSaved((old) =>
        old
          ? {
              ...old,
              items: old.items.map((x) => (x.source_id === updated.source_id ? updated : x)),
            }
          : old,
      );
    } catch (e) {
      setSavedError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function remove(item: Saved) {
    if (
      !window.confirm(
        '¿Quitar esta vacante de tu lista guardada? Sus análisis anteriores se conservarán.',
      )
    )
      return;
    setSaving(true);
    setSavedError('');
    try {
      await api('/api/vacancies/saved/' + item.source_id, { method: 'DELETE', body: '{}' });
      setKnownSaved((old) => {
        const next = new Set(old);
        next.delete(item.source_id);
        return next;
      });
      await loadSaved(saved?.page ?? 1);
    } catch (e) {
      setSavedError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function use(job: Vacancy) {
    if (onUse(job))
      setNotice('Oferta copiada al formulario de análisis. Revisa el texto y utiliza tu CV.');
  }
  function card(job: Vacancy, item?: Saved) {
    return (
      <article className="vacancy-card" key={job.id}>
        <p className="eyebrow">{job.company}</p>
        <h3>{job.title}</h3>
        <p className="vacancy-location">Remoto · {job.location}</p>
        <p className="muted">
          {job.salary || 'Salario no publicado'}
          {job.publishedAt ? ' · Publicada: ' + job.publishedAt.slice(0, 10) : ''}
        </p>
        <details>
          <summary>Descripción de la oferta</summary>
          <p className="preserve vacancy-description">
            {job.description || 'Consulta la descripción en la oferta original.'}
          </p>
        </details>
        {!isPublicDemo && (
          <a className="source-link" href={job.url} target="_blank" rel="noopener noreferrer">
            Ver oferta original en Remotive ↗
          </a>
        )}
        {isPublicDemo && <p className="muted">Oferta ficticia · sin postulaciones reales</p>}
        <div className="vacancy-actions">
          {!item && (
            <Button
              type="button"
              disabled={saving || knownSaved.has(job.id)}
              onClick={() => void save(job)}
            >
              {knownSaved.has(job.id) ? 'Guardada' : 'Guardar vacante'}
            </Button>
          )}
          <Button type="button" onClick={() => use(job)}>
            Preparar análisis
          </Button>
        </div>
        {item && (
          <div className="vacancy-actions">
            <label>
              Estado de la vacante
              <select
                aria-label={'Estado de ' + job.title}
                disabled={saving || savedLoading}
                value={item.status}
                onChange={(e) => void change(item, e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              className="delete"
              disabled={saving}
              onClick={() => void remove(item)}
            >
              Quitar de guardadas
            </Button>
          </div>
        )}
      </article>
    );
  }
  return (
    <section className="panel vacancy-panel" aria-labelledby="vacancies-title">
      <div className="section-head">
        <div>
          <p className="eyebrow">
            {isPublicDemo ? 'CATÁLOGO DE EJEMPLO' : 'EXPLORA OPORTUNIDADES REALES'}
          </p>
          <h2 id="vacancies-title">{isPublicDemo ? 'Vacantes de ejemplo' : 'Vacantes remotas'}</h2>
        </div>
        <span>
          {isPublicDemo ? (
            'Ofertas ficticias'
          ) : (
            <>
              Fuente:{' '}
              <a href="https://remotive.com" target="_blank" rel="noopener noreferrer">
                Remotive
              </a>
            </>
          )}
        </span>
      </div>
      <p className="muted">
        {isPublicDemo
          ? 'Explora estas ofertas ficticias, guárdalas y prepara un análisis de ejemplo. No se consulta ninguna fuente externa.'
          : 'No requiere saldo de IA. La API pública de Remotive publica ofertas con 24 horas de retraso; esta aplicación consulta la fuente como máximo cada 6 horas. Confirma los requisitos geográficos y la vigencia en la oferta original.'}
      </p>
      <form
        className="vacancy-filters"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          void search(1, true);
        }}
      >
        <div>
          <label htmlFor="vacancy-query">Cargo, tecnología o empresa</label>
          <Input
            id="vacancy-query"
            maxLength={100}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="React, frontend, Node…"
          />
        </div>
        <div>
          <label htmlFor="vacancy-location">Ubicación publicada</label>
          <Input
            id="vacancy-location"
            maxLength={100}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Colombia, LATAM, Europe…"
          />
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={worldwide}
            onChange={(e) => setWorldwide(e.target.checked)}
          />
          Incluir ofertas mundiales al filtrar ubicación
        </label>
        <Button className="primary" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar vacantes'}
        </Button>
      </form>
      <p className="muted">
        El filtro busca el texto publicado; no interpreta países dentro de regiones. Para explorar
        ofertas para Colombia, prueba también «Latin America» o «LATAM». «Worldwide» no garantiza
        que cumplas todos los requisitos.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success" role="status">
          {notice}
        </p>
      )}
      {result && (
        <>
          <p className="muted" role="status">
            {result.total} resultados · Consultado:{' '}
            {new Date(result.fetchedAt).toLocaleString('es-CO')} · Próxima actualización posible:{' '}
            {new Date(result.nextRefreshAt).toLocaleString('es-CO')}
          </p>
          {result.stale && (
            <p className="import-warning">
              No se pudo renovar la fuente. Se muestra la última copia disponible; verifica si estas
              ofertas siguen abiertas.
            </p>
          )}
          {result.jobs.length ? (
            <div className="vacancy-grid">{result.jobs.map((job) => card(job))}</div>
          ) : (
            <p>No hay coincidencias. Prueba menos palabras o deja la ubicación vacía.</p>
          )}
          <div className="pagination">
            <Button
              type="button"
              disabled={loading || result.page <= 1}
              onClick={() => void search(result.page - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {result.page} de {result.pages}
            </span>
            <Button
              type="button"
              disabled={loading || result.page >= result.pages}
              onClick={() => void search(result.page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </>
      )}
      <div className="saved-heading">
        <h3>Vacantes guardadas{saved ? ' (' + saved.total + ')' : ''}</h3>
        <Button
          type="button"
          disabled={savedLoading || saving}
          onClick={() => void loadSaved(saved?.page ?? 1)}
        >
          Recargar guardadas
        </Button>
      </div>
      <p className="muted">
        Se conservan aunque desaparezcan de la fuente. Su estado es independiente del historial de
        análisis. Cambiar a «Postulada» no envía una solicitud.
      </p>
      {savedError && (
        <p className="error" role="alert">
          {savedError}
        </p>
      )}
      {savedLoading ? (
        <p role="status">Cargando guardadas…</p>
      ) : (
        saved && (
          <>
            {saved.items.length ? (
              <div className="vacancy-grid">{saved.items.map((item) => card(item.data, item))}</div>
            ) : (
              <p className="muted">Todavía no has guardado ninguna vacante.</p>
            )}
            <div className="pagination">
              <Button
                type="button"
                disabled={saving || saved.page <= 1}
                onClick={() => void loadSaved(saved.page - 1)}
              >
                Anterior
              </Button>
              <span>
                Página {saved.page} de {saved.pages}
              </span>
              <Button
                type="button"
                disabled={saving || saved.page >= saved.pages}
                onClick={() => void loadSaved(saved.page + 1)}
              >
                Siguiente
              </Button>
            </div>
          </>
        )
      )}
    </section>
  );
}
