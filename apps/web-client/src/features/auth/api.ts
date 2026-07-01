import { http } from "@/lib/http";

import type { AuthResponse, LoginPayload, MeResponse, User } from "./types";

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>("/api/auth/login", payload);
  return data;
}

export async function logout(): Promise<void> {
  await http.post("/api/auth/logout");
}

export async function refreshToken(token: string): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>("/api/auth/refresh", {
    refreshToken: token,
  });

  return data;
}

export async function me(): Promise<User> {
  const { data } = await http.get<MeResponse>("/api/auth/me");
  return data.user;
}
