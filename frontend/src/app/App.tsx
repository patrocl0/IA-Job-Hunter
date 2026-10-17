import { PasswordDialog } from '@/features/auth/PasswordDialog';
import { Sidebar } from './Sidebar';
import { Dashboard } from './Dashboard';
import { navigation, type Page } from './navigation';
import { useEffect, useState } from 'react';
import { ChevronRight, Menu, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, isPublicDemo, resetDemo } from '@/lib/api';
import { ProfilePanel } from '@/features/profile/ProfilePanel';
import { VacancySearch } from '@/features/vacancies/VacancySearch';
import { AnalysisForm, type Draft } from '@/features/analyses/AnalysisForm';
import { Applications } from '@/features/analyses/Applications';
import { useAnalyses } from '@/features/analyses/useAnalyses';
import type { Analysis } from '@/features/analyses/types';
export default function App({
  accountEmail,
  onLogout,
  logoutBusy,
  onPasswordChanged,
}: {
  accountEmail?: string;
  onLogout?: () => void;
  logoutBusy?: boolean;
  onPasswordChanged?: () => void;
}) {
  const [page, setPage] = useState<Page>('overview'),
    [mobile, setMobile] = useState(false),
    [mode, setMode] = useState(''),
    [configError, setConfigError] = useState('');
  const [draft, setDraft] = useState<Draft>({ title: '', cv: '', job: '', jobUrl: '' });
  const [hasProfile, setHasProfile] = useState(false);
  const model = useAnalyses();
  const stats = model.data?.stats;
  const go = (page: Page) => {
    setPage(page);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const loadConfig = async () => {
    setConfigError('');
    try {
      setMode((await api<{ mode: string }>('/api/config')).mode);
    } catch (e) {
      setConfigError((e as Error).message);
    }
  };
  useEffect(() => {
    void loadConfig();
  }, []);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="skip-link" href="#main">
        Saltar al contenido
      </a>
      <Sidebar mobile={mobile} setMobile={setMobile} go={go} page={page} stats={stats} />
      <div className="lg:pl-64">
        <header className="flex min-h-20 flex-wrap py-3 md:flex-nowrap items-center justify-between gap-3 border-b bg-card/90 px-5 md:px-9">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir navegación"
              onClick={() => setMobile(true)}
            >
              {mobile ? <X size={20} /> : <Menu size={20} />}
            </Button>
            <span className="hidden text-sm text-muted-foreground sm:inline">Mi espacio</span>
            <ChevronRight size={14} className="hidden text-muted-foreground sm:inline" />
            <span className="text-sm font-medium">
              {navigation.find((n) => n.id === page)?.title}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {onPasswordChanged && (
              <PasswordDialog onChanged={onPasswordChanged} disabled={logoutBusy} />
            )}
            {onLogout && (
              <Button variant="ghost" size="sm" disabled={logoutBusy} onClick={onLogout}>
                Cerrar sesión
              </Button>
            )}
            <Badge variant="outline" className="gap-2 rounded-full px-3 py-1.5">
              <span
                className={'size-1.5 rounded-full ' + (mode ? 'bg-emerald-500' : 'bg-amber-400')}
              />
              {mode === 'openai'
                ? 'IA conectada'
                : mode === 'demo'
                  ? 'Modo demostración'
                  : 'Conectando…'}
            </Badge>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-[1500px] px-5 py-8 md:px-9 md:py-10">
          {isPublicDemo && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
              <p className="max-w-3xl text-xs leading-5 text-primary">
                <strong>Demo pública.</strong> Perfil y ofertas ficticios, sin consumo de IA. Los
                cambios quedan en este navegador. Usa datos de ejemplo.
              </p>
              <Button variant="ghost" size="sm" onClick={() => void resetDemo()}>
                Restablecer demo
              </Button>
            </div>
          )}
          {configError && (
            <p role="alert" className="error mb-6">
              {configError}
              <Button variant="outline" size="sm" onClick={() => void loadConfig()}>
                Reintentar conexión
              </Button>
            </p>
          )}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground">
                {page === 'overview' ? 'DALE DIRECCIÓN A TU BÚSQUEDA' : 'TU PRÓXIMA OPORTUNIDAD'}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {page === 'overview'
                  ? 'Tu próximo capítulo empieza aquí.'
                  : navigation.find((n) => n.id === page)?.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {page === 'overview'
                  ? 'Un lugar para conectar tu experiencia con nuevas oportunidades.'
                  : page === 'applications'
                    ? 'Cada conversación cuenta. Mantén tus fechas y próximos pasos a mano.'
                    : page === 'profile'
                      ? 'Tu experiencia, organizada y lista para cada nueva oportunidad.'
                      : page === 'vacancies'
                        ? 'Explora, guarda y prepara tu siguiente postulación.'
                        : 'Convierte una oportunidad en un siguiente paso claro.'}
              </p>
            </div>
            {page !== 'analysis' && (
              <Button onClick={() => go('analysis')} className="mt-2">
                <Plus size={16} />
                Nueva oportunidad
              </Button>
            )}
          </div>
          {page === 'overview' && <Dashboard model={model} hasProfile={hasProfile} go={go} />}
          <div hidden={page !== 'profile'}>
            <ProfilePanel
              onSaved={(data) => {
                setHasProfile(!!data.profile);
                setDraft((current) => ({ ...current, cv: current.cv || data.cvText }));
              }}
              onUse={(text) => {
                if (
                  draft.cv.trim() &&
                  draft.cv !== text &&
                  !window.confirm('¿Reemplazar el CV de esta oportunidad?')
                )
                  return false;
                setDraft({ ...draft, cv: text });
                go('analysis');
                return true;
              }}
              onDelete={(previous) => {
                setHasProfile(false);
                setDraft((current) => ({
                  ...current,
                  cv: current.cv === previous ? '' : current.cv,
                }));
              }}
            />
          </div>
          <div hidden={page !== 'vacancies'}>
            <VacancySearch
              onUse={(vacancy) => {
                if (
                  (draft.title || draft.job) &&
                  !window.confirm('¿Reemplazar la vacante del formulario? Tu CV se conserva.')
                )
                  return false;
                setDraft({
                  ...draft,
                  title: `${vacancy.title} · ${vacancy.company}`.slice(0, 160),
                  job: `${vacancy.title}\n${vacancy.company}\n${vacancy.location}\n\n${vacancy.description}`,
                  jobUrl: vacancy.url,
                });
                go('analysis');
                return true;
              }}
            />
          </div>
          <div hidden={page !== 'applications'}>
            <Applications model={model} onNew={() => go('analysis')} />
          </div>
          <div hidden={page !== 'analysis'}>
            <AnalysisForm
              draft={draft}
              setDraft={setDraft}
              mode={mode}
              create={async (value) => {
                const item = await api<Analysis>('/api/analyses', {
                  method: 'POST',
                  body: JSON.stringify({ ...value, tracking: { jobUrl: value.jobUrl } }),
                });
                await model.reload();
                return item;
              }}
            />
          </div>
          <footer className="mt-12 flex flex-wrap justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
            <span>AI Job Hunter · Construye tu siguiente oportunidad.</span>
            <span>
              {isPublicDemo ? 'Demo pública · sin IA' : `Sesión de ${accountEmail ?? ''}`}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
