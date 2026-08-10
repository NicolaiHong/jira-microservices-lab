"use client";

import { LogOutIcon, SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { NotificationBell } from "@/features/notification/components/NotificationBell";

export function AppHeader() {
  const auth = useAuth();
  const router = useRouter();
  const initials = auth.user?.email.slice(0, 2).toUpperCase() ?? "UI";

  async function signOut() {
    await auth.logout();
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="relative hidden w-full max-w-sm md:block">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search" className="pl-8" placeholder="Search projects and issues" type="search" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground" title={auth.user?.email}>{initials}</div>
          <Button aria-label="Sign out" disabled={auth.isLoggingOut} onClick={signOut} size="icon" variant="ghost"><LogOutIcon /></Button>
        </div>
      </div>
    </header>
  );
}
