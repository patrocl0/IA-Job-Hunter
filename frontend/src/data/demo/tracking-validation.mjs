export const statuses = ['Guardada', 'Postulada', 'Entrevista', 'Oferta', 'Descartada'];
export function validDate(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' &&
    value <= '9999-12-31' &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateTracking(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Seguimiento inválido.');
  const result = {};
  for (const key of Object.keys(input)) {
    if (!['jobUrl', 'appliedOn', 'followUpOn', 'notes'].includes(key))
      throw new Error('Campo de seguimiento desconocido.');
    if (typeof input[key] !== 'string') throw new Error('El seguimiento debe contener texto.');
    const value = input[key].trim();
    if (['appliedOn', 'followUpOn'].includes(key) && value && !validDate(value))
      throw new Error('Fecha inválida. Usa AAAA-MM-DD.');
    if (key === 'notes' && value.length > 5000)
      throw new Error('Las notas admiten hasta 5.000 caracteres.');
    if (key === 'jobUrl' && value) {
      let url;
      try {
        url = new URL(value);
      } catch {
        throw new Error('El enlace debe ser una URL completa http o https.');
      }
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        value.length > 2000
      )
        throw new Error('Enlace inválido: usa http o https, sin credenciales.');
    }
    result[key] = value;
  }
  return result;
}
