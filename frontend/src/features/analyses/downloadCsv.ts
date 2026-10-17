import { requestResponse, isPublicDemo } from '@/lib/api';
import { localDay } from '@/lib/dates';
export async function downloadCsv(status: string, due: boolean, signal: AbortSignal) {
  const today = localDay();
  const params = new URLSearchParams({ today });
  if (status !== 'Todas') params.set('status', status);
  if (due) params.set('followUp', 'due');
  const response = await requestResponse('/api/analyses/export?' + params, { signal });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: 'No se pudo exportar. Intenta de nuevo.' }));
    throw new Error(body.error || 'No se pudo exportar.');
  }
  if (!response.headers.get('Content-Type')?.startsWith('text/csv'))
    throw new Error('La API no devolvió un CSV válido.');
  const blob = await response.blob();
  signal.throwIfAborted();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `postulaciones${isPublicDemo ? '-demo' : ''}-${today}.csv`;
  try {
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return Number(response.headers.get('X-Export-Count'));
}
