import { http } from "@/lib/http";

import type { Notification } from "./types";

/**
 * Lists notifications through the gateway once the notification REST surface exists.
 */
export async function listNotifications(): Promise<Notification[]> {
  const { data } = await http.get<Notification[]>("/api/notifications");
  return data;
}

/**
 * Marks a notification as read through the gateway.
 */
export async function markNotificationRead(id: string): Promise<Notification> {
  const { data } = await http.patch<Notification>(`/api/notifications/${id}`, {
    read: true,
  });

  return data;
}
