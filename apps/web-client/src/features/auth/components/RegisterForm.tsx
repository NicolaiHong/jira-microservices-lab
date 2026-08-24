"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { register } from "../api";

export function RegisterForm() {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    try {
      await register({ email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") });
      toast.success("Account created", { description: "Sign in to continue." });
      router.push("/login");
    } catch { toast.error("Could not create account"); }
    finally { setPending(false); }
  }

  return (
    <Card className="auth-card w-full max-w-sm border-0 bg-transparent p-0 shadow-none ring-0">
      <CardHeader><p className="eyebrow">Begin a new workspace</p><CardTitle className="mt-2 text-4xl font-normal tracking-[-0.045em]">Create account</CardTitle><CardDescription>Bring your projects into one considered place.</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="email">Email</label><Input id="email" name="email" type="email" required /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium" htmlFor="password">Password</label><Input id="password" minLength={8} name="password" type="password" required /></div>
          <Button className="mt-2 w-full" disabled={pending} type="submit">{pending ? "Creating…" : "Create account"}</Button>
          <p className="text-center text-sm text-muted-foreground">Already registered? <Link className="font-semibold text-foreground underline decoration-foreground/35 underline-offset-4 hover:decoration-foreground" href="/login">Sign in</Link></p>
        </form>
      </CardContent>
    </Card>
  );
}
