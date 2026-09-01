import { Card, CardHeader, CardTitle, EmptyState } from '@lumyx/ui';
import { SlidersHorizontal } from "lucide-react";

export default function Page() {
  return (
    <Card className="max-w-[1360px] overflow-hidden">
      <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
      <EmptyState
        icon={SlidersHorizontal}
        title="No design exists for this screen yet"
        body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
      />
    </Card>
  );
}
