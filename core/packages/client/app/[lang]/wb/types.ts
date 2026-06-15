// Mirror of core/packages/wb-build/src/types.ts (kept in sync manually).
export type WbTabId = 'standard' | 'oh' | 'wf' | 'bld' | 'fm' | 'virtual' | 'team' | 'other';

export interface WbBilingual { en: string; zh: string;
 }

export interface WbRecord {
  format: string;
  result: string;
  resultMs: number | null;
  cuber: string;
  country: string;
  iso2: string | null;
  date: string | null;
  video: string | null;
  notes: string | null;
}

export interface WbEvent {
  id: string;
  name: string;
  records: WbRecord[];
}

export interface WbCategory {
  id: string;
  name: WbBilingual;
  events: WbEvent[];
}

export interface WbTab {
  id: WbTabId;
  name: WbBilingual;
  categories: WbCategory[];
}

export interface WbDataset {
  scrapedAt: string;
  sourceUrl: string;
  tabs: WbTab[];
}
