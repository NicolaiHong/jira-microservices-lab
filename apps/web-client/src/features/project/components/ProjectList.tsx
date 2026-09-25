"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toastApiError } from "@/lib/apiError";

import { useManageProject } from "../hooks/useProjects";
import type { Project, UpdateProjectPayload } from "../types";

export function ProjectList({
  projects,
  canManage,
}: {
  projects: Project[];
  canManage: boolean;
}) {
  if (projects.length === 0) {
    return (
      <Card className="border-foreground/15">
        <CardHeader>
          <CardTitle>No projects yet</CardTitle>
          <CardDescription>Create the first project in this workspace.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard canManage={canManage} key={project.id} project={project} />
      ))}
    </div>
  );
}

function ProjectCard({ project, canManage }: { project: Project; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const { update, archive } = useManageProject(project);
  const archived = project.status === "ARCHIVED";

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const description = String(form.get("description") ?? "").trim();
    // PATCH is presence-aware: send only changed fields; an emptied description is null (BR-PROJ-001).
    const payload: UpdateProjectPayload = {};
    if (name !== project.name) payload.name = name;
    if (description !== (project.description ?? "")) payload.description = description || null;
    try {
      if (Object.keys(payload).length) {
        await update.mutateAsync(payload);
        toast.success("Project updated");
      }
      setEditing(false);
    } catch (error) {
      toastApiError(error, "Could not update project");
    }
  }

  async function archiveProject() {
    if (
      !window.confirm(
        `Archive ${project.name}? This cannot be undone: there is no way to restore an archived project. It stays readable, but its issues and planning can no longer change.`,
      )
    ) {
      return;
    }
    try {
      await archive.mutateAsync();
      toast.success("Project archived");
    } catch (error) {
      toastApiError(error, "Could not archive project");
    }
  }

  return (
    <Card className="relative h-full border-foreground/15 bg-background/85 transition-all hover:border-foreground hover:bg-background hover:shadow-[5px_5px_0_rgb(0_0_0/0.1)]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>
            {/* Stretched link keeps the whole card clickable without nesting the buttons inside it. */}
            <Link className="after:absolute after:inset-0" href={`/projects/${project.id}/board`}>
              {project.name}
            </Link>
          </CardTitle>
          <span className="flex gap-1.5">
            {archived ? <Badge variant="secondary">Archived</Badge> : null}
            <Badge variant="outline">{project.key}</Badge>
          </span>
        </div>
        {editing ? null : (
          <CardDescription>
            {project.description ?? "No project description yet."}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {editing ? (
          <form className="relative z-10 grid gap-2" onSubmit={submitEdit}>
            <Input aria-label="Edit project name" defaultValue={project.name} maxLength={120} name="name" required />
            <Input
              aria-label="Edit project description"
              defaultValue={project.description ?? ""}
              maxLength={2000}
              name="description"
              placeholder="What is this project for?"
            />
            <div className="flex gap-2">
              <Button disabled={update.isPending} size="sm" type="submit">Save</Button>
              <Button onClick={() => setEditing(false)} size="sm" type="button" variant="outline">Cancel</Button>
            </div>
          </form>
        ) : (
          <p>Updated {new Date(project.updatedAt).toLocaleDateString()}</p>
        )}
        {canManage && !archived && !editing ? (
          <div className="relative z-10 flex gap-2">
            <Button aria-label={`Edit ${project.name}`} onClick={() => setEditing(true)} size="sm" type="button" variant="outline">
              Edit
            </Button>
            <Button
              aria-label={`Archive ${project.name}`}
              disabled={archive.isPending}
              onClick={() => void archiveProject()}
              size="sm"
              type="button"
              variant="destructive"
            >
              Archive
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
