"use client";

import Link from "next/link";
import { useState } from "react";
import { BellIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationActions, useNotifications } from "../hooks/useNotifications";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifications = useNotifications();
  const actions = useNotificationActions();
  const unread = notifications.data?.filter((item) => !item.readAt).length ?? 0;

  return (
    <div className="relative">
      <Button aria-label="Notifications" onClick={() => setOpen((value) => !value)} size="icon" variant="ghost">
        <BellIcon />
        {unread > 0 ? <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">{Math.min(unread, 9)}</span> : null}
      </Button>
      {open ? (
        <div className="absolute right-0 top-10 z-50 w-[min(380px,calc(100vw-2rem))] rounded-xl border bg-popover p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Notifications</p>
            <Button disabled={unread === 0 || actions.markAllRead.isPending} onClick={() => actions.markAllRead.mutate()} size="xs" variant="ghost">Mark all read</Button>
          </div>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {notifications.data?.map((item) => (
              <Link
                className={`block rounded-lg p-3 text-sm hover:bg-muted ${item.readAt ? "opacity-60" : "bg-muted/60"}`}
                href={`/projects/${item.projectId}/issues/${item.issueId}`}
                key={item.id}
                onClick={() => { if (!item.readAt) actions.markRead.mutate(item.id); setOpen(false); }}
              >
                <p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.body}</p>
              </Link>
            ))}
            {notifications.data?.length === 0 ? <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
