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
      <Card className="border-foreground/15">
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
          <Card className="h-full border-foreground/15 bg-background/85 transition-all hover:-translate-y-0.5 hover:border-foreground hover:bg-background hover:shadow-[5px_5px_0_rgb(0_0_0/0.1)]">
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
              <span className="font-medium uppercase tracking-[0.12em]">{project.status}</span>
              <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
