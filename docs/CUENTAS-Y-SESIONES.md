# Cuentas, sesiones y actualización segura

Esta entrega añade autenticación real a la instalación con Express y PostgreSQL. La demo pública sigue siendo una demostración sin cuentas reales, sin backend y con almacenamiento del navegador. No hay sincronización de datos entre ambas.

## Instalar sobre tu proyecto actual

El parche `AI-Job-Hunter-Cuentas.patch` se preparó sobre `bf95d0e82f17ac75bf29cf7ffe525ec2ed9c9663` (main, arquitectura integrada). Incluye los archivos auxiliares y las pruebas de la corrección de PDF. No apliques además el parche antiguo del PDF si ya tienes sus cambios.

1. Trabaja en la carpeta original del proyecto y revisa `git status --short`. Si hay trabajo sin guardar, consérvalo en tu rama antes de continuar. Actualiza main únicamente con un árbol limpio:

```bash
git switch main
git pull --ff-only origin main
```

2. Con la base de datos anterior todavía en marcha, crea un respaldo y comprueba que el comando terminó correctamente:

```bash
docker compose exec -T db pg_dump -U jobhunter -d jobhunter > ../job-hunter-antes-cuentas.sql
```

El respaldo contiene datos personales. Mantenlo fuera del repositorio. Conserva tu `.env`, la contraseña de PostgreSQL y la carpeta original; no ejecutes `docker compose down -v`.

3. Descarga el parche a la carpeta padre del proyecto y aplica la actualización:

```bash
git switch -c feature/cuentas-usuarios
git apply --check ../AI-Job-Hunter-Cuentas.patch
git apply ../AI-Job-Hunter-Cuentas.patch
```

Si `--check` falla, detente antes de aplicar. La comprobación no escribe archivos. Comparte el error para adaptar la actualización a tu versión.

4. Añade estas variables a tu `.env` conservando las existentes:

```dotenv
APP_ORIGIN=http://localhost:8080
ALLOW_REGISTRATION=false
```

`APP_ORIGIN` debe coincidir exactamente con la dirección que abres, sin barra final. Si usas `http://127.0.0.1:8080`, configura ese origen. Un dominio externo requiere HTTPS. La publicación de esta aplicación completa necesita alojamiento propio con PostgreSQL; el Site estático actual no ejecuta este backend.

5. Reconstruye y activa la cuenta propietaria:

```bash
docker compose up -d --build
docker compose restart web
docker compose exec api node backend/src/modules/auth/create-owner.js
```

El comando pide correo, contraseña de al menos 12 caracteres y confirmación. La contraseña no se muestra ni se añade al historial de comandos. Se ejecuta una sola vez; no sustituye una cuenta propietaria activada.

La migración reserva todos tus registros anteriores para la cuenta propietaria. El registro web nunca reclama esos datos. Si activas una cuenta nueva por registro, aparecerá vacía: es el comportamiento correcto.

6. Abre `http://localhost:8080`, recarga con Ctrl + Shift + R e inicia sesión con esa cuenta. Comprueba tu perfil, análisis, notas, fechas y vacantes anteriores.

7. Si quieres permitir otras cuentas, cambia `ALLOW_REGISTRATION=true` y ejecuta `docker compose up -d api`. Aparecerá «Crear una cuenta nueva». La configuración predeterminada deja el registro cerrado. Mantén `AI_MODE=demo` mientras haces pruebas para no consumir saldo.

## Qué se implementó

### Datos por usuario

- `users`: correo normalizado a minúsculas y hash de contraseña. El usuario 1 se reserva para los datos anteriores; su acceso está bloqueado hasta activarlo por terminal.
- `professional_profile`: una fila por `user_id` en lugar del identificador único global.
- `analyses`: cada registro pertenece a un usuario. Tanto el historial como la paginación, estadísticas, seguimiento y eliminación filtran por su identificador de sesión.
- `saved_vacancies`: clave compuesta `(user_id, source_id)`. Dos personas pueden guardar la misma oferta y mantener estados independientes.
- `vacancy_cache`: caché pública de ofertas compartida, sin perfiles, CV ni notas personales.

La migración 3 es transaccional y se ejecuta una sola vez bajo el bloqueo de migraciones existente. Añade claves foráneas e índices por usuario. Conserva el contenido anterior, cambia las claves del perfil y de vacantes guardadas, y no deja valores predeterminados que asignen nuevos registros al propietario. No es compatible con ejecutar el backend antiguo sobre el esquema nuevo; para volver atrás hay que restaurar el respaldo en una base separada y ejecutar la versión anterior.

### Contraseñas

Se usa `scrypt` de Node con salt aleatorio de 16 bytes, N=32768, r=8, p=3 y salida de 64 bytes. El formato incluye el nombre del algoritmo. No se almacena ni se registra la contraseña. Se aceptan frases largas, sin reglas arbitrarias de símbolos, con mínimo 12 caracteres y máximo 256 bytes. La comparación usa `timingSafeEqual`; el acceso a correos inexistentes también realiza el trabajo de derivación.

