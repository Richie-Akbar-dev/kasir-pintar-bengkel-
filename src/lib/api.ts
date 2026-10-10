/** Pembungkus fetch untuk API lokal. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = Omit<RequestInit, 'body'> & { body?: unknown };

async function request<T>(method: string, url: string, options: Options = {}): Promise<T> {
  const { body, headers, ...rest } = options;
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    let message = `Permintaan gagal (${res.status})`;
    if (data && typeof data === 'object' && 'error' in data) {
      const maybeError = (data as { error?: unknown }).error;
      if (typeof maybeError === 'string' && maybeError.trim()) message = maybeError;
    }
    // Sesi kedaluwarsa -> beri tahu aplikasi supaya kembali ke halaman login
    if (res.status === 401) window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export const api = {
  get: <T>(url: string, options?: Options) => request<T>('GET', url, options),
  post: <T>(url: string, body?: unknown, options?: Options) =>
    request<T>('POST', url, { ...options, body }),
  put: <T>(url: string, body?: unknown, options?: Options) =>
    request<T>('PUT', url, { ...options, body }),
  del: <T>(url: string, options?: Options) => request<T>('DELETE', url, options),
};

/** Bangun query string, abaikan nilai kosong. */
export function qs(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === false) continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}
