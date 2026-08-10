import { http } from "@/lib/http";

import type { AuthResponse, LoginPayload, MeResponse, RegisterPayload, User } from "./types";

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await http.post<{ user: User }>("/api/auth/register", payload);
  return data.user;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>("/api/auth/login", payload);
  return data;
}

export async function logout(refreshToken: string | null): Promise<void> {
  if (refreshToken) {
    await http.post("/api/auth/logout", { refreshToken });
  }
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
