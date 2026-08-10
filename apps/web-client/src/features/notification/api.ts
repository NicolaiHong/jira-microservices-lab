import { http } from "@/lib/http";
import type { Notification } from "./types";

export async function listNotifications(): Promise<Notification[]> {
  const { data } = await http.get<{ items: Notification[] }>("/api/notifications");
  return data.items;
}

export async function markNotificationRead(id: string): Promise<void> {
  await http.patch(`/api/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await http.post("/api/notifications/read-all");
}
