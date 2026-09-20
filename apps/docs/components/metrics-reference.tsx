import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lumyx/ui';
import { METRICS } from '@/lib/metrics-data';

/**
 * Tableau recapitulatif des six seuils par defaut, repris de l'ancienne page. Le brief de la
 * tache 5 ne le mentionnait pas ; sans lui, la vue d'ensemble (six metriques sur une grille de
 * six colonnes) disparaissait de la doc migree.
 */
export function MetricsThresholds() {
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Metric</TableHead>
            <TableHead>Field</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Threshold</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead>What it breaks</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {METRICS.map((m) => (
            <TableRow key={m.field}>
              <TableCell className="font-medium text-strong">{m.name}</TableCell>
              <TableCell className="font-mono text-code text-muted">{m.field}</TableCell>
              <TableCell className="text-muted">{m.unit}</TableCell>
              {/* `sl-num` : c'est la colonne dont le travail est la comparaison verticale de
                  nombres (> 2% / > 200ms / < 100kbps). Sans chiffres tabulaires, ils ne
                  s'alignent pas. */}
              <TableCell className="sl-num font-medium text-strong">{m.threshold}</TableCell>
              <TableCell className="text-muted">{m.scope}</TableCell>
              <TableCell className="text-muted">{m.breaks}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/**
 * Le corps d'UNE metrique : sept champs se tiennent mieux dans un objet que dans des
 * paragraphes paralleles.
 *
 * Ce composant ne rend deliberement ni titre ni `id`. Le titre est un vrai `##` dans le MDX,
 * avec son ancre epinglee (`## Packet loss [#packet_loss_ratio]`), pour deux raisons : Fumadocs
 * derive la table des matieres des titres du document au moment de la compilation, donc un titre
 * rendu a l'interieur d'un composant React n'y figure jamais ; et l'ancre explicite conserve
 * `#packet_loss_ratio` la ou rehype-slug aurait produit `#packet-loss`. Poser ici un `id` en plus
 * le dupliquerait.
 */
export function MetricDetail({ field }: { field: string }) {
  const m = METRICS.find((metric) => metric.field === field);
  if (!m) throw new Error(`MetricDetail: metrique inconnue "${field}"`);

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-code text-muted">{m.field}</span>

      <p className="max-w-[680px] text-14 leading-relaxed text-body text-pretty">{m.body}</p>

      <Card>
        <CardContent className="flex flex-col gap-2">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              ['Unit', m.unit],
              ['Default threshold', m.threshold],
              ['Scope', m.scope],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="sl-label">{label}</dt>
                <dd className="text-13 text-body">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-1 rounded-md border border-subtle bg-sunken px-4 py-3.5">
        {m.sample.map((line) => (
          <span key={line} className="whitespace-pre font-mono text-code text-body">
            {line}
          </span>
        ))}
      </div>

      <p className="max-w-[680px] text-13 text-muted text-pretty">
        <span className="text-strong">What breaks:</span> {m.breaks}
      </p>
      <p className="max-w-[680px] text-13 text-muted text-pretty">{m.action}</p>
    </div>
  );
}
