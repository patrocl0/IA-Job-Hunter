import { useRef, useState } from 'react';
type Imported = { text: string; warnings: string[] };
export function ImportCv({ onUse }: { onUse: (text: string) => boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Imported | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  async function extract() {
    if (!file) return;
    setError(''); setNotice(''); setPreview(null);
    if (!/\.(pdf|docx)$/i.test(file.name)) { setError('Selecciona un PDF o DOCX. No se admite .doc.'); return; }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) { setError('El archivo debe tener contenido y pesar como máximo 5 MiB.'); return; }
    setBusy(true);
    try {
      const form = new FormData(); form.append('cv', file);
      const response = await fetch('/api/cv/import', { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
      const data = await response.json().catch(() => { throw new Error('El servidor no respondió correctamente. Comprueba los contenedores.'); });
      if (!response.ok) throw new Error(data.error || 'No se pudo importar el archivo.');
      setPreview(data);
    } catch (e) { setError(e instanceof Error && e.name === 'TimeoutError' ? 'La importación tardó demasiado. Intenta con un archivo más simple.' : (e as Error).message); }
    finally { setBusy(false); }
  }
  function discard() { setPreview(null); setFile(null); setError(''); setNotice(''); if (picker.current) picker.current.value = ''; }
  const count = preview?.text.trim().length ?? 0;
  return <div className="import-cv">
    <h3>Importar CV desde un archivo</h3>
    <p className="muted">PDF con texto o DOCX · hasta 5 MiB · PDF de hasta 30 páginas. Se procesa en tu servidor local sin IA. El archivo no se guarda; podrás revisar el texto antes de usarlo.</p>
    <label htmlFor="cv-file">Seleccionar CV</label>
    <input ref={picker} id="cv-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={e => {setFile(e.target.files?.[0] ?? null); setPreview(null); setError(''); setNotice('');}} />
    <button type="button" disabled={!file || busy} onClick={() => void extract()}>{busy ? 'Extrayendo texto…' : 'Extraer texto'}</button>
    {busy && <p role="status" className="muted">Procesando el documento. Puede tardar unos segundos.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {notice && <p role="status" className="success">{notice}</p>}
    {preview && <div className="import-preview">
      <p className="muted">Revisa nombres, fechas y el orden de las secciones. Los documentos con columnas o tablas pueden extraerse en otro orden. No se rellenan automáticamente los campos de «Mi perfil».</p>
      {preview.warnings.map((warning, i) => <p className="import-warning" key={i}>{warning}</p>)}
      <label htmlFor="cv-preview">Vista previa editable</label>
      <textarea id="cv-preview" rows={10} value={preview.text} onChange={e => setPreview({...preview, text: e.target.value})} aria-describedby="preview-count" />
      <p id="preview-count" className={count < 80 || count > 16000 ? 'import-warning' : 'muted'}>{count.toLocaleString('es-CO')} caracteres · para usar el CV necesitas entre 80 y 16.000.</p>
      <div className="profile-actions"><button type="button" disabled={count < 80 || count > 16000} onClick={() => { if (onUse(preview.text.trim())) {discard(); setNotice('Texto copiado al CV de esta vacante. Tu perfil guardado no se modificó.');} }}>Usar este texto como CV</button>
      <button type="button" onClick={discard}>Descartar importación</button></div>
    </div>}
  </div>;
}
