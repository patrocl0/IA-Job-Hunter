# Exportar postulaciones a CSV

En **Postulaciones**, pulsa **Exportar CSV**. La descarga incluye todos los registros que coincidan con los filtros actuales de estado y seguimiento pendiente, no solo los 20 de la página visible. Guarda primero las notas que estés editando: mientras el editor está abierto la exportación está deshabilitada.

El archivo incluye ID, título, estado, fecha de creación UTC, fecha de postulación, fecha de seguimiento, enlace, notas, modo de análisis y puntuación orientativa. El modo demo deja vacía la puntuación. No incluye tu CV, el perfil, el correo de acceso ni el texto completo del análisis.

## Instalar

Este parche actualizado se preparó sobre main, commit `60a7004966740d552131a587629581236865fd74`, con contraseñas y la corrección de `scripts/smoke.mjs` integradas. Usa `AI-Job-Hunter-CSV-Actualizado.patch` en lugar del parche CSV anterior. No se necesitan exclusiones.

1. Desde `ai-job-hunter`, ejecuta `git status --short`. Conserva primero cualquier trabajo pendiente. Con el árbol limpio:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature/exportar-csv-actualizado
```

2. Descarga `AI-Job-Hunter-CSV-Actualizado.patch` **dentro de la carpeta `ai-job-hunter`**. Ejecuta estos comandos en la terminal, no los pegues dentro de un archivo JavaScript:

```bash
git apply --check AI-Job-Hunter-CSV-Actualizado.patch
git apply AI-Job-Hunter-CSV-Actualizado.patch
```

Solo ejecuta el segundo comando si la comprobación no muestra errores. Si falla, comparte la salida; no elimines archivos ni fuerces la aplicación. Si ya aplicaste parte del parche anterior, no superpongas este parche sin revisar las diferencias.

3. Comprueba el código:

```bash
npm ci
npm run lint
npm test
npm run build
npm run build:demo
```

4. Reconstruye y recarga:

```bash
docker compose up -d --build
docker compose restart web
```

Abre http://localhost:8080 y recarga con Ctrl + Shift + R. No hacen falta variables de entorno, paquetes nuevos ni migraciones de datos. Conserva tu `.env` y el volumen de PostgreSQL.

5. Prueba una exportación sin filtros y otra con estado o seguimiento pendiente. Comprueba títulos, tildes, notas, fechas y número de registros. La exportación no modifica tus postulaciones.

## Abrir en Excel o LibreOffice

El archivo utiliza UTF-8 con BOM, coma como separador, comillas dobles y filas terminadas en CRLF. Conserva las notas con saltos de línea dentro de una celda. Si tu programa muestra todo en una sola columna, importa el archivo como CSV y selecciona **UTF-8** y **coma**. Las fechas de seguimiento y postulación se guardan como AAAA-MM-DD; la creación lleva hora UTC.

El nombre será `postulaciones-AAAA-MM-DD.csv`. En la demo pública será `postulaciones-demo-AAAA-MM-DD.csv`, con los datos de ese navegador. La demo no exporta información de tu instalación local.

Los valores con prefijos que podrían iniciar fórmulas se exportan con un apóstrofo protector. Esto puede mostrarse en ciertos programas o al importar el CSV como texto; es intencional. Las comillas se duplican y cada campo se encierra entre comillas. No se garantiza el comportamiento de todas las hojas de cálculo después de editar y volver a guardar un CSV. Referencia: https://owasp.org/www-community/attacks/CSV_Injection

## Arquitectura y límites

- `GET /api/analyses/export?today=AAAA-MM-DD&status=...&followUp=due` requiere una sesión en la instalación local. Solo acepta esos tres parámetros; `status` y `followUp` son opcionales.
- La consulta toma `user_id` de la sesión y reutiliza los mismos filtros SQL que la paginación. Ordena por fecha de creación o por seguimiento pendiente. No admite seleccionar otro usuario.
- La exportación consulta una sola lista, sin recorrer páginas que pudieran cambiar entre solicitudes. Recupera solo las columnas necesarias; no incluye el resultado completo de IA.
- Límite: **5.000 registros** por exportación. Si se supera, devuelve un error que pide aplicar filtros; no entrega un archivo truncado.
- `shared/analyses-csv.mjs` contiene el formato común para Express y la demo. Ambos Dockerfiles copian esta carpeta. La demo adapta su ruta relativa al empaquetado de Sites.
- El navegador descarga el resultado como Blob, libera su URL temporal y cancela una descarga pendiente cuando se desmonta la sesión. El servidor responde `Cache-Control: no-store` y `Content-Disposition: attachment`.
- El botón informa que incluye todas las páginas y queda deshabilitado cuando no hay registros, hay una carga pendiente o se están editando notas.

## Validación

45 pruebas aprobadas: 35 de backend y 10 de frontend. Las pruebas CSV verifican tildes, comillas, notas multilínea, prefijos de fórmulas, BOM, exportación de 25 registros (más de una página), filtros, aislamiento entre cuentas, rechazo de parámetros inesperados, resultado vacío y límite sin truncamiento. La demo utiliza el mismo formato y su exportación no escribe en el almacenamiento.

Lint y las compilaciones local/demo pasaron. El smoke de CI incorpora una descarga autenticada por Nginx. La revisión visual, la apertura en Excel/LibreOffice y Docker/PostgreSQL 17 no se ejecutaron en este entorno; compruébalos localmente y en el workflow nuevo. No se realizan llamadas a OpenAI para exportar.

## Guardar en GitHub

Mueve el parche fuera del proyecto sin sobrescribir otro archivo del mismo nombre:

```bash
mv -i AI-Job-Hunter-CSV-Actualizado.patch ../
npm run lint
npm test
npm run build
npm run build:demo
git diff --check
git status --short
```

Revisa los archivos y después:

```bash
git add .
git commit -m "feat: export filtered applications to CSV"
git push -u origin feature/exportar-csv-actualizado
```

Abre un pull request hacia main y revisa el nuevo CI antes de integrarlo. No ejecutes el smoke test sobre tus datos locales: el workflow usa una base desechable.
