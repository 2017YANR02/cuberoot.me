'use client';

/**
 * One smart-cube control instance: toolbar trigger and trainer settings.
 *
 * Presentational: everything it shows comes from `useTrainerCube`, which is
 * where the cube and the MAC prompt live. Portals keep connection/prompt state
 * alive while settings are closed. It renders in the panel's own idiom
 * (`trainer-opts-*`) rather than reusing /timer's Bluetooth modal — that modal
 * is a modal, and it draws on `timer.css`, which would mean pulling a page's
 * whole stylesheet in for four rows of text.
 *
 * The status line exists because the one thing a user cannot guess is when the
 * clock will stop. "Stops when OLL is done" has to be on screen.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from '@app-foundation/icons/lucide';

import { tr } from '@/i18n/tr';
import { TimerDeviceCenter } from '@cuberoot/timer-ui';
import { detectBluetoothEnv, envAdvice } from '@/lib/bluetooth';
import type { CubeStep } from '@cuberoot/shared/timer/reconstruct/steps';
import type { TrainerCubeState } from './useTrainerCube';
import TrainerCubeViewPicker from './TrainerCubeViewPicker';

/** What each finish line is called, in the words the alg library already uses. */
function stepLabel(step: CubeStep): string {
  switch (step) {
    case 'solved': return tr({ zh: '整体还原', en: 'a full solve' });
    case 'oll': return tr({ zh: '顶层全部朝上', en: 'the last layer oriented' });
    case 'ocll': return tr({ zh: '顶层角块朝上', en: 'the last-layer corners oriented' });
    case 'eoll': return tr({ zh: '顶层棱块朝上', en: 'the last-layer edges oriented' });
    case 'cpll': return tr({ zh: '顶层角块归位', en: 'the last-layer corners placed' });
    case 'f2l': return tr({ zh: '前两层完成', en: 'the first two layers' });
    case 'cross': return tr({ zh: '十字完成', en: 'the cross' });
    case 'fb': return tr({ zh: '第一块完成', en: 'the first block' });
    case 'sb': return tr({ zh: '第二块完成', en: 'the second block' });
    case 'cll': return tr({ zh: 'CLL 完成', en: 'CLL' });
    case 'cmll': return tr({ zh: 'CMLL 完成', en: 'CMLL' });
  }
}

interface Props {
  /** Persisted user switch. */
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  state: TrainerCubeState;
  /** False for puzzles with no smart cube — the whole block is pointless then. */
  supported: boolean;
  devicePortal?: HTMLElement | null;
  settingsPortal?: HTMLElement | null;
  onSettingsRequested?: () => void;
}

