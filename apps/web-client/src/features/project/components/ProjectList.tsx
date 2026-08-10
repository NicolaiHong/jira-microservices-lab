import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { Project } from "../types";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No projects yet</CardTitle>
          <CardDescription>Create the first project in this workspace.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <Link href={`/projects/${project.id}/board`} key={project.id}>
          <Card className="h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{project.name}</CardTitle>
                <Badge variant="outline">{project.key}</Badge>
              </div>
              <CardDescription>
                {project.description ?? "No project description yet."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{project.status}</span>
              <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
