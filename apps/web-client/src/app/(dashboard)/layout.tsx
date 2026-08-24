import type { ReactNode } from "react";

import { AppHeader } from "@/components/shared/AppHeader";
import { MobileNav } from "@/components/shared/MobileNav";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Sidebar } from "@/components/shared/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="min-h-screen md:pl-60">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 pb-20 sm:px-6 md:pb-6 lg:px-8">
            {children}
          </main>
        </div>
        <MobileNav />
      </div>
    </RequireAuth>
  );
}
