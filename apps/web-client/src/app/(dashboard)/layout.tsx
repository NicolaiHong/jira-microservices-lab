import type { ReactNode } from "react";

import { AppHeader } from "@/components/shared/AppHeader";
import { RequireAuth } from "@/components/shared/RequireAuth";
import { Sidebar } from "@/components/shared/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-muted/30">
        <Sidebar />
        <div className="min-h-screen md:pl-64">
          <AppHeader />
          <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
