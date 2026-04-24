export const LABELS = {
  appTitle:        { zh: '纽约等时圈',                         en: 'NYC Isochrone' },
  appSubtitle:     { zh: 'OSM + MTA GTFS · H3 r9 网格',         en: 'OSM + MTA GTFS · H3 r9 hex grid' },

  clickToAdd:      { zh: '点击地图添加出发点',                 en: 'Click map to add an origin' },

  referencePoints: { zh: '出发点',                             en: 'Origins' },
  addPoint:        { zh: '添加',                               en: 'Add' },
  noPoints:        { zh: '点击地图开始添加出发点',             en: 'Click map to start adding origins' },
  noPointSelected: { zh: '在地图或列表中选择一个出发点',       en: 'Select an origin on the map or list' },
  delete:          { zh: '删除',                               en: 'Delete' },
  clearAll:        { zh: '清空',                               en: 'Clear' },
  visible:         { zh: '显示',                               en: 'Visible' },

  pointEditor:     { zh: '出发点设置',                         en: 'Origin Settings' },
  name:            { zh: '名称',                               en: 'Name' },
  minutes:         { zh: '时间预算',                           en: 'Time Budget' },
  transitMode:     { zh: '出行方式',                           en: 'Transit Mode' },
  walk:            { zh: '步行',                               en: 'Walk' },
  bike:            { zh: '骑行',                               en: 'Bike' },
  walkSubway:      { zh: '步行 + 地铁',                        en: 'Walk + Subway' },
  walkSubwayBus:   { zh: '步行 + 地铁 + 公交',                  en: 'Walk + Subway + Bus' },

  isochrone:       { zh: '等时圈显示',                         en: 'Isochrone Layer' },
  colorMode:       { zh: '配色',                               en: 'Color' },
  colorByPoint:    { zh: '按出发点',                           en: 'By Origin' },
  colorByTime:     { zh: '按时间',                             en: 'By Time' },

  coverageStats:   { zh: '可达统计',                           en: 'Reachability Stats' },
  totalPoints:     { zh: '出发点数',                           en: 'Origins' },
  reachableCells:  { zh: '可达六边形',                         en: 'Reachable Cells' },
  reachableArea:   { zh: '可达面积',                           en: 'Reachable Area' },
  medianTime:      { zh: '中位到达时间',                       en: 'Median Time' },
  maxTime:         { zh: '最长到达时间',                       en: 'Max Time' },

  graphLoading:    { zh: '正在加载 NYC 等时圈图…',              en: 'Loading NYC isochrone graph…' },
  graphMissing:    { zh: '未找到图数据，请先运行 `pnpm build:graph`', en: 'Graph data missing — run `pnpm build:graph` first' },

  confirm:         { zh: '确定',                               en: 'Confirm' },
  cancel:          { zh: '取消',                               en: 'Cancel' },
  disabled:        { zh: '隐藏',                               en: 'Hidden' },
} as const;

export type LabelKey = keyof typeof LABELS;

export function label(key: LabelKey, sep = ' '): string {
  const entry = LABELS[key];
  return `${entry.zh}${sep}${entry.en}`;
}

export function zh(key: LabelKey): string {
  return LABELS[key].zh;
}

export function en(key: LabelKey): string {
  return LABELS[key].en;
}
