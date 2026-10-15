# AI Job Hunter

**Un espacio para organizar la búsqueda de empleo: del CV a la postulación.**

Aplicación full stack local que reúne un perfil profesional reutilizable, importación de CV en PDF/DOCX, búsqueda de vacantes remotas y seguimiento de oportunidades. Incluye un modo demo sin consumo de IA y una integración opcional con OpenAI para comparar un CV con una vacante.

## Vista previa

Las capturas muestran la interfaz real con **datos ficticios de documentación**. Las ofertas y el perfil de estas imágenes no corresponden a personas ni vacantes activas.

![Búsqueda y seguimiento de ejemplo](docs/screenshots/vacantes.png)

![Perfil profesional editable de ejemplo](docs/screenshots/perfil.png)

[Ver la captura móvil](docs/screenshots/movil.png)

## Qué resuelve

Evita repetir el mismo CV y dispersar las oportunidades entre pestañas y notas. Puedes guardar un perfil, importar un documento, revisar ofertas en su fuente original y registrar el avance de tus postulaciones.

| Función | Estado |
| --- | --- |
| Perfil profesional editable en PostgreSQL | Implementada |
| PDF/DOCX → vista previa de texto editable | Implementada, sin OCR |
| Vacantes remotas de Remotive y filtros | Implementada, requiere internet |
| Guardado sin duplicados y estados | Implementada |
| Comparación con IA y borradores | Integrada; requiere clave y saldo de OpenAI |
| Modo demo | Disponible sin clave; resultado simulado identificado |
| Envío automático de postulaciones | No incluido |
| Autenticación y despliegue multiusuario | Pendientes |

## Stack y arquitectura

| Capa | Tecnología |
| --- | --- |
| Interfaz | React + TypeScript + Vite |
| API | Node.js 24 + Express, JavaScript ESM |
| Datos | PostgreSQL 17 |
| Documentos | pdf-parse, Mammoth, Multer y workers de Node |
| Infraestructura | Nginx + Docker Compose |
| Calidad | ESLint, Node test runner y GitHub Actions |

```mermaid
flowchart TD
  UI["React + TypeScript"] --> Proxy["Nginx"]
  Proxy --> API["Express"]
  API --> DB["PostgreSQL"]
  API --> Worker["Extracción PDF / DOCX"]
  API --> Jobs["Remotive + caché"]
  API --> AI["OpenAI opcional"]
```

Las claves se leen en el backend. Los documentos se procesan en memoria y su texto se revisa antes de usarlo. Las ofertas se normalizan a texto y se enlazan a su fuente original.

## Arranque local

Necesitas Docker Engine y Docker Compose. Para una **instalación nueva**:

```bash
cp .env.example .env
docker compose up -d --build
```

Abre **http://localhost:8080**. La configuración inicial usa `AI_MODE=demo`, sin clave ni llamadas a OpenAI.

Si ya usabas el proyecto, **conserva tu `.env`, contraseña de PostgreSQL y carpeta original**. Copia los archivos nuevos sobre ella y ejecuta:

```bash
docker compose up -d --build
docker compose restart web
```

`docker compose down` conserva la base. No uses `down -v` si quieres mantener perfiles y oportunidades.

## Recorrido rápido

1. Completa «Mi perfil» y guárdalo.
2. Importa tu CV o prueba con `backend/test/fixtures/cv.docx` (datos ficticios).
3. Revisa el texto extraído antes de copiarlo al campo CV.
4. Busca una tecnología; deja ubicación vacía para ampliar resultados.
5. Guarda una oferta o pulsa «Preparar análisis».
6. Prueba el modo demo y registra el estado de tu postulación.

Guardar una vacante o marcarla como postulada no envía ninguna solicitud. Las vacantes guardadas y el historial de análisis tienen estados independientes.

## Activar la IA opcional

En `.env`, configura `AI_MODE=openai`, `OPENAI_API_KEY` y `OPENAI_MODEL` con un modelo habilitado en tu cuenta que admita Responses API y Structured Outputs. Después recrea la API y reinicia el proxy:

```bash
docker compose up -d --force-recreate api
docker compose restart web
```

Al ejecutar un análisis real se envían el CV y la vacante a OpenAI y se consume saldo de API. Revisa los textos generados; la puntuación orientativa no es una probabilidad de contratación. El modo demo no produce una puntuación ni finge evaluar tu perfil.

## Pruebas y CI

Para trabajar fuera de Docker, usa Node.js 24:

```bash
npm ci
npm run lint
npm test
npm run build
```

El workflow `.github/workflows/ci.yml` ejecuta en orden:

1. Lint.
2. Pruebas de lógica, parsers y contratos HTTP.
3. Compilación de frontend e imágenes Docker de API y web.
4. Arranque con Compose y smoke test a través de Nginx, con PostgreSQL real en el runner.

El smoke test comprueba salud, perfil persistente, importación DOCX, análisis demo y seguimiento. No llama a OpenAI ni a Remotive. Usa una base vacía y desechable: no lo ejecutes sobre tus datos personales. La contraseña de CI se genera para cada ejecución y no requiere secretos de GitHub.

**Validación local de esta entrega:** consulta [docs/VALIDATION.md](docs/VALIDATION.md). La ejecución completa del workflow debe confirmarse en GitHub; no se presenta como exitosa antes de ejecutarse.

## Capturas reproducibles

```bash
npx playwright install chromium
npm run screenshots
```

El script abre la compilación real en un servidor temporal, intercepta las llamadas a API con datos ficticios y produce las capturas. No consulta tu base, claves, CV ni fuentes externas.

## Límites actuales

- Aplicación local de un solo usuario, expuesta en `127.0.0.1`; sin autenticación. Antes de desplegar requiere controles de acceso, HTTPS y aislamiento de datos.
- PDF/DOCX hasta 5 MiB; PDF hasta 30 páginas. Los documentos escaneados necesitan OCR, todavía no incluido.
- CV y vacante hasta 16.000 caracteres. El orden de columnas o tablas puede requerir correcciones manuales.
- Remotive ofrece un catálogo parcial con retraso de publicación; la aplicación conserva una copia hasta seis horas entre consultas. Verifica vigencia y ubicación en la oferta original.
- Los tests de rutas locales utilizan almacenamiento simulado; el smoke test de CI está destinado a comprobar la integración real con PostgreSQL.

## Estructura

```text
backend/src/           API, perfil, importación, vacantes y análisis
backend/test/          Pruebas y documentos sintéticos
frontend/src/          Interfaz y componentes
scripts/               Smoke test y capturas reproducibles
docs/                  Capturas, validación y guía de presentación
.github/workflows/     Integración continua
compose.yaml           Servicios locales
```

## Fuentes y documentación

Las ofertas provienen de [Remotive](https://remotive.com), con atribución y enlace al anuncio original. Consulta sus [condiciones de API](https://github.com/remotive-com/remote-jobs-api) antes de redistribuir el catálogo. No se publican ofertas en otros portales ni se exige registro para verlas.

- [Guía para presentar el proyecto y subirlo a GitHub](docs/PORTFOLIO.md)
- [Historial de actualización y detalles de las funciones](docs/UPGRADE.md)
- [Structured Outputs de OpenAI](https://developers.openai.com/api/docs/guides/structured-outputs)

Proyecto desarrollado con asistencia de IA. Para presentarlo en entrevistas, explica las decisiones técnicas, valida el comportamiento y distingue las funciones reales de la demostración.
