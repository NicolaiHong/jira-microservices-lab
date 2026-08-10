import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Issue } from "../../types";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function Backlog({
  issues,
  projectId,
}: {
  issues: Issue[];
  projectId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Backlog</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {issues.length > 0 ? (
          issues.map((issue) => (
            <div className="flex items-center gap-3 rounded-lg border p-3 text-sm" key={issue.id}>
              <Badge variant="outline">{issue.key}</Badge>
              <Link className="font-medium hover:underline" href={`/projects/${projectId}/issues/${issue.id}`}>
                {issue.summary}
              </Link>
              <span className="ml-auto text-xs text-muted-foreground">{issue.status} · {issue.priority}</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No issues in this project yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
