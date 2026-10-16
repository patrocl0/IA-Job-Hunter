import { validateTracking, validDate } from './tracking-validation.mjs';
export const STORAGE_KEY = 'ai-job-hunter-demo:v1';
export const sampleProfile = {
  name: 'Alex · Perfil de ejemplo',
  headline: 'Frontend Developer',
  location: 'Medellín · Colombia',
  summary:
    'Perfil ficticio para explorar la aplicación. Desarrollo interfaces accesibles con React y TypeScript y aprendo mediante proyectos prácticos.',
  skills: 'React, TypeScript, CSS, Git, pruebas unitarias',
  experience:
    'Ejemplo: desarrollo de interfaces y formularios para una aplicación de gestión de tareas.',
  projects:
    'Ejemplo: tablero de tareas con filtros, componentes reutilizables y diseño responsive.',
  education: 'Formación de ejemplo en desarrollo web.',
  languages: 'Español · Inglés en formación',
};
export const jobs = [
  [
    'demo-react',
    'Frontend Developer React',
    'Estudio Norte · Ficticia',
    'LATAM',
    'React, TypeScript, CSS',
    'Construir interfaces accesibles con React y TypeScript. Colaborar con diseño, implementar formularios y escribir pruebas. Esta oferta es ficticia y solo permite explorar la demo.',
  ],
  [
    'demo-fullstack',
    'Full Stack Developer',
    'Equipo Horizonte · Ficticia',
    'Worldwide',
    'React, Node, PostgreSQL',
    'Desarrollar una aplicación con React, Node y PostgreSQL. Diseñar endpoints REST, documentar decisiones y trabajar con Git. Esta oferta es ficticia, no acepta postulaciones.',
  ],
  [
    'demo-python',
    'Backend Developer Python',
    'Laboratorio Sur · Ficticia',
    'Colombia',
    'Python, FastAPI, SQL',
    'Construir APIs con Python y FastAPI, consultar bases SQL y documentar servicios. Trabajar en equipo y escribir pruebas. Oferta de ejemplo, no corresponde a una empresa real.',
  ],
  [
    'demo-ui',
    'Frontend Junior',
    'Taller Digital · Ficticia',
    'Worldwide',
    'JavaScript, HTML, CSS',
    'Crear páginas responsive con HTML, CSS y JavaScript. Revisar accesibilidad, corregir errores y aprender junto al equipo. Oferta ficticia para practicar el seguimiento de oportunidades.',
  ],
].map(([id, title, company, location, tags, description]) => ({
  id,
  title,
  company,
  location,
  tags: tags.split(', '),
  description,
  salary: 'Ejemplo · sin salario',
  jobType: 'Ejemplo',
  category: 'Software',
  url: '',
  source: 'Demo ficticia',
  publishedAt: null,
}));
const labels = {
  name: 'Nombre',
  headline: 'Cargo objetivo',
  location: 'Ubicación',
  summary: 'Resumen',
  skills: 'Habilidades',
  experience: 'Experiencia',
  projects: 'Proyectos',
  education: 'Formación',
  languages: 'Idiomas',
};
const profileData = (profile) => ({
  profile,
  cvText: profile
    ? Object.entries(labels)
        .filter(([key]) => profile[key])
        .map(([key, label]) => `${label}:\n${profile[key]}`)
        .join('\n\n')
    : '',
  updatedAt: profile ? new Date().toISOString() : null,
});
const seed = () => ({ profile: profileData({ ...sampleProfile }), analyses: [], saved: [] });
const result = {
  mode: 'demo',
  score: null,
  summary:
    'Resultado de demostración. No se ha evaluado tu CV ni se ha utilizado inteligencia artificial.',
  matches: ['En la versión con IA se muestran coincidencias respaldadas por el CV.'],
  gaps: ['En la versión con IA se identifican requisitos sin evidencia suficiente.'],
  nextSteps: [
    'Practica el seguimiento cambiando el estado de esta oportunidad.',
    'Consulta el repositorio para ejecutar la versión completa localmente.',
  ],
  tailoredSummary:
    'Aquí aparecería un resumen basado en tu experiencia. Esta demo no genera ni inventa información profesional.',
  recruiterMessage:
    'Aquí aparecería un borrador para revisar. La aplicación nunca envía mensajes automáticamente.',
};
const statuses = ['Guardada', 'Postulada', 'Entrevista', 'Oferta', 'Descartada'];
export function createDemoApi(storage) {
  const read = () => {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.analyses) || !Array.isArray(value.saved) || !value.profile)
      throw new Error('Datos de demo inválidos. Usa «Restablecer demo».');
    return value;
  };
  const write = (state) => storage.setItem(STORAGE_KEY, JSON.stringify(state));
  const json = (data, status = 200) =>
    new Response(status === 204 ? null : JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  return async function demoRequest(url, init = {}) {
    try {
      const { pathname, searchParams } = new URL(url, 'https://demo.local');
      const method = init.method || 'GET';
      const body = init.body ? JSON.parse(init.body) : {};
      const state = read();
      if (pathname === '/api/config') return json({ mode: 'demo' });
      if (pathname === '/api/profile') {
        if (method === 'PUT') {
          if (
            typeof body.name !== 'string' ||
            body.name.trim().length < 2 ||
            typeof body.headline !== 'string' ||
            body.headline.trim().length < 3
          )
            return json({ error: 'Completa nombre y cargo objetivo.' }, 400);
          state.profile = profileData(
            Object.fromEntries(
              Object.keys(labels).map((k) => [
                k,
                typeof body[k] === 'string' ? body[k].trim() : '',
              ]),
            ),
          );
          if (state.profile.cvText.length > 16000)
            return json({ error: 'El perfil supera 16.000 caracteres.' }, 400);
          write(state);
        }
        if (method === 'DELETE') {
          state.profile = profileData(null);
          write(state);
          return json(null, 204);
        }
        return json(state.profile);
      }
      if (pathname === '/api/vacancies') {
        const q = (searchParams.get('q') || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
        const location = (searchParams.get('location') || '').toLowerCase();
        const filtered = jobs.filter(
          (j) =>
            q.every((t) =>
              `${j.title} ${j.company} ${j.tags.join(' ')} ${j.description}`
                .toLowerCase()
                .includes(t),
            ) &&
            (!location ||
              j.location.toLowerCase().includes(location) ||
              (searchParams.get('worldwide') === 'true' && j.location === 'Worldwide')),
        );
        return json({
          jobs: filtered,
          total: filtered.length,
          page: 1,
          pages: 1,
          fetchedAt: new Date().toISOString(),
          nextRefreshAt: new Date().toISOString(),
          stale: false,
        });
      }
      if (pathname === '/api/vacancies/saved') {
        if (method === 'POST') {
          const data = jobs.find((j) => j.id === body.id);
          if (!data) return json({ error: 'Oferta de ejemplo no encontrada.' }, 404);
          if (!state.saved.some((j) => j.source_id === data.id))
            state.saved.unshift({
              source_id: data.id,
              data,
              status: 'Guardada',
              created_at: new Date().toISOString(),
            });
          write(state);
          return json(
            state.saved.find((j) => j.source_id === data.id),
            201,
          );
        }
        return json({ items: state.saved, total: state.saved.length, page: 1, pages: 1 });
      }
      if (pathname === '/api/analyses/page') {
        const today = searchParams.get('today');
        if (!validDate(today)) return json({ error: 'Fecha inválida.' }, 400);
        const pending = (x) =>
          x.tracking?.followUpOn &&
          x.tracking.followUpOn <= today &&
          !['Oferta', 'Descartada'].includes(x.status);
        const all = state.analyses;
        const stats = {
          total: all.length,
          applied: all.filter((x) => x.status === 'Postulada').length,
          interviews: all.filter((x) => x.status === 'Entrevista').length,
          offers: all.filter((x) => x.status === 'Oferta').length,
          due: all.filter(pending).length,
        };
        const status = searchParams.get('status');
        const due = searchParams.get('followUp') === 'due';
        const filtered = all.filter(
          (x) => (!status || x.status === status) && (!due || pending(x)),
        );
        if (due)
          filtered.sort((a, b) => a.tracking.followUpOn.localeCompare(b.tracking.followUpOn));
        const limit = 20,
          pages = Math.max(1, Math.ceil(filtered.length / limit)),
          page = Math.max(1, Math.min(Number(searchParams.get('page')) || 1, pages));
        return json({
          items: filtered.slice((page - 1) * limit, page * limit),
          total: filtered.length,
          page,
          pages,
          stats,
        });
      }
      if (pathname === '/api/analyses') {
        if (method === 'POST') {
          for (const [key, min, max] of [
            ['title', 3, 160],
            ['cv', 80, 16000],
            ['job', 80, 16000],
          ]) {
            if (
              typeof body[key] !== 'string' ||
              body[key].trim().length < min ||
              body[key].length > max
            )
              return json({ error: `${key}: entre ${min} y ${max} caracteres.` }, 400);
          }
          let tracking;
          try {
            tracking = validateTracking(body.tracking ?? {});
          } catch (e) {
            return json({ error: e.message }, 400);
          }
          const item = {
            id: crypto.randomUUID(),
            title: body.title.trim(),
            status: 'Guardada',
            created_at: new Date().toISOString(),
            result,
            tracking,
          };
          state.analyses.unshift(item);
          state.analyses = state.analyses.slice(0, 100);
          write(state);
          return json(item, 201);
        }
        if (searchParams.has('followUp')) {
          const today = searchParams.get('today');
          if (searchParams.get('followUp') !== 'due' || !validDate(today))
            return json({ error: 'Filtro o fecha inválidos.' }, 400);
          return json(
            state.analyses
              .filter(
                (x) =>
                  x.tracking?.followUpOn &&
                  x.tracking.followUpOn <= today &&
                  !['Oferta', 'Descartada'].includes(x.status),
              )
              .sort((a, b) => a.tracking.followUpOn.localeCompare(b.tracking.followUpOn)),
          );
        }
        return json(state.analyses);
      }
      const match = pathname.match(/^\/api\/(analyses|vacancies\/saved)\/([^/]+)$/);
      if (match) {
        const list = match[1] === 'analyses' ? state.analyses : state.saved;
        const key = match[1] === 'analyses' ? 'id' : 'source_id';
        const index = list.findIndex((x) => x[key] === match[2]);
        if (index < 0) return json({ error: 'Registro no encontrado.' }, 404);
        if (method === 'DELETE') {
          list.splice(index, 1);
          write(state);
          return json(null, 204);
        }
        if (method === 'PATCH' && match[1] === 'analyses') {
          let tracking;
          try {
            if (
              !body ||
              typeof body !== 'object' ||
              Array.isArray(body) ||
              !Object.keys(body).length ||
              Object.keys(body).some((k) => !['status', 'tracking'].includes(k))
            )
              throw new Error('Actualización inválida.');
            if ('status' in body && !statuses.includes(body.status))
              throw new Error('Estado inválido.');
            tracking = 'tracking' in body ? validateTracking(body.tracking) : {};
          } catch (e) {
            return json({ error: e.message }, 400);
          }
          list[index] = {
            ...list[index],
            status: body.status ?? list[index].status,
            tracking: { ...list[index].tracking, ...tracking },
          };
          write(state);
          return json(list[index]);
        }
        if (method === 'PATCH' && statuses.includes(body.status)) {
          list[index].status = body.status;
          write(state);
          return json(list[index]);
        }
      }
      return json({ error: 'Operación no disponible en esta demo.' }, 400);
    } catch {
      return json(
        {
          error:
            'No se pudo leer o guardar la demo en este navegador. Comprueba que el almacenamiento esté permitido o usa «Restablecer demo».',
        },
        500,
      );
    }
  };
}
