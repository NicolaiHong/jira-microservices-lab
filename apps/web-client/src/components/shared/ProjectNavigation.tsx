"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const projectViews = [
  { label: "Board", suffix: "/board" },
  { label: "Backlog", suffix: "/backlog" },
  { label: "Roadmap", suffix: "/roadmap" },
];

export function ProjectNavigation({ projectId }: { projectId: string }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project views" className="flex items-center gap-1 border-b border-border">
      {projectViews.map((view) => {
        const href = `/projects/${projectId}${view.suffix}`;
        const active = pathname === href;
        return (
          <Link className={`border-b-2 px-3 py-2 text-sm ${active ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"}`} href={href} key={view.label}>
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
