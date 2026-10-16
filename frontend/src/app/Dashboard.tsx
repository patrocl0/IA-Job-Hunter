import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  FileText,
  ListChecks,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Page } from './navigation';
import type { useAnalyses } from '@/features/analyses/useAnalyses';
export function Dashboard({
  model,
  hasProfile,
  go,
}: {
  model: ReturnType<typeof useAnalyses>;
  hasProfile: boolean;
  go: (page: Page) => void;
}) {
  const stats = model.data?.stats;
  return (
    <div className="space-y-7">
      {model.error && (
        <p role="alert" className="error">
          {model.error}
          <Button variant="outline" size="sm" onClick={() => void model.reload()}>
            Reintentar
          </Button>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: 'Oportunidades',
            value: stats?.total,
            icon: BriefcaseBusiness,
            caption: 'En tu historial',
          },
          {
            label: 'Postuladas',
            value: stats?.applied,
            icon: ArrowUpRight,
            caption: 'Estado registrado',
          },
          {
            label: 'Entrevistas',
            value: stats?.interviews,
            icon: UserRound,
            caption: 'Conversaciones en curso',
          },
          {
            label: 'Por dar seguimiento',
            value: stats?.due,
            icon: CalendarClock,
            caption: 'Hoy y fechas vencidas',
          },
        ].map(({ label, value, icon: Icon, caption }) => (
          <Card key={label} className="shadow-none">
            <CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <Icon size={17} className="text-primary/70" />
              </div>
              <p className="text-3xl font-semibold tracking-tight">{value ?? '—'}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">{caption}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="overflow-hidden border-primary/10 bg-[#eaf2ed] shadow-none">
          <CardContent className="relative p-7 md:p-9">
            <div className="relative z-10 max-w-lg">
              <Badge className="mb-6 bg-white/80 text-primary hover:bg-white/80">
                HECHO PARA AVANZAR
              </Badge>
              <h2 className="max-w-sm text-2xl font-semibold leading-snug tracking-tight md:text-3xl">
                Menos pestañas abiertas.
                <br />
                Más claridad en tu búsqueda.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-7 text-[#52665a]">
                Reúne tu perfil, encuentra una oportunidad y decide tu siguiente paso en un mismo
                espacio.
              </p>
              <Button className="mt-7" onClick={() => go('vacancies')}>
                Explorar oportunidades <ArrowUpRight size={16} />
              </Button>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-12 -right-10 hidden size-64 rounded-full border-[30px] border-white/40 sm:block"
            >
              <div className="m-6 size-36 rounded-full border-[25px] border-primary/10" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2">
              <ListChecks size={18} className="text-primary" />
              <h2 className="font-semibold">Tu ruta de hoy</h2>
            </div>
            {[
              {
                title: 'Prepara tu perfil',
                desc: hasProfile
                  ? 'Tu perfil está listo para reutilizar.'
                  : 'Añade tu experiencia y habilidades.',
                done: hasProfile,
                target: 'profile',
              },
              {
                title: 'Encuentra una oportunidad',
                desc: 'Explora y guarda una vacante.',
                done: false,
                target: 'vacancies',
              },
              {
                title: 'Mantén el contacto',
                desc: stats?.due
                  ? `${stats.due} seguimientos pendientes.`
                  : 'Revisa tus próximos pasos.',
                done: false,
                target: 'applications',
              },
            ].map((step, i) => (
              <button
                key={step.title}
                onClick={() => {
                  if (step.target === 'applications') model.filterDue(true);
                  go(step.target as Page);
                }}
                className="flex w-full items-start gap-3 border-b py-4 text-left last:border-0"
              >
                <span
                  className={
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs ' +
                    (step.done ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')
                  }
                >
                  {step.done ? <Check size={14} /> : i + 1}
                </span>
                <span className="flex-1">
                  <strong className="text-sm font-medium">{step.title}</strong>
                  <small className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {step.desc}
                  </small>
                </span>
                <ChevronRight size={14} className="mt-1 text-muted-foreground" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
      <Card className="shadow-none">
        <CardContent className="flex flex-wrap items-center justify-between gap-5 p-6">
          <div className="flex items-start gap-4">
            <div className="icon-tile">
              <FileText size={21} />
            </div>
            <div>
              <h2 className="font-semibold">Tu experiencia merece una buena presentación</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Importa tu CV, revisa el texto y úsalo en una oportunidad.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => go('analysis')}>
            Preparar un análisis <ArrowUpRight size={16} />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
