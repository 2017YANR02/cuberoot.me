'use client';

/**
 * SettingsModal — slim modal for timer settings users actually want to tweak
 * in the Next.js port: inspection, sounds, voice, hold time, precision, charts,
 * PB toast, BLD memo, hide time.
 *
 * Ported subset of packages/client/src/pages/timer/components/SettingsPanel.tsx
 * (1001 lines). The heavy panel with themes / colors / fonts / sync-seed /
 * metronome BPM etc. is deferred.
 */

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { resetSettings, updateSettings, useTimerSettings } from '../timer-settings';

interface Props {
  isZh: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isZh, onClose }: Props) {
  const s = useTimerSettings();
  const t = (zh: string, en: string) => (isZh ? zh : en);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="tmr-modal-backdrop" onClick={onClose}>
      <div className="tmr-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('设置', 'Settings')}>
        <div className="tmr-modal-head">
          <h3>{t('设置', 'Settings')}</h3>
          <button type="button" className="tmr-icon-btn" onClick={onClose} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>

        <div className="tmr-settings-grid">
          <label className="tmr-setting-row">
            <span>{t('观察时间 (秒)', 'Inspection (s)')}</span>
            <select
              value={s.inspection}
              onChange={(e) => updateSettings({ inspection: Number(e.target.value) })}
            >
              <option value={0}>{t('关', 'Off')}</option>
              <option value={15}>15 (WCA)</option>
              <option value={10}>10</option>
              <option value={30}>30</option>
            </select>
          </label>

          <label className="tmr-setting-row">
            <span>{t('观察启动时机', 'Inspection starts on')}</span>
            <select
              value={s.inspectionTrigger}
              onChange={(e) => updateSettings({ inspectionTrigger: e.target.value as 'down' | 'up' })}
            >
              <option value="down">{t('按下', 'Key down')}</option>
              <option value="up">{t('松开', 'Key up')}</option>
            </select>
          </label>

          <label className="tmr-setting-row">
            <span>{t('按住时长 (ms)', 'Hold time (ms)')}</span>
            <input
              type="number"
              min={100}
              max={1500}
              step={50}
              value={s.holdMs}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 100 && v <= 1500) updateSettings({ holdMs: v });
              }}
            />
          </label>

          <label className="tmr-setting-row">
            <span>{t('精度', 'Precision')}</span>
            <select
              value={s.precision}
              onChange={(e) => updateSettings({ precision: Number(e.target.value) as 2 | 3 })}
            >
              <option value={2}>0.01 ({t('百分秒', 'cs')})</option>
              <option value={3}>0.001 ({t('毫秒', 'ms')})</option>
            </select>
          </label>

          <label className="tmr-setting-row">
            <input
              type="checkbox"
              checked={s.soundsEnabled}
              onChange={(e) => updateSettings({ soundsEnabled: e.target.checked })}
            />
            <span>{t('音效', 'Sound cues')}</span>
          </label>

          <label className="tmr-setting-row">
            <span>{t('音量', 'Volume')}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            />
          </label>

          <label className="tmr-setting-row">
            <span>{t('观察语音', 'Voice cues')}</span>
            <select
              value={s.voiceInspection}
              onChange={(e) => updateSettings({ voiceInspection: e.target.value as 'none' | 'en-male' | 'en-female' | 'zh-male' | 'zh-female' })}
            >
              <option value="none">{t('关', 'Off')}</option>
              <option value="en-female">English (female)</option>
              <option value="en-male">English (male)</option>
              <option value="zh-female">中文 (女)</option>
              <option value="zh-male">中文 (男)</option>
            </select>
          </label>

          <label className="tmr-setting-row">
            <input
              type="checkbox"
              checked={s.showCharts}
              onChange={(e) => updateSettings({ showCharts: e.target.checked })}
            />
            <span>{t('显示分布 / 趋势图', 'Show charts')}</span>
          </label>

          <label className="tmr-setting-row">
            <input
              type="checkbox"
              checked={s.pbToast}
              onChange={(e) => updateSettings({ pbToast: e.target.checked })}
            />
            <span>{t('PB 提示', 'PB celebration')}</span>
          </label>

          <label className="tmr-setting-row">
            <input
              type="checkbox"
              checked={s.bldMemo}
              onChange={(e) => updateSettings({ bldMemo: e.target.checked })}
            />
            <span>{t('BLD 记忆分段 (Enter 标记)', 'BLD memo split (Enter)')}</span>
          </label>

          <label className="tmr-setting-row">
            <input
              type="checkbox"
              checked={s.hideTime}
              onChange={(e) => updateSettings({ hideTime: e.target.checked })}
            />
            <span>{t('计时中隐藏时间', 'Hide time while running')}</span>
          </label>
        </div>

        <div className="tmr-modal-foot">
          <button
            type="button"
            className="tmr-action-btn"
            onClick={() => {
              if (window.confirm(t('重置为默认?', 'Reset to defaults?'))) resetSettings();
            }}
          >
            {t('重置', 'Reset')}
          </button>
          <button type="button" className="tmr-action-btn" onClick={onClose}>{t('完成', 'Done')}</button>
        </div>
      </div>
    </div>
  );
}
