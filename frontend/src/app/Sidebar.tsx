import { ArrowUpRight, Target, FileText, UserRound } from 'lucide-react';
import { isPublicDemo } from '@/lib/api';
import { navigation, type Page } from './navigation';
import type { Stats } from '@/features/analyses/types';
export function Sidebar({
  mobile,
  setMobile,
  go,
  page,
  stats,
}: {
  mobile: boolean;
  setMobile: (open: boolean) => void;
  go: (page: Page) => void;
  page: Page;
  stats?: Stats;
}) {
  return (
    <>
      {mobile && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          aria-label="Cerrar navegación"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card p-5 transition-transform lg:visible lg:translate-x-0 ' +
          (mobile ? 'visible translate-x-0' : 'invisible -translate-x-full')
        }
      >
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go('overview');
          }}
          className="mb-10 flex items-center gap-3 px-2 pt-3"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
            <ArrowUpRight size={25} />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Job Hunter<span className="ml-1 text-primary">.</span>
            <small className="block text-[10px] font-medium tracking-[.18em] text-muted-foreground">
              TU SIGUIENTE PASO
            </small>
          </span>
        </a>
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[.15em] text-muted-foreground">
          ESPACIO DE TRABAJO
        </p>
        <nav aria-label="Principal" className="space-y-1.5">
          {navigation.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={page === id ? 'page' : undefined}
              className={
                'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors ' +
                (page === id
                  ? 'bg-primary/8 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground')
              }
            >
              <Icon size={18} />
              {title}
              {id === 'applications' && !!stats?.due && (
                <span className="ml-auto rounded-md bg-primary/10 px-1.5 text-xs">{stats.due}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto rounded-xl border bg-secondary/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Target size={16} className="text-primary" />
            Un paso a la vez
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            Organiza tu búsqueda y dedica más tiempo a las oportunidades que importan.
          </p>
          <a
            href="https://github.com/patrocl0/IA-Job-Hunter"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 text-xs font-medium"
          >
            <FileText size={14} /> Ver el proyecto <ArrowUpRight size={13} />
          </a>
        </div>
        <div className="mt-5 flex items-center gap-3 border-t px-2 pt-5">
          <div className="flex size-9 items-center justify-center rounded-full bg-secondary">
            <UserRound size={17} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {isPublicDemo ? 'Espacio de ejemplo' : 'Mi espacio personal'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isPublicDemo ? 'Datos en este navegador' : 'Instalación local'}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
