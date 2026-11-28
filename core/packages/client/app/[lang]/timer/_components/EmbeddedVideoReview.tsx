'use client';

import { useEffect, useRef, useState } from 'react';
import { applyAppearancePreferences } from '@cuberoot/app-ui/appearance';
import { decodeAppearancePreferences } from '@cuberoot/shared/appearance';
import { TimerVideoReview } from './TimerVideoReview';
import './embedded-video-review.css';

function notify(busy: boolean) {
  if (window.parent !== window) window.parent.postMessage({ type: 'cuberoot:video-review:ready', busy }, '*');
}

function notifyWorkspaceOpen() {
  if (window.parent !== window) window.parent.postMessage({ type: 'cuberoot:video-review:workspace' }, '*');
}

export default function EmbeddedVideoReview() {
  const [scramble] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('scramble') ?? '');
  // No user data is sent to the embedding document. The host verifies origin and window.
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.dispatchEvent(new Event('app-boot-stop'));
    const encoded = new URLSearchParams(window.location.hash.slice(1)).get('appearance');
    if (encoded) {
      try {
        const preferences = decodeAppearancePreferences(JSON.parse(encoded));
        if (preferences) applyAppearancePreferences(preferences);
      } catch { /* An invalid external fragment leaves the website theme in effect. */ }
    }
    notify(false);
    const element = main.current;
    if (!element || window.parent === window) return;
    const observer = new ResizeObserver(() => window.parent.postMessage({
      type: 'cuberoot:video-review:resize', height: Math.ceil(element.getBoundingClientRect().height)
    }, '*'));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <main ref={main} className="timer-video-embedded"><TimerVideoReview scramble={scramble} onBusyChange={notify} onSourceOpen={notifyWorkspaceOpen} /></main>;
}
