"use client";

import { useParams } from "next/navigation";

import { Backlog } from "@/features/issue/components/Backlog";
import { useIssues } from "@/features/issue/hooks/useIssues";

export default function ProjectBacklogPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const issuesQuery = useIssues(projectId);
  const issues = issuesQuery.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Backlog</h1>
        <p className="text-sm text-muted-foreground">Project {projectId}</p>
      </div>
      {issuesQuery.isPending ? (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          Loading backlog...
        </p>
      ) : (
        <Backlog
          issues={issuesQuery.isError ? [] : issues}
          projectId={projectId}
        />
      )}
    </section>
  );
}
