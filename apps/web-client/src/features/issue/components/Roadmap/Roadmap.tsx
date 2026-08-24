"use client";

import { FormEvent } from "react";
import { CalendarDaysIcon, FlagIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateEpic } from "../../hooks/useIssues";
import type { Epic } from "../../types";

const colors = {
  PURPLE: "bg-[#e9e0ff] text-[#5e4db2]",
  BLUE: "bg-[#d9eaff] text-[#0c66e4]",
  GREEN: "bg-[#d6f7e7] text-[#216e4e]",
  YELLOW: "bg-[#fff0b8] text-[#7f5f01]",
  ORANGE: "bg-[#ffebe6] text-[#ae2e24]",
};
const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function laneFor(epic: Epic, index: number) {
  const startMonth = epic.startDate ? new Date(`${epic.startDate}T00:00:00Z`).getUTCMonth() : index % 4 + 6;
  const endMonth = epic.targetDate ? new Date(`${epic.targetDate}T00:00:00Z`).getUTCMonth() : startMonth + 1;
  const start = Math.max(1, Math.min(6, startMonth - 5));
  const end = Math.max(start + 1, Math.min(7, endMonth - 5 + 1));
  return { start, span: Math.max(1, end - start) };
}

export function Roadmap({ projectId, epics }: { projectId: string; epics: Epic[] }) {
  const createEpic = useCreateEpic(projectId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await createEpic.mutateAsync({ name: String(form.get("name") ?? ""), color: String(form.get("color") ?? "BLUE") as Epic["color"], startDate: String(form.get("startDate") ?? "") || undefined, targetDate: String(form.get("targetDate") ?? "") || undefined });
      event.currentTarget.reset();
      toast.success("Epic created");
    } catch { toast.error("Could not create epic"); }
  }

  return <div className="overflow-hidden rounded-md border border-border bg-background shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><CalendarDaysIcon className="size-4 text-muted-foreground" /><span className="text-sm font-semibold">Timeline</span><Badge variant="secondary">H2</Badge></div><details className="relative"><summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded-md bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground hover:bg-[#0055cc]"><PlusIcon className="size-3.5" /> Create epic</summary><form className="absolute right-0 z-20 mt-2 grid w-72 gap-2 rounded-md border border-border bg-background p-3 shadow-lg" onSubmit={submit}><Input name="name" placeholder="Epic name" required /><div className="grid grid-cols-2 gap-2"><Input name="startDate" type="date" /><Input name="targetDate" type="date" /></div><select className="h-8 border border-border bg-background px-2 text-xs" defaultValue="BLUE" name="color"><option value="BLUE">Blue</option><option value="PURPLE">Purple</option><option value="GREEN">Green</option><option value="YELLOW">Yellow</option><option value="ORANGE">Orange</option></select><Button disabled={createEpic.isPending} size="sm" type="submit">Save epic</Button></form></details></div><div className="min-w-[780px]"><div className="grid grid-cols-[220px_repeat(6,minmax(90px,1fr))] border-b border-border bg-muted/45 text-[11px] font-semibold text-muted-foreground"><div className="px-4 py-3">Initiative</div>{months.map((month) => <div className="border-l border-border px-3 py-3" key={month}>{month}</div>)}</div>{epics.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">Create an epic to start mapping delivery work on the roadmap.</p> : <div className="grid grid-cols-[220px_1fr]"><div className="divide-y divide-border border-r border-border">{epics.map((epic) => <div className="flex h-20 items-center gap-2 px-4" key={epic.id}><FlagIcon className="size-3.5 text-primary" /><div className="min-w-0"><p className="truncate text-xs font-semibold">{epic.name}</p><p className="text-[10px] text-muted-foreground">{epic.targetDate ?? "No target date"}</p></div></div>)}</div><div className="relative divide-y divide-border bg-[linear-gradient(to_right,transparent_calc(16.66%-1px),#dfe1e6_calc(16.66%-1px),#dfe1e6_16.66%,transparent_16.66%)] bg-[length:16.66%_100%]"><div className="absolute inset-y-0 left-1/2 z-10 border-l-2 border-primary/70"><span className="absolute -top-0.5 -translate-x-1/2 bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-white">Today</span></div>{epics.map((epic, index) => { const lane = laneFor(epic, index); return <div className="grid h-20 grid-cols-6 items-center px-3" key={epic.id}><div className={`h-7 rounded-sm px-2 py-1.5 text-[10px] font-semibold ${colors[epic.color]}`} style={{ gridColumn: `${lane.start} / span ${lane.span}` }}>{epic.name}</div></div>; })}</div></div>}</div></div>;
}
