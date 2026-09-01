import { Card, CardHeader, CardTitle, EmptyState } from '@lumyx/ui';
import { Server } from "lucide-react";

export default function Page() {
  return (
    <Card className="max-w-[1360px] overflow-hidden">
      <CardHeader><CardTitle>Server</CardTitle></CardHeader>
      <EmptyState
        icon={Server}
        title="No design exists for this screen yet"
        body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
      />
    </Card>
  );
}
