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

function makeIssue(id: string, assigneeUserId: string | null): Issue {
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
    sprintId: null,
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
});
