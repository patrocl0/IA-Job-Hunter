import { useState } from 'react';
import { ArrowUpRight, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ImportCv } from '@/features/documents/ImportCv';
import { ResultView } from './ResultView';
import type { Analysis } from './types';
export type Draft = { title: string; cv: string; job: string; jobUrl: string };
export function AnalysisForm({
  draft,
  setDraft,
  mode,
  create,
}: {
  draft: Draft;
  setDraft: (value: Draft) => void;
  mode: string;
  create: (draft: Draft) => Promise<Analysis>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<Analysis | null>(null);
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="icon-tile">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Prepara tu oportunidad</h2>
              <p className="text-sm text-muted-foreground">
                Un perfil, una vacante y un siguiente paso.
              </p>
            </div>
          </div>
          <details className="mb-6 rounded-xl border p-4">
            <summary>Importar un CV en PDF o DOCX</summary>
            <ImportCv
              onUse={(text) => {
                if (
                  draft.cv.trim() &&
                  draft.cv !== text &&
                  !window.confirm('¿Reemplazar el texto del CV?')
                )
                  return false;
                setDraft({ ...draft, cv: text });
                return true;
              }}
            />
          </details>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                setSelected(await create(draft));
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div>
              <label htmlFor="title">Cargo y empresa</label>
              <Input
                id="title"
                required
                minLength={3}
                maxLength={160}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Frontend Developer · Empresa"
              />
            </div>
            <div>
              <label htmlFor="job-url">
                Enlace de la oferta{' '}
                <span className="text-muted-foreground font-normal">(opcional)</span>
              </label>
              <Input
                id="job-url"
                type="url"
                maxLength={2000}
                value={draft.jobUrl}
                onChange={(e) => setDraft({ ...draft, jobUrl: e.target.value })}
                placeholder="https://…"
              />
            </div>
            <div>
              <label htmlFor="cv">Tu CV en texto</label>
              <Textarea
                id="cv"
                required
                minLength={80}
                maxLength={16000}
                rows={8}
                value={draft.cv}
                onChange={(e) => setDraft({ ...draft, cv: e.target.value })}
                placeholder="Experiencia, habilidades, proyectos e idiomas…"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {draft.cv.length.toLocaleString('es-CO')} / 16.000 caracteres · mínimo 80
              </p>
            </div>
            <div>
              <label htmlFor="job">Descripción de la vacante</label>
              <Textarea
                id="job"
                required
                minLength={80}
                maxLength={16000}
                rows={8}
                value={draft.job}
                onChange={(e) => setDraft({ ...draft, job: e.target.value })}
                placeholder="Responsabilidades, requisitos y condiciones…"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {draft.job.length.toLocaleString('es-CO')} / 16.000 caracteres · mínimo 80
              </p>
            </div>
            <p className="rounded-lg bg-secondary p-3 text-xs leading-5 text-muted-foreground">
              {mode === 'openai'
                ? 'Se envían el CV y la vacante a OpenAI. Revisa el resultado antes de usarlo.'
                : 'Modo demo: guarda un ejemplo identificado, sin evaluar tu perfil ni consumir IA.'}
            </p>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <Button
              className="w-full"
              size="lg"
              disabled={busy || !mode || draft.job.length > 16000}
            >
              {busy
                ? 'Procesando…'
                : mode === 'openai'
                  ? 'Analizar y guardar'
                  : 'Probar demostración'}
              <ArrowUpRight size={17} />
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="self-start">
        <CardContent className="p-6 md:p-8">
          {selected ? (
            <ResultView item={selected} />
          ) : (
            <div className="flex min-h-[450px] flex-col items-center justify-center text-center">
              <div className="mb-5 rounded-2xl bg-secondary p-5">
                <Sparkles size={28} className="text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Tu próximo paso empieza aquí</h2>
              <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                Completa el formulario para explorar un resultado y guardar la oportunidad en tu
                seguimiento.
              </p>
              <div className="mt-8 flex gap-2">
                <span className="h-1.5 w-12 rounded-full bg-primary/30" />
                <span className="h-1.5 w-8 rounded-full bg-primary/15" />
                <span className="h-1.5 w-5 rounded-full bg-primary/10" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
