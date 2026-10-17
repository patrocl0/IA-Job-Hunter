import { downloadCsv } from './downloadCsv';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Download,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TrackingEditor } from './TrackingEditor';
import { displayDate, isDue } from '@/lib/dates';
import { ResultView } from './ResultView';
import { statuses, type Analysis } from './types';
import { useAnalyses } from './useAnalyses';
export function Applications({
  model,
  onNew,
}: {
  model: ReturnType<typeof useAnalyses>;
  onNew: () => void;
}) {
  const [editing, setEditing] = useState<Analysis | null>(null),
    [view, setView] = useState<Analysis | null>(null),
    [notice, setNotice] = useState(''),
    [error, setError] = useState('');
  const { data, loading, busy } = model;
  const [exporting, setExporting] = useState(false);
  const exportRequest = useRef<AbortController | null>(null);
  useEffect(() => () => exportRequest.current?.abort(), []);
  async function exportCsv() {
    const controller = new AbortController();
    exportRequest.current = controller;
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const count = await downloadCsv(model.status, model.due, controller.signal);
      setNotice(`CSV preparado: ${count} registros. Revisa las descargas de tu navegador.`);
    } catch (error) {
      if (!controller.signal.aborted) setError((error as Error).message);
    } finally {
      if (!controller.signal.aborted) setExporting(false);
    }
  }
  async function update(item: Analysis, status: string) {
    setError('');
    try {
      await model.mutate('/api/analyses/' + item.id, 'PATCH', { status });
      setNotice('Estado actualizado.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="space-y-5">
      {editing && (
        <TrackingEditor
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (tracking) => {
            await model.mutate('/api/analyses/' + editing.id, 'PATCH', { tracking });
            setEditing(null);
            setNotice('Seguimiento guardado.');
          }}
        />
      )}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
            <div>
              <h2 className="font-semibold">Tus oportunidades</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {data?.total ?? 0} registros en esta vista · El CSV incluye todas las páginas.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={
                  exporting || loading || busy || !!editing || !!model.error || !data?.total
                }
                onClick={() => void exportCsv()}
              >
                <Download size={16} />
                {exporting ? 'Exportando…' : 'Exportar CSV'}
              </Button>
              <label className="sr-only" htmlFor="status-filter">
                Filtrar por estado
              </label>
              <select
                id="status-filter"
                disabled={!!editing || loading || busy || exporting}
                value={model.status}
                onChange={(e) => model.filterStatus(e.target.value)}
              >
                {['Todas', ...statuses].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="icon"
                aria-label="Actualizar lista"
                disabled={loading || busy || !!editing || exporting}
                onClick={() => void model.reload()}
              >
                <RefreshCw size={16} />
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary/40 px-5 py-3">
            <label className="m-0 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={model.due}
                disabled={loading || busy || !!editing || exporting}
                onChange={(e) => model.filterDue(e.target.checked)}
              />
              Seguimiento pendiente
            </label>
            <span className="text-xs text-muted-foreground">
              Hoy y vencidos · sin Oferta ni Descartada
            </span>
          </div>
          {(error || model.error) && (
            <p role="alert" className="error m-5">
              {error || model.error}
            </p>
          )}
          {notice && (
            <p role="status" className="success mx-5 mt-4">
              {notice}
            </p>
          )}
          {loading ? (
            <div className="space-y-4 p-5">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !data?.items.length ? (
            <div className="flex flex-col items-center p-12 text-center">
              <Inbox className="mb-4 text-muted-foreground" size={32} />
              <h3 className="font-semibold">No hay oportunidades en esta vista</h3>
              <p className="mb-5 mt-2 text-sm text-muted-foreground">
                Prueba otro filtro o prepara tu primera oportunidad.
              </p>
              <Button onClick={onNew}>
                Crear una oportunidad <ArrowUpRight size={16} />
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {data.items.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-4 p-5 transition-colors hover:bg-secondary/25 lg:grid-cols-[1fr_180px_200px]"
                >
                  <div className="min-w-0">
                    <p className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {item.result.mode === 'demo' ? 'Demo' : `${item.result.score}/100`}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('es-CO')}
                      </span>
                    </p>
                    <h3 className="break-words font-semibold">{item.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-4">
                      <button
                        className="text-sm text-primary hover:underline"
                        onClick={() => setView(item)}
                      >
                        Ver análisis
                      </button>
                      {item.tracking?.jobUrl && /^https?:\/\//i.test(item.tracking.jobUrl) && (
                        <a
                          className="text-sm text-muted-foreground hover:underline"
                          href={item.tracking.jobUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir oferta ↗
                        </a>
                      )}
                    </div>
                    {item.tracking?.notes && (
                      <details className="mt-3 text-sm">
                        <summary>Notas</summary>
                        <p className="preserve mt-2 text-muted-foreground">{item.tracking.notes}</p>
                      </details>
                    )}
                  </div>
                  <div>
                    <label className="text-xs" htmlFor={'state-' + item.id}>
                      Estado
                    </label>
                    <select
                      id={'state-' + item.id}
                      className="w-full"
                      value={item.status}
                      disabled={busy || !!editing}
                      onChange={(e) => void update(item, e.target.value)}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Postulación: {displayDate(item.tracking?.appliedOn)}
                    </p>
                  </div>
                  <div className="flex flex-col items-start justify-between gap-3">
                    <p
                      className={
                        'flex items-center gap-2 text-xs ' +
                        (isDue(item) ? 'font-medium text-amber-800' : 'text-muted-foreground')
                      }
                    >
                      <CalendarClock size={14} />
                      {displayDate(item.tracking?.followUpOn)}
                      {isDue(item) ? ' · Pendiente' : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !!editing}
                        onClick={() => {
                          setEditing(item);
                          setNotice('');
                        }}
                      >
                        Editar seguimiento
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label={'Eliminar ' + item.title}
                        disabled={busy || !!editing}
                        onClick={async () => {
                          if (!window.confirm(`¿Eliminar «${item.title}» y su análisis?`)) return;
                          try {
                            await model.mutate('/api/analyses/' + item.id, 'DELETE', {});
                            setNotice('Oportunidad eliminada.');
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t p-4">
            <span className="text-xs text-muted-foreground">
              Página {data?.page ?? 1} de {data?.pages ?? 1} · 20 por página
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={loading || busy || !!editing || (data?.page ?? 1) <= 1}
                onClick={() => model.setPage(model.page - 1)}
              >
                <ChevronLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página siguiente"
                disabled={loading || busy || !!editing || (data?.page ?? 1) >= (data?.pages ?? 1)}
                onClick={() => model.setPage(model.page + 1)}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog
        open={!!view}
        onOpenChange={(open) => {
          if (!open) setView(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalle del análisis</DialogTitle>
            <DialogDescription>Revisa el resultado y sus próximos pasos.</DialogDescription>
          </DialogHeader>
          {view && <ResultView item={view} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
