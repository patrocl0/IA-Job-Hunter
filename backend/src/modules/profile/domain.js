export const profileFields = {
  name: { label: 'Nombre', max: 120 },
  headline: { label: 'Cargo objetivo', max: 160 },
  location: { label: 'Ubicación y disponibilidad', max: 200 },
  summary: { label: 'Resumen profesional', max: 2000 },
  skills: { label: 'Habilidades', max: 2000 },
  experience: { label: 'Experiencia', max: 5000 },
  projects: { label: 'Proyectos', max: 4000 },
  education: { label: 'Formación', max: 1000 },
  languages: { label: 'Idiomas', max: 500 },
};
export function profileToText(profile) {
  return Object.entries(profileFields)
    .filter(([key]) => profile[key]?.trim())
    .map(([key, field]) => `${field.label}:\n${profile[key].trim()}`)
    .join('\n\n');
}
export function validateProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('Perfil inválido.');
  const profile = {};
  for (const [key, field] of Object.entries(profileFields)) {
    if (input[key] !== undefined && typeof input[key] !== 'string')
      throw new Error(`${field.label}: debe ser texto.`);
    const value = (input[key] ?? '').trim();
    if (value.length > field.max)
      throw new Error(`${field.label}: máximo ${field.max} caracteres.`);
    profile[key] = value;
  }
  if (profile.name.length < 2) throw new Error('Escribe un nombre de al menos 2 caracteres.');
  if (profile.headline.length < 3)
    throw new Error('Escribe un cargo objetivo de al menos 3 caracteres.');
  if (profileToText(profile).length > 16000)
    throw new Error('El perfil completo supera los 16.000 caracteres.');
  return profile;
}
