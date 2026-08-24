import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mutate = vi.fn();

vi.mock("../../hooks/useIssues", () => ({
  useTransitionIssue: () => ({ isPending: false, mutate }),
}));

import { Board } from "./Board";

describe("Issue board transitions", () => {
  it("sends the version of the rendered card without retrying it", () => {
    mutate.mockReset();
    render(
      <Board
        projectId="project-1"
        onCreateIssue={() => undefined}
        issues={[
          {
            id: "issue-1",
            projectId: "project-1",
            number: 1,
            key: "CORE-1",
            summary: "Move me",
            description: null,
            type: "TASK",
            priority: "MEDIUM",
            status: "TODO",
            reporterUserId: "reporter-1",
            assigneeUserId: null,
            epicId: null,
            sprintId: null,
            version: 11,
            createdAt: "2026-08-24T00:00:00.000Z",
            updatedAt: "2026-08-24T00:00:00.000Z",
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByLabelText("Move right"));
    expect(mutate).toHaveBeenCalledWith({
      issueId: "issue-1",
      status: "IN_PROGRESS",
      expectedVersion: 11,
    });
  });
});
