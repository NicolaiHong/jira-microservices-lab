import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const project = vi.hoisted(() => ({ data: { name: "Actual project", status: "ACTIVE" } }));
vi.mock("next/navigation", () => ({ useParams: () => ({ projectId: "project-1" }) }));
vi.mock("@/features/project/hooks/useProjects", () => ({ useProject: () => project }));
vi.mock("@/features/issue/components/Board", () => ({ BoardScreen: () => null }));
vi.mock("@/components/shared/ProjectNavigation", () => ({ ProjectNavigation: () => null }));
import ProjectBoardPage from "./page";

afterEach(cleanup);
it("uses the loaded project name in its breadcrumb", () => {
  render(<ProjectBoardPage />);
  expect(screen.getByText("Projects / Actual project")).toBeInTheDocument();
});
