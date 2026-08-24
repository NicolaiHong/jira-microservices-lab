"use client";

import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";

import { login, logout } from "../api";
import { useAuthStore } from "../store";
import type { LoginPayload } from "../types";

export function useAuth() {
  const auth = useAuthStore();

  useEffect(() => {
    auth.hydrate();
  }, [auth]);

  const loginMutation = useMutation({
    mutationFn: (payload: LoginPayload) => login(payload),
    onSuccess: (session) => {
      auth.setSession(session);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      auth.clearSession();
    },
  });

  return {
    ...auth,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
  };
}
