import { socketClient } from "@/lib/socketClient";

import type { Notification } from "./types";

export function connectNotificationSocket() {
  return socketClient.connect();
}

export function disconnectNotificationSocket() {
  socketClient.disconnect();
}

export function onNotification(callback: (notification: Notification) => void) {
  return socketClient.on<Notification>("notification", callback);
}
