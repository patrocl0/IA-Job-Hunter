import { CV_RESULT } from './import-protocol';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth/mammoth.browser';
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; name: string }>) => {
  try {
    let text = '';
    const warnings: string[] = [];
    if (event.data.name.toLowerCase().endsWith('.pdf')) {
      const doc = await pdfjs.getDocument({
        data: new Uint8Array(event.data.buffer),
        isEvalSupported: false,
      }).promise;
      try {
        if (doc.numPages > 30) throw new Error('Máximo 30 páginas.');
        for (let p = 1; p <= doc.numPages; p++) {
          const page = await doc.getPage(p);
          const content = await page.getTextContent();
          text +=
            content.items
              .map((i) => ('str' in i ? i.str + ('hasEOL' in i && i.hasEOL ? '\n' : ' ') : ''))
              .join('') + '\n\n';
          if (text.length > 100000) throw new Error('El documento contiene demasiado texto.');
        }
      } finally {
        await doc.destroy();
      }
      warnings.push('Comprueba el orden de las columnas y los saltos de línea. No se realiza OCR.');
    } else {
      const result = await mammoth.extractRawText({ arrayBuffer: event.data.buffer });
      text = result.value;
      warnings.push('Comprueba el orden y el contenido extraído del DOCX.');
    }
    text = text.trim();
    if (!text)
      throw new Error('No se encontró texto. Prueba un PDF con texto seleccionable o un DOCX.');
    if (text.length > 100000) throw new Error('El documento contiene demasiado texto.');
    self.postMessage({ type: CV_RESULT, result: { text, warnings } });
  } catch (e) {
    self.postMessage({
      type: CV_RESULT,
      error: e instanceof Error ? e.message : 'No se pudo leer el documento.',
    });
  }
};
