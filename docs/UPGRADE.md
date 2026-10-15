# Actualización: búsqueda de vacantes reales (v0.4)

Incluye todo lo anterior: perfil editable, importación de PDF/DOCX e historial. Añade búsqueda de empleos remotos de Remotive, filtros por texto y ubicación publicada, paginación, guardado sin duplicados, estados y enlaces originales. No requiere clave de Remotive ni saldo de OpenAI. Sí necesita internet para consultar la fuente.

## Actualizar conservando tus datos

1. Extrae este ZIP en una carpeta temporal.
2. Copia el contenido de `ai-job-hunter` sobre tu **carpeta original** del proyecto y reemplaza los archivos de código.
3. Conserva tu `.env` y su contraseña actual de PostgreSQL. Mantén `AI_MODE=demo`. No reemplaces `.env` por `.env.example`.
4. Ejecuta desde la misma carpeta original:

```bash
docker compose up -d --build
docker compose restart web
```

5. Abre http://localhost:8080 y recarga la página.

Se crean automáticamente dos tablas nuevas, `vacancy_cache` y `saved_vacancies`; las tablas del perfil y los análisis no se borran ni modifican. Mantén la misma carpeta y nombre de proyecto Compose para reutilizar el volumen. No ejecutes `docker compose down -v`.

## Primer uso

- En **Buscar vacantes remotas**, escribe `React`, `frontend` o una tecnología. Deja la ubicación vacía para ver las coincidencias de cualquier región.
- Pulsa **Buscar vacantes**. Los filtros buscan texto en el catálogo público disponible: no es una búsqueda de todos los empleos de internet.
- Para ubicación, prueba por separado `Colombia`, `LATAM` o `Latin America`. El filtro compara texto; no deduce automáticamente que una ciudad o país pertenece a una región.
- La casilla de ofertas mundiales incluye ubicaciones globales explícitas cuando filtras una región. La ubicación original siempre queda visible. Comprueba elegibilidad, idioma, horario y vigencia en el anuncio original.
- Abre **Ver oferta original en Remotive** para revisar la oferta o postularte allí.
- Usa **Guardar vacante** para conservarla en PostgreSQL. Guardarla de nuevo no duplica ni reinicia el estado.
- **Preparar análisis** copia cargo, empresa, enlace y descripción al formulario; solicita confirmación si ya escribiste una oportunidad y conserva tu CV. Si el texto supera 16.000 caracteres, recórtalo antes de analizarlo.

La búsqueda y el guardado son reales aunque `AI_MODE=demo`. Solo la evaluación del CV continúa simulada. Preparar un análisis no lo ejecuta ni consume saldo. Cambiar el estado a «Postulada» tampoco envía una candidatura.

## Fuente, fechas y límites

Fuente: Remotive, https://remotive.com . Documentación: https://github.com/remotive-com/remote-jobs-api . Se conserva el enlace original y la atribución en cada oferta.

La API pública de Remotive entrega ofertas con un retraso de 24 horas. La aplicación limita las consultas externas a una cada seis horas por instalación; los filtros y la paginación operan sobre la copia local. No hay actualización programada en segundo plano: se comprueba si corresponde actualizar cuando buscas o guardas una oferta. Reiniciar el backend no reinicia ese plazo.

Cada respuesta muestra fecha de consulta y próxima actualización posible. Si Remotive falla y existe una copia previa, se identifica como antigua. Sin copia, aparece un error; no se inventan ofertas. Tras un intento fallido también se espera hasta la próxima ventana para respetar el límite. Las guardadas siguen disponibles aunque no haya internet o desaparezcan de la fuente. Esto no garantiza que sigan abiertas: consulta el enlace original.

Las vacantes guardadas y el historial de análisis son listas independientes. Cambiar o eliminar una no sincroniza la otra. La lista guardada se pagina de 12 en 12. No se envían CV, perfiles ni consultas escritas a Remotive; el servidor obtiene su catálogo y filtra localmente. La aplicación continúa siendo local y de un solo usuario.

## Archivos y API

- `backend/src/vacancies.js`: normalización de HTML a texto, validación de enlaces, filtros, caché y rutas.
- `frontend/src/VacancySearch.tsx`: búsqueda, ofertas, paginación y lista guardada.
- `backend/test/vacancies.test.js`: filtros, enlaces, caché, caída de fuente y seguimiento.
- `GET /api/vacancies?q=React&location=Colombia&worldwide=true&page=1`
- `GET /api/vacancies/saved?page=1`
- `POST /api/vacancies/saved` con JSON `{ "id": "identificador de la fuente" }`
- `PATCH /api/vacancies/saved/:id` con JSON `{ "status": "Postulada" }`
- `DELETE /api/vacancies/saved/:id`

