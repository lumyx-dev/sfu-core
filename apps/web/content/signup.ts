// Source: Sign up.dc.html:209-227 (the `<script data-dc-script>` logic class) — REGIONS, SDK
// and POINTS, copied verbatim. Region and SellingPoint are inferred names: the source itself
// never types these literals. task-12-brief.md's interfaces list types SDK as
// `Record<string, string>` — wrong, each entry is the list of source lines shown in the Keys
// step's snippet box (`SDK[lang][i]`), not a single string; it is typed as `Record<string,
// string[]>` here to match what the source actually holds.

export interface Region {
  id: string;
  latency: string;
}

export const REGIONS: Region[] = [
  { id: 'eu-west-3', latency: '18ms' },
  { id: 'us-east-1', latency: '86ms' },
  { id: 'ap-south-1', latency: '142ms' },
  { id: 'sa-east-1', latency: '204ms' },
];

export const SDK: Record<string, string[]> = {
  js: [
    'import { Room } from "livekit-client";',
    '',
    'const room = new Room();',
    'await room.connect(',
    '  "wss://live-classroom.REGION.sightline.cloud/ws",',
    '  token);',
  ],
  rust: [
    'let client = sightline::Client::new(',
    '  "wss://live-classroom.REGION.sightline.cloud/ws",',
    '  token,',
    ');',
    'client.join("cohort-42").await?;',
  ],
  go: [
    'room, err := sightline.Connect(',
    '  "wss://live-classroom.REGION.sightline.cloud/ws",',
    '  token,',
    ')',
    'if err != nil { log.Fatal(err) }',
  ],
};

export interface SellingPoint {
  title: string;
  body: string;
}

export const POINTS: SellingPoint[] = [
  {
    title: 'One project, ready in 30 seconds',
    body: 'Name it, pick a region, and the keys are on screen. No sales call, no onboarding queue.',
  },
  {
    title: 'Drop-in LiveKit signaling',
    body: 'Keep your client SDKs and token logic. Only the URL and the signing key change.',
  },
  {
    title: 'Six metrics armed by default',
    body: 'Loss, RTT, jitter, NACK, freeze and bitrate come with documented thresholds and alerts already on.',
  },
  {
    title: 'A spend cap from minute one',
    body: 'Set a ceiling before you have traffic. Past it, new rooms are refused and running sessions are preserved.',
  },
];
