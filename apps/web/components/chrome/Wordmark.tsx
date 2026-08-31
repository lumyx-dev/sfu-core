export function Wordmark({ size = 20 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          background: 'var(--accent)',
          flex: 'none',
        }}
      />
      <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-strong)' }}>
        Sightline
      </span>
    </span>
  );
}
