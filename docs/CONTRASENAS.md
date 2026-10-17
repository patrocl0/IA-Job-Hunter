# Cambio de contraseña y recuperación local

Esta entrega amplía la autenticación existente. No necesita nuevas variables de entorno ni modifica el esquema de PostgreSQL. Mantiene tu cuenta, perfiles, análisis y vacantes. No vuelvas a ejecutar `create-owner.js` para instalarla.

## Instalar la actualización

El parche `AI-Job-Hunter-Contrasenas.patch` está preparado sobre main, commit `88cde97f4e6eda1aa5350fd5c24d849877773fcc`, que incluye cuentas y sesiones.

1. Desde la carpeta original `ai-job-hunter`, revisa `git status --short`. Guarda primero cualquier cambio pendiente. Con el árbol limpio:

```bash
git switch main
git pull --ff-only origin main
```

2. Conserva un respaldo fuera del repositorio:

```bash
docker compose exec -T db pg_dump -U jobhunter -d jobhunter > ../job-hunter-antes-contrasenas.sql
```

Si el respaldo falla, detente. No modifiques tu `.env`, la contraseña de PostgreSQL ni el volumen Docker. No ejecutes `docker compose down -v`.

3. Descarga `AI-Job-Hunter-Contrasenas.patch` **dentro de la carpeta `ai-job-hunter`** y ejecuta:

```bash
git switch -c feature/contrasenas
git apply --check AI-Job-Hunter-Contrasenas.patch
git apply AI-Job-Hunter-Contrasenas.patch
```

Ejecuta el segundo `git apply` únicamente si `--check` termina sin errores. Si falla, comparte la salida antes de continuar. No uses exclusiones de parches anteriores: este parche se preparó sobre la versión con cuentas integrada.

4. Reconstruye:

```bash
docker compose up -d --build
docker compose restart web
```

Abre http://localhost:8080 y recarga con Ctrl + Shift + R. Mantén la dirección configurada en `APP_ORIGIN` si usas otra.

## Cambiar la contraseña desde la aplicación

1. Inicia sesión y guarda los cambios pendientes en perfil o postulaciones.
2. En la cabecera pulsa **Cambiar contraseña**.
3. Escribe la contraseña actual, la nueva y su confirmación.
4. Pulsa **Guardar y cerrar sesiones**.
5. La aplicación vuelve al acceso y muestra una confirmación. Inicia sesión con la contraseña nueva.

Se exige una sesión activa y la contraseña actual correcta. La contraseña nueva debe ser distinta, tener al menos 12 caracteres y no superar 256 bytes UTF-8. Puedes usar una frase larga y un gestor de contraseñas. No se eliminan espacios de la contraseña ni se trunca.

Se cierran todas las sesiones de esa cuenta, incluida la actual y las de otros dispositivos. Las cuentas de otras personas conservan sus sesiones. Las otras pestañas del mismo navegador reciben el aviso mediante BroadcastChannel cuando está disponible; cualquier sesión revocada será rechazada por el servidor en su próxima solicitud.

## Recuperar acceso cuando olvidaste la contraseña

La recuperación requiere acceso administrativo a la terminal de la instalación. No está disponible a través de una petición web ni envía correos. Es apropiada para la instalación local actual; no sustituye un flujo de recuperación por correo verificado para un servicio público.

Desde `ai-job-hunter`, con los contenedores en marcha:

```bash
docker compose exec api node backend/src/modules/auth/reset-password.js
```

El comando pide:

1. El correo exacto de una cuenta activada (normaliza mayúsculas y espacios alrededor).
2. La palabra `RESTABLECER` para confirmar la cuenta indicada.
3. La contraseña nueva y su repetición, ambas ocultas mientras escribes.

Después cierra todas las sesiones de esa cuenta. Vuelve a la aplicación e inicia sesión con la contraseña nueva. Los datos personales permanecen asociados a la misma cuenta.

No escribas contraseñas como argumentos del comando ni las guardes en `.env`. El comando exige una terminal interactiva y no acepta entrada redirigida. Un correo que no exista, una confirmación distinta de `RESTABLECER` o contraseñas que no coincidan detienen la operación.

La recuperación desbloquea los contadores por correo y de cambio de contraseña de esa cuenta. El límite compartido de acceso por dirección de conexión permanece vigente; si lo agotaste, espera a que termine su ventana de 15 minutos.

Quien administra el contenedor y la base de datos tiene la capacidad de recuperar cualquier cuenta de esa instalación. Si otra persona administra el servicio, solicita la recuperación a esa persona.

## Cómo se implementó

- `POST /api/auth/password`: ruta protegida que solo admite `currentPassword` y `newPassword`. Toma el usuario de la sesión; rechaza campos extra como `userId` o `email`.
- Conserva las defensas de origen, cabecera de seguridad y cookies de la entrega anterior. Añade un límite de 10 intentos de cambio por cuenta cada 15 minutos en PostgreSQL.
- Reutiliza la validación y el hash scrypt existentes. Una contraseña actual incorrecta responde 403 y no cierra la sesión.
- Actualiza el hash y elimina las sesiones dentro de la misma transacción. Si falla la eliminación, se revierte también el hash: no queda una contraseña modificada con sesiones antiguas activas.
- Antes de escribir, vuelve a verificar la vigencia de la sesión y el hash leído. La emisión de sesiones de inicio de sesión y los cambios de contraseña se coordinan mediante el bloqueo de la fila del usuario. Un acceso que verificó una contraseña ya sustituida no puede crear una nueva sesión después del restablecimiento.
- `reset-password.js` es una herramienta administrativa local. No se registra una ruta HTTP de restablecimiento y no crea usuarios.
- La pantalla de acceso incluye ayuda de recuperación local. El modal de cambio limpia los campos al cerrarse y, después del éxito, desmonta el espacio privado y comunica el cierre a otras pestañas.
- La demo pública estática sigue sin cuentas reales. Esta entrega se instala en el backend local y no necesita publicar otra versión del Site.

Fuentes de referencia para el diseño:

- https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

## Pruebas y límites

Verificado en esta entrega: 33 pruebas de backend y 9 del frontend; lint y compilaciones local y demo. Las pruebas nuevas usan HTTP y PostgreSQL embebido (PGlite) para verificar contraseña incorrecta, CSRF, aislamiento entre cuentas, cierre de múltiples sesiones, contraseña antigua rechazada, conservación del perfil, rechazo de credenciales de login obsoletas y rollback ante fallos de almacenamiento.

El smoke test de CI añade cambio de contraseña y nuevo inicio de sesión a través de Nginx/PostgreSQL. No ejecutes el smoke contra tus datos: solo es para una base desechable. Esta ejecución no incluye Docker/PostgreSQL 17 ni revisión visual de navegador; el CI nuevo y la comprobación local completan esa validación. La recuperación por email y MFA siguen pendientes.

## Subir la actualización

Después de probar cambio de contraseña y recuperación local, mueve el parche fuera del repositorio, sin sobrescribir otro archivo con ese nombre:

```bash
mv -i AI-Job-Hunter-Contrasenas.patch ../
npm ci
npm run lint
npm test
npm run build
npm run build:demo
git diff --check
git status --short
```

Comprueba que no se añadan `.env`, respaldos `.sql` ni parches. Luego:

```bash
git add .
git commit -m "feat: add password change and local account recovery"
git push -u origin feature/contrasenas
```

Abre un pull request hacia main y revisa GitHub Actions antes de integrarlo.
