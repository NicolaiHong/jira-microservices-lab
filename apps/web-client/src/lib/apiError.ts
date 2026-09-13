import axios from "axios";
import { toast } from "sonner";

export type ApiErrorKind =
  | "unavailable"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "rejected"
  | "unknown";

export function getApiErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  const code = error.response?.data?.code;
  return typeof code === "string" ? code : undefined;
}

export function getApiErrorKind(error: unknown): ApiErrorKind {
  if (!axios.isAxiosError(error)) {
    return "unknown";
  }

  const status = error.response?.status;
  if (!status || status === 502 || status === 503 || status === 504) {
    return "unavailable";
  }
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return status < 500 ? "rejected" : "unknown";
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  const kind = getApiErrorKind(error);

  if (kind === "unavailable") {
    return axios.isAxiosError(error) && error.response
      ? "The service is temporarily unavailable. Try again shortly."
      : "Cannot reach the server. Check your connection and try again.";
  }
  if (kind === "unauthorized") {
    return "Your session has expired. Sign in again.";
  }
  if (kind === "unknown" || !axios.isAxiosError(error)) {
    return fallback;
  }

  // 4xx bodies follow { code, message, details }; VALIDATION_ERROR details map field -> message.
  const { message, details } = error.response?.data ?? {};
  const fieldMessages =
    details && typeof details === "object"
      ? Object.values(details).filter((value): value is string => typeof value === "string")
      : [];

  if (fieldMessages.length) return fieldMessages.join(" ");
  return typeof message === "string" && message ? message : fallback;
}

export function toastApiError(error: unknown, fallback: string) {
  const kind = getApiErrorKind(error);
  const message = getApiErrorMessage(error, fallback);

  // A shared id collapses repeated session/network failures into one toast.
  if (kind === "unauthorized" || kind === "unavailable") {
    toast.error(message, { id: kind });
  } else {
    toast.error(message);
  }
}
