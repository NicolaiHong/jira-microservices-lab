"use client";

import { useQuery } from "@tanstack/react-query";

import { listNotifications } from "../api";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: listNotifications,
  });
}
