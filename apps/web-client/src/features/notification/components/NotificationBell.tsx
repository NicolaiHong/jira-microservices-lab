import { BellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NotificationBell() {
  return (
    <Button aria-label="Notifications" disabled size="icon" variant="ghost">
      <BellIcon />
    </Button>
  );
}
