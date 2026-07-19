// Data-shape types for the WCA stat renderer (WcaStatView family).
// Extracted verbatim from WcaStatView.tsx — pure declarations, no runtime.

export interface StatHeader {
  key: string;
  label: string;
  labelZh: string;
  align: 'left' | 'right' | 'center';
}

export interface StatSection {
  title: string;
  titleZh?: string;
  rows: unknown[][];
}

export interface StatPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  header: StatHeader[];
  sections: StatSection[];
}

export interface SourcePanel {
  id: string;
  labelEn: string;
  labelZh: string;
  panels: StatPanel[];
}

export interface MetricPanel {
  id: string;
  labelEn: string;
  labelZh: string;
  panels?: StatPanel[];
  sourcePanels?: SourcePanel[];
  // NOTE: 若设置——sourcePanels 的选择器渲染为 BoolToggle（off=源[0], on=源[1]），而非 tab bar。
  //   round_top3_sum 的「只看决赛」布尔开关。仅当 sourcePanels 恰为 2 个时生效。
  sourceBool?: { labelEn: string; labelZh: string };
}

export interface MetricGroup {
  label: string;
  labelZh: string;
  items: string[];
}

export interface StatData {
  id: string;
  title: string;
  titleZh: string;
  note?: string;
  noteZh?: string;
  header: StatHeader[];
  rows?: unknown[][];
  sections?: StatSection[];
  panels?: StatPanel[];
  metricPanels?: MetricPanel[];
  metricGroups?: MetricGroup[];
  years?: number[];
  cumulative?: Record<string, number[]>;
}
