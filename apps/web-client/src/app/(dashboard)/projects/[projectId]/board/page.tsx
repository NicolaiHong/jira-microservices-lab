"use client";

import { QueryError } from "@/components/shared/QueryError";
import { useParams } from "next/navigation";

import { BoardScreen } from "@/features/issue/components/Board";
import { ProjectNavigation } from "@/components/shared/ProjectNavigation";
import { useProject } from "@/features/project/hooks/useProjects";

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const projectQuery = useProject(projectId);

  const failed = [projectQuery].filter((query) => query.isError);

  return (
    <section className="flex flex-col gap-4">
      <title>{`Board · ${projectQuery.data?.name ?? "Project"} · Orbit`}</title>
      <div>
        <p className="text-xs text-muted-foreground">Projects / {projectQuery.data?.name ?? "..."}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sprint board</h1>
      </div>
      <ProjectNavigation projectId={projectId} />
      {failed.length ? <QueryError resource="project" onRetry={() => { void projectQuery.refetch(); }} /> : projectQuery.isPending ? <p>Loading project...</p> : <BoardScreen
        isProjectWritable={projectQuery.data?.status === "ACTIVE"}
        projectId={projectId}
      />}
    </section>
  );
}
