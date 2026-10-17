import { validateImportedCv } from '@/data/demo/import-protocol';
import { isPublicDemo, requestResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    setError('');
    setNotice('');
    setPreview(null);
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setError('Selecciona un PDF o DOCX. No se admite .doc.');
      return;
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      setError('El archivo debe tener contenido y pesar como máximo 5 MiB.');
      return;
    }
    setBusy(true);
    try {
      let data: Imported;
      if (isPublicDemo) {
        const { extractCv } = await import('@/data/demo/browser-import');
        data = await extractCv(file);
      } else {
        const form = new FormData();
        form.append('cv', file);
        const response = await requestResponse('/api/cv/import', {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(60000),
        });
        const body = await response.json().catch(() => {
          throw new Error('El servidor no respondió correctamente. Comprueba los contenedores.');
        });
        if (!response.ok) throw new Error(body.error || 'No se pudo importar el archivo.');
        data = body;
      }
      setPreview(validateImportedCv(data));
    } catch (e) {
      setError(
        e instanceof Error && e.name === 'TimeoutError'
          ? 'La importación tardó demasiado. Intenta con un archivo más simple.'
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function discard() {
    setPreview(null);
    setFile(null);
    setError('');
    setNotice('');
    if (picker.current) picker.current.value = '';
  }
  const count = preview?.text.trim().length ?? 0;
  return (
    <div className="import-cv">
      <h3>Importar CV desde un archivo</h3>
      <p className="muted">
        PDF con texto o DOCX · hasta 5 MiB · PDF de hasta 30 páginas.{' '}
        {isPublicDemo
          ? 'Se procesa en este navegador sin subir el archivo.'
          : 'Se procesa en tu servidor local sin IA.'}{' '}
        El archivo no se guarda; podrás revisar el texto antes de usarlo.
      </p>
      <label htmlFor="cv-file">Seleccionar CV</label>
      <Input
        ref={picker}
        id="cv-file"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        disabled={busy}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setPreview(null);
          setError('');
          setNotice('');
        }}
      />
      <Button type="button" disabled={!file || busy} onClick={() => void extract()}>
        {busy ? 'Extrayendo texto…' : 'Extraer texto'}
      </Button>
      {busy && (
        <p role="status" className="muted">
          Procesando el documento. Puede tardar unos segundos.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success">
          {notice}
        </p>
      )}
      {preview && (
        <div className="import-preview">
          <p className="muted">
            Revisa nombres, fechas y el orden de las secciones. Los documentos con columnas o tablas
            pueden extraerse en otro orden. No se rellenan automáticamente los campos de «Mi
            perfil».
          </p>
          {preview.warnings.map((warning, i) => (
            <p className="import-warning" key={i}>
              {warning}
            </p>
          ))}
          <label htmlFor="cv-preview">Vista previa editable</label>
          <Textarea
            id="cv-preview"
            rows={10}
            value={preview.text}
            onChange={(e) => setPreview({ ...preview, text: e.target.value })}
            aria-describedby="preview-count"
          />
          <p
            id="preview-count"
            className={count < 80 || count > 16000 ? 'import-warning' : 'muted'}
          >
            {count.toLocaleString('es-CO')} caracteres · para usar el CV necesitas entre 80 y
            16.000.
          </p>
          <div className="profile-actions">
            <Button
              type="button"
              disabled={count < 80 || count > 16000}
              onClick={() => {
                if (onUse(preview.text.trim())) {
                  discard();
                  setNotice(
                    'Texto copiado al CV de esta vacante. Tu perfil guardado no se modificó.',
                  );
                }
              }}
            >
              Usar este texto como CV
            </Button>
            <Button type="button" onClick={discard}>
              Descartar importación
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
