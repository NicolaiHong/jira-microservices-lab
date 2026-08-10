"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../api";

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: listNotifications, refetchInterval: 5000 });
}

export function useNotificationActions() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["notifications"] });
  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  return { markRead, markAllRead };
}
