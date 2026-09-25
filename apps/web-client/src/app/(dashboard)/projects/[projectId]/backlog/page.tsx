"use client";

import { QueryError } from "@/components/shared/QueryError";
import { useParams } from "next/navigation";

import { Backlog } from "@/features/issue/components/Backlog";
import { useEpics, useIssues, useSprints } from "@/features/issue/hooks/useIssues";
import { ProjectNavigation } from "@/components/shared/ProjectNavigation";
import { useProject } from "@/features/project/hooks/useProjects";

export default function ProjectBacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const epicsQuery = useEpics(projectId);
  const sprintsQuery = useSprints(projectId);
  const activeSprint = sprintsQuery.data?.find((sprint) => sprint.status === "ACTIVE");
  // The sprint list decides whether the server returns one sprint or the whole project.
  const issuesQuery = useIssues(
    sprintsQuery.isSuccess ? projectId : undefined,
    activeSprint ? { sprintId: activeSprint.id } : {},
  );
  const projectQuery = useProject(projectId);
  const issues = issuesQuery.data ?? [];

  const queries = [issuesQuery, epicsQuery, sprintsQuery, projectQuery];
  const failed = queries.filter((query) => query.isError);

  return (
    <section className="flex flex-col gap-4">
      <title>{`Backlog · ${projectQuery.data?.name ?? "Project"} · Orbit`}</title>
      <div>
        <p className="text-xs text-muted-foreground">Projects / {projectQuery.data?.name ?? "..."}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Backlog</h1>
      </div>
      <ProjectNavigation projectId={projectId} />
      {failed.length ? <QueryError resource="backlog" queries={failed} /> : queries.some((query) => query.isPending) ? (
        <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">
          Loading backlog...
        </p>
      ) : (
        <Backlog
          issues={issues}
          epics={epicsQuery.data ?? []}
          isProjectWritable={projectQuery.data?.status === "ACTIVE"}
          sprints={sprintsQuery.data ?? []}
          projectId={projectId}
        />
      )}
    </section>
  );
}
