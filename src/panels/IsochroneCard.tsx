import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { zh, type LabelKey } from '@/lib/labels';
import type { IsochroneColorMode } from '@/map/IsochroneLayer';
import { useUIStore } from '@/stores/ui-store';

const COLOR_OPTIONS: Array<{ key: IsochroneColorMode; labelKey: LabelKey }> = [
  { key: 'byPoint', labelKey: 'colorByPoint' },
  { key: 'byTime', labelKey: 'colorByTime' },
];

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ key: T; labelKey: LabelKey }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-full rounded-md border bg-muted/40 p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            'flex-1 rounded-sm px-2 py-1 text-xs transition-colors',
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

export function IsochroneCard() {
  const enabled = useUIStore((s) => s.isochroneEnabled);
  const colorMode = useUIStore((s) => s.colorMode);
  const setEnabled = useUIStore((s) => s.setIsochroneEnabled);
  const setColorMode = useUIStore((s) => s.setColorMode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{zh('isochrone')}</span>
          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] transition-colors',
              enabled
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {enabled ? zh('visible') : zh('disabled')}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn('space-y-3', !enabled && 'opacity-50 pointer-events-none')}
      >
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            {zh('colorMode')}
          </label>
          <Segmented
            value={colorMode}
            options={COLOR_OPTIONS}
            onChange={setColorMode}
          />
        </div>
      </CardContent>
    </Card>
  );
}
