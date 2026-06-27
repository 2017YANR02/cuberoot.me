'use client';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import type { ReactNode } from 'react';

/** Hoist `?puzzle` to the front of the query on every URL write so /sim links are
 *  self-describing (puzzle right after `/sim?`). nuqs's `processUrlSearchParams` runs on
 *  serialize + every live flush, and `URLSearchParams.set` keeps existing keys in place
 *  (new keys append last) — so without this, switching puzzle after a setup lands
 *  `?setup=…&puzzle=…`. No-op on pages without a `puzzle` param. */
function hoistPuzzleFirst(search: URLSearchParams): URLSearchParams {
  if (!search.has('puzzle')) return search;
  const entries = [...search.entries()];
  if (entries[0]?.[0] === 'puzzle') return search;
  const out = new URLSearchParams();
  for (const [k, v] of entries) if (k === 'puzzle') out.append(k, v);
  for (const [k, v] of entries) if (k !== 'puzzle') out.append(k, v);
  return out;
}

/** Root nuqs adapter wrapper — a client boundary so the function prop can be passed
 *  (the root layout is a server component). */
export default function AppNuqsAdapter({ children }: { children: ReactNode }) {
  return <NuqsAdapter processUrlSearchParams={hoistPuzzleFirst}>{children}</NuqsAdapter>;
}