export default function SmartCubeRow({ enabled, onEnabledChange, state, supported, devicePortal, settingsPortal, onSettingsRequested }: Props) {
  const { cube, stopStep, reason, view, setView, connect, macPrompt, submitMac, cancelMac, practiceMode } = state;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mac, setMac] = useState('');

  // 连接本身就是启用智能魔方的明确意图。兼容旧版本里曾手动关掉开关、
  // 但魔方仍保持连接的本地偏好,避免出现「已连接却不工作」且无入口可恢复。
  useEffect(() => {
    if (supported && cube.status.connected && !enabled) onEnabledChange(true);
  }, [supported, cube.status.connected, enabled, onEnabledChange]);

  if (!supported) return null;

  const doConnect = async () => {
    onSettingsRequested?.();
    setError(null);
    setBusy(true);
    try {
      await connect();
      onEnabledChange(true);
    } catch (e) {
      // The hook's error already names the reason (no Web Bluetooth, user
      // cancelled the picker, unsupported device), so pass it through.
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const env = detectBluetoothEnv();
  const advice = env === 'available' ? null : envAdvice(env);

  const device = <TimerDeviceCenter
          ariaLabel={tr({ zh: '计时设备', en: 'Timer devices' })}
          className="trainer-device-center"
          directSingleItem
          items={[{
            active: cube.status.connected,
            disabled: busy || !!advice,
            id: 'smart-cube',
            kind: 'smart-cube',
            label: cube.status.connected
              ? tr({ zh: '断开智能魔方', en: 'Disconnect smart cube' })
              : busy
                ? tr({ zh: '连接中', en: 'Connecting' })
                : tr({ zh: '智能魔方', en: 'Smart cube' }),
            onSelect: () => {
              if (cube.status.connected) void cube.disconnect();
              else void doConnect();
            },
          }]}
          menuLabel={tr({ zh: '可用计时设备', en: 'Available timer devices' })}
          triggerLabel={tr({ zh: '设备', en: 'Devices' })}
        />;
  const controls = <>
      <div className="trainer-opts-row">
        {cube.status.connected && (
          <>
            <span className="trainer-opts-label">{cube.status.deviceName}</span>
            {cube.status.battery !== null && (
              <span className="trainer-opts-label">{cube.status.battery}%</span>
            )}
          </>
        )}
        {devicePortal === undefined && device}
      </div>

      {cube.status.connected && (
        <div className="trainer-opts-row">
          <span className="trainer-opts-label">{tr({ zh: '显示', en: 'Display' })}</span>
          <TrainerCubeViewPicker value={view} onChange={setView} />
        </div>
      )}

      {macPrompt && (
        <div className="trainer-opts-row">
          <span className="trainer-opts-label">
            {macPrompt.isWrongKey
              ? tr({ zh: '这个 MAC 解不开,换一个', en: 'That MAC didn’t decrypt — try another' })
              : tr({ zh: `${macPrompt.deviceName} 的 MAC`, en: `MAC for ${macPrompt.deviceName}` })}
          </span>
          <input
            className="trainer-coop-code"
            type="text"
            value={mac}
            onChange={(e) => setMac(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && mac.trim()) { submitMac(mac); setMac(''); } }}
            placeholder="AB:CD:EF:12:34:56"
            autoComplete="off"
            spellCheck={false}
            aria-label={tr({ zh: '魔方 MAC 地址', en: 'Cube MAC address' })}
          />
          <button
            type="button"
            className="trainer-opts-btn"
            onClick={() => { submitMac(mac); setMac(''); }}
            disabled={!mac.trim()}
          >
            <Check size={13} />
          </button>
          <button type="button" className="trainer-opts-btn is-ghost" onClick={cancelMac}>
            <X size={13} />
          </button>
        </div>
      )}

      {advice && (
        <div className="trainer-opts-hint">
          {tr(advice.title)} {tr(advice.body)}
          {advice.url && (
            <>
              {' '}
              <a href={advice.url} target="_blank" rel="noopener noreferrer">
                {advice.urlLabel ? tr(advice.urlLabel) : advice.url}
              </a>
            </>
          )}
        </div>
      )}
      {error && <div className="trainer-opts-hint trainer-room-err">{error}</div>}

      {reason !== 'off' && (practiceMode !== 'manual' || reason === 'ready' || reason === 'running') && (
        <div className="trainer-opts-hint">
          {practiceMode === 'manual'
          ? tr({
              zh: reason === 'ready' ? '打乱已就绪，下一步转动开始还原' : `还原中，${stepLabel(stopStep ?? 'solved')}后进入下一题`,
              en: reason === 'ready' ? 'Scramble ready — turn to begin solving' : `Solving — next case after ${stepLabel(stopStep ?? 'solved')}`,
            })
          : reason === 'disconnected'
          ? tr({
              zh: '连上蓝牙魔方后,每题由魔方直接「变成」那个 case —— 不用照打乱拧,拧完自动判定、自动下一题。练的是这一套的收尾动作,魔方本体越练越乱,不用管',
              en: 'Connect a bluetooth cube and each case is handed to you on the cube itself — no scramble to apply, and the clock starts and stops on its own. The cube in your hands drifts further from solved every rep, which never matters',
            })
          : reason === 'unreadable-case'
              ? tr({ zh: '这题的打乱记号无法识别，请切换打乱方式', en: 'This scramble has unsupported notation; choose another scramble mode' })
              : reason === 'no-case'
                ? tr({ zh: '等出题', en: 'Waiting for a case' })
                : reason === 'settling'
                  // 上一把的收尾动作还在拧 —— 这段时间的转动算上一把的,不计入下一把
                  ? tr({
                      zh: '把魔方停一下,下一题就开始 —— 这会儿的转动都算上一把的收尾',
                      en: 'Let the cube come to rest and the next case begins — turns until then count as finishing the last one',
                    })
                  : stopStep
                  ? tr({
                      zh: `第一下转动开始计时,${stepLabel(stopStep)}即停表`,
                      en: `Your first turn starts the clock; it stops at ${stepLabel(stopStep)}`,
                    })
                  : tr({
                      zh: '这一套没有阶段判定，第一下转动开始计时，整体还原后停表',
                      en: 'This set has no stage detector: your first turn starts the clock, and a full solve stops it',
                    })}
        </div>
      )}
    </>;
  return <>
    {devicePortal && createPortal(device, devicePortal)}
    {settingsPortal === undefined ? controls : settingsPortal ? createPortal(controls, settingsPortal) : null}
  </>;
}
