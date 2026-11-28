'use client';

import dynamic from 'next/dynamic';
import { parseAsString, useQueryStates } from 'nuqs';
import { ArrowLeft, Bluetooth, Check, ChevronDown, Crosshair, Keyboard, LoaderCircle } from '@app-foundation/icons/lucide';
import { cubeMove, SOLVED_3X3 } from '@cuberoot/puzzle-solvers/timer-333-cube';
import { normalizeWcaScramble } from '@cuberoot/shared/normalize-wca-scramble';
import type { Quat } from '@cuberoot/shared/smart-cube/orientation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { T, useLang } from '@/i18n/tr';
import { detectBluetoothEnv, mayUseMiniProgramBridge, useBluetoothCube } from '@/lib/bluetooth';
import PracticeReferenceSheet from '../../components/PracticeReferenceSheet';
import { LBL_STEPS } from '../content';
import { LBL_LESSON_STAGE_IDS, type LblLessonStageId } from '../lesson-runs';
import ConnectedLesson from './ConnectedLesson';
import { PracticeCube, PracticeWorkspace } from './PracticeWorkspace';
import { lessonStart, PRACTICE_GRIP, type PracticeCubeMove } from './lesson-guide';
import { LessonRotationTracker } from './lesson-rotation';
import './smart-practice.css';

const BluetoothModal = dynamic(() => import('@/components/BluetoothModal'), { ssr: false });
const yellowCrossCases = ['line', 'elbow', 'dot'] as const;
const DEV_VIRTUAL_CUBE = process.env.NODE_ENV === 'development';
const calibrationPosition = { turns: '', pose: PRACTICE_GRIP };

