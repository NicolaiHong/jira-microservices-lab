"use client";

import { FormEvent } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateIssue } from "../../hooks/useIssues";
import type { Epic, Sprint } from "../../types";

interface IssueFormProps {
  projectId: string;
  epics: Epic[];
  sprints: Sprint[];
  onClose: () => void;
}

export function IssueForm({ projectId, epics, sprints, onClose }: IssueFormProps) {
  const createIssue = useCreateIssue(projectId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await createIssue.mutateAsync({
        summary: String(form.get("summary") ?? ""),
        description: String(form.get("description") ?? "") || undefined,
        type: String(form.get("type")) as "TASK" | "BUG" | "STORY",
        priority: String(form.get("priority")) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        assigneeUserId: String(form.get("assigneeUserId") ?? "") || undefined,
        epicId: String(form.get("epicId") ?? "") || undefined,
        sprintId: String(form.get("sprintId") ?? "") || undefined,
      });
      formElement.reset();
      toast.success("Issue created");
      onClose();
    } catch {
      toast.error("Could not create issue");
    }
  }

  return (
    <aside aria-label="Create issue" className="jira-surface fixed inset-y-0 right-0 z-40 w-full max-w-xl overflow-y-auto border-l border-border bg-background p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4"><div><p className="eyebrow">New work item</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Create issue</h2></div><Button aria-label="Close create issue" onClick={onClose} size="icon-sm" variant="ghost"><XIcon /></Button></div>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-medium">Summary<Input autoFocus className="mt-1.5" maxLength={200} name="summary" placeholder="What needs to be done?" required /></label>
        <label className="block text-sm font-medium">Description<textarea className="mt-1.5 min-h-32 w-full border bg-background p-3 text-sm" name="description" placeholder="Add context, acceptance criteria, or useful links." /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Issue type<select className="mt-1.5 h-9 w-full border bg-background px-2 text-sm" defaultValue="TASK" name="type"><option value="TASK">Task</option><option value="BUG">Bug</option><option value="STORY">Story</option></select></label><label className="block text-sm font-medium">Priority<select className="mt-1.5 h-9 w-full border bg-background px-2 text-sm" defaultValue="MEDIUM" name="priority"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Highest</option></select></label></div>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Epic<select className="mt-1.5 h-9 w-full border bg-background px-2 text-sm" defaultValue="" name="epicId"><option value="">No epic</option>{epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.name}</option>)}</select></label><label className="block text-sm font-medium">Sprint<select className="mt-1.5 h-9 w-full border bg-background px-2 text-sm" defaultValue="" name="sprintId"><option value="">Backlog</option>{sprints.filter((sprint) => sprint.status === "ACTIVE").map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select></label></div>
        <label className="block text-sm font-medium">Assignee ID<Input className="mt-1.5" name="assigneeUserId" placeholder="Optional member UUID" /></label>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4"><Button onClick={onClose} type="button" variant="outline">Cancel</Button><Button disabled={createIssue.isPending} type="submit">Create issue</Button></div>
      </form>
    </aside>
  );
}
