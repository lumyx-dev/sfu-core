/**
 * Thème Shiki Lumyx.
 *
 * Shiki accepte des valeurs de couleur non hexadécimales depuis 0.9.15 (« Arbitrary Color
 * Values ») : il substitue un marqueur interne le temps de la tokenisation, puis restitue la
 * valeur d'origine. On peut donc peindre un thème TextMate entier avec des variables CSS, ce qui
 * donne trois choses à la fois — aucune couleur littérale dans le rendu, les couleurs exactes du
 * design system, et un mode sombre gratuit puisque les tokens `--code-*` pointent sur des alias
 * sémantiques qui basculent déjà sous `.dark`.
 *
 * Contrepartie documentée par Shiki : le thème n'est plus compatible TextMate au sens strict et
 * devient inutilisable hors web (shiki-cli, shiki-monaco). Sans effet ici.
 *
 * Les neuf rôles reprennent la map `ROLE_COLOR` du tokenizer de la landing
 * (`apps/landing/lib/highlight.ts`), pour que la doc et le site marketing colorient le code de
 * façon identique.
 */

export type CodeThemeSetting = {
  scope: string[];
  settings: { foreground: string };
};

export type CodeTheme = {
  name: string;
  bg: string;
  fg: string;
  settings: CodeThemeSetting[];
};

export const lumyxCodeTheme: CodeTheme = {
  name: "lumyx",
  bg: "var(--code-bg)",
  fg: "var(--code-fg)",
  settings: [
    {
      scope: ["comment", "punctuation.definition.comment", "string.comment"],
      settings: { foreground: "var(--code-comment)" },
    },
    {
      scope: [
        "string",
        "string.quoted",
        "string.template",
        "constant.other.symbol",
        "meta.embedded.assembly",
      ],
      settings: { foreground: "var(--code-string)" },
    },
    {
      scope: [
        "constant.numeric",
        "constant.language",
        "constant.character",
        "constant.other",
        "keyword.other.unit",
      ],
      settings: { foreground: "var(--code-number)" },
    },
    {
      scope: [
        "keyword",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
        "storage",
        "storage.type",
        "storage.modifier",
        "variable.language",
      ],
      settings: { foreground: "var(--code-keyword)" },
    },
    {
      scope: [
        "entity.name.function",
        "support.function",
        "meta.function-call.generic",
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: "var(--code-function)" },
    },
    {
      scope: [
        "support.type.property-name",
        "meta.object-literal.key",
        "variable.other.member",
        "entity.name.tag",
        "entity.other.attribute-name",
        "support.type.property-name.toml",
        "entity.name.tag.yaml",
      ],
      settings: { foreground: "var(--code-property)" },
    },
    {
      scope: [
        "punctuation",
        "punctuation.separator",
        "punctuation.terminator",
        "punctuation.definition.string",
        "meta.brace",
        "keyword.operator",
      ],
      settings: { foreground: "var(--code-punct)" },
    },
  ],
};
