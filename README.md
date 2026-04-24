# loupe-lite — 纽约等时圈 (NYC Isochrone)

基于真实路网 + 公共交通的等时圈可视化工具，使用 H3 r9 六边形网格呈现。数据来源：OpenStreetMap、NYC Open Data（行政区边界）、MTA 静态 GTFS（地铁，可选公交）。

Network-aware isochrone visualization over NYC's five boroughs, rendered as an H3 r9 hex grid. Data: OpenStreetMap, NYC Open Data (borough boundaries), MTA static GTFS (subway; bus optional).

灵感来源 Inspired by patent CN110046208A (关键点 + 通勤时间矩阵 hub-and-spoke 等时圈) — we adapt the hub-and-spoke idea to a hex-cell output so the reachable region follows water and transit lines rather than degenerating to overlapping circles.

## 功能 Features

- **六边形等时圈 Hex isochrone** — 点击地图放置出发点，选择时间预算和出行方式，图中显示所有可达的 H3 r9 网格（≈174m 边长）。
- **多模交通 Multi-modal** — 步行 / 骑行 / 步行+地铁 / 步行+地铁+公交。地铁段使用 MTA GTFS 平均区间时间，步行段基于 OSM 可步行路网 + 主要人行桥。
- **多个出发点并集 Multiple origins** — 支持任意多个出发点；每个六边形归属于到达最快的那个出发点。
- **按点或按时间着色 Color by origin or by time** — 右侧面板切换。
- **全客户端 Fully client-side** — 图加载后所有 Dijkstra 在浏览器里跑，无需 API Key、无网络请求（除了一次静态文件下载）。

## 使用 Usage

### 一、构建预计算图（一次性）Build the graph (one-time)

```bash
pnpm install
pnpm build:graph
```

这会：
1. 下载 NYC 行政区边界（约 1MB）— 作为 H3 r9 陆地网格的来源
2. 下载 MTA 地铁静态 GTFS（约 40MB）— 计算站点间平均通勤时间
3. 生成 `public/data/nyc-graph.json`（约 200–500KB）

下载文件缓存在 `data/raw/`，重复运行时不会再次下载。

### 二、开发 / 构建 Develop / Build

```bash
pnpm dev      # 开发服务器 · dev server
pnpm build    # 生产构建 · production build
pnpm preview  # 预览生产包 · preview production
```

### 交互 Interactions

| 动作 Action               | 说明 Description |
|---------------------------|-------------------|
| 点击空白 Click empty      | 添加出发点 Add origin |
| 点击出发点 Click origin   | 选中（面板打开编辑）Select for editing |
| 拖拽出发点 Drag origin    | 移动位置，等时圈实时重算 Move, isochrone recomputes |
| Delete / Backspace        | 删除当前出发点 Delete active origin |
| ESC                       | 清除选中 Deselect |

## 技术栈 Stack

React 19 · TypeScript · Vite · Tailwind v4 + shadcn/radix · maplibre-gl + react-map-gl · deck.gl（`H3HexagonLayer`）· zustand · h3-js · tinyqueue

## 数据来源 Data sources

- **行政区边界 Borough boundaries** — [NYC Open Data · Borough Boundaries (gthc-hcne)](https://data.cityofnewyork.us/City-Government/Borough-Boundaries/gthc-hcne)
- **地铁 Subway GTFS** — [MTA Static GTFS (rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip)](https://rrgtfsfeeds.s3.amazonaws.com/gtfs_subway.zip)
- **地图瓦片 Tiles** — [OpenFreeMap Positron](https://openfreemap.org/) (OSM-derived, no key required)

## 算法说明 Algorithm notes

构建阶段 (scripts/build-nyc-graph.ts)：

1. 用 `h3.polygonToCells` 将每个行政区 GeoJSON polygon 转成一组 H3 r9 网格 — 这是"陆地"网格集合。
2. 解析 MTA GTFS `stops.txt` + `stop_times.txt`：
   - 每个 `stop_id` 映射到其 H3 r9 cell。
   - 对每个 trip 的连续两站 (i, i+1)，取 `stop_times[i+1].arr - stop_times[i].dep + 30s` 作为一次通勤时间样本。
   - 对同一对有序 cell 的多次样本求平均，得到地铁边。
3. 加入人行桥硬编码（Brooklyn / Manhattan / Williamsburg / Queensboro / Pulaski / RFK 等）— OSM 网络在客户端计算出的步行图无法跨水，桥边显式补上。
4. 所有节点和边写入 `nyc-graph.json`。

运行阶段 (src/analysis/)：

1. 首次访问时加载 `nyc-graph.json`，在内存中重建图：每个 cell 的邻居通过 `h3.gridDisk(cell, 1)` 动态生成（只保留也在图里的邻居），权重 = `haversine_distance / 步行速度`。
2. 用户点击地图 → 把点捕捉到对应 H3 cell（若落在水里则扩环直到找到陆地 cell）。
3. 从捕捉到的起点运行 Dijkstra（tinyqueue 优先队列），达到时间预算后剪枝退出。
4. 出行方式决定启用哪些边：
   - `walk`: 步行边 + 人行桥
   - `bike`: 步行边（按 `walk_speed / bike_speed` 缩放）
   - `walk+subway`: 步行边 + 人行桥 + 地铁边
   - `walk+subway+bus`: 同上加公交（v1 未接入）

## 目录 Structure

```
src/
├── analysis/         # hex-graph.ts (loader + Dijkstra), isochrone.ts, types.ts
├── map/              # MapView.tsx, IsochroneLayer.ts, PointsLayer.ts, interactions.ts
├── panels/           # CoverageStatsCard, PointsListCard, PointEditorCard, IsochroneCard
├── stores/           # points-store, ui-store
├── lib/              # labels.ts, format.ts, utils.ts
├── data/             # tile-sources.ts, nyc.ts
└── components/ui/    # shadcn 基础组件

scripts/
└── build-nyc-graph.ts  # 一次性离线图构建
```
