import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { AuthShell } from "@/components/shared/AuthShell";

export const metadata: Metadata = { title: "Register · Orbit" };

export default function RegisterPage() {
  return <AuthShell><RegisterForm /></AuthShell>;
}
