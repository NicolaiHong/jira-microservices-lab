import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Issue, IssueStatus } from "../../types";

const transitionMocks = vi.hoisted(() => ({
  mutate: vi.fn(),
}));
const issueApiMocks = vi.hoisted(() => ({
  getIssueErrorCode: vi.fn(),
}));
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("../../api", () => ({
  getIssueErrorCode: issueApiMocks.getIssueErrorCode,
}));

vi.mock("../../hooks/useIssues", () => ({
  useTransitionIssue: () => ({
    isPending: false,
    mutate: transitionMocks.mutate,
  }),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

import { Board } from "./Board";

function makeIssue(
  id: string,
  status: IssueStatus,
  version: number,
): Issue {
  return {
    id,
    projectId: "project-1",
    number: version,
    key: "CORE-" + version,
    summary: "Issue " + version,
    description: null,
    type: "TASK",
    priority: "MEDIUM",
    status,
    reporterUserId: "reporter-1",
    assigneeUserId: null,
    epicId: null,
    sprintId: null,
    version,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
}

function renderBoard(
  issues: Issue[],
  isProjectWritable = true,
  onCreateIssue = vi.fn(),
) {
  return render(
    <Board
      isProjectWritable={isProjectWritable}
      issues={issues}
      onCreateIssue={onCreateIssue}
      projectId="project-1"
    />,
  );
}

describe("Issue board transitions", () => {
  afterEach(cleanup);

  beforeEach(() => {
    transitionMocks.mutate.mockReset();
    issueApiMocks.getIssueErrorCode.mockReset();
    toastMocks.error.mockReset();
  });

  it("offers and sends every valid board move with the rendered version", () => {
    renderBoard([
      makeIssue("issue-todo", "TODO", 1),
      makeIssue("issue-progress", "IN_PROGRESS", 2),
      makeIssue("issue-done", "DONE", 3),
    ]);

    fireEvent.click(
      screen.getByRole("button", { name: "Move CORE-1 to In progress" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Move CORE-2 to To do" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Move CORE-2 to Done" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Move CORE-3 to In progress" }),
    );

    expect(transitionMocks.mutate).toHaveBeenNthCalledWith(
      1,
      {
        issueId: "issue-todo",
        status: "IN_PROGRESS",
        expectedVersion: 1,
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(transitionMocks.mutate).toHaveBeenNthCalledWith(
      2,
      {
        issueId: "issue-progress",
        status: "TODO",
        expectedVersion: 2,
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(transitionMocks.mutate).toHaveBeenNthCalledWith(
      3,
      {
        issueId: "issue-progress",
        status: "DONE",
        expectedVersion: 2,
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
    expect(transitionMocks.mutate).toHaveBeenNthCalledWith(
      4,
      {
        issueId: "issue-done",
        status: "IN_PROGRESS",
        expectedVersion: 3,
      },
      expect.objectContaining({ onError: expect.any(Function) }),
    );
  });

  it("does not offer invalid or same-state movement controls", () => {
    renderBoard([
      makeIssue("issue-todo", "TODO", 1),
      makeIssue("issue-progress", "IN_PROGRESS", 2),
      makeIssue("issue-done", "DONE", 3),
    ]);

    expect(
      screen.getAllByRole("button", { name: /^Move / }).map((button) =>
        button.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Move CORE-1 to In progress",
      "Move CORE-2 to To do",
      "Move CORE-2 to Done",
      "Move CORE-3 to In progress",
    ]);
  });

  it.each([
    ["CONCURRENT_ISSUE_MODIFICATION", "Latest Issue data was reloaded."],
    [
      "INVALID_ISSUE_TRANSITION",
      "Action is no longer valid. Latest Issue data was reloaded.",
    ],
    ["PROJECT_ARCHIVED", "Project is read-only."],
    [undefined, "Could not move the issue. Check your connection and try again."],
  ])(
    "keeps the rendered status and displays feedback after a %s failure",
    (code, message) => {
      issueApiMocks.getIssueErrorCode.mockReturnValue(code);
      transitionMocks.mutate.mockImplementation(
        (
          _variables,
          callbacks?: { onError?: (error: unknown) => void },
        ) => {
          callbacks?.onError?.(new Error("transition failed"));
        },
      );
      renderBoard([makeIssue("issue-todo", "TODO", 1)]);

      fireEvent.click(
        screen.getByRole("button", { name: "Move CORE-1 to In progress" }),
      );

      expect(toastMocks.error).toHaveBeenCalledWith(message);
      expect(
        screen.getByRole("button", { name: "Move CORE-1 to In progress" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Move CORE-1 to Done" }),
      ).not.toBeInTheDocument();
    },
  );

  it("keeps issue reads visible and hides create and transition controls for an archived project", () => {
    renderBoard([makeIssue("issue-todo", "TODO", 1)], false);

    expect(screen.getByText("Issue 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create issue" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^Move / }),
    ).not.toBeInTheDocument();
  });
});
