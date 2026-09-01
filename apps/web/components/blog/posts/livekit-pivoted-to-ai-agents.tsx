export default function LivekitPivotedToAiAgents() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-16 leading-relaxed text-body text-pretty">
        On January 22, 2026, LiveKit announced a $100M Series C led by Index Ventures, with Salesforce Ventures,
        Altimeter, Hanabi Capital and Redpoint Ventures participating, at a $1B valuation. That much is a funding
        headline. What matters more is how LiveKit described itself while announcing it — not as a video SFU
        company, but as{" "}
        <a href="https://livekit.com/blog/livekit-series-c">
          &ldquo;the open source framework and cloud platform for voice, video, and physical AI agents.&rdquo;
        </a>{" "}
        Bloomberg&rsquo;s own headline made the same read explicit:{" "}
        <a href="https://www.bloomberg.com/news/articles/2026-01-22/livekit-seller-of-voice-tools-to-openai-raises-100-million">
          &ldquo;LiveKit, Seller of Voice Tools to OpenAI, Raises $100 Million.&rdquo;
        </a>
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">The center of gravity has moved</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        You can see the same shift in the repos. As of today,{" "}
        <a href="https://github.com/livekit/agents">livekit/agents</a> sits at{" "}
        <span className="sl-num text-strong">13,933</span> stars against{" "}
        <a href="https://github.com/livekit/livekit">livekit/livekit</a>&rsquo;s{" "}
        <span className="sl-num text-strong">20,629</span>. The core SFU is still ahead — but that&rsquo;s a
        6.7k-star gap on a repo that&rsquo;s existed for a fraction of the time, and it&rsquo;s where nearly all of
        LiveKit&rsquo;s public content, DevRel energy and funding narrative point now.
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">The pricing model tells the same story</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        LiveKit Cloud&rsquo;s{" "}
        <a href="https://livekit.com/pricing.md">current pricing</a> is built around agent workloads, not plain
        video minutes: Build is free (5,000 WebRTC minutes + 1,000 agent minutes), Ship is $50/mo for 5,000
        agent-session minutes, Scale is $500/mo for 50,000 agent-session minutes and is the hard floor for
        HIPAA/SOC2, and Enterprise is custom. If you&rsquo;re shipping a video product with no agent in the loop,
        you&rsquo;re paying into — and building on top of — a roadmap that isn&rsquo;t optimized for you anymore.
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">Self-hosting still has sharp edges</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        None of this is a knock on LiveKit&rsquo;s engineering. A{" "}
        <a href="https://prodinit.com/blog/self-hosted-livekit-production-guide">production self-hosting guide</a>{" "}
        from July 2026 documents the same defaults every self-hosted SFU has to reckon with: Redis is required
        for multi-instance room state (its absence causes silent split-brain, not a loud error), the UDP
        50000&ndash;60000 range has to be opened and is the single most common cause of ICE failures, symmetric
        NAT needs TURN, and naive CPU-only autoscaling is flagged as the most common operational failure mode.
        Worth noting: that guide&rsquo;s framing of &ldquo;three distinct services&rdquo; (server, agent workers,
        egress) describes an agent-and-recording deployment specifically — a plain video-only LiveKit self-host
        is still one service. Don&rsquo;t let that detail get flattened into a bigger claim than it is.
      </p>

      <h2 className="text-20 font-semibold tracking-[-0.02em] text-strong">Where that leaves video-only teams</h2>
      <p className="text-16 leading-relaxed text-body text-pretty">
        If your product is video first — classrooms, telehealth, live commerce, multiplayer — and you don&rsquo;t
        need an agent runtime, you&rsquo;re now a secondary audience for the SFU you might already depend on.
        That&rsquo;s the gap Lumyx is building into: a Rust SFU that stays a video SFU, with the same jitter,
        packet loss, RTT, NACK ratio and freeze ratio metrics you&rsquo;d otherwise bolt on with Prometheus or a
        third-party SDK, measured natively in the media path instead.
      </p>

      <p className="text-13 leading-relaxed text-faint text-pretty">
        Sources: LiveKit,{" "}
        <a href="https://livekit.com/blog/livekit-series-c">
          &ldquo;LiveKit&rsquo;s Series C: Towards the voice-driven era of computing&rdquo;
        </a>{" "}
        (Jan 22, 2026); Bloomberg,{" "}
        <a href="https://www.bloomberg.com/news/articles/2026-01-22/livekit-seller-of-voice-tools-to-openai-raises-100-million">
          &ldquo;LiveKit, Seller of Voice Tools to OpenAI, Raises $100 Million&rdquo;
        </a>{" "}
        (Jan 22, 2026); GitHub API,{" "}
        <a href="https://github.com/livekit/livekit">livekit/livekit</a> and{" "}
        <a href="https://github.com/livekit/agents">livekit/agents</a> star counts (queried Sep 1, 2026);{" "}
        <a href="https://livekit.com/pricing.md">LiveKit Cloud pricing</a> (Sep 1, 2026); Prodinit,{" "}
        <a href="https://prodinit.com/blog/self-hosted-livekit-production-guide">
          &ldquo;Self-Host LiveKit on ECS: Production Guide&rdquo;
        </a>{" "}
        (Jul 6, 2026).
      </p>
    </div>
  );
}
