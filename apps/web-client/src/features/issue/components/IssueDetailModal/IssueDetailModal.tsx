"use client";

import { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  assignIssue,
  isConcurrentIssueModification,
  updateIssue,
} from "../../api";
import { useAddComment, useComments, useHistory } from "../../hooks/useIssue";
import type { Issue } from "../../types";

export function IssueDetailModal({ issue, issueId }: { issue?: Issue; issueId: string }) {
  const comments = useComments(issueId);
  const history = useHistory(issueId);
  const addComment = useAddComment(issueId);
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (payload: Parameters<typeof updateIssue>[1]) =>
      updateIssue(issueId, payload, issue?.version ?? 0),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issues", issueId] });
      if (issue?.projectId) {
        await queryClient.invalidateQueries({ queryKey: ["issues", issue.projectId] });
      }
    },
    onError: async (error) => {
      if (isConcurrentIssueModification(error)) {
        await queryClient.invalidateQueries({ queryKey: ["issues", issueId] });
        if (issue?.projectId) {
          await queryClient.invalidateQueries({ queryKey: ["issues", issue.projectId] });
        }
      }
    },
  });
  const assign = useMutation({
    mutationFn: (userId: string | null) =>
      assignIssue(issueId, userId, issue?.version ?? 0),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["issues", issueId] });
      if (issue?.projectId) {
        await queryClient.invalidateQueries({ queryKey: ["issues", issue.projectId] });
      }
    },
    onError: async (error) => {
      if (isConcurrentIssueModification(error)) {
        await queryClient.invalidateQueries({ queryKey: ["issues", issueId] });
        if (issue?.projectId) {
          await queryClient.invalidateQueries({ queryKey: ["issues", issue.projectId] });
        }
      }
    },
  });

  if (!issue) {
    return <Card><CardContent className="p-6 text-sm text-destructive">Issue could not be loaded.</CardContent></Card>;
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await update.mutateAsync({
        summary: String(form.get("summary") ?? ""),
        description: String(form.get("description") ?? ""),
        type: String(form.get("type")) as Issue["type"],
        priority: String(form.get("priority")) as Issue["priority"],
      });
      toast.success("Issue updated");
    } catch (error) {
      toast.error(
        isConcurrentIssueModification(error)
          ? "Issue changed elsewhere. Latest data has been loaded."
          : "Could not update issue",
      );
    }
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("assigneeUserId") ?? "");
    try {
      await assign.mutateAsync(value || null);
      toast.success(value ? "Assignee updated" : "Issue unassigned");
    } catch (error) {
      toast.error(
        isConcurrentIssueModification(error)
          ? "Issue changed elsewhere. Latest data has been loaded."
          : "Could not change assignee",
      );
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const body = String(new FormData(formElement).get("body") ?? "");
    try {
      await addComment.mutateAsync(body);
      formElement.reset();
    } catch { toast.error("Could not add comment"); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{issue.summary}</CardTitle><Badge variant="outline">{issue.status}</Badge>
            </div>
            <CardDescription>{issue.key} · version {issue.version}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitEdit}>
              <Input defaultValue={issue.summary} maxLength={200} name="summary" required />
              <textarea className="min-h-28 w-full rounded-lg border bg-background p-3 text-sm" defaultValue={issue.description ?? ""} name="description" placeholder="Description" />
              <div className="grid gap-3 sm:grid-cols-2">
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={issue.type} name="type"><option>TASK</option><option>BUG</option><option>STORY</option></select>
                <select className="h-8 rounded-lg border bg-background px-2 text-sm" defaultValue={issue.priority} name="priority"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select>
              </div>
              <Button disabled={update.isPending} type="submit">Save issue</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <form className="flex gap-2" onSubmit={submitComment}><Input name="body" placeholder="Write a comment" required /><Button disabled={addComment.isPending} type="submit">Add</Button></form>
            {comments.data?.map((comment) => <div className="rounded-lg border p-3 text-sm" key={comment.id}><p>{comment.body}</p><p className="mt-1 text-xs text-muted-foreground">{comment.authorUserId} · {new Date(comment.createdAt).toLocaleString()}</p></div>)}
            {comments.data?.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
          </CardContent>
        </Card>
      </div>
      <div className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
          <CardContent><form className="space-y-3" onSubmit={submitAssignment}><Input defaultValue={issue.assigneeUserId ?? ""} name="assigneeUserId" placeholder="Member UUID; empty to unassign" /><Button className="w-full" disabled={assign.isPending} type="submit">Update assignee</Button></form></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {history.data?.map((entry) => <div className="border-l-2 pl-3 text-sm" key={entry.id}><p className="font-medium">{entry.action.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