El backend recupera los datos de la oferta desde su copia de la fuente; no confía en URLs o descripciones enviadas por el cliente. La nueva dependencia `html-to-text` y el lockfile están incluidos.

## Verificación

Pasaron **21 pruebas** y la compilación TypeScript/Vite. Se comprobó acceso HTTP real al catálogo público de Remotive durante la implementación. Las pruebas de caché y rutas usan fuente y almacenamiento simulados para ser reproducibles y no consumir consultas externas. No se ejecutaron Docker, PostgreSQL real ni una revisión visual en navegador en este entorno; comprueba el arranque completo en tu equipo.

```bash
npm ci
npm test
npm run build
```

---

## Historial de versiones anteriores

# Actualización: importar CV en PDF y DOCX (v0.3)

Esta versión extrae texto en el servidor local, muestra una vista previa editable y permite copiarla al campo CV de una oportunidad. Funciona en modo demo, sin llamadas a OpenAI y sin consumir saldo de IA. Conserva el perfil editable y el historial anteriores.

## Actualizar sin perder datos

1. Extrae el ZIP en una carpeta temporal y copia el contenido de `ai-job-hunter` sobre tu **carpeta original**, reemplazando los archivos del código.
2. Conserva tu `.env` y su `POSTGRES_PASSWORD` actual. Mantén `AI_MODE=demo`. No copies `.env.example` sobre tu `.env` existente.
3. Desde la misma carpeta original ejecuta:

```bash
docker compose up -d --build
docker compose restart web
```

Se deben reconstruir API y web porque hay dependencias nuevas y cambios del proxy. La instalación de dependencias requiere internet; la extracción posterior es local. Mantén la carpeta y el nombre del proyecto Compose originales para reutilizar el volumen. No uses `docker compose down -v`.

## Importar y revisar

1. Abre http://localhost:8080 y recarga la página.
2. En «Nueva oportunidad», usa **Seleccionar CV** y elige un `.pdf` o `.docx`.
3. Pulsa **Extraer texto**.
4. Revisa la **Vista previa editable**; corrige el orden, nombres y fechas si es necesario.
5. Pulsa **Usar este texto como CV**. Si el campo CV ya tiene contenido diferente, se pide confirmación antes de sustituirlo.
6. Pega la vacante y continúa con **Probar demostración**.

Importar no inicia un análisis ni modifica automáticamente los campos de «Mi perfil». El archivo y el texto de la vista previa no se guardan en la base de datos. Puedes usar «Descartar importación» para limpiarlos. Si recargas antes de usarlos, tendrás que importar de nuevo.

El perfil y el historial se mantienen en PostgreSQL como antes. Importar no envía información a OpenAI, incluso si más adelante activas el modo real. Pulsar «Analizar y guardar» en modo OpenAI sí envía el CV y la vacante, como en versiones anteriores.

## Formatos y límites

- PDF con texto seleccionable y DOCX: máximo **5 MiB** por archivo.
- PDF: máximo **30 páginas**; no se aceptan PDFs con contraseña.
- DOCX: se limita el contenido descomprimido a 20 MiB y 1.000 entradas.
- PDF escaneado o imagen: requiere OCR; esta versión no incluye OCR.
- `.doc` antiguo no admitido: exporta a DOCX o PDF.
- El analizador acepta entre 80 y 16.000 caracteres. Si se extrae más, la vista previa permite recortarlo manualmente; no hay truncamiento automático. Documentos de más de 100.000 caracteres se rechazan.
- Columnas, tablas, cuadros de texto y elementos visuales pueden perder orden o contenido. Revisa siempre la extracción antes de usarla.

El archivo se procesa en memoria en un worker, con un máximo de 30 segundos para extraer el texto. No se generan archivos temporales del CV en la aplicación. La extracción admite un archivo a la vez y no registra el contenido del documento.

## API y archivos añadidos

`POST /api/cv/import`: `multipart/form-data`, un único archivo llamado `cv`. Devuelve `{ text, warnings }`. No requiere clave de IA. Los demás endpoints de escritura siguen requiriendo JSON.

- `backend/src/import-cv.js`: validación de subida, límites y coordinación del worker.
- `backend/src/import-worker.js`: extracción real de PDF y DOCX.
- `backend/src/request-guard.js`: formatos permitidos y protección de peticiones entre sitios.
- `frontend/src/ImportCv.tsx`: selección, vista previa, edición y confirmación.
- `backend/test/import.test.js` y `backend/test/fixtures`: pruebas con documentos sintéticos; no contienen datos personales.
- `frontend/nginx.conf`: límite de carga específico para el endpoint de importación.

Dependencias directas fijadas y lockfile actualizado: multer, pdf-parse, mammoth y yauzl.
Documentación usada: https://github.com/mehmet-kozan/pdf-parse ; https://github.com/mwilliamson/mammoth.js ; https://expressjs.com/en/resources/middleware/multer/

