'use client';

/**
 * The smart-cube controls in the trainer's settings panel.
 *
 * Presentational: everything it shows comes from `useTrainerCube`, which is
 * where the cube and the MAC prompt live. It renders in the panel's own idiom
 * (`trainer-opts-*`) rather than reusing /timer's Bluetooth modal — that modal
 * is a modal, and it draws on `timer.css`, which would mean pulling a page's
 * whole stylesheet in for four rows of text.
 *
 * The status line exists because the one thing a user cannot guess is when the
 * clock will stop. "Stops when OLL is done" has to be on screen.
 */

import { useEffect, useState } from 'react';
import { Bluetooth, Check, X } from 'lucide-react';

import { tr } from '@/i18n/tr';
import { detectBluetoothEnv, envAdvice } from '../../timer/_lib/bluetooth';
import type { CubeStep } from '../../timer/_lib/cube/steps';
import type { TrainerCubeState } from './useTrainerCube';

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
}

export default function SmartCubeRow({ enabled, onEnabledChange, state, supported }: Props) {
  const { cube, stopStep, reason, connect, macPrompt, submitMac, cancelMac } = state;
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

  return (
    <>
      <div className="trainer-opts-row">
        {cube.status.connected ? (
          <>
            <span className="trainer-opts-label">{cube.status.deviceName}</span>
            {cube.status.battery !== null && (
              <span className="trainer-opts-label">{cube.status.battery}%</span>
            )}
            <button type="button" className="trainer-opts-btn is-ghost" onClick={cube.disconnect}>
              {tr({ zh: '断开', en: 'Disconnect' })}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="trainer-opts-btn"
            onClick={() => void doConnect()}
            disabled={busy || !!advice}
          >
            <Bluetooth size={13} />
            {busy
              ? tr({ zh: '连接中', en: 'Connecting' })
              : tr({ zh: '连接智能魔方', en: 'Connect smart cube' })}
          </button>
        )}
      </div>

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

      <div className="trainer-opts-hint">
        {reason === 'disconnected'
          ? tr({
              zh: '连上蓝牙魔方后,每题由魔方直接「变成」那个 case —— 不用照打乱拧,拧完自动判定、自动下一题。练的是这一套的收尾动作,魔方本体越练越乱,不用管',
              en: 'Connect a bluetooth cube and each case is handed to you on the cube itself — no scramble to apply, and the clock starts and stops on its own. The cube in your hands drifts further from solved every rep, which never matters',
            })
          : reason === 'off'
            ? tr({ zh: '正在启用智能魔方…', en: 'Enabling smart cube…' })
            : reason === 'unreadable-case'
              ? tr({ zh: '这题的打乱含看不懂的记号,本题由你自己停表', en: 'This case’s scramble has notation we can’t read, so stop the clock yourself' })
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
                      zh: '这一套的收尾状态判定不了,第一下转动开始计时,整体还原或按空格停表',
                      en: 'We can’t state where this set finishes: your first turn starts the clock, and a full solve or the space bar stops it',
                    })}
      </div>
    </>
  );
}
