import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      <h1
        className="text-4xl"
        style={{ color: "var(--text-strong)", fontWeight: "var(--fw-semibold)", letterSpacing: "var(--ls-tight)" }}
      >
        Lumyx
      </h1>
      <p className="max-w-md" style={{ color: "var(--text-muted)", lineHeight: "var(--lh-body)" }}>
        This app hosts the Lumyx design system. Browse the full component gallery to see
        every token, primitive, and pattern rendered together.
      </p>
      <Link
        href="/_ds"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: 40,
          padding: "0 var(--space-8)",
          borderRadius: "var(--radius-pill)",
          background: "var(--accent)",
          color: "var(--text-on-accent)",
          fontWeight: "var(--fw-medium)",
          textDecoration: "none",
        }}
      >
        View design system
      </Link>
    </div>
  );
}
