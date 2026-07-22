export function getAuthToken(): string | null {
  return localStorage.getItem("maratona_token");
}

export const customFetch = async <T>(url: string, options?: RequestInit): Promise<T> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw { status: response.status, message: error.error ?? error.message ?? "Erro desconhecido" };
  }
  if (response.status === 204) return undefined as T;
  return response.json();
};

export type ErrorType<T> = T & { status?: number; message?: string };
