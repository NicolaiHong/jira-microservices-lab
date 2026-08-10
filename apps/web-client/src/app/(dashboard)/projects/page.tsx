import { WorkspaceProjectDashboard } from "@/features/project/components/WorkspaceProjectDashboard";

export default function ProjectsPage() {
  return (
    <section className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Project command center</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Workspaces & projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everything here talks to the system through the API Gateway.</p>
      </div>
      <WorkspaceProjectDashboard />
    </section>
  );
}
