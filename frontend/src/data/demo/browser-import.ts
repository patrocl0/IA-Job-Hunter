export async function extractCv(file: File): Promise<{ text: string; warnings: string[] }> {
  const buffer = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./import-worker.ts', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('La extracción tardó demasiado. Prueba un archivo más sencillo.'));
    }, 30000);
    const cleanup = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    worker.onmessage = (e) => {
      cleanup();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    worker.onerror = () => {
      cleanup();
      reject(
        new Error('No se pudo procesar el archivo en este navegador. Puedes pegar el CV en texto.'),
      );
    };
    worker.postMessage({ buffer, name: file.name }, [buffer]);
  });
}
