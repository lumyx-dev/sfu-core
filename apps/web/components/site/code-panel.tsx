"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent, cn } from '@lumyx/ui';
import { SNIPPETS, type Snippet } from "@/lib/platform-data";
import { ROLE_COLOR, tokenize } from "@/lib/highlight";

function CodeLines({ snippet }: { snippet: Snippet }) {
  return (
    <div className="bg-card py-3.5">
      {snippet.src.map((line, i) => {
        const marked = snippet.mark.includes(i);
        return (
          <div
            key={i}
            className={cn(
              "flex gap-4 py-px pr-4 leading-[1.85]",
              marked && "bg-accent-tint shadow-[inset_2px_0_0_var(--accent)]"
            )}
          >
            <span className="sl-num w-[34px] flex-none select-none pl-3.5 text-right text-12 text-faint">
              {i + 1}
            </span>
            {/* pre-wrap: the markup must not introduce whitespace of its own */}
            <span className="sl-num whitespace-pre-wrap break-words text-13 tracking-[0.005em]">{tokenize(line, snippet.lang).map((tok, k) => (<span key={k} style={{ color: ROLE_COLOR[tok.role] }}>{tok.t}</span>))}</span>
          </div>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex h-6 items-center gap-1.5 rounded-xs border border-hairline bg-card px-2.5 text-[11.5px] font-medium text-muted transition-colors duration-[120ms] ease-[var(--ease-out)] hover:border-stroke hover:text-strong"
    >
      {copied ? <Check className="size-3 stroke-[1.75]" /> : <Copy className="size-3 stroke-[1.75]" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function CodePanel() {
  return (
    <Tabs defaultValue={SNIPPETS[0].id} className="gap-0 overflow-hidden rounded-lg border border-hairline bg-card shadow-[var(--shadow-sm)]">
      <TabsList className="h-10 w-full justify-start gap-0 rounded-none border-b border-subtle bg-sunken p-0">
        {SNIPPETS.map((s) => (
          <TabsTrigger
            key={s.id}
            value={s.id}
            className="h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-4 text-[12.5px] font-medium text-muted shadow-none transition-colors duration-[120ms] ease-[var(--ease-out)] hover:text-strong data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-strong data-[state=active]:shadow-none"
          >
            {s.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {SNIPPETS.map((s) => (
        <TabsContent key={s.id} value={s.id} className="m-0">
          <div className="flex items-center gap-2.5 border-b border-subtle px-4 py-2.5">
            <span className="sl-num text-[12.5px] text-muted">{s.file}</span>
            <span className="inline-flex h-[18px] items-center rounded-[6px] border border-hairline bg-sunken px-[7px] text-[10.5px] font-semibold uppercase tracking-[0.05em] text-faint">
              {s.lang}
            </span>
            <span className="flex-1" />
            <CopyButton text={s.src.join("\n")} />
          </div>
          <CodeLines snippet={s} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
