# Exportación CSV

45 pruebas aprobadas (35 backend, 10 frontend), lint y compilaciones local/demo. Las pruebas de exportación incluyen aislamiento, formato, filtros y rechazo de truncamiento. Detalles y límites en [EXPORTAR-CSV.md](EXPORTAR-CSV.md). Falta validación visual, apertura en hoja de cálculo y el nuevo CI con Docker/PostgreSQL.

# Cambio y recuperación de contraseña

33 pruebas de backend y 9 de frontend aprobadas; lint y ambas compilaciones correctos. Las pruebas nuevas cubren cambio HTTP, recuperación local, revocación de sesiones y rollback. El smoke de Docker se amplió y debe ejecutarse en el CI nuevo. Detalles en [CONTRASENAS.md](CONTRASENAS.md). No se realizó revisión visual en navegador en esta entrega.

# Actualización de autenticación

La entrega de cuentas incorpora pruebas HTTP con SQL real en PGlite, migración de datos anteriores y aislamiento entre usuarios. Consulta [CUENTAS-Y-SESIONES.md](CUENTAS-Y-SESIONES.md). Las cifras y ejecuciones de la sección siguiente pertenecen a la entrega anterior. El nuevo CI con PostgreSQL/Nginx debe ejecutarse tras subir la rama.

# Validación: arquitectura y diseño

| Comprobación | Resultado |
| --- | --- |
| ESLint | Correcto |
| Backend | 26 pruebas correctas |
| Adaptador de demo | 7 pruebas correctas |
| TypeScript + Vite, build local | Correcto |
| TypeScript + Vite, build demo | Correcto |
| Migraciones y consultas: contratos con dependencias simuladas | Correcto |
| Docker/PostgreSQL real de esta refactorización | Pendiente de GitHub Actions; Docker no disponible en el entorno de preparación |
| Comprobación visual e importación de navegador del nuevo diseño | Pendiente; herramienta de navegador requerida no disponible |
| OpenAI real | No ejecutado; no se consumió saldo |

La versión anterior sí pasó su pipeline remoto. Ese resultado no acredita esta nueva refactorización. El workflow amplía el smoke test con paginación y estadísticas reales en PostgreSQL y construye las dos variantes de frontend.

Las capturas existentes en docs/screenshots corresponden al diseño anterior; no son una validación visual del nuevo. Se actualizó el script de capturas para navegar las secciones nuevas, pero no se ejecutó aquí.

Vite puede mostrar advertencias por las directivas `use client` de Radix/Lucide en una aplicación enteramente cliente. Las compilaciones terminan correctamente; esas directivas no habilitan renderizado de servidor.
