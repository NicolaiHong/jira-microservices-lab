"use client";

import type { FormEvent } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useCompleteSprint, useCreateSprint } from "../../hooks/useIssues";
import type { Epic, Issue, Sprint } from "../../types";

function issueTypeDotClass(issue: Issue) {
  switch (issue.type) {
    case "BUG":
      return "bg-[#e2483d]";
    case "STORY":
      return "bg-[#22a06b]";
    default:
      return "bg-[#0c66e4]";
  }
}

interface BacklogProps {
  issues: Issue[];
  epics: Epic[];
  sprints: Sprint[];
  projectId: string;
  isProjectWritable: boolean;
}

export function Backlog({
  issues,
  epics,
  sprints,
  projectId,
  isProjectWritable,
}: BacklogProps) {
  const activeSprint = sprints.find((sprint) => sprint.status === "ACTIVE");
  const createSprint = useCreateSprint(projectId);
  const completeSprint = useCompleteSprint(projectId);
  const displayedIssues = activeSprint
    ? issues.filter((issue) => issue.sprintId === activeSprint.id)
    : issues;

  async function startSprint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isProjectWritable) {
      return;
    }

    const form = new FormData(event.currentTarget);

    try {
      await createSprint.mutateAsync({
        name: String(form.get("name") ?? ""),
        goal: String(form.get("goal") ?? "") || undefined,
        startDate: String(form.get("startDate") ?? "") || undefined,
        endDate: String(form.get("endDate") ?? "") || undefined,
      });
      event.currentTarget.reset();
      toast.success("Sprint started");
    } catch {
      toast.error("Could not start sprint");
    }
  }

  async function finishSprint() {
    if (!activeSprint || !isProjectWritable) {
      return;
    }

    try {
      await completeSprint.mutateAsync(activeSprint.id);
      toast.success("Sprint completed");
    } catch {
      toast.error("Could not complete sprint");
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
      <Card className="border-border">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{activeSprint?.name ?? "Backlog"}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {activeSprint?.goal ??
                  "Prioritize and refine the work your team will take on next."}
              </p>
            </div>
            {isProjectWritable && activeSprint ? (
              <Button
                disabled={completeSprint.isPending}
                onClick={finishSprint}
                size="sm"
                variant="outline"
              >
                Complete sprint
              </Button>
            ) : null}
            {isProjectWritable && !activeSprint ? (
              <details className="relative">
                <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-[#0055cc]">
                  <PlusIcon className="size-3.5" /> Start sprint
                </summary>
                <form
                  className="absolute right-0 z-20 mt-2 grid w-72 gap-2 rounded-md border border-border bg-background p-3 shadow-lg"
                  onSubmit={startSprint}
                >
                  <Input name="name" placeholder="Sprint name" required />
                  <Input name="goal" placeholder="Sprint goal" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input name="startDate" type="date" />
                    <Input name="endDate" type="date" />
                  </div>
                  <Button
                    disabled={createSprint.isPending}
                    size="sm"
                    type="submit"
                  >
                    Start sprint
                  </Button>
                </form>
              </details>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {displayedIssues.length ? (
            displayedIssues.map((issue) => (
              <div
                className="group flex min-h-11 items-center gap-3 border-b border-border px-4 py-2 text-sm last:border-b-0 hover:bg-muted/55"
                key={issue.id}
              >
                <span
                  className={[
                    "size-2 rounded-full",
                    issueTypeDotClass(issue),
                  ].join(" ")}
                />
                <Badge variant="outline">{issue.key}</Badge>
                <Link
                  className="min-w-0 flex-1 truncate font-medium hover:text-primary hover:underline"
                  href={"/projects/" + projectId + "/issues/" + issue.id}
                >
                  {issue.summary}
                </Link>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {issue.priority}
                </span>
                <span className="flex size-5 items-center justify-center rounded-full bg-[#6554c0] text-[8px] font-semibold text-white">
                  AM
                </span>
              </div>
            ))
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              {activeSprint
                ? "No issues have been planned into this sprint."
                : "No issues in this project yet."}
            </p>
          )}
          {isProjectWritable ? (
            <Link
              className="flex h-10 items-center gap-1 px-4 text-xs font-medium text-muted-foreground hover:text-primary"
              href={"/projects/" + projectId + "/board"}
            >
              <PlusIcon className="size-3.5" /> Create issue
            </Link>
          ) : null}
        </CardContent>
      </Card>
      <aside className="space-y-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Epic panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {epics.length ? (
              epics.slice(0, 4).map((epic) => (
                <p className="rounded-sm bg-muted p-2 font-medium" key={epic.id}>
                  {epic.name}
                </p>
              ))
            ) : (
              <p className="text-muted-foreground">No epics yet.</p>
            )}
            {isProjectWritable ? (
              <Link
                className="text-primary hover:underline"
                href={"/projects/" + projectId + "/roadmap"}
              >
                + Create epic
              </Link>
            ) : null}
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-sm">Sprint details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              {activeSprint?.goal ??
                "Start a sprint when the team is ready to commit."}
            </p>
            <p>
              {displayedIssues.length}{" "}
              {displayedIssues.length === 1 ? "issue" : "issues"} ·{" "}
              {sprints.filter((sprint) => sprint.status === "COMPLETED").length}{" "}
              completed
            </p>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
