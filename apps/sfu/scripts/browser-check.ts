// QA de bout en bout, dans de vrais navigateurs.
//
// Lance N onglets Chrome headless sur la console de test, les fait se
// connecter, publier et rejoindre la même room, puis vérifie que chacun affiche
// bien N-1 vignettes distantes portant de la vidéo décodée.
//
// C'est le complément de `tests/room.rs` : les tests Rust remplacent le
// navigateur par str0m, ce qui couvre le routage et la négociation mais pas la
// façon dont Chrome interprète une re-offer. Les deux défauts qu'ils n'ont pas
// vus — une vignette fantôme pendant la renégociation, et l'absence de
// keyframe — se sont vus ici.
//
// Usage :
//   cargo run &                      # le SFU sur https://localhost:3000
//   bun scripts/browser-check.ts 5   # 5 participants
//
// Variables : CHROME_BIN (chemin du binaire), SFU_URL, CDP_PORT.

const CHROME =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SFU_URL = process.env.SFU_URL ?? "https://localhost:3000/";
const N = Number(process.argv[2] ?? 3);
const PORT = Number(process.env.CDP_PORT ?? 9333);

const proc = Bun.spawn([
  CHROME,
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  "--ignore-certificate-errors",
  "--autoplay-policy=no-user-gesture-required",
  "--no-sandbox",
  "--disable-gpu",
  `--user-data-dir=/tmp/lumyx-chrome-${Date.now()}`,
  "about:blank",
], { stdout: "inherit", stderr: "inherit" });

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function browserWs(): Promise<string> {
  for (let i = 0; i < 160; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error("Chrome n'a pas démarré");
}

class Cdp {
  ws!: WebSocket; id = 0; pending = new Map<number, any>();
  static async open(url: string) {
    const c = new Cdp();
    c.ws = new WebSocket(url);
    await new Promise((res, rej) => { c.ws.onopen = res; c.ws.onerror = rej; });
    c.ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string);
      if (m.id && c.pending.has(m.id)) { c.pending.get(m.id)(m); c.pending.delete(m.id); }
    };
    return c;
  }
  send(method: string, params: any = {}, sessionId?: string): Promise<any> {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, (m: any) => m.error ? rej(new Error(method + ": " + JSON.stringify(m.error))) : res(m.result));
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
}

const cdp = await Cdp.open(await browserWs());

async function newTab(): Promise<string> {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
  return sessionId;
}

const evalIn = async (s: string, expr: string) =>
  (await cdp.send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, s)).result.value;

const sessions: string[] = [];
for (let i = 0; i < N; i++) sessions.push(await newTab());

for (const s of sessions) {
  await cdp.send("Page.enable", {}, s);
  await cdp.send("Runtime.enable", {}, s);
  await cdp.send("Page.navigate", { url: SFU_URL }, s);
}
await sleep(2500);

// connect → camera → call, then join once the transport is up.
for (const s of sessions) await evalIn(s, `document.getElementById('btnConnect').click(), 1`);
await sleep(1200);
for (const s of sessions) await evalIn(s, `document.getElementById('btnCamera').click(), 1`);
await sleep(1500);
for (const s of sessions) await evalIn(s, `document.getElementById('btnCall').click(), 1`);
await sleep(3000);
for (const s of sessions) {
  const ready = await evalIn(s, `!document.getElementById('btnJoin').disabled`);
  if (!ready) console.log("!! btnJoin encore désactivé");
  await evalIn(s, `document.getElementById('btnJoin').click(), 1`);
}
// Poll rather than guess: the room settles once every tab shows N-1 remote
// tiles carrying decoded video.
const probe = `JSON.stringify({
      tiles: [...document.querySelectorAll('#videoGrid .video-card')].map(c => {
        const v = c.querySelector('video');
        return { id: c.id.replace('remote-',''), local: c.id === 'localCard',
                 w: v?.videoWidth ?? 0, h: v?.videoHeight ?? 0,
                 tracks: v?.srcObject?.getTracks().map(t => t.kind) ?? [] };
      }),
      log: [...document.querySelectorAll('.log-entry')].slice(-8).map(e => e.textContent.trim()),
    })`;

let settled = false;
for (let i = 0; i < 50 && !settled; i++) {
  await sleep(600);
  settled = true;
  for (const s of sessions) {
    const r = JSON.parse(await evalIn(s, probe));
    const remotes = r.tiles.filter((t: any) => !t.local);
    if (remotes.length !== N - 1 || remotes.some((t: any) => t.w === 0)) settled = false;
  }
}

let ok = true;
for (const [i, s] of sessions.entries()) {
  const r = JSON.parse(await evalIn(s, probe));
  const remotes = r.tiles.filter((t: any) => !t.local);
  const live = remotes.filter((t: any) => t.w > 0 && t.h > 0);
  const complete = remotes.filter((t: any) => t.tracks.length === 2);
  const verdict = remotes.length === N - 1 && live.length === N - 1 && complete.length === N - 1 ? "OK " : "ÉCHEC";
  if (verdict === "ÉCHEC") ok = false;
  console.log(`${verdict} onglet ${i}: ${remotes.length}/${N - 1} vignettes, ${live.length} en vidéo`,
    JSON.stringify(remotes.map((t: any) => `${t.id} ${t.w}x${t.h} [${t.tracks}]`)));
  if (verdict === "ÉCHEC") console.log("   log:", r.log.join(" | "));
}

console.log(ok ? `\n✅ ${N} peers : chacun voit les ${N - 1} autres, en vidéo.` : `\n❌ échec`);
proc.kill();
process.exit(ok ? 0 : 1);
