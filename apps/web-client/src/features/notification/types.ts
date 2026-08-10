export interface Notification {
  id: string;
  userId: string;
  eventId: string;
  type: string;
  title: string;
  body: string;
  issueId: string;
  projectId: string;
  createdAt: string;
  readAt: string | null;
}
