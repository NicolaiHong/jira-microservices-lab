import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Issue } from "../../types";

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
            <div className="rounded-lg border p-3 text-sm" key={issue.id}>
              {issue.title}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            Backlog placeholder for project {projectId}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
