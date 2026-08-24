"use client";

import { FormEvent, useState } from "react";
import { ArrowUpRightIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProjectList } from "./ProjectList";
import {
  useCreateProject,
  useCreateWorkspace,
  useProjects,
  useWorkspaces,
} from "../hooks/useProjects";

export function WorkspaceProjectDashboard() {
  const workspaces = useWorkspaces();
  const [workspaceId, setWorkspaceId] = useState<string>();
  const activeWorkspaceId = workspaceId ?? workspaces.data?.[0]?.id;
  const activeWorkspace = workspaces.data?.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );
  const canManageProjects =
    activeWorkspace?.role === "OWNER" || activeWorkspace?.role === "ADMIN";
  const projects = useProjects(activeWorkspaceId);
  const createWorkspace = useCreateWorkspace();
  const createProject = useCreateProject(activeWorkspaceId);

  async function submitWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const workspace = await createWorkspace.mutateAsync({
        name: String(form.get("name") ?? ""),
        slug: String(form.get("slug") ?? ""),
      });
      setWorkspaceId(workspace.id);
      formElement.reset();
      toast.success("Workspace created");
    } catch {
      toast.error("Could not create workspace");
    }
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await createProject.mutateAsync({
        name: String(form.get("name") ?? ""),
        key: String(form.get("key") ?? ""),
        description: String(form.get("description") ?? ""),
      });
      formElement.reset();
      toast.success("Project created");
    } catch {
      toast.error("Could not create project");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
      <aside className="space-y-5">
        <Card className="border-foreground/15 bg-background/80">
          <CardHeader><p className="eyebrow">Your spaces</p><CardTitle className="mt-1">Workspaces</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {workspaces.isPending ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            {workspaces.data?.map((workspace) => (
              <button
                className={`w-full border px-3 py-3 text-left text-sm transition-all ${workspace.id === activeWorkspaceId ? "border-primary bg-primary text-primary-foreground shadow-[3px_3px_0_rgb(0_0_0/0.16)]" : "border-foreground/12 bg-background/55 hover:border-foreground hover:bg-background"}`}
                key={workspace.id}
                onClick={() => setWorkspaceId(workspace.id)}
                type="button"
              >
                <span className="block font-medium">{workspace.name}</span>
                <span className="text-xs opacity-75">{workspace.role} · {workspace.slug}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card className="border-foreground/15 bg-background/80">
          <CardHeader><p className="eyebrow">Add a container</p><CardTitle className="mt-1">New workspace</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitWorkspace}>
              <Input name="name" placeholder="Workspace name" required />
              <Input name="slug" pattern="[a-z0-9-]+" placeholder="workspace-slug" required />
              <Button className="w-full" disabled={createWorkspace.isPending} type="submit">
                <PlusIcon /> Create workspace
              </Button>
            </form>
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-5">
        {canManageProjects ? (
          <Card className="relative overflow-hidden border-foreground/15 bg-background/88">
            <CardHeader><div className="flex items-start justify-between gap-4"><div><p className="eyebrow">Start with purpose</p><CardTitle className="mt-1">New project</CardTitle></div><ArrowUpRightIcon className="mt-1 size-5 text-muted-foreground" /></div></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-[1fr_120px_1.5fr_auto]" onSubmit={submitProject}>
                <Input name="name" placeholder="Project name" required />
                <Input name="key" maxLength={20} placeholder="KEY" required />
                <Input name="description" placeholder="What is this project for?" />
                <Button disabled={!activeWorkspaceId || createProject.isPending} type="submit">
                  <PlusIcon /> Create
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
        {!activeWorkspaceId ? (
          <Card className="border-foreground/15"><CardContent className="p-7 text-sm text-muted-foreground">Create or select a workspace first.</CardContent></Card>
        ) : projects.isPending ? (
          <Card className="border-foreground/15"><CardContent className="p-7 text-sm text-muted-foreground">Loading projects…</CardContent></Card>
        ) : projects.isError ? (
          <Card className="border-foreground/15"><CardContent className="p-7 text-sm text-destructive">Project service is unavailable.</CardContent></Card>
        ) : (
          <ProjectList projects={projects.data ?? []} />
        )}
      </section>
    </div>
  );
}
