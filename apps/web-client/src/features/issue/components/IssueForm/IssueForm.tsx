"use client";

import { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateIssue } from "../../hooks/useIssues";

export function IssueForm({ projectId }: { projectId: string }) {
  const createIssue = useCreateIssue(projectId);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await createIssue.mutateAsync({
        summary: String(form.get("summary") ?? ""),
        description: String(form.get("description") ?? ""),
        type: String(form.get("type")) as "TASK" | "BUG" | "STORY",
        priority: String(form.get("priority")) as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        assigneeUserId: String(form.get("assigneeUserId") ?? "") || undefined,
      });
      formElement.reset();
      toast.success("Issue created");
    } catch {
      toast.error("Could not create issue");
    }
  }

  return (
    <form className="grid gap-3 rounded-xl border bg-background p-4 lg:grid-cols-[1.5fr_1fr_130px_130px_1fr_auto]" onSubmit={submit}>
      <Input name="summary" maxLength={200} placeholder="Issue summary" required />
      <Input name="description" placeholder="Description" />
      <select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue="TASK" name="type">
        <option value="TASK">Task</option><option value="BUG">Bug</option><option value="STORY">Story</option>
      </select>
      <select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue="MEDIUM" name="priority">
        <option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option><option value="CRITICAL">Critical</option>
      </select>
      <Input name="assigneeUserId" placeholder="Assignee UUID (optional)" />
      <Button disabled={createIssue.isPending} type="submit">Create</Button>
    </form>
  );
}
