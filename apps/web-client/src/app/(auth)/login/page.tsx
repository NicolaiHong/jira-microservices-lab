"use client";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { AuthShell } from "@/components/shared/AuthShell";

export default function LoginPage() {
  return <AuthShell><LoginForm /></AuthShell>;
}
