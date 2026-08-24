"use client";

import { ChevronDownIcon, HelpCircleIcon, LogOutIcon, SearchIcon } from "lucide-react";
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
    <header className="sticky top-0 z-20 bg-primary text-primary-foreground shadow-sm">
      <div className="flex h-11 items-center gap-3 px-3 sm:px-5">
        <div className="flex items-center gap-4 text-xs font-medium">
          <span className="font-bold tracking-[0.08em]">ORBIT</span>
          <button className="hidden items-center gap-1 hover:text-white/85 sm:flex" type="button">Your work <ChevronDownIcon className="size-3" /></button>
          <button className="hidden hover:text-white/85 sm:block" type="button">Projects</button>
          <button className="hidden hover:text-white/85 lg:block" type="button">Filters</button>
          <button className="hidden hover:text-white/85 lg:block" type="button">Dashboards</button>
          <button className="hidden hover:text-white/85 lg:block" type="button">People</button>
          <button className="hidden hover:text-white/85 lg:block" type="button">Apps</button>
        </div>
        <div className="relative ml-auto hidden w-full max-w-48 sm:block">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-primary/70" />
          <Input aria-label="Search" className="h-7 border-0 bg-white pl-8 text-[11px] text-foreground placeholder:text-muted-foreground focus-visible:ring-white/65" placeholder="Search" type="search" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <Button aria-label="Help" className="text-white hover:bg-white/15 hover:text-white" size="icon-xs" variant="ghost"><HelpCircleIcon /></Button>
          <div className="flex size-7 items-center justify-center rounded-full bg-[#6554c0] text-[10px] font-bold text-white" title={auth.user?.email}>{initials}</div>
          <Button aria-label="Sign out" className="text-white hover:bg-white/15 hover:text-white" disabled={auth.isLoggingOut} onClick={signOut} size="icon-xs" variant="ghost"><LogOutIcon /></Button>
        </div>
      </div>
    </header>
  );
}
