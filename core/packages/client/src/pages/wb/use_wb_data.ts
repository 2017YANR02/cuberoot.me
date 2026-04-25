import { useEffect, useState } from 'react';
import type { WbDataset } from './types';

const URL = '/stats/data/world_bests.json';

export function useWbData() {
  const [data, setData] = useState<WbDataset | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(URL)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j: WbDataset) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(String(e?.message ?? e)); });
    return () => { cancelled = true; };
  }, []);

  return { data, error };
}
