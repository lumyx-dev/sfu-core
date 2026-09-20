import Link from 'next/link';
import { Card, CardContent } from '@lumyx/ui';

export function DocCards({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>;
}

export function DocCard({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="no-underline hover:no-underline">
      <Card className="h-full transition-colors duration-[120ms] ease-[var(--ease-out)] hover:border-stroke">
        <CardContent className="flex flex-col gap-1.5">
          <span className="text-14 font-medium text-strong">{title}</span>
          <span className="text-13 leading-relaxed text-muted text-pretty">{children}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
