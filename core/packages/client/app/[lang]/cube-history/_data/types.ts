/** Research snapshot. Unknown is a value: never replace missing facts with estimates. */
export interface LocalizedText { zh: string; en: string }
export type ReleaseBasis = 'official' | 'retailer' | 'documented' | 'approximate' | 'unknown';
export type PriceKind = 'current' | 'launch' | 'historical';
export interface Source {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: 'official' | 'retailer' | 'review' | 'archive';
}
export interface CubePrice {
  amount: number;
  currency: string;
  region: string;
  kind: PriceKind;
  asOf: string | null;
  variant: string | null;
  note: LocalizedText;
  sourceId: string;
}
export interface Cube {
  id: string;
  brand: string;
  name: LocalizedText;
  /** Sorting year, not necessarily a launch year. Always display release.basis with it. */
  year: number | null;
  release: {
    date: string | null;
    precision: 'day' | 'month' | 'year' | 'unknown';
    basis: ReleaseBasis;
    note: LocalizedText;
    sourceIds: string[];
  };
  prices: CubePrice[];
  specs: {
    /** Explicitly retain units and version qualification; never parse gross weight as item weight. */
    size: string | null;
    weight: string | null;
    mechanism: string[];
    adjustment: LocalizedText | null;
  };
  highlights: LocalizedText[];
  assessment: {
    summary: LocalizedText;
    tradeoffs: LocalizedText;
    basis: 'editorial' | 'review';
    sourceIds: string[];
  };
  variants: string[];
  sourceIds: string[];
  tags: string[];
  /** released means a historical commercial release, not a guarantee of present stock. */
  status: 'released' | 'announced' | 'unverified';
  category: 'speed' | 'smart' | 'classic' | 'mini' | 'educational';
}
export interface Dataset {
  sources: Source[];
  cubes: Cube[];
  /** Research handover notes; public methodology is separately localized. */
  coverageNotes: string[];
}
export interface Milestone {
  id: string;
  year: number;
  period: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
  sourceIds: string[];
  cubeIds: string[];
}
