import {
  AlertBanner,
  AppShell,
  Badge,
  Breadcrumb,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  EventList,
  Icon,
  IconButton,
  Input,
  LatencyChip,
  LoadingSkeleton,
  MetricCard,
  MetricGrid,
  PeerCard,
  Pill,
  ProgressBar,
  QualityIndicator,
  RoomCard,
  Select,
  SeverityBadge,
  Sidebar,
  Sparkline,
  SplitPane,
  StatusDot,
  StatusStrip,
  Tabs,
  TimeSeriesChart,
  Toast,
  Toolbar,
  VideoTile,
} from "@lumyx/ui";

/**
 * A specimen of every component in `@lumyx/ui`, the local counterpart to
 * the Design System pane in the Claude Design project.
 *
 * Values here are invented; the metric names and thresholds are the real ones
 * from the repo's metrics reference.
 */

const RTT = [128, 134, 121, 140, 156, 149, 162, 158, 171, 166, 182, 178, 194, 188];
const LOSS = [0.2, 0.3, 0.2, 0.5, 0.8, 0.6, 1.2, 0.9, 1.8, 1.4, 2.4, 2.1, 3.2, 2.8];

const NAV = [
  { section: "Observe" },
  { id: "overview", label: "Overview", icon: "layout-dashboard" as const },
  { id: "rooms", label: "Rooms", icon: "radio-tower" as const, count: 12 },
  { id: "peers", label: "Peers", icon: "users" as const, count: 148 },
  { section: "Diagnose" },
  { id: "alerts", label: "Alerts", icon: "bell" as const, status: "degraded" as const },
  { id: "replay", label: "Session replay", icon: "circle-play" as const },
];

const PEERS = [
  { id: "a3f91c02", room: "webinar-us", rtt: 38, loss: 0.2, codec: "vp8", quality: 96 },
  { id: "c27ad930", room: "test-room", rtt: 142, loss: 0.9, codec: "vp8", quality: 74 },
  { id: "ff104b2c", room: "webinar-us", rtt: 218, loss: 7.9, codec: "h264", quality: 31 },
];

