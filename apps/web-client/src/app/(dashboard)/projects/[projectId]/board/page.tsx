"use client";

import { useParams } from "next/navigation";

import { BoardScreen } from "@/features/issue/components/Board";
import { ProjectNavigation } from "@/components/shared/ProjectNavigation";

export default function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Projects / Orbit Launch</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Sprint board</h1>
      </div>
      <ProjectNavigation projectId={projectId} />
      <BoardScreen projectId={projectId} />
    </section>
  );
}
