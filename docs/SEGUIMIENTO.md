# Actualización: seguimiento de postulaciones

## Instalación

Esta actualización corresponde a la aplicación local. La demo pública se mantiene separada.

Copia el parche descargado a la raíz del proyecto y, desde esa carpeta, ejecuta:

```bash
git apply --check AI-Job-Hunter-Seguimiento.patch
git apply AI-Job-Hunter-Seguimiento.patch
docker compose up -d --build
docker compose restart web
```

Si la comprobación informa conflictos, no fuerces la aplicación: revisa las diferencias con tus cambios locales. Conserva tu `.env` y tu carpeta de proyecto. No uses `docker compose down -v`.

La API añade `analyses.tracking` como JSONB con valor vacío por defecto; la migración puede repetirse y conserva los análisis existentes. No cambian las dependencias. Los campos se guardan en PostgreSQL y no se envían a OpenAI.

## Prueba manual

1. Abre un análisis existente y pulsa Editar seguimiento.
2. Añade un enlace https, fecha de postulación, próximo seguimiento de hoy y notas; guarda.
3. Recarga la página: deben conservarse los cuatro campos.
4. Activa Seguimiento pendiente: debe aparecer.
5. Cambia su estado a Oferta: debe salir de pendientes.
6. Vuelve a Todas, cambia a Entrevista y borra la fecha de seguimiento: no debe aparecer en pendientes.
7. Comprueba también un análisis nuevo preparado desde una vacante: su enlace debe conservarse.

Las fechas no cambian automáticamente al elegir un estado. Oferta y Descartada se consideran fuera de seguimiento pendiente. Vacantes guardadas y el historial de análisis continúan siendo listas independientes.

## Validación de esta actualización

- ESLint y TypeScript/Vite: correctos.
- 23 pruebas de backend: correctas, incluyendo fechas reales, URLs, borrado de campos y contrato HTTP de cambios parciales.
- Smoke test ampliado para comprobar persistencia y filtro con PostgreSQL real cuando se ejecute CI.
- Docker/PostgreSQL y comprobación visual no ejecutados en el entorno de preparación de esta actualización.
