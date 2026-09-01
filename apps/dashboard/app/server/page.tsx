import { AppHeader, Card, EmptyState, PageBody } from '@lumyx/ui';
import { Server } from "lucide-react";

export default function Page() {
  return (
    <>
      <AppHeader title="Server" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={Server}
            title="No design exists for this screen yet"
            body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
          />
        </Card>
      </PageBody>
    </>
  );
}
