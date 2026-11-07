'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { loadAlg, type AlgCase } from '@cuberoot/shared/alg';
import type { Solve } from '@cuberoot/shared/timer';
import { useTimeAttackOrder } from '@/hooks/useTimeAttackOrder';
import { canonicalTimeAttackCases, caseMap } from '@/lib/alg-time-attack-order';
import { caseKey } from '@/lib/trainer-case-key';
import { PllChainAttempt, pllChainCaseId } from '@/lib/pll-chain';

/** PLL-specific state only. SoloView retains its timer, devices, inputs and results. */
export function usePllChain(enabled: boolean) {
  const [cases, setCases] = useState<AlgCase[]>([]);
  const [failed, setFailed] = useState(false);
  const [loadVersion, reload] = useState(0);
  const [orderOpen, setOrderOpen] = useState(false);
  const attemptRef = useRef<PllChainAttempt | null>(null);
  const smartRef = useRef(false);
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setFailed(false);
    void loadAlg('3x3', 'pll').then(data => {
      const next = canonicalTimeAttackCases('3x3', 'pll', data.cases.filter(c => pllChainCaseId(c.name)));
      if (next.length !== 21 || new Set(next.map(c => pllChainCaseId(c.name))).size !== 21) throw new Error('Incomplete PLL set');
      if (active) setCases(next);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [enabled, loadVersion]);
  useLayoutEffect(() => { attemptRef.current = null; setOrderOpen(false); refresh(n => n + 1); }, [enabled]);
  const defaults = useMemo(() => enabled ? cases.map(caseKey) : [], [cases, enabled]);
  const { order, persistOrder, syncState } = useTimeAttackOrder('3x3', 'pll', '', defaults);
  const byKey = useMemo(() => caseMap(cases), [cases]);
  const ids = useMemo(() => order.flatMap(key => {
    const c = byKey.get(key);
    const id = c && pllChainCaseId(c.name);
    return id ? [id] : [];
  }), [order, byKey]);
  const idsRef = useRef(ids); idsRef.current = ids;
  const begin = useCallback((smart: boolean, initialFacelets?: string) => {
    smartRef.current = smart;
    attemptRef.current = new PllChainAttempt(idsRef.current, initialFacelets);
    refresh(n => n + 1);
  }, []);
  const observe = useCallback((move: string, facelets: string | null) => {
    const attempt = attemptRef.current;
    if (!attempt || !smartRef.current) return false;
    const trusted = attempt.verified;
    if (attempt.move(move, facelets) || trusted !== attempt.verified) refresh(n => n + 1);
    return attempt.verified && attempt.done;
  }, []);
  const interrupt = useCallback(() => {
    if (!smartRef.current) return;
    attemptRef.current?.interrupt(); refresh(n => n + 1);
  }, []);
  const finish = useCallback((solve: Solve) => {
    const attempt = attemptRef.current;
    solve.pllChain = attempt ? attempt.result(solve.moves ?? []) : { order: [...idsRef.current], verified: false, splits: [] };
    if (smartRef.current && !solve.pllChain.verified) solve.penalty = 'DNF';
  }, []);
  const saveOrder = (keys: string[]) => { persistOrder(keys); attemptRef.current = null; refresh(n => n + 1); };
  return {
    cases, order, defaults, syncState, failed, ready: !failed && ids.length === 21,
    retry: () => reload(n => n + 1), saveOrder, orderOpen, setOrderOpen,
    shownOrder: attemptRef.current?.order ?? ids, completed: attemptRef.current?.completed ?? 0,
    interrupted: attemptRef.current?.verified === false, begin, observe, interrupt, finish,
    orderSnapshot: () => [...idsRef.current],
  };
}
