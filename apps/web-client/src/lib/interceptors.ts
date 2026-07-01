import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from "axios";
import { toast } from "sonner";

import { useAuthStore } from "@/features/auth/store";
import type { AuthResponse } from "@/features/auth/types";

import { apiGatewayUrl } from "./http";

interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

export function setupInterceptors(instance: AxiosInstance) {
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

      if (!error.response && typeof window !== "undefined") {
        toast.error("Network request failed", {
          description: "Check that the API gateway is running.",
        });
      }

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        const refreshToken = useAuthStore.getState().refreshToken;

        if (refreshToken) {
          try {
            const { data } = await axios.post<AuthResponse>(
              `${apiGatewayUrl}/api/auth/refresh`,
              { refreshToken },
            );

            useAuthStore.getState().setSession(data);
            originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

            return instance(originalRequest);
          } catch {
            useAuthStore.getState().clearSession();
          }
        } else {
          useAuthStore.getState().clearSession();
        }
      }

      return Promise.reject(error);
    },
  );
}
