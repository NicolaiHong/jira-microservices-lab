import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Realtime notification UI wiring is intentionally not implemented yet.
      </CardContent>
    </Card>
  );
}
