import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getIssue: vi.fn(), listIssues: vi.fn() }));
vi.mock("../api", () => api);
import { useIssue } from "./useIssue";
import { useIssues } from "./useIssues";

afterEach(cleanup);
it("keeps detail and project list caches isolated even when their UUIDs match", async () => {
  api.getIssue.mockResolvedValue({ id: "same-uuid", summary: "Details" });
  api.listIssues.mockResolvedValue([{ id: "other-issue" }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => ({ detail: useIssue("same-uuid"), list: useIssues("same-uuid") }), { wrapper });
  await waitFor(() => expect(result.current.detail.isSuccess && result.current.list.isSuccess).toBe(true));
  expect(result.current.detail.data).toEqual({ id: "same-uuid", summary: "Details" });
  expect(result.current.list.data).toEqual([{ id: "other-issue" }]);
  await act(() => client.invalidateQueries({ queryKey: ["issues", "list", "same-uuid"] }));
  expect(api.getIssue).toHaveBeenCalledTimes(1);
  expect(api.listIssues).toHaveBeenCalledTimes(2);
});
