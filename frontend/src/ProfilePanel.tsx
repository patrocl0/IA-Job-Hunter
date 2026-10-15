import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
const fields = [
  { key: 'name', label: 'Nombre', max: 120, min: 2 },
  { key: 'headline', label: 'Cargo objetivo', max: 160, min: 3 },
  { key: 'location', label: 'Ubicación y disponibilidad', max: 200 },
  { key: 'summary', label: 'Resumen profesional', max: 2000, rows: 4 },
  { key: 'skills', label: 'Habilidades', max: 2000, rows: 3 },
  { key: 'experience', label: 'Experiencia', max: 5000, rows: 5 },
  { key: 'projects', label: 'Proyectos', max: 4000, rows: 4 },
  { key: 'education', label: 'Formación', max: 1000, rows: 3 },
  { key: 'languages', label: 'Idiomas', max: 500, rows: 2 },
] as const;
type FieldKey = typeof fields[number]['key'];
type Profile = Record<FieldKey, string>;
export type SavedProfile = { profile: Profile | null; cvText: string; updatedAt: string | null };
const emptyProfile = (): Profile => Object.fromEntries(fields.map(f => [f.key, ''])) as Profile;
async function request(method = 'GET', profile?: Profile): Promise<SavedProfile | null> {
  const response = await fetch('/api/profile', {
    method, headers: { 'Content-Type': 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(profile ?? {}) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'No se pudo guardar o cargar el perfil.');
  }
  return response.status === 204 ? null : response.json();
}
export function ProfilePanel({ onSaved, onUse, onDelete }: {
  onSaved: (data: SavedProfile) => void;
  onUse: (cv: string) => boolean;
  onDelete: (previousCv: string) => void;
}) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loaded, setLoaded] = useState(false);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved?.profile ?? emptyProfile());
  async function load() {
    setLoading(true); setError('');
    try {
      const data = await request();
      setProfile(data?.profile ?? emptyProfile()); setSaved(data); setLoaded(true);
      if (data) onSaved(data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(event: FormEvent) {
    event.preventDefault(); setPending(true); setError(''); setNotice('');
    try {
      const data = await request('PUT', profile);
      if (data) { setSaved(data); setProfile(data.profile!); onSaved(data); setNotice('Perfil guardado. Puedes usarlo en una nueva oportunidad.'); }
    } catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  }
  async function remove() {
    if (!window.confirm('¿Eliminar el perfil guardado? Los análisis anteriores se conservan.')) return;
    setPending(true); setError(''); setNotice('');
    try { await request('DELETE'); onDelete(saved?.cvText ?? ''); setProfile(emptyProfile()); setSaved(null); setNotice('Perfil eliminado. Los análisis anteriores se conservan.'); }
    catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  }
  return <section className="panel profile-panel" aria-labelledby="profile-title">
    <div className="section-head"><div><p className="eyebrow">TU BASE PROFESIONAL</p><h2 id="profile-title">Mi perfil</h2></div><span>{dirty ? 'Cambios sin guardar' : saved?.profile ? 'Perfil guardado' : 'Empieza aquí'}</span></div>
    <p className="muted">Guarda tu experiencia una vez y reutilízala en tus próximas oportunidades. Guardar el perfil no utiliza IA.</p>
    {error && <div className="error" role="alert">{error}{!loaded && <button type="button" onClick={() => void load()}>Reintentar</button>}</div>}
    {notice && <p className="success" role="status">{notice}</p>}
    {loading ? <p role="status">Cargando perfil…</p> : loaded && <details open={!saved?.profile || undefined}>
      <summary>Editar datos profesionales</summary>
      <form onSubmit={save}><fieldset disabled={pending} className="profile-fields"><legend className="sr-only">Datos profesionales</legend>
        {fields.map(field => <div key={field.key} className={'rows' in field ? 'wide' : ''}>
          <label htmlFor={`profile-${field.key}`}>{field.label}{'min' in field ? ' *' : ''}</label>
          {'rows' in field ? <textarea id={`profile-${field.key}`} rows={field.rows} maxLength={field.max} value={profile[field.key]} onChange={e => {setProfile({...profile, [field.key]: e.target.value}); setNotice('');}} />
            : <input id={`profile-${field.key}`} required={'min' in field} minLength={'min' in field ? field.min : undefined} maxLength={field.max} value={profile[field.key]} onChange={e => {setProfile({...profile, [field.key]: e.target.value}); setNotice('');}} />}
        </div>)}
      </fieldset><p className="muted">* Campos obligatorios. Completa solo información real. El perfil se guarda en la base de datos local de esta aplicación.</p>
      <div className="profile-actions"><button className="primary" disabled={pending || !dirty}>{pending ? 'Guardando…' : 'Guardar perfil'}</button>
      <button type="button" disabled={pending || !dirty} onClick={() => {setProfile(saved?.profile ?? emptyProfile()); setNotice(''); setError('');}}>Descartar cambios</button></div></form>
    </details>}
    {saved?.profile && <div className="profile-actions"><button type="button" disabled={pending || dirty} onClick={() => { if (onUse(saved.cvText)) setNotice('Perfil copiado al campo CV. Puedes ajustarlo para esta vacante.'); }}>Usar perfil en esta vacante</button>
      <button type="button" className="delete" disabled={pending} onClick={() => void remove()}>Eliminar perfil</button>
      <small className="muted">Último guardado: {new Date(saved.updatedAt!).toLocaleString('es-CO')}</small></div>}
  </section>;
}
