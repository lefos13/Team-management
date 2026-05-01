/* Centralize API calls and error extraction so every page handles server failures the same way. */
import axios from "axios";

const defaultApiBaseUrl = `${import.meta.env.BASE_URL}api`;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl,
  withCredentials: true,
});

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl}${normalizedPath}`;
}

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export function getErrorMessage(error: unknown, fallback = "Something went wrong.") {
  if (axios.isAxiosError<ApiErrorPayload>(error)) {
    return error.response?.data?.error?.message ?? fallback;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
