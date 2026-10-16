import type { Tracking } from '@/features/analyses/TrackingEditor';
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function isDue(item: { status: string; tracking?: Tracking }) {
  return (
    !!item.tracking?.followUpOn &&
    item.tracking.followUpOn <= localDay() &&
    !['Oferta', 'Descartada'].includes(item.status)
  );
}
export function displayDate(day?: string) {
  return day ? day.split('-').reverse().join('/') : 'Sin fecha';
}
