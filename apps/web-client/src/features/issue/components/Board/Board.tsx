"use client";

import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTransitionIssue } from "../../hooks/useIssues";
import type { Issue, IssueStatus } from "../../types";

const columns: Array<{ id: IssueStatus; label: string }> = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

export function Board({ issues, projectId }: { issues: Issue[]; projectId: string }) {
  const transition = useTransitionIssue(projectId);

  function move(issue: Issue, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.id === issue.status);
    const target = columns[index + direction];
    if (target) transition.mutate({ issueId: issue.id, status: target.id });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((column) => {
        const columnIssues = issues.filter((issue) => issue.status === column.id);
        return (
          <Card className="min-h-80 bg-muted/25" key={column.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{column.label}</CardTitle>
                <Badge variant="secondary">{columnIssues.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {columnIssues.map((issue) => (
                <article className="rounded-xl border bg-background p-3 shadow-sm" key={issue.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant="outline">{issue.key}</Badge>
                    <span className="text-[11px] font-medium text-muted-foreground">{issue.priority}</span>
                  </div>
                  <Link className="text-sm font-medium hover:underline" href={`/projects/${projectId}/issues/${issue.id}`}>
                    {issue.summary}
                  </Link>
                  <div className="mt-3 flex justify-between">
                    <Button aria-label="Move left" disabled={column.id === "TODO" || transition.isPending} onClick={() => move(issue, -1)} size="icon-xs" variant="ghost"><ArrowLeftIcon /></Button>
                    <Button aria-label="Move right" disabled={column.id === "DONE" || transition.isPending} onClick={() => move(issue, 1)} size="icon-xs" variant="ghost"><ArrowRightIcon /></Button>
                  </div>
                </article>
              ))}
              {columnIssues.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No issues</div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
