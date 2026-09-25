import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Issue } from "../../types";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../hooks/useIssues", () => ({
  useCompleteSprint: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCreateSprint: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

import { Backlog } from "./Backlog";

afterEach(cleanup);

function makeIssue(id: string, assigneeUserId: string | null, sprintId: string | null = null): Issue {
  return {
    id,
    projectId: "project-1",
    number: 1,
    key: "CORE-1",
    summary: "Plan the next sprint",
    description: null,
    type: "TASK",
    priority: "MEDIUM",
    status: "TODO",
    reporterUserId: "reporter-1",
    assigneeUserId,
    epicId: null,
    sprintId,
    version: 1,
    createdAt: "2026-08-24T00:00:00.000Z",
    updatedAt: "2026-08-24T00:00:00.000Z",
  };
}

describe("Backlog", () => {
  it("shows assigned and unassigned users without invented initials", () => {
    render(
      <Backlog
        epics={[]}
        isProjectWritable={false}
        issues={[makeIssue("issue-assigned", "member-2"), makeIssue("issue-unassigned", null)]}
        projectId="project-1"
        sprints={[]}
      />,
    );

    expect(screen.getByRole("img", { name: "Assignee member-2" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Unassigned" })).toBeInTheDocument();
    expect(screen.queryByText("AM")).not.toBeInTheDocument();
  });

  it("renders the server-filtered sprint list as given and counts every issue", () => {
    render(
      <Backlog
        epics={[]}
        isProjectWritable={false}
        issues={[makeIssue("issue-1", null, "sprint-1"), makeIssue("issue-2", null, null)]}
        projectId="project-1"
        sprints={[{
          id: "sprint-1",
          projectId: "project-1",
          name: "Sprint 1",
          goal: null,
          startDate: null,
          endDate: null,
          status: "ACTIVE",
          createdAt: "2026-08-24T00:00:00.000Z",
          completedAt: null,
        }]}
      />,
    );

    expect(screen.getAllByRole("link", { name: "Plan the next sprint" })).toHaveLength(2);
    expect(screen.getByText(/2 issues/)).toBeInTheDocument();
  });
});
