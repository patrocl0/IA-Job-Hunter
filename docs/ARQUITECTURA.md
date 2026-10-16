# AI Job Hunter: arquitectura y rediseño

## Resultado y alcance

Esta versión organiza la aplicación como un **monolito modular** y comparte el frontend entre la instalación local y la demo pública. Mantiene Express, PostgreSQL y Docker Compose. No introduce cuentas de usuario ni convierte la aplicación en un SaaS listo para tráfico masivo.

La separación facilita agregar funciones, escribir pruebas y localizar errores. No constituye una medición de capacidad: no se hicieron pruebas de carga.

## Cómo se organiza el backend

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `backend/src/server.js` | Lee configuración, crea el pool, ejecuta migraciones, arranca HTTP y cierra conexiones al terminar. |
| `backend/src/app.js` | Construye Express e inyecta sus dependencias. Puede probarse sin iniciar el servidor real. |
| `backend/src/db/migrate.js` | Evoluciona el esquema y registra las versiones aplicadas. |
| `backend/src/http/` | Controles HTTP comunes, por ejemplo el tipo de contenido y el origen de escrituras. |
| `backend/src/modules/analyses/` | Validación, proveedor de análisis, seguimiento, paginación y rutas. |
| `backend/src/modules/profile/` | Validación/serialización del perfil y rutas. |
| `backend/src/modules/vacancies/` | Normalización, búsqueda, servicio de caché, persistencia de caché y rutas. |
| `backend/src/modules/documents/` | Subida y extracción de documentos mediante workers. |

En vacantes, `domain.js` transforma los datos, `service.js` decide cuándo consultar Remotive, `repository.js` adapta la caché a PostgreSQL y `routes.js` maneja HTTP. En análisis, `repository.js` encapsula la consulta paginada y sus estadísticas. Algunas rutas sencillas aún usan consultas SQL directamente; la separación es incremental, sin añadir una capa vacía por cada operación.

El proveedor de análisis y el pool se inyectan al crear la aplicación. Esto permite probar rutas con dependencias controladas y cambiar una implementación sin reconstruir todo el servidor. Se conserva el contrato de los endpoints anteriores.

## Datos, migraciones y paginación

Antes, las tablas se creaban dentro del arranque y de las funciones de las características. Ahora las modificaciones se concentran en migraciones numeradas:

1. La primera reconoce o crea las tablas existentes y añade `tracking` solo si falta.
2. La segunda añade índices para ordenar oportunidades, filtrar estado y buscar fechas pendientes.

Las migraciones corren en una transacción, usan un bloqueo asesor de PostgreSQL y registran versiones en `schema_migrations`. Si una operación falla, se revierte la transacción. El bloqueo serializa dos arranques que intenten migrar al mismo tiempo; no convierte por sí solo toda la API en apta para múltiples réplicas.

No se eliminan tablas, columnas, perfiles ni oportunidades. Los índices ayudan a las consultas correspondientes; no eliminan el costo de conteos globales ni garantizan una mejora cuantificada. En una base grande habrá que planificar ventanas o índices concurrentes y medir tiempos.

Nuevo endpoint: `GET /api/analyses/page?today=2026-10-16&page=1&limit=20`. Admite `status` y `followUp=due`. Responde con `items`, `total`, `page`, `pages` y estadísticas globales. Valida entradas y parametriza valores SQL. La interfaz muestra 20 registros por página; los indicadores se calculan sobre todo el historial local.

Se conserva `GET /api/analyses` para compatibilidad. Las fechas de seguimiento son días de calendario, no timestamps convertidos a UTC. El navegador envía su día local. La paginación usa OFFSET: para historiales muy grandes se debería evolucionar a cursores. Los conteos y filas son consultas separadas: con escrituras concurrentes puede haber un desfase breve que se resuelve al actualizar.

## Cómo se organiza el frontend

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `app/App.tsx` | Coordina navegación, configuración y borrador de la oportunidad. |
| `app/Sidebar.tsx` y `app/Dashboard.tsx` | Navegación y panel de resumen. |
| `app/ErrorBoundary.tsx` | Muestra una recuperación si ocurre un error de renderizado. |
| `features/profile`, `vacancies`, `documents`, `analyses` | Componentes de cada función. |
| `features/analyses/useAnalyses.ts` | Estado de consultas, filtros, páginas y mutaciones. |
| `lib/api.ts` | Acceso HTTP o adaptador demo y manejo común de respuestas. |
| `lib/dates.ts` | Formato y comparación de días locales. |
| `components/ui/` | Componentes de shadcn/ui almacenados en el proyecto. |
| `data/demo/` | Datos ficticios, almacenamiento de navegador e importación de documentos pública. |

`main.tsx` solo monta la aplicación. El hook de análisis ignora respuestas antiguas para evitar que una solicitud lenta sustituya una vista más reciente. Un cambio de filtro vuelve a la primera página. Los borradores de formularios se conservan al cambiar de sección; no equivalen a datos persistidos hasta guardarlos.

