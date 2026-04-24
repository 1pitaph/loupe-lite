import { MapView } from '@/map/MapView';
import { SidebarPanel } from '@/panels/SidebarPanel';

export default function App() {
  return (
    <div className="flex h-full w-full">
      <main className="relative flex-1 bg-background">
        <MapView />
      </main>
      <SidebarPanel />
    </div>
  );
}
