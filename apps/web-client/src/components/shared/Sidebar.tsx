import Link from "next/link";
import { ClipboardListIcon, FolderKanbanIcon, InboxIcon } from "lucide-react";

const navigation = [
  { href: "/projects", label: "Projects", icon: FolderKanbanIcon },
  { href: "/projects/demo/board", label: "Board", icon: ClipboardListIcon },
  { href: "/projects/demo/backlog", label: "Backlog", icon: InboxIcon },
];

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-background md:block">
      <div className="flex h-14 items-center border-b px-5">
        <Link className="text-sm font-semibold" href="/projects">
          Polyglot Jira
        </Link>
      </div>
      <nav className="flex flex-col gap-1 p-3">
        {navigation.map((item) => (
          <Link
            className="flex h-9 items-center gap-2 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
