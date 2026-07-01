import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Issue, IssueStatus } from "../../types";

const columns: Array<{ id: IssueStatus; label: string }> = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "done", label: "Done" },
];

export function Board({
  issues,
  projectId,
}: {
  issues: Issue[];
  projectId: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((column) => {
        const columnIssues = issues.filter(
          (issue) => issue.status === column.id,
        );

        return (
          <Card className="min-h-72" key={column.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{column.label}</CardTitle>
                <Badge variant="secondary">{columnIssues.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {columnIssues.length > 0 ? (
                columnIssues.map((issue) => (
                  <div
                    className="rounded-lg border bg-background p-3 text-sm"
                    key={issue.id}
                  >
                    <div className="font-medium">{issue.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {issue.priority}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Placeholder column for project {projectId}.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