export default function SmartPracticePage() {
  const t = useT();
  const lang = useLang();
  const [route, setRoute] = useQueryStates({ step: parseAsString, case: parseAsString });
  const stage = LBL_LESSON_STAGE_IDS.find(id => id === route.step) ?? LBL_LESSON_STAGE_IDS[0];
  const caseNumber = Number(route.case);
  const variant = Number.isSafeInteger(caseNumber) && caseNumber > 0 ? caseNumber - 1 : 0;
  const requestedCase = stage === 'yellow-cross' && caseNumber > 0 ? yellowCrossCases[caseNumber - 1] : undefined;
  const selectStage = (next: LblLessonStageId) => { void setRoute({ step: next, case: null }); };
  const cubeButton = useRef<HTMLButtonElement>(null);
  const onCubeMove = useRef<PracticeCubeMove | null>(null);
  const onCubeGyro = useRef<((quat: Quat) => void) | null>(null);
  const [rotationTracker] = useState(() => new LessonRotationTracker());
  const [calibrationDialog, setCalibrationDialog] = useState<'ready' | 'no-sample' | 'done' | null>(null);
  const [calibrationRevision, setCalibrationRevision] = useState(0);
  const virtualState = useRef<string | null>(null);
  const [virtualFacelets, setVirtualFacelets] = useState<string | null>(null);
  const [virtualSession, setVirtualSession] = useState(0);
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
    shareConnection: true,
    onMove: (move, timestamp, facelets) => onCubeMove.current?.(move, timestamp, facelets),
    onGyro: quat => onCubeGyro.current?.(quat),
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
    if (!cube.status.connected) return;
    closeDevice();
    virtualState.current = null;
    setVirtualFacelets(null);
  }, [cube.status.connected, closeDevice]);
  useEffect(() => {
    rotationTracker.reset();
    setCalibrationDialog(null);
    setCalibrationRevision(0);
  }, [cube.status.connected, cube.status.deviceId, rotationTracker]);
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
  const virtualActive = DEV_VIRTUAL_CUBE && !!virtualFacelets && !cube.status.connected;
  const resetVirtual = (solved: boolean) => {
    const next = solved ? SOLVED_3X3 : lessonStart('daisy', virtualSession).facelets;
    closeDevice();
    virtualState.current = next;
    setVirtualFacelets(next);
    setVirtualSession(session => session + 1);
  };
  const virtualTurn = (move: string, pose: string) => {
    const physicalAlg = normalizeWcaScramble(`${pose} ${move}`);
    let next = virtualState.current;
    if (!physicalAlg || !next) return;
    for (const token of physicalAlg.split(' ')) {
      next = cubeMove(next, token);
      onCubeMove.current?.(token, performance.now(), next);
    }
    virtualState.current = next;
    setVirtualFacelets(next);
  };
  const deviceLabel = virtualActive ? t('退出虚拟测试', 'Exit virtual test') : cube.status.connected
    ? t('智能魔方已连接', 'Smart cube connected')
    : t('连接智能魔方', 'Connect smart cube');
  const deviceButton = <button ref={cubeButton} type="button" className="lbl-smart-device"
    aria-label={deviceLabel} aria-expanded={virtualActive ? undefined : deviceOpen} aria-haspopup={virtualActive ? undefined : 'dialog'}
    data-connected={cube.status.connected} data-virtual={virtualActive} onClick={virtualActive ? () => {
      virtualState.current = null;
      setVirtualFacelets(null);
    } : openDevice}>
    {virtualActive ? <Keyboard size={16} aria-hidden="true" /> : <Bluetooth size={16} aria-hidden="true" />}
    <span>{virtualActive ? t('退出测试', 'Exit test') : cube.status.connected ? t('已连接', 'Connected') : t('未连接', 'Disconnected')}</span>
  </button>;
  const liveFacelets = virtualActive ? virtualFacelets : cube.status.connected ? cube.facelets : null;
  const canCalibrate = cube.status.connected && Boolean(liveFacelets);
  const calibrateGrip = () => {
    if (!rotationTracker.calibrateGrip(performance.now())) {
      setCalibrationDialog('no-sample');
      return;
    }
    setCalibrationRevision(revision => revision + 1);
    setCalibrationDialog('done');
  };
  const showLesson = Boolean(liveFacelets);
  const preview = useMemo(() => showLesson ? undefined : {
    turns: lessonStart(stage, variant, requestedCase).deviceAlg, pose: PRACTICE_GRIP,
  }, [showLesson, stage, variant, requestedCase]);
  const stageInfo = LBL_STEPS.find(step => step.id === stage)!;
  const exercise = requestedCase ? stageInfo.examples[variant]?.title : undefined;
  const reviewQuery = new URLSearchParams({ step: stage });
  if (route.case) reviewQuery.set('case', route.case);
  const reviewHref = `/tutorial/lbl?${reviewQuery}`;
  return <main className="lbl-smart-page">
    <header className="lbl-smart-header">
      <Link href={reviewHref} className="lbl-smart-action lbl-smart-back" prefetch={false} aria-label={t('回看本节教程', 'Review this lesson')}>
        <ArrowLeft size={18} aria-hidden="true" />
      </Link>
      <div className="lbl-smart-brand">
        <span><T zh="三阶层先法" en="3×3 Layer by layer" /></span>
        <h1><T zh="智能魔方练习" en="Smart cube practice" /></h1>
      </div>
      {deviceButton}
      <div className="lbl-smart-stage-tools">
        <label className="lbl-smart-stage">
          <span><T zh="课程阶段" en="Lesson stage" /></span>
          <select className="lbl-smart-stage-select" value={stage} onChange={event => {
            const next = LBL_LESSON_STAGE_IDS.find(id => id === event.target.value);
            if (next) selectStage(next);
          }}>
            {LBL_LESSON_STAGE_IDS.map(id => {
              const name = LBL_STEPS.find(step => step.id === id)!.title;
              return <option key={id} value={id}>{t(name.zh, name.en)}</option>;
            })}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
        {canCalibrate && <button type="button" className="lbl-smart-action lbl-smart-calibration-trigger" aria-haspopup="dialog"
          aria-expanded={calibrationDialog !== null} onClick={() => setCalibrationDialog('ready')}>
          {calibrationRevision > 0 ? <Check size={16} aria-hidden="true" /> : <Crosshair size={16} aria-hidden="true" />}
          <T zh="朝向校准" en="Calibrate grip" />
        </button>}
      </div>
    </header>
    {liveFacelets
      ? <ConnectedLesson key={`${stage}/${variant}/${requestedCase ?? ''}/${virtualActive ? virtualSession : cube.status.deviceId ?? 'ble'}`} stage={stage} variant={variant}
        requestedCase={requestedCase} facelets={liveFacelets} moves={onCubeMove} onNext={selectStage}
        gyro={virtualActive ? undefined : onCubeGyro} brand={cube.status.brand}
        rotationTracker={rotationTracker} calibrationRevision={calibrationRevision}
        virtual={virtualActive ? { onReset: resetVirtual, onTurn: virtualTurn } : undefined} />
      : <PracticeWorkspace phase="prepare" visual={<figure className="lbl-smart-live">
        <div className="lbl-smart-cube"><PracticeCube position={preview} /></div>
        <figcaption><T zh="起始示例" en="Example starting state" /></figcaption>
      </figure>} actions={!cube.status.connected && <>
        <button type="button" className="lbl-smart-action lbl-smart-action--primary" onClick={openDevice}>
          <Bluetooth size={18} aria-hidden="true" /><T zh="连接智能魔方" en="Connect smart cube" />
        </button>
        {DEV_VIRTUAL_CUBE && <button type="button" className="lbl-smart-action lbl-smart-test-entry" onClick={() => resetVirtual(false)}>
          <Keyboard size={17} aria-hidden="true" /><T zh="使用虚拟魔方测试" en="Test with virtual cube" />
        </button>}
      </>}>
        {exercise && <p className="lbl-smart-context">{t(exercise.zh, exercise.en)}</p>}
        <h2>{t(stageInfo.title.zh, stageInfo.title.en)}</h2>
        {cube.status.connected
          ? <p className="lbl-smart-loading" role="status"><LoaderCircle size={17} aria-hidden="true" /><T zh="正在读取魔方状态…" en="Reading your cube…" /></p>
          : <p><T zh="连上蓝牙后，转动手上的魔方。屏幕会跟随真机，并根据当前状态给出下一步。"
            en="Connect over Bluetooth and turn your cube. The screen mirrors your cube and guides you from its current state." /></p>}
      </PracticeWorkspace>}
    {canCalibrate && calibrationDialog && <PracticeReferenceSheet title={<T zh="朝向校准" en="Grip calibration" />} onClose={() => setCalibrationDialog(null)}>
      <div className="lbl-smart-help lbl-smart-calibration">
        <div className="lbl-smart-preview"><PracticeCube position={calibrationPosition} fixedView /></div>
        <p><T zh="对照示范拿好真机，黄心朝上，绿心朝前。" en="Match the reference. Hold the yellow center on top and the green center facing you." /></p>
        {calibrationDialog !== 'ready' && <p role="status">{calibrationDialog === 'done'
          ? <T zh="朝向已校准。" en="Grip calibrated." />
          : <T zh="还没收到可用的姿态数据。轻转整颗魔方，摆回示范朝向后再试。"
            en="No recent orientation data. Rotate the whole cube, return to the reference grip, then try again." />}</p>}
        <button type="button" className="lbl-smart-action lbl-smart-action--primary" onClick={calibrateGrip}><T zh="校准" en="Calibrate" /></button>
      </div>
    </PracticeReferenceSheet>}
    {deviceOpen && <BluetoothModal anchorRef={cubeButton} isZh={lang === 'zh'} cube={cube}
      onClose={closeDevice} connectAttempt={connectAttempt} onConnect={cube.connect} allowDeviceCalibration={false}
      macPrompt={macPrompt} onSubmitMac={resolveMac} onCancelMac={() => resolveMac(null)} />}
  </main>;
}
