import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Epic } from "../../types";

vi.mock("../../hooks/useIssues", () => ({
  useCreateEpic: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

import { Roadmap } from "./Roadmap";

const epic: Epic = {
  id: "epic-1",
  projectId: "project-1",
  name: "Readable epic",
  color: "BLUE",
  startDate: "2026-07-01",
  targetDate: "2026-08-01",
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

describe("Archived roadmap", () => {
  it("keeps epics visible and hides creation controls", () => {
    render(
      <Roadmap
        epics={[epic]}
        isProjectWritable={false}
        projectId="project-1"
      />,
    );

    expect(screen.getAllByText("Readable epic")).toHaveLength(2);
    expect(screen.queryByText("Create epic")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Save epic" }),
    ).not.toBeInTheDocument();
  });
});
