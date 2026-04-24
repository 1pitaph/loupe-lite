import { label, zh } from '@/lib/labels';
import { CoverageStatsCard } from './CoverageStatsCard';
import { IsochroneCard } from './IsochroneCard';
import { PointEditorCard } from './PointEditorCard';
import { PointsListCard } from './PointsListCard';

export function SidebarPanel() {
  return (
    <aside className="w-[420px] shrink-0 border-l bg-background flex flex-col h-full">
      <header className="px-4 py-3 border-b">
        <h1 className="text-sm font-semibold leading-tight">
          {label('appTitle')}
        </h1>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {zh('appSubtitle')}
        </p>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <CoverageStatsCard />
        <PointsListCard />
        <PointEditorCard />
        <IsochroneCard />
      </div>
      <footer className="px-4 py-2 border-t text-[10px] text-muted-foreground">
        {zh('clickToAdd')}
      </footer>
    </aside>
  );
}
