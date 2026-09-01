import { Card, CardHeader, CardTitle, EmptyState } from '@lumyx/ui';
import { Bell } from "lucide-react";

export default function Page() {
  return (
    <Card className="max-w-[1360px] overflow-hidden">
      <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
      <EmptyState
        icon={Bell}
        title="No design exists for this screen yet"
        body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
      />
    </Card>
  );
}
