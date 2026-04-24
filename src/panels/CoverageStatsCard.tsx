import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { zh } from '@/lib/labels';
import { formatAreaKm2, formatMinutes } from '@/lib/format';
import { useIsochrone } from '@/analysis/isochrone';

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'positive' | 'muted';
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          accent === 'positive'
            ? 'font-mono text-emerald-600 font-semibold tabular-nums'
            : accent === 'muted'
              ? 'font-mono text-muted-foreground tabular-nums'
              : 'font-mono tabular-nums'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function CoverageStatsCard() {
  const iso = useIsochrone();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{zh('coverageStats')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {!iso.graphLoaded && (
          <p
            className={
              iso.loadError
                ? 'text-xs text-destructive py-2'
                : 'text-xs text-muted-foreground py-2'
            }
          >
            {iso.loadError ? zh('graphMissing') : zh('graphLoading')}
          </p>
        )}
        <StatRow label={zh('totalPoints')} value={`${iso.stats.pointCount}`} />
        <StatRow
          label={zh('reachableCells')}
          value={`${iso.stats.reachableCellCount.toLocaleString()}`}
          accent="positive"
        />
        <StatRow
          label={zh('reachableArea')}
          value={formatAreaKm2(iso.stats.reachableAreaKm2 * 1_000_000)}
          accent="positive"
        />
        <StatRow
          label={zh('medianTime')}
          value={formatMinutes(iso.stats.medianMinutes)}
          accent="muted"
        />
        <StatRow
          label={zh('maxTime')}
          value={formatMinutes(iso.stats.maxMinutes)}
          accent="muted"
        />
      </CardContent>
    </Card>
  );
}
