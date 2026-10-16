import { Worker } from 'node:worker_threads';
import multer from 'multer';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
function failure(message, status = 422) {
  return Object.assign(new Error(message), { status });
}
export function identifyDocument(filename, buffer) {
  const extension = filename.toLowerCase().split('.').pop();
  if (!['pdf', 'docx'].includes(extension))
    throw failure('Selecciona un PDF o DOCX. El formato .doc no está admitido.', 415);
  if (!buffer.length) throw failure('El archivo está vacío.');
  if (buffer.length > MAX_FILE_BYTES) throw failure('El archivo supera el máximo de 5 MiB.', 413);
  if (extension === 'pdf' && buffer.subarray(0, 1024).includes(Buffer.from('%PDF-'))) return 'pdf';
  if (extension === 'docx' && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
    return 'docx';
  throw failure(
    'El contenido del archivo no corresponde a su extensión. Exporta otra copia del CV.',
  );
}
const messages = {
  PASSWORD:
    'El PDF está protegido con contraseña. Exporta una copia sin contraseña para importarla.',
  PAGE_LIMIT: 'El PDF supera el máximo de 30 páginas. Importa solamente las páginas de tu CV.',
  DOCX_LIMIT:
    'El DOCX está cifrado o supera el límite de contenido descomprimido (20 MiB / 1.000 entradas).',
};
export async function extractCv(filename, buffer) {
  const type = identifyDocument(filename, buffer);
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import-worker.js', import.meta.url), {
      workerData: { buffer, type },
      resourceLimits: { maxOldGenerationSizeMb: 192 },
      stdout: true,
      stderr: true,
    });
    // Drain parser diagnostics without logging uploaded contents.
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(value);
    };
    const timer = setTimeout(
      () =>
        finish(
          failure(
            'La extracción tardó demasiado. Prueba con un archivo más simple o pega el texto manualmente.',
            408,
          ),
        ),
      30000,
    );
    worker.once('message', (message) => {
      if (message.error)
        finish(
          failure(
            messages[message.error] ||
              'No se pudo leer el archivo. Puede estar dañado o tener un formato no compatible.',
          ),
        );
      else finish(null, message.result);
    });
    worker.once('error', () =>
      finish(failure('No se pudo procesar el archivo. Prueba con una copia más simple.')),
    );
    worker.once('exit', () => {
      if (!settled) finish(failure('La extracción se interrumpió. Intenta con otro archivo.'));
    });
  });
  const text = result.text
    .replace(/\r\n?/g, '\n')
    .split('\u0000')
    .join('')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
  if (!text)
    throw failure(
      'No encontramos texto extraíble. Si el CV es una imagen o PDF escaneado, necesitas OCR; esta versión no lo incluye. También puedes pegar el texto manualmente.',
    );
  if (text.length > 100000)
    throw failure('El documento contiene demasiado texto. Importa solamente tu CV.');
  return {
    text,
    warnings: [
      ...result.warnings,
      ...(text.length > 16000
        ? ['El texto supera los 16.000 caracteres. Recórtalo en la vista previa antes de usarlo.']
        : []),
    ],
  };
}
export function registerImportRoutes(app) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_FILE_BYTES,
      files: 1,
      fields: 0,
      parts: 1,
    },
  }).single('cv');
  let active = false;
  app.post('/api/cv/import', async (req, res) => {
    if (active)
      return res
        .status(429)
        .json({ error: 'Ya hay una importación en curso. Espera a que termine.' });
    active = true;
    res.set('Cache-Control', 'no-store');
    try {
      await new Promise((resolve, reject) =>
        upload(req, res, (error) => (error ? reject(error) : resolve())),
      );
      if (!req.file)
        return res.status(400).json({ error: 'Adjunta un archivo PDF o DOCX en el campo cv.' });
      const result = await extractCv(req.file.originalname, req.file.buffer);
      res.json(result);
    } catch (error) {
      if (error instanceof multer.MulterError) {
        const large = error.code === 'LIMIT_FILE_SIZE';
        return res.status(large ? 413 : 400).json({
          error: large
            ? 'El archivo supera el máximo de 5 MiB.'
            : 'Adjunta un único archivo PDF o DOCX, sin campos adicionales.',
        });
      }
      res.status(error.status || 422).json({
        error: error.status
          ? error.message
          : 'No se pudo importar el archivo. Intenta con otra copia.',
      });
    } finally {
      // No files or extracted text are written to disk or the database.
      if (req.file) req.file.buffer = undefined;
      active = false;
    }
  });
}
