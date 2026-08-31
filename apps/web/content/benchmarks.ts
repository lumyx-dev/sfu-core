// Source: Home.dc.html, logic class, `proofRust()` — the "Runtime characteristics" table
// inside the third pain block on Home (content/home.ts PAINS[2]). NOT the three invented
// metrics ("Memory at rest", "Peers per core", "Forwarding p99") an earlier draft of the task
// brief described — those never appear anywhere in the source. The string "benchmark pending"
// occurs exactly once in the whole handoff, on the last row below.
//
// UNVERIFIED — "Measured throughput" is literally awaiting publication ("benchmark pending —
// number to be published" is the source's own copy, not a placeholder we invented). The other
// three rows are architectural facts (no GC, no CGO, no GC pause), not measurements, so they
// carry no such caveat.

export interface Benchmark {
  label: string;
  value: string;
}

export const BENCHMARKS: Benchmark[] = [
  { label: 'Media path', value: 'Rust · no garbage collector' },
  { label: 'FFI boundary', value: 'none — no CGO in the hot path' },
  { label: 'Tail latency', value: 'no GC pause to schedule around' },
  { label: 'Measured throughput', value: 'benchmark pending — number to be published' },
];
