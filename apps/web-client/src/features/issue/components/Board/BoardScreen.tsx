"use client";

import { useState } from "react";
import { Board } from "./Board";
import { IssueForm } from "../IssueForm";
import { useEpics, useIssues, useSprints } from "../../hooks/useIssues";

export function BoardScreen({ projectId }: { projectId: string }) {
  const [isCreating, setIsCreating] = useState(false);
  const issues = useIssues(projectId);
  const epics = useEpics(projectId);
  const sprints = useSprints(projectId);

  if (issues.isPending) return <p className="rounded-md border border-border bg-background p-4 text-sm text-muted-foreground">Loading board...</p>;
  return <><Board issues={issues.isError ? [] : issues.data ?? []} onCreateIssue={() => setIsCreating(true)} projectId={projectId} />{isCreating ? <IssueForm epics={epics.data ?? []} onClose={() => setIsCreating(false)} projectId={projectId} sprints={sprints.data ?? []} /> : null}</>;
}