## Verificación de esta actualización

**16 pruebas correctas** y compilación TypeScript/Vite correcta. Las pruebas ejecutan extractores reales con PDF y DOCX, comprueban texto Unicode, archivos corruptos o vacíos, límite de páginas, tamaño excesivo, ausencia de truncamiento, carga multipart y validaciones del perfil. Las rutas del perfil usan almacenamiento simulado. Docker y PostgreSQL reales, y la revisión visual en navegador, siguen pendientes de comprobar en tu equipo. No se han usado claves ni saldo de API.

```bash
npm ci
npm test
npm run build
```

---

## Historial e instrucciones de versiones anteriores

# Actualización: perfil profesional (v0.2)

## Actualizar tu instalación sin perder oportunidades

1. Extrae el ZIP en una carpeta temporal.
2. Copia el contenido de `ai-job-hunter` encima de tu carpeta **original** `ai-job-hunter`, aceptando reemplazar archivos. El paquete no contiene `.env`, por lo que debes conservar el tuyo y la contraseña existente de PostgreSQL.
3. En tu `.env` original configura `AI_MODE=demo`. Puedes dejar `OPENAI_API_KEY=` y `OPENAI_MODEL=` vacíos. No cambies `POSTGRES_PASSWORD` de la base ya creada.
4. Desde esa misma carpeta original ejecuta:

```bash
docker compose up -d --build
docker compose restart web
```

5. Abre http://localhost:8080 y recarga la página.

Mantén el mismo nombre de proyecto de Compose y la misma carpeta original: así se reutiliza el volumen de PostgreSQL. No ejecutes `docker compose down -v`: borraría la base. No hace falta bajar los contenedores para actualizar. La nueva tabla se crea automáticamente, sin modificar `analyses`.

## Probar el perfil

- Abre **Mi perfil** y completa nombre y cargo objetivo; el resto es opcional.
- Guarda habilidades, experiencia, proyectos, formación e idiomas que sean reales.
- Pulsa **Usar perfil en esta vacante**. Si ya pegaste otro CV, se solicita confirmación antes de reemplazarlo.
- Ajusta el texto del CV si quieres: ese ajuste afecta solo a esta oportunidad.
- Pega una vacante y prueba el modo demo. El perfil se guarda realmente; el resultado de análisis sigue siendo una demostración sin puntuación.
- Recarga la página: se recupera el perfil y se completa el CV cuando está vacío.
- Puedes descartar cambios del formulario o eliminar el perfil. Eliminarlo no elimina análisis anteriores ni sus datos derivados.

No se envían datos a OpenAI al guardar el perfil. A diferencia del CV pegado para un análisis, los campos del perfil **sí se almacenan en PostgreSQL**. Sigue siendo una aplicación local para una sola persona, sin autenticación.

## Cambios incluidos

- `GET /api/profile`, `PUT /api/profile`, `DELETE /api/profile`.
- Tabla `professional_profile` con un único registro y fecha de actualización.
- Validación de tipos, límites de texto y campos obligatorios.
- Componente `ProfilePanel.tsx`, estados de carga, error, guardado y cambios pendientes.
- Se conservan tus diagnósticos de errores de OpenAI. El saldo agotado ahora tiene un mensaje específico.
- El `.env` recibido se excluyó del paquete actualizado; no se utilizaron sus credenciales.

## Verificación

Pasaron 11 pruebas, incluidas las rutas HTTP del perfil con almacenamiento simulado, y la compilación TypeScript/Vite. No se ejecutó Docker ni una base PostgreSQL real en este entorno. El comportamiento visual en navegador y el arranque completo se deben comprobar en tu instalación.

---

# AI Job Hunter — primera versión

Aplicación local y de un solo usuario para comparar un CV en texto con una vacante, guardar resultados y seguir postulaciones. Interfaz en español, React + TypeScript; API Node.js + Express; PostgreSQL y Docker Compose.

## 1. Arrancar en Linux

Necesitas Docker Engine funcionando y Docker Compose. Comprueba:

```bash
docker --version
docker compose version
```

Extrae el ZIP y abre una terminal dentro de `ai-job-hunter`:

```bash
cp .env.example .env
docker compose up --build -d
```

La primera ejecución descarga imágenes e instala dependencias; necesita internet. Abre http://localhost:8080. Empieza en **modo demostración**: no necesita clave, no consume API y devuelve un ejemplo identificado sin puntuación. Pega al menos 80 caracteres en CV y vacante, y un título de al menos 3 caracteres. El resultado se guarda en PostgreSQL.

Comprueba los servicios:

```bash
docker compose ps
curl --fail http://localhost:8080/health
docker compose logs --tail=80 api
```

