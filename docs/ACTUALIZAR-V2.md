# Instalar la actualización de arquitectura y diseño

Trabaja en la carpeta original `ai-job-hunter`. Conserva tu `.env`, la contraseña de PostgreSQL y el volumen Docker. La demo pública se actualiza por separado y no modifica tu instalación.

## 1. Comprobar la base y respaldar

```bash
git status --short
git pull --ff-only origin main
docker compose exec -T db pg_dump -U jobhunter -d jobhunter > ../job-hunter-respaldo.sql
```

Si tienes cambios locales o falla el respaldo, detente y resuélvelo antes de continuar. El respaldo contiene información personal: no lo subas al repositorio.

El parche se preparó sobre el commit `aac675056cf77bc0c8127a73c5d845ce185cc4df`, que incluye seguimiento de postulaciones. Comprueba la aplicación del parche antes de escribir archivos; si cambió el repositorio, la comprobación puede detectar un conflicto.

## 2. Aplicar en una rama

Copia `AI-Job-Hunter-Arquitectura-UI.patch` a la raíz del proyecto:

```bash
git switch -c feature/arquitectura-ui
git apply --check AI-Job-Hunter-Arquitectura-UI.patch
git apply AI-Job-Hunter-Arquitectura-UI.patch
```

Si `--check` falla, no ejecutes el segundo `git apply`. Comparte el mensaje para resolver la diferencia sin sobreescribir tu trabajo.

## 3. Construir y ejecutar

```bash
docker compose up -d --build
docker compose restart web
docker compose ps
```

Abre http://localhost:8080 y recarga con Ctrl + Shift + R. Mantén la carpeta original para que Compose use el mismo proyecto y volumen. No ejecutes `docker compose down -v`.

Las migraciones conservan tus tablas y datos. En el primer arranque se registra el esquema y se añaden índices. Si la API falla, revisa `docker compose logs --tail=80 api`.

## 4. Revisar el recorrido

Comprueba que ves tus análisis y tu perfil anteriores. Busca una vacante, prepara un análisis, importa un documento de prueba, guarda notas/fechas, prueba filtros y recarga. Si tienes más de 20 análisis, prueba la segunda página. Comprueba también desde una ventana estrecha.

## 5. Guardar el trabajo

Después de comprobar la aplicación, mueve el archivo `.patch` fuera del proyecto para no incluirlo en tu commit. Revisa `git diff --stat` y `git status --short` antes de añadir los archivos. El `.env` permanece ignorado.

```bash
git add .
git commit -m "refactor: modular architecture and shared Tailwind interface"
git push -u origin feature/arquitectura-ui
```

Abre un pull request hacia main y revisa GitHub Actions antes de integrarlo. Este push no publica automáticamente la demo.

## Desarrollo sin reconstruir Docker a cada cambio

Con Node 24, instala las dependencias con `npm ci`. Usa `npm run dev --workspace frontend`; Vite redirige `/api` a `127.0.0.1:3000`. Debes tener una API accesible en ese puerto (la configuración Compose actual no la publica al host). No cambies a una dirección pública para resolverlo.

`npm run build:demo` genera una interfaz estática en `frontend/dist-demo`; permite trabajar en la demo sin Express ni PostgreSQL.
