"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useAuth } from "../hooks/useAuth";

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (auth.isHydrated && auth.isAuthenticated) {
      router.replace("/projects");
    }
  }, [auth.isAuthenticated, auth.isHydrated, router]);

  async function onSubmit(values: LoginFormValues) {
    try {
      await auth.login(values);
      router.push("/projects");
    } catch {
      toast.error("Unable to sign in", {
        description: "Check your credentials and try again.",
      });
    }
  }

  return (
    <Card className="auth-card w-full max-w-sm border-0 bg-transparent p-0 shadow-none ring-0">
      <CardHeader>
        <p className="eyebrow">Welcome back</p>
        <CardTitle className="mt-2 text-4xl font-normal tracking-[-0.045em]">Sign in</CardTitle>
        <CardDescription>
          Pick up where the important work left off.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(form.formState.errors.email)}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-invalid={Boolean(form.formState.errors.password)}
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.password.message}
              </p>
            ) : null}
          </div>
          <Button className="mt-2 w-full" disabled={auth.isLoggingIn} type="submit">
            {auth.isLoggingIn ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here? <Link className="font-semibold text-foreground underline decoration-foreground/35 underline-offset-4 hover:decoration-foreground" href="/register">Create an account</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
