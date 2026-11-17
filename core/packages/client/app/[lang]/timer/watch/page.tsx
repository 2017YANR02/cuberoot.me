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
    let revision = 0;
    const read = () => {
      const current = ++revision;
      setCredential(null);
      void parseTimerLiveWatchHash(window.location.hash).then(value => {
        if (current === revision) setCredential(value);
      }).catch(() => { if (current === revision) setCredential(null); });
    };
    read(); window.addEventListener('hashchange', read);
    return () => { revision++; window.removeEventListener('hashchange', read); };
  }, []);
  const host = useMemo<ReconstructHost>(() => ({ localize: v => v[language], writeClipboardText: browserClipboardTransport,
    recordGyro: true, replayUrl: solve => encodeReplayUrl(solve, `${window.location.origin}${language === 'zh' ? '/zh' : ''}/timer`) }), [language]);
  return <main><TimerLiveWatch className="timer-shell" language={language} credential={credential} host={host}
    transport={{ apiUrl, websocketUrl: websocketApiUrl('/v1/timer/live-shares/socket') }} /></main>;
}
