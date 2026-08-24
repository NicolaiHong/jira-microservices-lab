import { WorkspaceProjectDashboard } from "@/features/project/components/WorkspaceProjectDashboard";

export default function ProjectsPage() {
  return (
    <section className="flex flex-col gap-7">
      <div>
        <p className="eyebrow">Project command center</p>
        <h1 className="mt-3 font-heading text-4xl font-normal tracking-[-0.045em] sm:text-5xl">Workspaces & projects</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">A considered view of the spaces and projects your team is moving through.</p>
      </div>
      <WorkspaceProjectDashboard />
    </section>
  );
}
