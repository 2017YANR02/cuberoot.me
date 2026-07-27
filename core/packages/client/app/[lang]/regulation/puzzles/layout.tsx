import { regulationMetadata } from '../_data/reg-metadata';

// Title + description derive from this chapter's REG_ARTICLES entry, so the
// wording has one source. See _data/reg-metadata.ts.
export const generateMetadata = regulationMetadata('puzzles');

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
