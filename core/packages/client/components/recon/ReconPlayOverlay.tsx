'use client';
import './ReconPlayOverlay.css';
import Overlay from '@cuberoot/timer-ui/recon/ReconPlayOverlay';
import { useTranslation } from 'react-i18next';
import type { ComponentProps } from 'react';
export default function ReconPlayOverlay(props: ComponentProps<typeof Overlay>) {
  const { i18n } = useTranslation();
  return <Overlay {...props} language={i18n.language === 'zh' ? 'zh' : 'en'} />;
}
