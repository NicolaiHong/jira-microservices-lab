import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";

import { useAuthStore } from "@/features/auth/store";
import type { AuthResponse } from "@/features/auth/types";

import { toastApiError } from "./apiError";
import { apiGatewayUrl } from "./http";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export function setupInterceptors(instance: AxiosInstance) {
  let refreshPromise: Promise<AuthResponse> | null = null;

  const refreshSession = () => {
    if (!refreshPromise) {
      refreshPromise = axios
        .post<AuthResponse>(
          `${apiGatewayUrl}/api/auth/refresh`,
          undefined,
          { withCredentials: true },
        )
        .then(({ data }) => {
          useAuthStore.getState().setSession(data);
          return data;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  };

  instance.interceptors.request.use((config) => {
    const token = useAuthStore.getState().accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as
        RetryableRequestConfig | undefined;

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        if (useAuthStore.getState().isAuthenticated) {
          try {
            const data = await refreshSession();
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

            return instance(originalRequest);
          } catch {
            useAuthStore.getState().clearSession();
            toastApiError(error, "");
          }
        } else {
          useAuthStore.getState().clearSession();
        }
      }

      return Promise.reject(error);
    },
  );
}