Estos parámetros corresponden a una de las combinaciones descritas por OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Sesiones

El navegador recibe un identificador aleatorio de 32 bytes en una cookie `HttpOnly`, `SameSite=Strict`, `Path=/`. Con HTTPS utiliza además `Secure` y el prefijo `__Host-`. En PostgreSQL se guarda únicamente el SHA-256 del identificador, asociado al usuario y con vencimiento absoluto de 7 días.

Una autenticación nueva revoca la sesión anterior presentada por ese navegador. Cerrar sesión elimina la sesión del servidor y la cookie; otros dispositivos mantienen sus propias sesiones. La API vuelve a comprobar la vigencia en cada solicitud. Un proceso horario elimina sesiones e intentos vencidos. No se guardan tokens en localStorage.

Referencia: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

### Protección de solicitudes

Todas las rutas de datos, búsqueda e importación requieren sesión. `/health`, `/api/config` y las rutas de acceso son públicas por necesidad. Las escrituras requieren la cabecera `X-Job-Hunter: 1`; se rechaza un `Origin` distinto al configurado y las solicitudes declaradas cross-site. No se habilita CORS. La cabecera obliga al navegador a hacer preflight cuando otro origen intenta enviarla; la cookie SameSite aporta una defensa adicional.

Los intentos de acceso y registro se limitan en PostgreSQL: 30 por dirección de conexión y 10 por correo en 15 minutos. El límite se comparte entre procesos; detrás del Nginx actual las conexiones comparten la dirección del proxy, de modo que el límite de dirección es compartido por los usuarios. Antes de un servicio público habrá que configurar explícitamente proxies confiables y una política adecuada al tráfico. No se confía ciegamente en `X-Forwarded-For`.

El backend no acepta un `user_id` del formulario para decidir pertenencia. Toma siempre el usuario de la sesión. Las modificaciones de análisis ajenos responden 404. El borrado de vacantes es idempotente y solo actúa sobre la cuenta actual.

### Interfaz

`AuthGate` comprueba la sesión antes de montar el espacio de trabajo, ofrece acceso y registro (si se habilita) y desmonta el estado privado al salir o recibir un 401. Las pestañas del mismo origen se notifican de los cambios de cuenta mediante BroadcastChannel, cuando el navegador lo soporta. Cerrar sesión pide confirmación por posibles borradores sin guardar. El formulario permite gestores de contraseñas y muestra errores del servidor.

## Validación

- Pruebas unitarias de contraseñas, configuración y validaciones.
- Prueba HTTP con PGlite (PostgreSQL embebido, dependencia de desarrollo): ejecuta las migraciones reales, conserva datos anteriores, activa propietario, crea otra cuenta y comprueba aislamiento de perfil, análisis, estadísticas y vacantes. Verifica expiración, rotación y revocación de sesiones y rechazo de escrituras sin cabecera/origen permitido.
- El flujo CI ejecuta las pruebas, ambas compilaciones y un smoke test con Docker/Nginx/PostgreSQL. Su base es temporal y tiene registro habilitado solo para CI.
- El smoke requiere una instalación desechable y `SMOKE_ALLOW_WRITES=true`: crea una cuenta de prueba, no lo ejecutes contra tus datos reales.

La ejecución local de esta entrega no incluye Docker ni una revisión visual de la pantalla en navegador. PGlite ejecuta SQL real, pero no sustituye la comprobación de PostgreSQL 17 y Nginx en GitHub Actions. Revisa el resultado del nuevo workflow al subir la rama; los workflows antiguos no validan esta entrega.

## Alcance y siguientes pasos

Esta versión no incluye verificación de correo, recuperación de contraseña por email, cambio de contraseña, MFA, administración de usuarios ni eliminación de cuentas. El registro es para una instalación controlada. No se afirma que sea un SaaS listo para publicación masiva.

Antes de abrir un servicio a Internet: HTTPS y proxy confiable, verificación/recuperación por correo, límites por cuenta para consumo de IA/importación, gestión de abuso, copias y recuperación probadas, observabilidad y pruebas de carga. Los análisis y la importación mantienen sus límites de concurrencia existentes por proceso. El aislamiento se realiza en consultas explícitas; no se ha añadido PostgreSQL Row-Level Security.

## Guardar en GitHub

Después de revisar la instalación y las pruebas:

```bash
git diff --check
git status --short
git add .
git commit -m "feat: add account sessions and isolate user data"
git push -u origin feature/cuentas-usuarios
```

Abre un pull request a main y espera a que termine GitHub Actions. Mantén el parche y los respaldos fuera del repositorio. Este push no publica la demo estática.
