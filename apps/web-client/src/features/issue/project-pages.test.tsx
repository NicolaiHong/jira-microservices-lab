import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queries = vi.hoisted(() => ({
  project: { data: { name: "Current project", status: "ACTIVE" }, isPending: false, isError: false, refetch: vi.fn() },
  issues: { data: [], isPending: false, isError: false, refetch: vi.fn() },
  epics: { data: [], isPending: false, isError: false, refetch: vi.fn() },
  sprints: { data: [] as Array<{ id: string; status: string }>, isPending: false, isError: false, isSuccess: true, refetch: vi.fn() },
}));
const issuesCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "project-1" }) }));
vi.mock("@/features/project/hooks/useProjects", () => ({ useProject: () => queries.project }));
vi.mock("@/features/issue/hooks/useIssues", () => ({ useIssues: (...args: unknown[]) => { issuesCalls.push(args); return queries.issues; }, useEpics: () => queries.epics, useSprints: () => queries.sprints }));
vi.mock("@/components/shared/ProjectNavigation", () => ({ ProjectNavigation: () => null }));
vi.mock("@/features/issue/components/Backlog", () => ({ Backlog: () => <p>Loaded backlog</p> }));
vi.mock("@/features/issue/components/Roadmap", () => ({ Roadmap: () => <p>Loaded roadmap</p> }));
vi.mock("@/features/issue/components/Board", () => ({ BoardScreen: () => <p>Loaded board</p> }));
import BacklogPage from "@/app/(dashboard)/projects/[projectId]/backlog/page";
import RoadmapPage from "@/app/(dashboard)/projects/[projectId]/roadmap/page";
import BoardPage from "@/app/(dashboard)/projects/[projectId]/board/page";

afterEach(cleanup);
beforeEach(() => { Object.values(queries).forEach((query) => { query.isError = false; query.refetch.mockReset(); }); });
describe.each([["backlog", BacklogPage], ["roadmap", RoadmapPage], ["board", BoardPage]] as const)("%s page", (name, Page) => {
  it("shows a project error with a retry instead of a blank or misleading read-only page", () => {
    queries.project.isError = true;
    render(<Page />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    expect(screen.queryByText(`Loaded ${name}`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(queries.project.refetch).toHaveBeenCalledOnce();
  });
  it("sets a page title and breadcrumb from the loaded project", () => {
    render(<Page />);
    expect(document.title).toContain("Current project");
    expect(document.title.toLowerCase()).toContain(name);
    expect(screen.getByText("Projects / Current project")).toBeInTheDocument();
  });
});

it("retries a failed epic query on the roadmap", () => {
  queries.epics.isError = true;
  render(<RoadmapPage />);
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(queries.epics.refetch).toHaveBeenCalledOnce();
  expect(queries.project.refetch).not.toHaveBeenCalled();
});

describe("backlog issue loading", () => {
  afterEach(() => {
    queries.sprints.data = [];
    queries.sprints.isSuccess = true;
    issuesCalls.length = 0;
  });

  it("asks the server for the active sprint's issues only", () => {
    queries.sprints.data = [{ id: "sprint-1", status: "COMPLETED" }, { id: "sprint-2", status: "ACTIVE" }];
    render(<BacklogPage />);
    expect(issuesCalls.at(-1)).toEqual(["project-1", { sprintId: "sprint-2" }]);
  });

  it("asks for the whole project list when no sprint is active", () => {
    queries.sprints.data = [{ id: "sprint-1", status: "COMPLETED" }];
    render(<BacklogPage />);
    expect(issuesCalls.at(-1)).toEqual(["project-1", {}]);
  });

  it("waits for the sprint list before loading issues", () => {
    queries.sprints.isSuccess = false;
    render(<BacklogPage />);
    expect(issuesCalls.at(-1)).toEqual([undefined, {}]);
  });
});
