"use client";

import { QueryError } from "@/components/shared/QueryError";
import { useParams } from "next/navigation";

import { IssueDetailModal } from "@/features/issue/components/IssueDetailModal";
import { useIssue } from "@/features/issue/hooks/useIssue";
import { useProject } from "@/features/project/hooks/useProjects";

export default function IssueDetailPage() {
  const { issueId } = useParams<{ issueId: string }>();
  const issueQuery = useIssue(issueId);
  const projectQuery = useProject(issueQuery.data?.projectId);

  return (
    <section className="flex flex-col gap-4">
      <title>{`${issueQuery.data?.key ?? "Issue"} · Orbit`}</title>
      {projectQuery.isError ? <QueryError resource="project" queries={[projectQuery]} /> : null}
      {issueQuery.isError ? <QueryError resource="issue" queries={[issueQuery]} /> : issueQuery.isPending ? (
        <p className="rounded-lg border bg-background p-4 text-sm text-muted-foreground">
          Loading issue...
        </p>
      ) : (
        <IssueDetailModal
          isProjectWritable={projectQuery.data?.status === "ACTIVE"}
          issue={issueQuery.data}
          issueId={issueId}
        />
      )}
    </section>
  );
}
