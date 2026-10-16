import { configureAlgFileLoader, type AlgFile } from '@cuberoot/shared/alg';
import { exportOllLookup } from '@cuberoot/shared/recon/oll-lookup';
import { exportPllLookup } from '@cuberoot/shared/recon/pll-lookup';
export async function generate(files: Record<string, AlgFile>) {
  configureAlgFileLoader(async (puzzle, set) => files[`${puzzle}/${set}`]);
  return { oll: await exportOllLookup(), pll: await exportPllLookup() };
}
