import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issues: { data: [], isPending: false, isError: false, refetch: vi.fn() },
  create: vi.fn(),
}));
vi.mock("../../hooks/useIssues", () => ({
  useIssues: () => mocks.issues,
  useEpics: () => ({ data: [] }),
  useSprints: () => ({ data: [] }),
  useCreateIssue: () => ({ mutateAsync: mocks.create, isPending: false }),
  useTransitionIssue: () => ({ mutate: vi.fn(), isPending: false }),
}));
import { BoardScreen } from "./BoardScreen";

afterEach(cleanup);
beforeEach(() => { mocks.issues.isError = false; mocks.create.mockReset(); mocks.issues.refetch.mockReset(); });

it("shows a retryable error instead of an empty board after a query failure", () => {
  mocks.issues.isError = true;
  render(<BoardScreen projectId="project-1" isProjectWritable />);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load board");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(mocks.issues.refetch).toHaveBeenCalledOnce();
  expect(screen.queryByText("No issues match this view")).not.toBeInTheDocument();
});

it("opens the actual issue form from the board and submits to the project mutation", async () => {
  mocks.create.mockResolvedValue({ id: "created" });
  render(<BoardScreen projectId="project-1" isProjectWritable />);
  fireEvent.click(screen.getAllByRole("button", { name: "Create issue" })[0]);
  const form = screen.getByRole("complementary", { name: "Create issue" });
  fireEvent.change(within(form).getByLabelText("Summary"), { target: { value: "New issue" } });
  fireEvent.submit(form.querySelector("form")!);
  await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ summary: "New issue", type: "TASK", priority: "MEDIUM" })));
  await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument());
});
