import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { AuthShell } from "@/components/shared/AuthShell";

export default function RegisterPage() {
  return <AuthShell><RegisterForm /></AuthShell>;
}
