export const isPublicDemo = import.meta.env.MODE === 'demo';
let demoRequest: typeof fetch | undefined;
export async function requestResponse(url: string, init?: RequestInit): Promise<Response> {
  if (isPublicDemo) {
    if (!demoRequest) {
      const { createDemoApi } = await import('@/data/demo/demo-store.mjs');
      demoRequest = createDemoApi({
        getItem: (key: string) => localStorage.getItem(key),
        setItem: (key: string, value: string) => localStorage.setItem(key, value),
      }) as typeof fetch;
    }
    return demoRequest(url, init);
  }
  const headers = new Headers(init?.headers);
  headers.set('X-Job-Hunter', '1');
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: 'same-origin',
    signal: init?.signal ?? AbortSignal.timeout(65000),
  });
  if (
    response.status === 401 &&
    !['/api/auth/login', '/api/auth/register', '/api/auth/session'].includes(url.split('?')[0])
  )
    window.dispatchEvent(new Event('jobhunter:session-expired'));
  return response;
}
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await requestResponse(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body =
    response.status === 204
      ? null
      : await response.json().catch(() => ({
          error: 'No se recibió una respuesta válida. Comprueba que la API esté disponible.',
        }));
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la solicitud.');
  return body as T;
}
export async function resetDemo() {
  if (!window.confirm('¿Eliminar los datos de esta demo en este navegador?')) return;
  try {
    const { STORAGE_KEY } = await import('@/data/demo/demo-store.mjs');
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  } catch {
    window.alert('El navegador bloquea el almacenamiento.');
  }
}
