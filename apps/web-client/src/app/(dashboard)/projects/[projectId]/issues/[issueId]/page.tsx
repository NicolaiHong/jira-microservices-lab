"use client";

import { useParams } from "next/navigation";

import { IssueDetailModal } from "@/features/issue/components/IssueDetailModal";
import { useIssue } from "@/features/issue/hooks/useIssue";

export default function IssueDetailPage() {
  const { issueId } = useParams<{ projectId: string; issueId: string }>();
  const issueQuery = useIssue(issueId);

  return (
    <section className="flex flex-col gap-4">
      {issueQuery.isPending ? (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          Loading issue...
        </p>
      ) : (
        <IssueDetailModal issue={issueQuery.data} issueId={issueId} />
      )}
    </section>
  );
}
