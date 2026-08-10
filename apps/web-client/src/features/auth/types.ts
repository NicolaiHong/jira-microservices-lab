export interface User {
  id: string;
  userId?: string;
  email: string;
  roles: string[];
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type RegisterPayload = LoginPayload;

export interface AuthResponse {
  accessToken: string;
  refreshToken?: string | null;
  user: User;
}

export interface MeResponse {
  user: User;
}
