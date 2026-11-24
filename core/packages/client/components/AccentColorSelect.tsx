'use client';
import './settings-typography.css';

import { useEffect, useRef, useState } from 'react';
import { AppearanceAccentControl } from '@cuberoot/app-ui/appearance';
import type { AccentId } from '@/lib/accent-colors';
import { applyAccent, previewAccent, readAccent } from '@/lib/theme';
import { useLang } from '@/i18n/tr';
import './accent-color-select.css';

export default function AccentColorSelect() {
  const language = useLang();
  const [accent, setAccent] = useState<AccentId | null>(null);
  const previewingRef = useRef(false);
  const endPreview = () => {
    if (!previewingRef.current) return;
    previewingRef.current = false;
    previewAccent(readAccent());
  };
  useEffect(() => () => endPreview(), []);
  useEffect(() => {
    const refresh = () => {
      const value = readAccent();
      setAccent(value);
    };
    refresh();
    window.addEventListener('theme-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('theme-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return <AppearanceAccentControl language={language} value={accent}
    onChange={value => { endPreview(); applyAccent(value, !value?.startsWith('#')); }}
    onPreview={value => {
      if (value === undefined) endPreview();
      else { previewingRef.current = true; previewAccent(value); }
    }} />;
}
