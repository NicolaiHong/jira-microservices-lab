import { BellIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="relative hidden w-full max-w-sm md:block">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search"
            className="pl-8"
            placeholder="Search projects and issues"
            type="search"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button aria-label="Notifications" size="icon" variant="ghost">
            <BellIcon />
          </Button>
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            UI
          </div>
        </div>
      </div>
    </header>
  );
}
