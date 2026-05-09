/**
 * Letter-pair word data for /memo/colpi/.
 *
 * Mirrored from bestsiteever.net/colpi (UI clone, by Roman Strakhov). The full
 * crowdsourced word list with categories is scraped via
 * `scripts/fetch_colpi_words.mjs` → `words.json` (~480 KB, 729 pairs, ~11.5k
 * words). User-submitted entries (logged-in WCA users) are layered on top of
 * this base, persisted to localStorage only.
 */
import wordsRaw from './words.json';

export const ALPHABET = [
  'A','B','C','D','E','F','G','H','I','J','K','L','M',
  'N','O','P','Q','R','S','T','U','V','W','X','Y','Z',
  'ʧ',
];

export type Category =
  | 'unspecified'
  | 'object'
  | 'person'
  | 'action'
  | 'place'
  | 'other';

export interface PairWord {
  word: string;
  category: Category;
  /** Community-flagged NSFW / slur / etc. on the upstream site. Omitted = false. */
  offensive?: boolean;
}

export const PAIRS: Record<string, PairWord[]> = wordsRaw as Record<string, PairWord[]>;

export interface RecentSubmission {
  id: number;
  pair: string;
  word: string;
  category: Category;
}

// Curated samples removed — recent list now reflects the user's own local
// submissions (see ColpiPage). When/if a real backend lands we'll fetch the
// site-wide recent submissions from there.
export const RECENT_SUBMISSIONS: RecentSubmission[] = [];
