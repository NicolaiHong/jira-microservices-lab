import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Epic, Issue, Sprint } from "../../types";

vi.mock("../../hooks/useIssues", () => ({
  useCompleteSprint: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
  useCreateSprint: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

import { Backlog } from "./Backlog";

const issue: Issue = {
  id: "issue-1",
  projectId: "project-1",
  number: 1,
  key: "CORE-1",
  summary: "Readable issue",
  description: null,
  type: "TASK",
  priority: "MEDIUM",
  status: "TODO",
  reporterUserId: "reporter-1",
  assigneeUserId: null,
  epicId: null,
  sprintId: null,
  version: 1,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

const epic: Epic = {
  id: "epic-1",
  projectId: "project-1",
  name: "Readable epic",
  color: "BLUE",
  startDate: null,
  targetDate: null,
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

const activeSprint: Sprint = {
  id: "sprint-1",
  projectId: "project-1",
  name: "Readable sprint",
  goal: null,
  startDate: null,
  endDate: null,
  status: "ACTIVE",
  createdAt: "2026-08-24T00:00:00.000Z",
  completedAt: null,
};

describe("Archived backlog", () => {
  it("keeps issue and epic reads visible while hiding start and create controls", () => {
    render(
      <Backlog
        epics={[epic]}
        isProjectWritable={false}
        issues={[issue]}
        projectId="project-1"
        sprints={[]}
      />,
    );

    expect(screen.getByText("Readable issue")).toBeInTheDocument();
    expect(screen.getByText("Readable epic")).toBeInTheDocument();
    expect(screen.queryByText("Start sprint")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Create issue/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /\+ Create epic/i }),
    ).not.toBeInTheDocument();
  });

  it("keeps active-sprint reads visible while hiding completion", () => {
    render(
      <Backlog
        epics={[]}
        isProjectWritable={false}
        issues={[{ ...issue, sprintId: activeSprint.id }]}
        projectId="project-1"
        sprints={[activeSprint]}
      />,
    );

    expect(screen.getByText("Readable sprint")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Complete sprint" }),
    ).not.toBeInTheDocument();
  });
});
