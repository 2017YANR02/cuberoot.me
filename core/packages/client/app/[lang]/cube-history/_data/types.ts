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
export type CubeTier = 'flagship' | 'mainstream' | 'budget' | 'specialty' | 'unknown';
export interface CubeImage {
  /** Original image URL observed on the cited product page or its public metadata. */
  url: string;
  /** Optional unchanged local copy, served when the original host blocks image embedding. */
  assetPath?: string;
  sourceId: string;
  alt: LocalizedText;
  /** family is only used when the source itself shares photography across versions. */
  match: 'exact' | 'family';
  note: LocalizedText;
}
export interface CubeRating {
  value: number;
  scale: number;
  count: number;
  asOf: string;
  sourceId: string;
  /** The merchant's product-page pool may include multiple colorways or configurations. */
  scope: 'product-page';
  note: LocalizedText;
}
export interface Cube {
  id: string;
  brand: string;
  name: LocalizedText;
  /** Related versions point to a stable, existing model ID. The root does not point to itself. */
  familyId?: string;
  /** Source-informed editorial positioning, not a performance score. */
  tier?: CubeTier;
  image: CubeImage | null;
  imageNote?: LocalizedText;
  rating?: CubeRating;
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
  /** Context-only family quotes whose configuration is unspecified; excluded from exact-model price filters. */
  familyPrices?: CubePrice[];
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
  category: 'speed' | 'smart' | 'classic' | 'mini' | 'educational' | 'collectible';
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
