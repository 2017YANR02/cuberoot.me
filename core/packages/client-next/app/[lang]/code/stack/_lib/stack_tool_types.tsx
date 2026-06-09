import type { ReactNode } from 'react';

// ─── Schema (rich, similar depth to /code/language/ts) ──────────────────────

export interface HeroStat {
  num: ReactNode;
  unit?: string;
  zh: ReactNode;
  en: ReactNode;
    zhHant?: ReactNode;
}

export interface StackHistoryItem {
  year: ReactNode;
  highlight?: boolean;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
}

export interface ConceptCard {
  tag: string;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code?: ReactNode;
}

export interface WhyCard {
  icon: ReactNode;
  zh: { title: ReactNode; desc: ReactNode };
  en: { title: ReactNode; desc: ReactNode };
  code?: ReactNode;
}

export interface Adopter {
  name: string;
  href?: string;
  highlight?: boolean;
  zhNote: string;
  enNote: string;
}

export interface OutlookCard {
  tag: ReactNode;
  hot?: boolean;
  big?: boolean;
  zh: { title: ReactNode; body: ReactNode };
  en: { title: ReactNode; body: ReactNode };
}

export interface StackTool {
  slug: string;
  name: string;
  version: string;
  since: string;
  group: 'frontend' | 'backend' | 'edge' | 'dev';
  accent: string;
  bright: string;
  glyph: ReactNode;
  floats: string[];
  zh: {
    tagline: string;
    role: string;
    heroSub: ReactNode;
    whatDesc: ReactNode;
    historyDesc: ReactNode;
    conceptsTitle: string;
    conceptsDesc: ReactNode;
    whyDesc: ReactNode;
    adoptersTitle: string;
    adoptersDesc: ReactNode;
    cuberootDesc: ReactNode;
    outlookTitle: string;
    outlookDesc: ReactNode;
  };
  en: {
    tagline: string;
    role: string;
    heroSub: ReactNode;
    whatDesc: ReactNode;
    historyDesc: ReactNode;
    conceptsTitle: string;
    conceptsDesc: ReactNode;
    whyDesc: ReactNode;
    adoptersTitle: string;
    adoptersDesc: ReactNode;
    cuberootDesc: ReactNode;
    outlookTitle: string;
    outlookDesc: ReactNode;
  };
  heroStats: HeroStat[];
  intro: { zh: ReactNode; en: ReactNode };
  history: StackHistoryItem[];
  concepts: ConceptCard[];
  whyCards: WhyCard[];
  adopters: Adopter[];
  outlook: OutlookCard[];
  cuberoot: { zh: ReactNode; en: ReactNode };
  links: { label: string; href: string }[];
}

// Code-style helper wrappers used inside `code:` snippet ReactNodes.
// Reuses the .cl-* classes scoped under .ts-intro-root.
export const k = (x: ReactNode) => <span className="cl-k">{x}</span>;
export const v = (x: ReactNode) => <span className="cl-v">{x}</span>;
export const s = (x: ReactNode) => <span className="cl-s">{x}</span>;
export const n = (x: ReactNode) => <span className="cl-n">{x}</span>;
export const f = (x: ReactNode) => <span className="cl-fn">{x}</span>;
export const p = (x: ReactNode) => <span className="cl-prop">{x}</span>;
export const c = (x: ReactNode) => <span className="cl-c">{x}</span>;
export const t = (x: ReactNode) => <span className="cl-type">{x}</span>;
