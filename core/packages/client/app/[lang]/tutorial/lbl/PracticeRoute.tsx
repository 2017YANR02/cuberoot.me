import { parseAsString, useQueryStates } from 'nuqs';
import dynamic from 'next/dynamic';
import { Bluetooth } from '@app-foundation/icons/lucide';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { detectBluetoothEnv, mayUseMiniProgramBridge, useBluetoothCube } from '@/lib/bluetooth';
import Practice from './Practice';
import { activeChapters, practiceExampleOrder } from './curriculum';
import type { PracticeCubeMove } from './usePracticeSmartCube';

const BluetoothModal = dynamic(() => import('../../timer/_components/BluetoothModal'), { ssr: false });

export default function PracticeRoute() {
  const t = useT();
  const lang = useLang();
  const [stepHints, setStepHints] = useState(false);
  const cubeButton = useRef<HTMLButtonElement>(null);
  const onCubeMove = useRef<PracticeCubeMove | null>(null);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const deviceOpenRef = useRef(false);
  const [connectAttempt, setConnectAttempt] = useState<Promise<void> | null>(null);
  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const macResolver = useRef<((value: string | null) => void) | null>(null);
  const resolveMac = useCallback((value: string | null) => {
    macResolver.current?.(value);
    macResolver.current = null;
    setMacPrompt(null);
  }, []);
  const cube = useBluetoothCube({
    onMove: (move, timestamp, facelets) => onCubeMove.current?.(move, timestamp, facelets),
    onNeedMac: (deviceName, isWrongKey) => new Promise(resolve => {
      if (!deviceOpenRef.current) { resolve(null); return; }
      macResolver.current = resolve;
      setMacPrompt({ deviceName, isWrongKey });
    }),
  });
  const closeDevice = useCallback(() => {
    deviceOpenRef.current = false;
    resolveMac(null);
    setDeviceOpen(false);
    setConnectAttempt(null);
  }, [resolveMac]);
  useEffect(() => {
    if (cube.status.connected) closeDevice();
  }, [cube.status.connected, closeDevice]);
  useEffect(() => () => {
    deviceOpenRef.current = false;
    macResolver.current?.(null);
    macResolver.current = null;
  }, []);
  const openDevice = () => {
    deviceOpenRef.current = true;
    setDeviceOpen(true);
    if (cube.status.connected || connectAttempt) return;
    const env = detectBluetoothEnv();
    if (env !== 'available' && env !== 'available-bluefy' && !mayUseMiniProgramBridge()) return;
    const attempt = cube.connect();
    setConnectAttempt(attempt);
    void attempt.catch(() => {});
  };
  const [route, setRoute] = useQueryStates({ view: parseAsString, step: parseAsString, case: parseAsString });
  const chapters = activeChapters.filter(chapter => chapter.id !== 'structure' && chapter.examples.length > 0);
  const chapterIndex = Math.max(0, chapters.findIndex(chapter => chapter.id === route.step));
  const chapter = chapters[chapterIndex];
  const order = practiceExampleOrder(chapter);
  const extra = route.case === 'white-edge' ? chapter.lessons.find(lesson => lesson.id === 'white-edge')?.example : undefined;
  const requested = Number(route.case ?? 1);
  const position = Number.isInteger(requested) && requested >= 1 && requested <= order.length ? requested - 1 : 0;
  const moveChapter = (direction: number) => {
    const next = chapters[chapterIndex + direction];
    const nextOrder = practiceExampleOrder(next);
    void setRoute({ step: next.id, case: String(direction > 0 ? 1 : nextOrder.length) });
  };
  const deviceLabel = cube.status.connected
    ? t('智能魔方已连接', 'Smart cube connected')
    : t('连接智能魔方', 'Connect smart cube');
  return <>
    <Practice key={`${chapter.id}/${route.case ?? '1'}`} step={chapter} exampleOrder={order}
    stepHints={stepHints} setStepHints={setStepHints}
    cubeConnected={cube.status.connected} cubeFacelets={cube.facelets} onCubeMove={onCubeMove}
    deviceOpen={deviceOpen} deviceButton={<button ref={cubeButton} type="button" className="lbl-practice-device"
      aria-label={deviceLabel} aria-expanded={deviceOpen} aria-haspopup="dialog" data-connected={cube.status.connected} onClick={openDevice}>
      <Bluetooth size={16} aria-hidden="true" />
      <span className="lbl-practice-device-label">{deviceLabel}</span>
      <span className="lbl-practice-device-compact" aria-hidden="true">{cube.status.connected
        ? t('已连接', 'Connected') : t('连接魔方', 'Connect cube')}</span>
    </button>}
    initialIndex={order[position]} extraExample={extra}
    onIndexChange={index => void setRoute({ step: chapter.id, case: String(extra ? index : index + 1) })}
    onPreviousChapter={chapterIndex > 0 ? () => moveChapter(-1) : undefined}
    onNextChapter={chapterIndex < chapters.length - 1 ? () => moveChapter(1) : undefined}
    onClose={() => void setRoute({ view: null, step: chapter.id, case: extra ? 'white-edge' : String(position + 1) }, { history: 'push' })} />
    {deviceOpen && <BluetoothModal anchorRef={cubeButton} isZh={lang === 'zh'} cube={cube}
      onClose={closeDevice} connectAttempt={connectAttempt} onConnect={cube.connect} allowDeviceCalibration={false}
      macPrompt={macPrompt} onSubmitMac={resolveMac} onCancelMac={() => resolveMac(null)} />}
  </>;
}
