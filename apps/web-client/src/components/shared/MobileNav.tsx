"use client";

import Link from "next/link";
import { FolderKanbanIcon, LayoutListIcon, MapIcon } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { label: "Board", icon: FolderKanbanIcon, suffix: "/board" },
  { label: "Backlog", icon: LayoutListIcon, suffix: "/backlog" },
  { label: "Roadmap", icon: MapIcon, suffix: "/roadmap" },
];

function projectPath(pathname: string, suffix: string) {
  const match = pathname.match(/^\/projects\/([^/]+)/);
  return match ? `/projects/${match[1]}${suffix}` : "/projects";
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Project navigation" className="fixed inset-x-0 bottom-0 z-40 flex h-15 border-t border-border bg-background px-3 md:hidden">
      {items.map((item) => {
        const active = pathname.endsWith(item.suffix);
        return (
          <Link className={`flex flex-1 flex-col items-center justify-center gap-1 text-[10px] ${active ? "font-semibold text-primary" : "text-muted-foreground"}`} href={projectPath(pathname, item.suffix)} key={item.label}>
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
