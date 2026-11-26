'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { ReplayPairTrainingInput } from '@cuberoot/timer-ui/reconstruct-report';
import AppLink from './AppLink';
import { tr } from '@/i18n/tr';
import { recordedPairCase } from '@/lib/replay-f2l-training';
import { createReplayTrainingSession, rememberReplayTraining, replayReturnChannel } from '@/lib/replay-training-session';

export default function ReplayPairTraining({fingerprint, label, fallback, origin, owner}: {
  fingerprint?: string; label: string; fallback: ReactNode; origin?: ReplayPairTrainingInput['origin']; owner: string;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof recordedPairCase>> | null>(null);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  const [token, setToken] = useState<string | null>();
  useEffect(() => {
    if (!fingerprint) return;
    let active = true;
    setFailed(false);
    setResult(null);
    void recordedPairCase(fingerprint).then(item => { if (active) setResult(item); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [fingerprint, retry]);
  useEffect(() => {
    if (!result || !origin) return;
    const id = crypto.randomUUID();
    const session = createReplayTrainingSession(owner, origin, {recorded: result});
    if (!session || !rememberReplayTraining(id, session)) {
      setToken(null);
      return;
    }
    setToken(id);
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(replayReturnChannel);
    channel.onmessage = event => {
      if (event.data?.type === 'return' && event.data.id === id) {
        channel.postMessage({type:'ready', id});
        window.focus();
      }
    };
    return () => channel.close();
  }, [result, origin?.scope, origin?.solve.id, owner]);
  if (failed) return <button type="button" className="rc-action rc-action--ghost" onClick={() => setRetry(value => value+1)}>
    {tr({zh:'重新加载本对公式',en:'Retry case lookup'})}</button>;
  if (!fingerprint || result === undefined) return <div><p className="cfop-note">{tr({
    zh:'公式库中未找到唯一对应的本对公式。', en:'There is no unique library match for this pair.',
  })}</p>{fallback}</div>;
  if (!result || (origin && token === undefined)) return <p role="status">{tr({zh:'正在识别本对公式…',en:'Identifying this pair…'})}</p>;
  const query = new URLSearchParams({cases:String(result.id),mode:'train'});
  if (token) query.set('replayPractice',token+'.recorded');
  return <AppLink className="rc-action" prefetch={false} target="_blank" rel="noopener noreferrer"
    href={`/alg/3x3/${result.set}/run?${query}`}>{tr({zh:`练 ${label} · ${result.name}`,en:`Practise ${label} · ${result.name}`})}</AppLink>;
}
