'use client';

import { useEffect, useRef, useState } from 'react';
import { Bluetooth, Video } from '@app-foundation/icons/lucide';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { MoreTogglePanel } from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { detectBluetoothEnv, mayUseMiniProgramBridge, useBluetoothCube, type ConnectPickOptions } from '@/lib/bluetooth';
import { installedBleAvailable, subscribeInstalledBleBridge } from '@/lib/installed-ble-bridge';
import type { CompetitionDevice, CompetitionMode } from '@/lib/online-competition-api';
import dynamic from 'next/dynamic';
import { ClientLoadStatus } from '@/components/StartupStatus';

const BluetoothModal = dynamic(() => import('@/components/BluetoothModal'), {
  ssr: false,
  loading: () => <ClientLoadStatus label={{ zh: '正在打开蓝牙面板…', en: 'Opening Bluetooth panel…' }} />,
});

type CameraCheck = 'idle' | 'checking' | 'denied' | 'missing' | 'failed' | 'ready';

function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

export function CompetitionPreflight({ mode, device, onReady }: {
  mode: CompetitionMode; device: CompetitionDevice; onReady?: () => void;
}) {
  const t = useT();
  const camera = mode !== 'offline' && (mode === 'supervised' || device === 'ordinary');
  const smart = mode !== 'offline' && device === 'smart';
  const [cameraVerified, setCameraVerified] = useState(false);
  const [cubeVerified, setCubeVerified] = useState(false);
  useEffect(() => { if ((!camera || cameraVerified) && (!smart || cubeVerified)) onReady?.(); },
    [camera, smart, cameraVerified, cubeVerified, onReady]);
  if (!camera && !smart) return null;

  return <section className="competition-preflight" data-site-surface="panel">
    <h3>{t('赛前设备自检', 'Equipment check')}</h3>
    {camera && <CameraPreflight onReady={() => setCameraVerified(true)} />}
    {smart && <CubePreflight onReady={() => setCubeVerified(true)} />}
  </section>;
}

function CameraPreflight({ onReady }: { onReady(): void }) {
  const t = useT();
  const [check, setCheck] = useState<CameraCheck>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const generation = useRef(0);
  const currentStream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => () => {
    generation.current += 1;
    stopCamera(currentStream.current);
    currentStream.current = null;
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element || !stream) return;
    element.srcObject = stream;
    void element.play?.().catch(() => {});
    const track = stream.getVideoTracks()[0];
    const onEnded = () => {
      stopCamera(stream);
      currentStream.current = null;
      setStream(null);
      setCheck('failed');
    };
    track?.addEventListener('ended', onEnded);
    return () => {
      track?.removeEventListener('ended', onEnded);
      element.srcObject = null;
    };
  }, [stream]);

  function closePreview() {
    stopCamera(currentStream.current);
    currentStream.current = null;
    setStream(null);
    if (check === 'checking') setCheck('idle');
  }

  async function checkCamera() {
    const attempt = ++generation.current;
    setCheck('checking');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCheck('missing');
        return;
      }
      const media = await navigator.mediaDevices.getUserMedia({ video: true });
      if (attempt !== generation.current) {
        stopCamera(media);
        return;
      }
      currentStream.current = media;
      setStream(media);
    } catch (error) {
      if (attempt !== generation.current) return;
      const name = typeof error === 'object' && error && 'name' in error ? error.name : '';
      setCheck(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied'
        : name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'missing' : 'failed');
    }
  }

  const failed = check === 'denied' || check === 'missing' || check === 'failed';
  const errors = {
    denied: t('摄像头权限被拒绝。请在站点设置中允许访问后重试。', 'Camera access was denied. Allow it in site settings and try again.'),
    missing: t('未检测到可用摄像头。请连接摄像头后重试。', 'No camera was found. Connect a camera and try again.'),
    failed: t('无法打开摄像头。请关闭占用摄像头的应用后重试。', 'Could not open the camera. Close other apps using it and try again.'),
  };
  return <div className="competition-preflight-check">
    <div className="competition-preflight-row">
      <strong><Video size={17} aria-hidden />{t('摄像头', 'Camera')}</strong>
      <button type="button" className="competition-secondary" disabled={check === 'checking' && !stream}
        onClick={stream ? closePreview : () => { void checkCamera(); }}>
        {stream ? t('结束预览', 'End preview') : check === 'checking' ? <LoadingIndicator>{t('正在打开…', 'Opening…')}</LoadingIndicator>
          : failed ? t('重新检测', 'Test again') : t('测试摄像头', 'Test camera')}
      </button>
    </div>
    {failed && <p className="competition-error" role="alert">{errors[check]}</p>}
    <MoreTogglePanel expanded={!!stream} keepMounted>
      <div className="competition-preflight-camera">
        <video ref={video} playsInline muted autoPlay aria-label={t('摄像头实时预览', 'Live camera preview')}
          onPlaying={() => { if (currentStream.current) { setCheck('ready'); onReady(); } }} />
      </div>
    </MoreTogglePanel>
    {check === 'ready' && <p className="competition-preflight-feedback" data-tone="success" role="status">
      {stream ? t('画面正常，请确认双手与魔方在取景框内。', 'Camera is working. Check that both hands and the cube are in view.')
        : t('摄像头检查完成。', 'Camera check complete.')}
    </p>}
  </div>;
}

