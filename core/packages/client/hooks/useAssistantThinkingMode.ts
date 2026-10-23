'use client';

import { useSyncExternalStore } from 'react';
import { persistItem } from '@/lib/safe-storage';
import type { AssistantThinkingMode } from '@cuberoot/shared/site-assistant';

const key = 'cuberoot.assistant.thinking';
const eventName = 'cuberoot-assistant-thinking';
let fallback: AssistantThinkingMode = 'auto';
function read(): AssistantThinkingMode {
  try {
    const value = localStorage.getItem(key);
    return value === 'fast' || value === 'deep' ? value : 'auto';
  } catch { return fallback; }
}
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); };
  window.addEventListener('storage', onStorage);
  window.addEventListener(eventName, listener);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(eventName, listener); };
}
function setMode(value: AssistantThinkingMode) {
  fallback = value;
  persistItem(key, value);
  window.dispatchEvent(new Event(eventName));
}
export function useAssistantThinkingMode() {
  const mode = useSyncExternalStore(subscribe, read, () => 'auto' as const);
  return [mode, setMode] as const;
}
