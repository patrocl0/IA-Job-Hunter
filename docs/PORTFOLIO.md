# Presentar AI Job Hunter

## Problema y solución

La búsqueda laboral suele repartir el CV, las vacantes y el seguimiento entre archivos y pestañas. AI Job Hunter reúne un perfil reutilizable, importación de documentos, búsqueda de ofertas y registro de postulaciones en una aplicación local.

## Guion de demostración (2–3 minutos)

1. Muestra «Mi perfil» y explica que PostgreSQL conserva los datos.
2. Importa el CV de ejemplo de `backend/test/fixtures/cv.docx`, revisa el texto y úsalo.
3. Busca una tecnología, explica la fuente Remotive y sus restricciones de ubicación.
4. Guarda una oferta y cambia su estado. Aclara que esto no envía una postulación.
5. Prepara el análisis y muestra el modo demo sin puntuación inventada.
6. Abre el código o las pruebas y explica una decisión: validación de archivos, caché persistente o separación de claves del frontend.

No presentes el análisis demo como una evaluación real ni las capturas de ejemplo como vacantes vigentes. La integración OpenAI existe, pero necesita clave, saldo y una validación real en tu cuenta.

## Preguntas técnicas para preparar

- ¿Por qué la clave de OpenAI vive solo en el backend?
- ¿Cómo se valida un PDF o DOCX y por qué se procesa en un worker?
- ¿Por qué Remotive se consulta cada seis horas y qué sucede si falla?
- ¿Cómo evitas duplicar una oferta guardada?
- ¿Qué comprueba una prueba de lógica frente al smoke test con contenedores?
- ¿Qué falta para convertir esta aplicación local en un servicio multiusuario?

## Descripción breve para GitHub

Aplicación full stack para organizar la búsqueda de empleo: perfil profesional, importación de CV en PDF/DOCX, vacantes remotas y seguimiento. React, TypeScript, Express, PostgreSQL y Docker.

Topics sugeridos: react, typescript, nodejs, express, postgresql, docker, job-search, portfolio.

## Publicar el repositorio

El paquete no crea ni publica un repositorio remoto. Crea uno vacío llamado `ai-job-hunter` en tu cuenta y revisa el código antes de subirlo.

Si todavía no hay repositorio local, desde la carpeta raíz:

```bash
git init -b main
git add .
git status --short
git commit -m "feat: add AI Job Hunter portfolio project"
```

Después conecta la URL que GitHub muestre para tu repositorio:

```bash
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

Si ya utilizas Git, conserva tu historial, rama y remoto: no repitas `git init` ni reemplaces `origin`. Revisa `git status` antes de confirmar cambios. `.env` debe permanecer fuera del repositorio; si se comprometió antes, quitarlo del último commit no elimina el secreto de su historial y debes revocarlo.

Abre la pestaña Actions tras el push. La verificación automática se considera validada en GitHub solo cuando termine correctamente; este paquete no implica una ejecución remota exitosa.
