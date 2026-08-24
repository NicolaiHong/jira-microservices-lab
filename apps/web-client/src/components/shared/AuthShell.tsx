import type { ReactNode } from "react";
import { ArrowUpRightIcon, CircleIcon } from "lucide-react";
import Link from "next/link";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-shell min-h-screen px-4 py-4 sm:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl overflow-hidden border border-foreground/15 bg-background shadow-[0_24px_80px_rgba(25,25,24,0.12)] sm:min-h-[calc(100vh-3rem)] lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.68fr)]">
        <section className="relative flex min-h-[540px] flex-col justify-between overflow-hidden border-b border-foreground/15 p-7 sm:p-10 lg:border-b-0 lg:border-r lg:p-12">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(250,250,248,0.90),rgba(250,250,248,0.72)),url('/paisley-monochrome.png')] bg-cover bg-center opacity-70" />
          <div className="relative z-10 flex items-center justify-between">
            <Link className="brand-mark" href="/projects">
              <CircleIcon aria-hidden className="size-3 fill-current" />
              POLYGLOT
            </Link>
            <span className="hidden text-[10px] font-semibold tracking-[0.24em] text-muted-foreground sm:block">
              WORKSPACE SYSTEM
            </span>
          </div>

          <div className="relative z-10 max-w-md">
            <p className="eyebrow">Intentional work, clearly arranged</p>
            <h1 className="mt-5 font-heading text-5xl leading-[0.94] tracking-[-0.055em] text-foreground sm:text-6xl">
              Make the work feel considered.
            </h1>
            <p className="mt-6 max-w-sm text-sm leading-6 text-foreground/70">
              A quiet command center for the projects, decisions, and details that move your team forward.
            </p>
          </div>

          <p className="relative z-10 flex items-center gap-2 text-xs font-medium text-foreground/65">
            <ArrowUpRightIcon aria-hidden className="size-3.5" />
            Built for focused collaboration
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-14">
          {children}
        </section>
      </div>
    </main>
  );
}
