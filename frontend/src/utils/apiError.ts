import axios from 'axios';

type ApiErrorBody = { error?: string | { detail?: string }; message?: string; detail?: string };

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const body = error.response?.data;
    const message = (typeof body?.error === 'object' ? body.error.detail : body?.error) || body?.message || body?.detail;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export function apiErrorStatus(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}
