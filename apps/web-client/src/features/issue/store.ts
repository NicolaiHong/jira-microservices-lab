import { create } from "zustand";

import type { IssuePriority, IssueStatus } from "./types";

interface IssueUiState {
  statusFilter: IssueStatus | "all";
  priorityFilter: IssuePriority | "all";
  setStatusFilter: (status: IssueUiState["statusFilter"]) => void;
  setPriorityFilter: (priority: IssueUiState["priorityFilter"]) => void;
}

export const useIssueStore = create<IssueUiState>((set) => ({
  statusFilter: "all",
  priorityFilter: "all",
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setPriorityFilter: (priorityFilter) => set({ priorityFilter }),
}));
