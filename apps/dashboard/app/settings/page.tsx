import { AppHeader, Card, EmptyState, PageBody } from '@lumyx/ui';
import { SlidersHorizontal } from "lucide-react";

export default function Page() {
  return (
    <>
      <AppHeader title="Settings" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={SlidersHorizontal}
            title="No design exists for this screen yet"
            body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
          />
        </Card>
      </PageBody>
    </>
  );
}
