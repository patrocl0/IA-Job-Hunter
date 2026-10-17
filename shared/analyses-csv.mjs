export const EXPORT_LIMIT = 5000;
export const csvColumns = [
  'ID',
  'Título',
  'Estado',
  'Creada (UTC)',
  'Fecha de postulación',
  'Fecha de seguimiento',
  'Enlace de la oferta',
  'Notas',
  'Modo de análisis',
  'Puntuación orientativa',
];
export function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Neutralize spreadsheet formulas, including whitespace/control and full-width prefixes.
  if (/^[\s\p{Cc}\p{Cf}]*[=+\-@＝＋－＠]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function analysesCsv(items) {
  const rows = items.map((item) => {
    const tracking = item.tracking ?? {};
    const result = item.result ?? {};
    const date = new Date(item.created_at);
    return [
      item.id,
      item.title,
      item.status,
      Number.isNaN(date.getTime()) ? '' : date.toISOString(),
      tracking.appliedOn,
      tracking.followUpOn,
      tracking.jobUrl,
      tracking.notes,
      result.mode,
      result.mode === 'openai' &&
      Number.isInteger(result.score) &&
      result.score >= 0 &&
      result.score <= 100
        ? result.score
        : '',
    ];
  });
  return (
    '\uFEFF' + [csvColumns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
  );
}
