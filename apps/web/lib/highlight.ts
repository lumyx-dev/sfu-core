import type { Lang } from "@/lib/platform-data";

/**
 * A deliberately small tokenizer — enough to colour the five snippet languages
 * on the landing page without pulling a highlighter into the bundle.
 * Colours are token roles, resolved to design-system CSS variables.
 */
export type Role = "comment" | "str" | "num" | "kw" | "key" | "fn" | "punct" | "plain";

export type Token = { t: string; role: Role };

export const ROLE_COLOR: Record<Role, string> = {
  comment: "var(--text-faint)",
  str: "var(--ok)",
  num: "var(--accent-2)",
  kw: "var(--accent-text)",
  key: "var(--text-strong)",
  fn: "var(--info)",
  punct: "var(--text-faint)",
  plain: "var(--text-body)",
};

const KEYWORD =
  /^(const|let|await|async|return|if|else|new|function|import|from|export|true|false|null|undefined)$/;

export function tokenize(line: string, lang: Lang): Token[] {
  const out: Token[] = [];
  let rest = line;
  let guard = 0;

  const push = (t: string, role: Role) => out.push({ t, role });

  while (rest.length > 0 && guard++ < 400) {
    let m: RegExpMatchArray | null;

    if ((m = rest.match(/^(\/\/[^\n]*|#[^\n]*)/))) {
      push(m[0], "comment");
    } else if ((m = rest.match(/^"[^"]*"|^'[^']*'/))) {
      const after = rest.slice(m[0].length);
      push(m[0], lang === "json" && /^\s*:/.test(after) ? "key" : "str");
    } else if ((m = rest.match(/^-?\d+(\.\d+)?[a-z%]*/))) {
      push(m[0], "num");
    } else if ((m = rest.match(/^\[[\w.\-]+\]/))) {
      push(m[0], "kw");
    } else if ((m = rest.match(/^[A-Za-z_$][\w$.\-/]*/))) {
      const word = m[0];
      const after = rest.slice(word.length);
      if (KEYWORD.test(word)) push(word, "kw");
      else if (after.startsWith("(")) push(word, "fn");
      else if ((lang === "yaml" || lang === "toml") && /^\s*[:=]/.test(after)) push(word, "key");
      else push(word, "plain");
    } else if ((m = rest.match(/^\s+/))) {
      push(m[0], "plain");
    } else {
      m = [rest[0]] as unknown as RegExpMatchArray;
      push(rest[0], "punct");
    }

    rest = rest.slice(m[0].length);
  }

  return out.length > 0 ? out : [{ t: " ", role: "plain" }];
}