La navegación interna es por estado React, no por rutas URL. No hay aún enlaces profundos a cada registro. Es una siguiente mejora razonable si se necesitan enlaces compartibles o navegación de historial por sección.

## Tailwind y shadcn/ui

Tailwind CSS 4 se integra con Vite mediante `@tailwindcss/vite`. Los colores y radios se definen como tokens; los componentes consumen esos valores. Cambiar el color principal no requiere buscar colores aislados por toda la interfaz.

Se incorporaron Button, Card, Badge, Input, Textarea, Dialog y Skeleton de la fuente oficial de shadcn/ui. El CLI no pudo acceder al registro por una restricción de red, por lo que se obtuvieron los componentes de su repositorio oficial y se adaptaron sus importaciones. La licencia MIT está en `docs/SHADCN-LICENSE.txt`.

shadcn no es una caja cerrada: el código queda dentro de `components/ui`, por lo que se pueden ajustar variantes. `cn` combina clases con clsx y tailwind-merge. El diálogo de resultados utiliza Radix para su comportamiento de foco y teclado.

El diseño incluye navegación lateral, menú móvil, panel de indicadores, tarjetas, jerarquía tipográfica, estados de carga, mensajes de error, vistas vacías y acciones de seguimiento. Usa una paleta verde con superficies claras. No depende de fuentes remotas. Se añaden foco visible, etiquetas de formulario, enlace para saltar al contenido y respeto de la preferencia de movimiento reducido. Esto no representa una auditoría completa de accesibilidad.

## Una interfaz, dos formas de funcionar

- `npm run build` genera `frontend/dist`: interfaz que llama a Express.
- `npm run build:demo` genera `frontend/dist-demo`: misma interfaz con operaciones en localStorage y ofertas ficticias.

El modo se elige al compilar, no mediante una clave secreta en el navegador. `AI_MODE=demo` en el backend es distinto del build público: la instalación local puede usar análisis de ejemplo y seguir guardando datos reales en PostgreSQL y consultando Remotive.

La demo conserva la clave `ai-job-hunter-demo:v1` para leer los datos existentes. No hay cuentas ni sincronización entre dispositivos; quienes comparten perfil de navegador comparten esos datos. Conserva hasta 100 análisis de demostración y usa un catálogo ficticio. Su importación PDF/DOCX ocurre en el navegador; la local sigue utilizando el backend y sus workers.

El código de ambas variantes está ahora en esta entrega del repositorio. La versión alojada en Sites se publica a partir de esta interfaz. El despliegue sigue siendo explícito: GitHub Actions no publica automáticamente la demo. La fuente de Sites es una copia de distribución, no el lugar para mantener otro diseño independiente.

## Calidad y operación

- TypeScript estricto para el frontend.
- ESLint para detectar problemas del código.
- Prettier con configuración y comando `npm run format` para mantener un estilo uniforme.
- 26 pruebas de backend y 7 del adaptador demo en esta entrega.
- CI: lint → tests → compilaciones local/demo → imágenes Docker → arranque → smoke test.
- El smoke test comprueba PostgreSQL real, importación, análisis, seguimiento, paginación y estadísticas cuando se ejecuta en CI.
- Peticiones tienen `X-Request-Id`, y errores internos evitan registrar el CV o notas.
- Pool acotado, timeout de conexión/consulta y cierre de servidor/pool con SIGTERM y SIGINT.
- Se conservan límites y validaciones existentes de subida y del proveedor de IA.

Ver límites de verificación en `docs/VALIDATION.md`. No se debe presentar una prueba con un repositorio simulado como una prueba de PostgreSQL real.

## Qué falta antes de abrir la aplicación real a múltiples usuarios

1. Identidad y sesiones seguras, con recuperación y cierre de sesión.
2. Relacionar cada perfil, análisis y vacante guardada con un usuario; comprobar propiedad en cada consulta.
3. Autorización y pruebas que impidan acceso entre cuentas.
4. Límites por usuario y coordinación distribuida para llamadas a proveedores. La exclusión de análisis e importación y la agrupación de consultas de Remotive siguen siendo por proceso.
5. Colas para tareas largas, cuotas de IA, cancelación y reintentos controlados.
6. Backups automáticos y restauraciones ensayadas, métricas, alertas y políticas de retención.
7. Pruebas de carga, análisis de consultas, paginación con cursores cuando haga falta y auditoría de seguridad/accesibilidad.

El monolito modular permite incorporar estos cambios sin adoptar microservicios antes de necesitarlos.

## Fuentes de implementación

- https://tailwindcss.com/docs/installation/using-vite
- https://ui.shadcn.com/docs/installation/vite
- https://github.com/shadcn-ui/ui/tree/main/apps/v4/registry/new-york-v4/ui
