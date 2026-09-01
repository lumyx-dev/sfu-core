"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AppHeader, PageBody, Card, CardHeader, CardTitle, CardDescription, Badge, Input, Tabs, TabsList, TabsTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, StatusDot, EmptyState } from '@lumyx/ui';
import { RadioTower } from "lucide-react";
import { ROOMS } from "@/lib/dashboard-data";

export default function RoomsPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<"active" | "ended" | "all">("active");
  const [q, setQ] = React.useState("");

  const rows = ROOMS
    .filter((r) => (filter === "all" ? true : r.state === filter))
    .filter((r) => r.id.includes(q.trim()));

  return (
    <>
      <AppHeader title="Rooms" meta={`${rows.length} of ${ROOMS.length}`} />
      <PageBody>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex-1" />
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="ended">Ended</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select defaultValue="Last 24 hours">
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Last hour", "Last 24 hours", "Last 7 days", "Last 30 days"].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="w-[220px]" placeholder="Search by room_id" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>{filter === "ended" ? "Ended rooms" : filter === "all" ? "All rooms" : "Active rooms"}</CardTitle>
              <CardDescription className="sl-num">{rows.length} of {ROOMS.length}</CardDescription>
            </CardHeader>
            {rows.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>room_id</TableHead>
                    <TableHead className="text-right">Participants</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Bandwidth</TableHead>
                    <TableHead className="text-right">Data</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/rooms/room?id=${r.id}`)}>
                      <TableCell>
                        <span className="sl-num inline-flex items-center gap-2 font-medium text-strong">
                          <StatusDot status={r.health === "idle" ? "idle" : r.health === "degraded" ? "degraded" : "live"} />
                          {r.id}
                        </span>
                      </TableCell>
                      <TableCell className="sl-num text-right">{r.peers}</TableCell>
                      <TableCell className="sl-num text-right text-muted">{r.uptime}</TableCell>
                      <TableCell className="sl-num text-right">{r.bitrate}</TableCell>
                      <TableCell className="sl-num text-right text-muted">{r.data}</TableCell>
                      <TableCell className="sl-num text-right text-muted">{r.started}</TableCell>
                      <TableCell><Badge tone="room">{r.region}</Badge></TableCell>
                      <TableCell><Badge tone={r.state === "active" ? "ok" : "neutral"}>{r.state === "active" ? "Active" : "Ended"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                icon={RadioTower}
                title="No rooms match this filter"
                body="Rooms appear here as soon as a peer joins."
              />
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
