"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon, MoreHorizontalIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTransitionIssue } from "../../hooks/useIssues";
import type { Issue, IssuePriority, IssueStatus } from "../../types";

const columns: Array<{ id: IssueStatus; label: string }> = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

const priorityLabels: Record<IssuePriority | "all", string> = { all: "All priorities", LOW: "Low", MEDIUM: "Medium", HIGH: "High", CRITICAL: "Highest" };

export function Board({ issues, projectId, onCreateIssue }: { issues: Issue[]; projectId: string; onCreateIssue: () => void }) {
  const transition = useTransitionIssue(projectId);
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<IssuePriority | "all">("all");
  const visibleIssues = useMemo(() => issues.filter((issue) => (priority === "all" || issue.priority === priority) && `${issue.key} ${issue.summary}`.toLowerCase().includes(query.trim().toLowerCase())), [issues, priority, query]);

  function move(issue: Issue, direction: -1 | 1) {
    const index = columns.findIndex((column) => column.id === issue.status);
    const target = columns[index + direction];
    if (target) {
      transition.mutate({
        issueId: issue.id,
        status: target.id,
        expectedVersion: issue.version,
      });
    }
  }

  return <div className="space-y-3"><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-60 flex-1 sm:max-w-sm"><SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Search issues" className="pl-8" onChange={(event) => setQuery(event.target.value)} placeholder="Search this board" type="search" value={query} />{query ? <button aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setQuery("")} type="button"><XIcon className="size-3.5" /></button> : null}</div><label className="flex h-8 items-center gap-1 border border-border bg-background px-2 text-xs text-muted-foreground"><SlidersHorizontalIcon className="size-3.5" /><span className="sr-only">Priority</span><select aria-label="Filter by priority" className="h-full bg-transparent text-xs text-foreground" onChange={(event) => setPriority(event.target.value as IssuePriority | "all")} value={priority}>{Object.keys(priorityLabels).map((value) => <option key={value} value={value}>{priorityLabels[value as IssuePriority | "all"]}</option>)}</select></label><span className="text-xs text-muted-foreground">{visibleIssues.length} of {issues.length} issues</span><Button className="ml-auto" onClick={onCreateIssue} size="sm"><PlusIcon /> Create issue</Button></div><div className="grid gap-3 lg:grid-cols-3">{columns.map((column) => { const columnIssues = visibleIssues.filter((issue) => issue.status === column.id); return <Card className="min-h-[420px] border-0 bg-muted/80 shadow-none" key={column.id}><CardHeader className="px-3 pt-3"><div className="flex items-center justify-between gap-3"><CardTitle className="text-sm">{column.label}</CardTitle><div className="flex items-center gap-1"><Badge variant="secondary">{columnIssues.length}</Badge><Button aria-label={`${column.label} actions`} size="icon-xs" variant="ghost"><MoreHorizontalIcon /></Button></div></div></CardHeader><CardContent className="flex flex-col gap-2 px-3 pb-3">{columnIssues.map((issue) => <article className="rounded-md border border-border bg-background p-3 shadow-[0_1px_2px_rgb(9_30_66/0.12)] transition-shadow hover:shadow-[0_3px_7px_rgb(9_30_66/0.16)]" key={issue.id}><div className="mb-2 flex items-center justify-between gap-2 text-[10px]"><span className="font-semibold text-muted-foreground">{issue.key}</span><span className={`size-2 rounded-full ${issue.priority === "CRITICAL" ? "bg-[#e2483d]" : issue.priority === "HIGH" ? "bg-[#f5cd47]" : "bg-[#0c66e4]"}`} title={issue.priority} /></div><Link className="text-sm font-medium leading-5 text-foreground hover:text-primary hover:underline" href={`/projects/${projectId}/issues/${issue.id}`}>{issue.summary}</Link><div className="mt-3 flex items-center justify-between"><span className="flex size-5 items-center justify-center rounded-full bg-[#6554c0] text-[8px] font-semibold text-white">AM</span><div className="flex items-center"><Button aria-label="Move left" disabled={column.id === "TODO" || transition.isPending} onClick={() => move(issue, -1)} size="icon-xs" variant="ghost"><ArrowLeftIcon /></Button><Button aria-label="Move right" disabled={column.id === "DONE" || transition.isPending} onClick={() => move(issue, 1)} size="icon-xs" variant="ghost"><ArrowRightIcon /></Button></div></div></article>)}{columnIssues.length === 0 ? <div className="rounded-md border border-dashed border-border bg-background/60 p-6 text-center text-xs text-muted-foreground">No issues match this view</div> : null}<button className="flex h-8 items-center gap-1 rounded-md px-2 text-left text-xs text-muted-foreground hover:bg-background hover:text-primary" onClick={onCreateIssue} type="button"><PlusIcon className="size-3.5" /> Create issue</button></CardContent></Card>; })}</div></div>;
}
