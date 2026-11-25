'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import type { CompetitionDevice, CompetitionMode } from '@/lib/online-competition-api';

export function CompetitionPreflight({ mode, device }: { mode: CompetitionMode; device: CompetitionDevice }) {
  const t = useT();
  const [capabilities, setCapabilities] = useState<{ camera: boolean; bluetooth: boolean; ios: boolean } | null>(null);
  const [check, setCheck] = useState<'checking' | 'ready' | 'failed' | null>(null);
  useEffect(() => {
    setCapabilities({ camera: !!navigator.mediaDevices?.getUserMedia, bluetooth: 'bluetooth' in navigator,
      ios: /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) });
  }, []);
  async function checkCamera() {
    setCheck('checking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCheck('ready');
    } catch { setCheck('failed'); }
  }
  if (!capabilities || mode === 'offline') return null;
  return <div className="competition-preflight">
    {device === 'smart' && <p>{capabilities.bluetooth ? t('浏览器支持蓝牙。请在赛前连接并检查魔方。', 'Bluetooth is available. Connect and check your cube before competing.')
      : capabilities.ios ? t('当前 iOS 浏览器不支持 Web Bluetooth。请使用桌面 Chrome 参赛。', 'This iOS browser lacks Web Bluetooth. Use desktop Chrome to compete.')
        : t('当前浏览器不支持 Web Bluetooth，请使用桌面 Chrome。', 'This browser lacks Web Bluetooth. Use desktop Chrome.')}</p>}
    {(mode === 'supervised' || device === 'ordinary') && <><p role="status">{check === 'ready' ? t('摄像头可用。', 'Camera is ready.')
      : check === 'failed' ? t('摄像头未通过检查，请检查浏览器权限。', 'Camera check failed. Check browser permissions.')
        : capabilities.camera ? t('请在赛前检查摄像头。', 'Check your camera before competing.') : t('当前浏览器无法访问摄像头。', 'This browser cannot access the camera.')}</p>
      {capabilities.camera && <button type="button" className="competition-secondary" disabled={check === 'checking'} onClick={() => void checkCamera()}>{check === 'checking' ? t('检查中…', 'Checking…') : t('检查摄像头', 'Check camera')}</button>}</>}
  </div>;
}
