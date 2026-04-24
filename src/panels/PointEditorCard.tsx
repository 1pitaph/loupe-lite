import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { zh, type LabelKey } from '@/lib/labels';
import { formatMinutes } from '@/lib/format';
import type { TransitMode } from '@/analysis/types';
import {
  MAX_MINUTES,
  MIN_MINUTES,
  usePointsStore,
} from '@/stores/points-store';

const MODE_OPTIONS: Array<{ key: TransitMode; labelKey: LabelKey }> = [
  { key: 'walk', labelKey: 'walk' },
  { key: 'bike', labelKey: 'bike' },
  { key: 'walk+subway', labelKey: 'walkSubway' },
  { key: 'walk+subway+bus', labelKey: 'walkSubwayBus' },
];

function SegmentedRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ key: T; labelKey: LabelKey }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-md border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-sm px-2 py-1 text-xs transition-colors',
            value === o.key
              ? 'bg-background shadow-sm font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {zh(o.labelKey)}
        </button>
      ))}
    </div>
  );
}

export function PointEditorCard() {
  const points = usePointsStore((s) => s.points);
  const activeId = usePointsStore((s) => s.activeId);
  const update = usePointsStore((s) => s.update);
  const active = points.find((p) => p.id === activeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{zh('pointEditor')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!active && (
          <p className="text-xs text-muted-foreground py-2">
            {zh('noPointSelected')}
          </p>
        )}

        {active && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {zh('name')}
              </label>
              <input
                type="text"
                value={active.label}
                onChange={(e) => update(active.id, { label: e.target.value })}
                placeholder={zh('referencePoints')}
                className="w-full h-8 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {zh('transitMode')}
              </label>
              <SegmentedRow<TransitMode>
                value={active.transitMode}
                options={MODE_OPTIONS}
                onChange={(v) => update(active.id, { transitMode: v })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{zh('minutes')}</span>
                <span className="font-mono">{formatMinutes(active.minutes)}</span>
              </div>
              <Slider
                min={MIN_MINUTES}
                max={MAX_MINUTES}
                step={1}
                value={[active.minutes]}
                onValueChange={([v]) => update(active.id, { minutes: v })}
              />
            </div>

            <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
              <span>
                {active.lng.toFixed(4)}, {active.lat.toFixed(4)}
              </span>
              <Button
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => update(active.id, { visible: !active.visible })}
              >
                {active.visible ? zh('visible') : zh('disabled')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
