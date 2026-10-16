import { parentPort, workerData } from 'node:worker_threads';
import yauzl from 'yauzl';

function checkDocx(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(error);
      let total = 0,
        count = 0,
        documentFound = false,
        done = false;
      const fail = (error) => {
        if (!done) {
          done = true;
          zip.close();
          reject(error);
        }
      };
      zip.on('error', fail);
      zip.on('entry', (entry) => {
        count++;
        total += entry.uncompressedSize;
        if (count > 1000 || total > 20 * 1024 * 1024 || entry.generalPurposeBitFlag & 1) {
          return fail(Object.assign(new Error(), { code: 'DOCX_LIMIT' }));
        }
        if (entry.fileName === 'word/document.xml') documentFound = true;
        zip.readEntry();
      });
      zip.on('end', () => {
        if (done) return;
        done = true;
        if (!documentFound) reject(new Error('Invalid DOCX'));
        else resolve();
      });
      zip.readEntry();
    });
  });
}
async function extract() {
  const buffer = Buffer.from(workerData.buffer);
  if (workerData.type === 'docx') {
    await checkDocx(buffer);
    const { default: mammoth } = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer }, { externalFileAccess: false });
    return {
      text: result.value,
      warnings: result.messages.length
        ? ['Algunos elementos del documento no pudieron interpretarse. Revisa el texto.']
        : [],
    };
  }
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer, isEvalSupported: false, verbosity: 0 });
  try {
    const info = await parser.getInfo();
    if (info.total > 30) throw Object.assign(new Error(), { code: 'PAGE_LIMIT' });
    const result = await parser.getText();
    const pages = result.pages || [];
    return {
      text: pages.map((page) => page.text).join('\n\n'),
      warnings: pages.some((page) => !page.text.trim())
        ? ['Hay páginas sin texto extraíble. Revisa si contienen imágenes o información escaneada.']
        : [],
    };
  } finally {
    await parser.destroy();
  }
}
try {
  parentPort.postMessage({ result: await extract() });
} catch (error) {
  parentPort.postMessage({
    error: error.name === 'PasswordException' ? 'PASSWORD' : error.code || 'INVALID_DOCUMENT',
  });
}