La salud debe responder `{"status":"ok"}`. Si falla el arranque, comparte el error, nunca el contenido de `.env`.

## 2. Activar análisis con IA

Edita `.env` en tu computador:

```dotenv
AI_MODE=openai
OPENAI_API_KEY=tu_clave_privada
OPENAI_MODEL=identificador_del_modelo_habilitado_en_tu_cuenta
```

Elige un modelo de tu cuenta que soporte Responses API y Structured Outputs. La API requiere credenciales y cuota propias. No pegues la clave en el frontend ni en GitHub. Reinicia el servicio:

```bash
docker compose up -d --force-recreate api
```

La interfaz mostrará «IA conectada» al recargar (indica configuración, no verifica cuota hasta analizar). Al pulsar analizar, envía el CV y la vacante a OpenAI. La integración usa `store: false`; esto no equivale a una garantía de retención cero del proveedor. La respuesta incluye puntuación orientativa, evidencia, brechas, próximos pasos, resumen profesional y mensaje. Revisa su fidelidad antes de usarla. No hay envíos automáticos.

Referencia oficial utilizada: https://developers.openai.com/api/docs/guides/structured-outputs

## 3. Entender el código

- `frontend/src/main.tsx`: formulario, resultado y seguimiento.
- `frontend/src/style.css`: diseño responsive.
- `backend/src/server.js`: rutas, PostgreSQL y validación de peticiones.
- `backend/src/analyze.js`: configuración, validación y llamada al modelo.
- `backend/test/analyze.test.js`: pruebas sin API ni base de datos.
- `compose.yaml`: base de datos, API y web.

Flujo: navegador → Nginx → Express → OpenAI → PostgreSQL → navegador.
La API usa JavaScript ESM para mantener simple el arranque; la interfaz usa TypeScript.

### Endpoints

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/health` | Comprueba conexión con PostgreSQL |
| GET | `/api/config` | Modo activo, sin secretos |
| POST | `/api/analyses` | Analiza y guarda `{title, cv, job}` |
| GET | `/api/analyses` | Últimos 100 resultados |
| PATCH | `/api/analyses/:id` | Actualiza `{status}` |
| DELETE | `/api/analyses/:id` | Elimina un resultado |

Estados: Guardada, Postulada, Entrevista, Oferta, Descartada. Cambiar un estado no postula a una vacante.

## 4. Pruebas y compilación

Con Node.js 24:

```bash
node --test backend/test/*.test.js
npm ci
npm run build
```

Las pruebas del analizador no necesitan instalar dependencias. El build sí. Las versiones directas están fijadas y se incluye `package-lock.json`. Usa `npm ci` para instalar las versiones resueltas. Los Dockerfiles también usan `npm ci`.

## 5. Crear tu repositorio local

Desde la carpeta del proyecto:

```bash
git init -b main
git add .
git commit -m "feat: initialize AI Job Hunter MVP"
```

`.env` y `node_modules` quedan excluidos. Crea después un repositorio vacío en GitHub y sigue sus instrucciones para conectar el remoto. No se ha creado ni publicado ningún repositorio remoto.

## Datos y alcance

Solo se publica el puerto web en `127.0.0.1`; PostgreSQL y la API quedan dentro de la red de Docker. Esta versión no incluye autenticación y está destinada a tu computador. Antes de desplegar en internet necesita usuarios, autorización por propietario, HTTPS, límites persistentes de consumo y migraciones versionadas. El límite actual es un análisis simultáneo y tres segundos entre intentos por proceso; no es un presupuesto de gasto.

Se guarda título, resultado, estado y fecha del análisis, además del perfil profesional si decides guardarlo. El CV pegado para analizar no se almacena como original, pero el resultado puede contener datos de tu experiencia. Elimina resultados desde la interfaz. La base persiste entre reinicios gracias al volumen de Docker. `docker compose down` detiene servicios conservando datos; no uses `down -v` salvo que quieras borrar toda la base.

## Próximas iteraciones

1. Clasificar el texto importado en los campos del perfil editable (la importación al campo CV ya está disponible).
2. Búsqueda de ofertas con fuentes autorizadas y deduplicación.
3. n8n para ejecutar búsquedas programadas y recordatorios.
4. Exportación de CV completo adaptado; actualmente solo adapta el resumen profesional.
5. Autenticación, despliegue y CI.

n8n y búsqueda automática no están implementados en esta entrega: primero se valida el flujo manual de extremo a extremo.

## Verificación de esta entrega

Se ejecutaron seis pruebas del analizador, validación sintáctica, comprobación TypeScript y compilación de producción de React. Docker no está disponible en el entorno de preparación; la integración real con PostgreSQL y la llamada a OpenAI quedan pendientes de verificar en tu equipo. No se ha usado una clave ni consumido tu cuota.