function CubePreflight({ onReady }: { onReady(): void }) {
  const t = useT();
  const lang = useLang();
  const anchor = useRef<HTMLButtonElement>(null);
  const resolveMac = useRef<((value: string | null) => void) | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [attempt, setAttempt] = useState<Promise<void> | null>(null);
  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const cube = useBluetoothCube({
    allowSimulated: false,
    onNeedMac: (deviceName, isWrongKey) => new Promise(resolve => {
      resolveMac.current = resolve;
      setMacPrompt({ deviceName, isWrongKey });
    }),
  });

  useEffect(() => {
    const detect = () => {
      const env = detectBluetoothEnv();
      setAvailable(installedBleAvailable() || mayUseMiniProgramBridge() || env === 'available' || env === 'available-bluefy');
    };
    detect();
    return subscribeInstalledBleBridge(detect);
  }, []);
  useEffect(() => () => resolveMac.current?.(null), []);
  useEffect(() => { if (cube.status.connected) onReady(); }, [cube.status.connected, onReady]);

  function finishMac(value: string | null) {
    resolveMac.current?.(value);
    resolveMac.current = null;
    setMacPrompt(null);
  }
  function connect(pick?: ConnectPickOptions) {
    const result = cube.connect(pick);
    void result.catch(() => {});
    setAttempt(result);
    return result;
  }

  return <div className="competition-preflight-check">
    <div className="competition-preflight-row">
      <strong><Bluetooth size={17} aria-hidden />{t('智能魔方', 'Smart cube')}</strong>
      {available && <button ref={anchor} type="button" className="competition-secondary"
        onClick={() => { if (cube.status.connected) cube.disconnect(); else void connect(); }}>
        {cube.status.connected ? t('断开魔方', 'Disconnect cube') : t('连接测试魔方', 'Connect test cube')}
      </button>}
    </div>
    {available === false && <p className="competition-preflight-feedback" data-tone="warning" role="status">
      {t('当前环境不支持蓝牙连接。请使用桌面 Chrome、小程序或 CubeRoot App 参赛。', 'Bluetooth is unavailable here. Use desktop Chrome, the Mini Program, or the CubeRoot app to compete.')}
    </p>}
    {cube.status.connected && <p className="competition-preflight-feedback" data-tone="success" role="status">
      {t('魔方连接正常', 'Cube connected')} · {cube.status.deviceName}
    </p>}
    {attempt && <BluetoothModal isZh={lang === 'zh'} anchorRef={anchor} cube={cube} connectAttempt={attempt}
      onConnect={pick => cube.connect(pick)} macPrompt={macPrompt} onSubmitMac={finishMac} onCancelMac={() => finishMac(null)}
      onClose={() => { finishMac(null); if (!cube.status.connected) cube.disconnect(); setAttempt(null); }} />}
  </div>;
}
