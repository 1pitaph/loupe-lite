import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { zh } from '@/lib/labels';
import { formatMinutes } from '@/lib/format';
import { usePointsStore } from '@/stores/points-store';

export function PointsListCard() {
  const points = usePointsStore((s) => s.points);
  const activeId = usePointsStore((s) => s.activeId);
  const setActive = usePointsStore((s) => s.setActive);
  const remove = usePointsStore((s) => s.remove);
  const update = usePointsStore((s) => s.update);
  const clear = usePointsStore((s) => s.clear);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>
            {zh('referencePoints')}
            <Badge variant="secondary" className="ml-2">
              {points.length}
            </Badge>
          </span>
          {points.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => clear()}
              className="text-muted-foreground"
            >
              {zh('clearAll')}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {points.length === 0 && (
          <p className="text-xs text-muted-foreground py-2">
            {zh('noPoints')}
          </p>
        )}
        {points.map((p, idx) => {
          const isActive = p.id === activeId;
          return (
            <div
              key={p.id}
              className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer text-xs',
                isActive ? 'bg-accent' : 'hover:bg-accent/60',
              )}
              onClick={() => setActive(p.id)}
            >
              <span
                className="size-3 shrink-0 rounded-full border border-white shadow-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="flex-1 truncate">
                {p.label || `${zh('referencePoints')} ${idx + 1}`}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {formatMinutes(p.minutes)}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  update(p.id, { visible: !p.visible });
                }}
                aria-label={zh('visible')}
              >
                {p.visible ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(p.id);
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label={zh('delete')}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
