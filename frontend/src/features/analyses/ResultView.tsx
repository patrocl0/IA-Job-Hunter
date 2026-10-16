import { CheckCircle2, CircleHelp, ListChecks, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Analysis } from './types';
export function ResultView({ item }: { item: Analysis }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="secondary">
            {item.result.mode === 'demo'
              ? 'Ejemplo · sin evaluación'
              : 'Análisis de compatibilidad'}
          </Badge>
          <h3 className="mt-3 text-xl font-semibold">{item.title}</h3>
        </div>
        <div className="text-4xl font-semibold tracking-tight text-primary">
          {item.result.score ?? '—'}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {item.result.score === null ? 'demo' : '/ 100'}
          </span>
        </div>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">{item.result.summary}</p>
      {[
        { title: 'Coincidencias', icon: CheckCircle2, values: item.result.matches },
        { title: 'Por reforzar o verificar', icon: CircleHelp, values: item.result.gaps },
        { title: 'Próximos pasos', icon: ListChecks, values: item.result.nextSteps },
      ].map(({ title, icon: Icon, values }) => (
        <section key={title} className="rounded-xl border p-4">
          <h4 className="mb-3 flex items-center gap-2 font-semibold">
            <Icon size={17} className="text-primary" />
            {title}
          </h4>
          <ul className="space-y-2 pl-4 text-sm leading-6 text-muted-foreground list-disc">
            {values.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      ))}
      <details>
        <summary>
          <Sparkles size={15} className="mr-2 inline" />
          Resumen profesional adaptado
        </summary>
        <p className="preserve mt-3 text-sm leading-6">{item.result.tailoredSummary}</p>
      </details>
      <details>
        <summary>Mensaje para el reclutador</summary>
        <p className="preserve mt-3 text-sm leading-6">{item.result.recruiterMessage}</p>
      </details>
      <p className="text-xs leading-5 text-muted-foreground">
        La puntuación, cuando existe, es orientativa; no es una probabilidad de contratación. Ningún
        mensaje se envía automáticamente.
      </p>
    </div>
  );
}
