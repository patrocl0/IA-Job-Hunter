# Verificación de la entrega para portafolio

| Comprobación | Resultado |
| --- | --- |
| ESLint en backend, frontend y scripts | Correcto |
| Pruebas de lógica, documentos y contratos HTTP | 21 correctas |
| TypeScript y compilación Vite | Correcto |
| UI: buscar, guardar oferta y preparar análisis conservando CV | Correcto con API simulada |
| Ancho móvil a 390 px | Sin desbordamiento horizontal |
| Capturas de perfil y vacantes | Generadas y revisadas con datos ficticios |
| Arranque Docker, Nginx y PostgreSQL real | Pendiente de CI; Docker no está disponible en el entorno de preparación |
| GitHub Actions remoto | Pendiente del primer push; no se ha ejecutado aquí |
| OpenAI real | No probado en esta entrega; sin consumo de saldo |

Las capturas se generaron con Chromium y Playwright sobre la compilación real. Los endpoints de API fueron interceptados con fixtures para no acceder a datos personales ni a servicios externos. El script `scripts/screenshots.mjs` incluye las comprobaciones de UI y puede repetirse con `npm run screenshots`.

El smoke test tiene una protección explícita: exige `SMOKE_ALLOW_WRITES=true`, modo demo y una base sin perfil ni análisis previos. El workflow lo ejecuta en un proyecto Compose temporal, con contraseña aleatoria. El paso final elimina exclusivamente el volumen de ese proyecto de CI. No copies el comando de limpieza con `-v` a tu instalación personal.

La configuración del workflow y las imágenes están preparadas, pero hasta que GitHub Actions finalice no debe afirmarse que el pipeline remoto pasa.
