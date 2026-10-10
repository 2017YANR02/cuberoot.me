import { canonicalize3x3AlgFile, type AlgCatalogSnapshot } from '@cuberoot/shared/alg';
import { commonCaseSetup } from './alg_case_alignment';
import { orientCaseSetup } from './alg_validation';

export type PreparedAlgCatalog = Omit<AlgCatalogSnapshot, 'sets'> & {
  sets: (AlgCatalogSnapshot['sets'][number] & { thumbnailSetup?: string })[];
};

/** A cover needs one canonical state, never validation of every alternative in a set. */
export async function prepareAlgCatalog(snapshot: AlgCatalogSnapshot): Promise<PreparedAlgCatalog> {
  const sets = await Promise.all(snapshot.sets.map(async row => {
    if (!row.first) return row;
    const first = canonicalize3x3AlgFile({
      puzzle: snapshot.puzzle, set: row.slug, source: '', scrapedAt: '', cases: [row.first],
    }).cases[0];
    const thumbnailSetup = await orientCaseSetup(
      snapshot.puzzle, row.slug, commonCaseSetup(snapshot.puzzle, row.slug, first),
    );
    return { ...row, first, thumbnailSetup };
  }));
  return { ...snapshot, sets };
}
