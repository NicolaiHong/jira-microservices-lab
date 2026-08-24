"use client";

import { useParams } from "next/navigation";
import { ProjectNavigation } from "@/components/shared/ProjectNavigation";
import { Roadmap } from "@/features/issue/components/Roadmap";
import { useEpics } from "@/features/issue/hooks/useIssues";

export default function ProjectRoadmapPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const epicsQuery = useEpics(projectId);

  return (
    <section className="flex flex-col gap-4">
      <div><p className="text-xs text-muted-foreground">Projects / Orbit Launch</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">Roadmap</h1></div>
      <ProjectNavigation projectId={projectId} />
      <Roadmap projectId={projectId} epics={epicsQuery.data ?? []} />
    </section>
  );
}
