'use client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';
import { TimerLiveWatch } from '@cuberoot/timer-ui/live-watch';
import { parseTimerLiveWatchHash, type TimerLiveCredential } from '@cuberoot/shared/timer/live-share';
import { browserClipboardTransport } from '@cuberoot/timer-ui';
import { encodeReplayUrl } from '@cuberoot/shared/timer/replay-encode';
import type { ReconstructHost } from '@cuberoot/timer-ui/reconstruct/ReconstructHost';
import { apiUrl, websocketApiUrl } from '@/lib/api-base';
import '../_shell/shell.css';
import '../timer.css';

export default function TimerWatchPage() {
  useTranslation();
  const language = tr({ en: 'en' as const, zh: 'zh' as const });
  const [credential, setCredential] = useState<TimerLiveCredential | null>(null);
  useEffect(() => {
    const read = () => setCredential(parseTimerLiveWatchHash(window.location.hash));
    read(); window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  const host = useMemo<ReconstructHost>(() => ({ localize: v => v[language], writeClipboardText: browserClipboardTransport,
    recordGyro: true, replayUrl: solve => encodeReplayUrl(solve, `${window.location.origin}${language === 'zh' ? '/zh' : ''}/timer`) }), [language]);
  return <main className="timer-shell"><TimerLiveWatch language={language} credential={credential} host={host}
    transport={{ apiUrl, websocketUrl: websocketApiUrl('/v1/timer/live-shares/socket') }} /></main>;
}
