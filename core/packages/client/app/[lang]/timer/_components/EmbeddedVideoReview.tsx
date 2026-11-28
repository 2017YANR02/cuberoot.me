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

function notifyViewfinder(active: boolean) {
  if (window.parent !== window) window.parent.postMessage({ type: 'cuberoot:video-review:viewfinder', active }, '*');
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
    document.documentElement.dataset.timerVideoEmbedded = '';
    // The iframe tracks its content height. Use the host viewport for video sizing
    // so a small chooser cannot shrink the subsequent camera preview.
    const updateViewport = (event: MessageEvent) => {
      const { type, height, available } = event.data ?? {};
      if (event.source === window.parent && type === 'cuberoot:video-review:viewport' && Number.isFinite(height) && height > 0) {
        element.style.setProperty('--review-host-height', `${height}px`);
        if (Number.isFinite(available) && available > 0) element.style.setProperty('--review-available-height', `${available}px`);
      }
    };
    window.addEventListener('message', updateViewport);
    const observer = new ResizeObserver(() => {
      const height = element.getBoundingClientRect().height;
      const player = element.querySelector('.timer-video-review[data-source="record"] .video-recon-player-frame');
      const toolbarSpace = player ? Math.ceil(height - player.getBoundingClientRect().height) : 0;
      const value = `${toolbarSpace}px`;
      if (element.style.getPropertyValue('--review-control-height') !== value) element.style.setProperty('--review-control-height', value);
      window.parent.postMessage({ type: 'cuberoot:video-review:resize', height: Math.ceil(height) }, '*');
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      delete document.documentElement.dataset.timerVideoEmbedded;
      window.removeEventListener('message', updateViewport);
    };
  }, []);
  return <main ref={main} className="timer-video-embedded"><TimerVideoReview scramble={scramble} onBusyChange={notify}
    onSourceOpen={notifyWorkspaceOpen} onViewfinderChange={notifyViewfinder} /></main>;
}
