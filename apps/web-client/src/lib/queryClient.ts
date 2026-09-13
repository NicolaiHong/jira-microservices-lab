import { QueryClient } from "@tanstack/react-query";

import { getApiErrorKind } from "./apiError";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 4xx answers (auth, access, validation) will not change on an immediate retry.
        retry: (failureCount, error) => {
          const kind = getApiErrorKind(error);
          return failureCount < 1 && (kind === "unavailable" || kind === "unknown");
        },
        staleTime: 30_000,
      },
    },
  });
}
