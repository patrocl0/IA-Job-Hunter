export type ImportedCv = { text: string; warnings: string[] };
export const CV_RESULT = 'job-hunter:cv-result';

export function validateImportedCv(value: unknown): ImportedCv {
  const data = value as Partial<ImportedCv> | null;
  if (
    !data ||
    typeof data.text !== 'string' ||
    !data.text.trim() ||
    !Array.isArray(data.warnings) ||
    !data.warnings.every((warning) => typeof warning === 'string')
  ) {
    throw new Error('La extracción no devolvió un texto válido. Intenta con otro PDF o DOCX.');
  }
  return { text: data.text, warnings: data.warnings };
}

// PDF.js can emit internal worker messages before the document result.
export function readCvMessage(value: unknown): ImportedCv | null {
  const data = value as { type?: string; error?: unknown; result?: unknown } | null;
  if (!data || data.type !== CV_RESULT) return null;
  if (typeof data.error === 'string') throw new Error(data.error);
  return validateImportedCv(data.result);
}
