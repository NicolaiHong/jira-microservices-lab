"use client";

import { ProjectList } from "@/features/project/components/ProjectList";
import { useProjects } from "@/features/project/hooks/useProjects";

export default function ProjectsPage() {
  const projectsQuery = useProjects();
  const projects = projectsQuery.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Gateway-backed project context for the workspace.
        </p>
      </div>
      {projectsQuery.isPending ? (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          Loading projects...
        </p>
      ) : projectsQuery.isError ? (
        <p className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
          Project API placeholder could not load data yet.
        </p>
      ) : (
        <ProjectList projects={projects} />
      )}
    </section>
  );
}
