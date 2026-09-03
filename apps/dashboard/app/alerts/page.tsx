import { AppHeader, Card, EmptyState, PageBody } from '@lumyx/ui';
import { Bell } from "lucide-react";

export default function Page() {
  return (
    <>
      <AppHeader title="Alerts" />
      <PageBody>
        <Card className="overflow-hidden">
          <EmptyState
            icon={Bell}
            title="No design exists for this screen yet"
            body="Overview, Rooms and Room detail are designed. Ask for this screen and it gets built from the same components."
          />
        </Card>
      </PageBody>
    </>
  );
}
