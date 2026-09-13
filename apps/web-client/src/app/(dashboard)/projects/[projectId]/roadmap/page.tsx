"use client";

import { QueryError } from "@/components/shared/QueryError";
import { useParams } from "next/navigation";
import { ProjectNavigation } from "@/components/shared/ProjectNavigation";
import { Roadmap } from "@/features/issue/components/Roadmap";
import { useEpics } from "@/features/issue/hooks/useIssues";
import { useProject } from "@/features/project/hooks/useProjects";

export default function ProjectRoadmapPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const epicsQuery = useEpics(projectId);
  const projectQuery = useProject(projectId);

  const failed = [epicsQuery, projectQuery].filter((query) => query.isError);

  return (
    <section className="flex flex-col gap-4">
      <title>{`Roadmap · ${projectQuery.data?.name ?? "Project"} · Orbit`}</title>
      <div><p className="text-xs text-muted-foreground">Projects / {projectQuery.data?.name ?? "..."}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Roadmap</h1></div>
      <ProjectNavigation projectId={projectId} />
      {failed.length ? <QueryError resource="roadmap" queries={failed} /> : epicsQuery.isPending || projectQuery.isPending ? <p>Loading roadmap...</p> : <Roadmap
        epics={epicsQuery.data ?? []}
        isProjectWritable={projectQuery.data?.status === "ACTIVE"}
        projectId={projectId}
      />}
    </section>
  );
}
