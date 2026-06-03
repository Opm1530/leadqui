// Cliente HTTP centralizado para a API do Pequi Digital
// Envia o JWT automaticamente em todas as requisições autenticadas

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const getToken = () => localStorage.getItem("pequi_token");

const request = async (path: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
};

export const api = {
  get: (path: string) => request(path),
  post: (path: string, data: any) =>
    request(path, { method: "POST", body: JSON.stringify(data) }),
  put: (path: string, data: any) =>
    request(path, { method: "PUT", body: JSON.stringify(data) }),
  patch: (path: string, data: any) =>
    request(path, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};

export default api;
