import { Card, CardHeader, CardTitle, EmptyState } from '@lumyx/ui';
import { CirclePlay } from "lucide-react";

export default function Page() {
  return (
    <Card className="max-w-[1360px] overflow-hidden">
      <CardHeader><CardTitle>Session replay</CardTitle></CardHeader>
      <EmptyState
        icon={CirclePlay}
        title="No design exists for this screen yet"
        body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
      />
    </Card>
  );
}
