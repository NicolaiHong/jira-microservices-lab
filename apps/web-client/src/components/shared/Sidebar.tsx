"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanbanIcon, LayoutListIcon, MapIcon, SettingsIcon, UsersIcon } from "lucide-react";

const navigation = [
  { href: "/projects", label: "Board", icon: FolderKanbanIcon },
  { href: "/projects", label: "Backlog", icon: LayoutListIcon },
  { href: "/projects", label: "Roadmap", icon: MapIcon },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-11 items-center border-b border-border px-4">
        <Link className="brand-mark" href="/projects">
          <span className="flex size-5 items-center justify-center rounded-sm bg-primary text-[9px] text-white">O</span>
          Orbit software
        </Link>
      </div>
      <div className="border-b border-border px-4 py-4">
        <p className="text-sm font-semibold">Orbit Launch</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Software project</p>
      </div>
      <nav className="mt-3 flex flex-col gap-0.5 px-2">
        {navigation.map((item) => (
          <Link
            className={`flex h-8 items-center gap-2 rounded-sm px-2.5 text-xs transition-colors ${pathname.includes(item.label.toLowerCase()) || (item.label === "Board" && pathname === "/projects") ? "bg-secondary font-semibold text-primary" : "text-foreground hover:bg-muted"}`}
            href={pathname.match(/^\/projects\/([^/]+)/) ? `/projects/${pathname.match(/^\/projects\/([^/]+)/)?.[1]}/${item.label.toLowerCase()}` : item.href}
            key={item.label}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 border-t border-border px-4 pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project shortcuts</p>
        <button className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-muted" type="button"><UsersIcon className="size-3.5" /> Releases</button>
        <button className="flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-xs hover:bg-muted" type="button"><SettingsIcon className="size-3.5" /> Project settings</button>
      </div>
    </aside>
  );
}
