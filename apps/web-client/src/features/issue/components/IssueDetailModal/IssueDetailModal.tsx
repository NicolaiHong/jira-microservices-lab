import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Issue } from "../../types";

export function IssueDetailModal({
  issue,
  issueId,
}: {
  issue?: Issue;
  issueId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{issue?.title ?? "Issue detail"}</CardTitle>
          <Badge variant="outline">{issue?.status ?? "placeholder"}</Badge>
        </div>
        <CardDescription>Issue id: {issueId}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Modal behavior and full issue editing are not implemented in this
        skeleton.
      </CardContent>
    </Card>
  );
}