const EVENTS = [
  { time: "14:06:38", message: "Peer joined", detail: "c27ad930", type: "event" as const },
  { time: "14:06:39", message: "Offer received", detail: "sfu_offer", type: "info" as const },
  { time: "14:06:39", message: "Answer sent", detail: "sfu_answer", type: "send" as const },
  { time: "14:06:41", message: "ICE failed", detail: "ff104b2c", type: "error" as const },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="sl-label">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <AppShell
      sidebar={
        <Sidebar
          items={NAV}
          activeId="overview"
          brandMeta="eu-west-3 · v0.1.0"
          footer="MIT licensed"
        />
      }
      toolbar={
        <Toolbar
          left={
            <Breadcrumb
              items={[
                { id: "root", label: "Sightline" },
                { id: "ds", label: "Design system" },
              ]}
            />
          }
          right={
            <>
              <IconButton label="Refresh">
                <Icon name="refresh-cw" />
              </IconButton>
              <Button variant="primary" icon={<Icon name="download" />}>
                Export
              </Button>
            </>
          }
        />
      }
      footer={
        <StatusStrip
          left="Connected · eu-west-3 · updated 14:06:41"
          items={[
            { label: "Rooms", value: "12" },
            { label: "Peers", value: "148" },
            { label: "Loss", value: "7.90%", tone: "danger" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-8">
        <Section title="Metrics">
          <Card padded={false} title="Session health" meta="last 15m">
            <MetricGrid columns={4}>
              <MetricCard
                label="Round-trip time"
                value="188"
                unit="ms"
                delta="+22ms"
                deltaTone="down"
                sublabel="vs 15m ago"
                chart={<Sparkline data={RTT} threshold={200} />}
              />
              <MetricCard
                label="Packet loss"
                value="2.80"
                unit="%"
                status="error"
                delta="+1.4%"
                deltaTone="down"
                chart={<Sparkline data={LOSS} tone="warn" threshold={2} />}
              />
              <MetricCard label="Jitter" value="12" unit="ms" status="ok" sublabel="within budget" />
              <MetricCard label="Bitrate" value="2.4" unit="Mbps" sublabel="1,284,920 packets" />
            </MetricGrid>
          </Card>
        </Section>

        <Section title="Charts">
          <Card title="Round-trip time" meta="ms · last hour">
            <TimeSeriesChart
              height={180}
              unit="ms"
              threshold={200}
              thresholdLabel="200ms budget"
              labels={["13:06", "13:21", "13:36", "13:51", "14:06"]}
              series={[
                { name: "webinar-us", data: RTT, tone: "accent" },
                { name: "test-room", data: RTT.map((v) => v * 0.62), tone: "secondary" },
              ]}
            />
          </Card>
        </Section>

        <Section title="Tables and events">
          <SplitPane
            left={
              <Card title="Peers" meta="3 active" padded={false}>
                <DataTable
                  columns={[
                    { key: "id", header: "Peer", strong: true },
                    { key: "room", header: "Room", muted: true },
                    {
                      key: "rtt",
                      header: "RTT",
                      align: "right",
                      numeric: true,
                      render: (r) => <LatencyChip value={r.rtt} metric="rtt" plain />,
                    },
                    {
                      key: "loss",
                      header: "Loss",
                      align: "right",
                      numeric: true,
                      render: (r) => <LatencyChip value={r.loss} metric="loss" unit="%" plain />,
                    },
                    { key: "codec", header: "Codec", muted: true },
                    {
                      key: "quality",
                      header: "Quality",
                      align: "right",
                      render: (r) => <QualityIndicator score={r.quality} />,
                    },
                  ]}
                  rows={PEERS}
                  selectedIndex={2}
                />
              </Card>
            }
            right={
              <Card title="Events" padded={false}>
                <EventList entries={EVENTS} />
              </Card>
            }
          />
        </Section>

        <Section title="Alerting">
          <div className="flex flex-col gap-3">
            <AlertBanner
              severity="critical"
              title="Peer ff104b2c is degrading"
              message="Packet loss has been above 2% for 3m 12s. Force audio-only or renegotiate the session."
              meta="webinar-us · ap-south-1 · 14:06:41 · loss 7.90% vs 2%"
              action={<Button size="sm">Force audio-only</Button>}
            />
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity="critical" />
              <SeverityBadge severity="warning" />
              <SeverityBadge severity="info" />
              <SeverityBadge severity="success" />
            </div>
            <Toast
              severity="warning"
              title="Jitter approaching budget"
              message="test-room · 28ms vs 30ms"
              time="14:06"
            />
          </div>
        </Section>

        <Section title="WebRTC">
          <div className="grid grid-cols-3 gap-4">
            <PeerCard
              peerId="ff104b2c"
              status="degraded"
              score={31}
              rtt={218}
              jitter={34}
              loss={7.9}
              codec="h264"
              tracks={["audio", "video"]}
              region="ap-south-1"
              samples={RTT}
            />
            <RoomCard
              roomId="webinar-us"
              peers={48}
              uptime="18m 04s"
              bitrate="2.4 Mbps"
              health="degraded"
              region="eu-west-3"
              samples={LOSS}
            />
            <VideoTile
              label="a3f91c02"
              sublabel="38ms"
              status="live"
              empty
              overlay={<QualityIndicator score={96} />}
            />
          </div>
        </Section>

        <Section title="Controls">
          <Card>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary">Primary</Button>
                <Button>Secondary</Button>
                <Button variant="quiet">Quiet</Button>
                <Button variant="danger">Danger</Button>
                <Button variant="accentQuiet">Accent quiet</Button>
                <Button disabled>Disabled</Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>neutral</Badge>
                <Badge tone="accent">accent</Badge>
                <Badge tone="secondary">secondary</Badge>
                <Badge tone="ok" uppercase>
                  healthy
                </Badge>
                <Badge tone="danger" solid>
                  breached
                </Badge>
                <Pill status="live" count={48}>
                  webinar-us
                </Pill>
                <LatencyChip value={38} label="RTT" />
                <LatencyChip value={218} label="RTT" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <StatusDot status="live" />
                <StatusDot status="connecting" />
                <StatusDot status="degraded" />
                <StatusDot status="disconnected" />
                <StatusDot status="idle" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Room" placeholder="test-room" prefix={<Icon name="search" />} />
                <Input label="Threshold" defaultValue="200" suffix="ms" hint="Alert above this value" />
                <Select label="Region" options={["eu-west-3", "us-east-1", "ap-south-1"]} />
              </div>
              <div className="flex flex-wrap gap-6">
                <Tabs
                  tabs={[
                    { id: "live", label: "Live", count: 12 },
                    { id: "history", label: "History" },
                  ]}
                  activeId="live"
                  variant="segmented"
                />
              </div>
              <ProgressBar label="Bandwidth budget" value={78} showValue threshold={90} />
            </div>
          </Card>
        </Section>

        <Section title="States">
          <div className="grid grid-cols-3 gap-4">
            <Card padded={false}>
              <EmptyState
                title="No active rooms"
                hint="Rooms appear here as soon as a peer joins."
                action={<Button size="sm">Open the quickstart</Button>}
              />
            </Card>
            <Card padded={false}>
              <ErrorState
                title="Signaling connection closed"
                message="The SFU dropped the WebSocket before the answer arrived."
                code="1006"
                detail="abnormal closure: no close frame received"
              />
            </Card>
            <Card title="Loading">
              <LoadingSkeleton variant="rows" rows={4} />
            </Card>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
