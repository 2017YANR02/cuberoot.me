'use client';

import { useEffect, useState } from 'react';
import { getRecon } from '@/lib/recon-api';

type ReconSolve = Awaited<ReturnType<typeof getRecon>>;

/** This page's ISR seed is a first paint, not proof of freshness. */
export function useReconDetailData(id: string, initialSolve?: ReconSolve) {
  const [solve, setSolve] = useState<ReconSolve | null>(initialSolve ?? null);
  const [loading, setLoading] = useState(!initialSolve);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    let requestVersion = 0;
    let hasSolve = !!initialSolve && String(initialSolve.id) === id;
    setSolve(hasSolve ? initialSolve! : null);
    setLoading(!hasSolve);
    setError(null);
    const refresh = async () => {
      const version = ++requestVersion;
      try {
        const fresh = await getRecon(Number(id));
        if (!active || version !== requestVersion) return;
        hasSolve = true;
        setSolve(fresh);
        setError(null);
      } catch (err) {
        if (!active || version !== requestVersion) return;
        const status = (err as { status?: number }).status;
        // Keep useful content on a transient outage, but never retain a solve
        // that the API now says is private or deleted.
        if (!hasSolve || status === 401 || status === 403 || status === 404) {
          hasSolve = false;
          setSolve(null);
          setError((err as Error).message);
        }
      } finally {
        if (active && version === requestVersion) setLoading(false);
      }
    };
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => {
      active = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [id, initialSolve]);

  return { solve, loading, error };
}
