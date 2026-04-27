/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect } from 'react';
import { resetSettings, updateSettings, useSettings } from '../settings';
import { warmupSound, play } from '../sound';

interface Props {
  isZh: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isZh, onClose }: Props) {
  const s = useSettings();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div className="timer-modal settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isZh ? '设置' : 'Settings'}</h2>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '计时' : 'Timing'}</h3>
          <Row label={isZh ? '观察时间（秒）' : 'Inspection (sec)'}>
            <input
              type="number" min={0} max={60}
              value={s.inspection}
              onChange={(e) => updateSettings({ inspection: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })}
            />
            <span className="hint">{s.inspection === 0 ? (isZh ? '关闭' : 'off') : (isZh ? `${s.inspection} 秒（>${s.inspection}s = +2，>${s.inspection + 2}s = DNF）` : `${s.inspection}s (>${s.inspection}s = +2, >${s.inspection + 2}s = DNF)`)}</span>
          </Row>
          <Row label={isZh ? '按住阈值（毫秒）' : 'Hold threshold (ms)'}>
            <input
              type="number" min={100} max={2000} step={50}
              value={s.holdMs}
              onChange={(e) => updateSettings({ holdMs: Math.max(100, Math.min(2000, Number(e.target.value) || 550)) })}
            />
          </Row>
          <Row label={isZh ? '隐藏运行中的时间' : 'Hide time while running'}>
            <input
              type="checkbox"
              checked={s.hideTime}
              onChange={(e) => updateSettings({ hideTime: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '精度' : 'Precision'}>
            <select
              value={s.precision}
              onChange={(e) => updateSettings({ precision: Number(e.target.value) as 2 | 3 })}
            >
              <option value={2}>{isZh ? '0.01 秒' : '0.01s'}</option>
              <option value={3}>{isZh ? '0.001 秒' : '0.001s'}</option>
            </select>
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '声音' : 'Sound'}</h3>
          <Row label={isZh ? '提示音' : 'Sounds'}>
            <input
              type="checkbox"
              checked={s.soundsEnabled}
              onChange={(e) => {
                updateSettings({ soundsEnabled: e.target.checked });
                if (e.target.checked) warmupSound();
              }}
            />
          </Row>
          <Row label={isZh ? '音量' : 'Volume'}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={s.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            />
            <button
              className="hint-btn"
              onClick={() => play('start')}
              title={isZh ? '试听' : 'Test'}
            >
              ♪
            </button>
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '外观' : 'Appearance'}</h3>
          <Row label={isZh ? '主题' : 'Theme'}>
            <select
              value={s.theme}
              onChange={(e) => updateSettings({ theme: e.target.value as 'dark' | 'light' | 'auto' })}
            >
              <option value="dark">{isZh ? '深色' : 'Dark'}</option>
              <option value="light">{isZh ? '浅色' : 'Light'}</option>
              <option value="auto">{isZh ? '跟随系统' : 'Auto'}</option>
            </select>
          </Row>
          <Row label={isZh ? '计时器字号' : 'Timer font scale'}>
            <input
              type="range" min={0.5} max={2} step={0.05}
              value={s.timerFontScale}
              onChange={(e) => updateSettings({ timerFontScale: Number(e.target.value) })}
            />
            <span className="hint">{s.timerFontScale.toFixed(2)}×</span>
          </Row>
          <Row label={isZh ? '紧凑打乱' : 'Compact scramble'}>
            <input
              type="checkbox"
              checked={s.compactScramble}
              onChange={(e) => updateSettings({ compactScramble: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '显示魔方预览' : 'Show cube preview'}>
            <input
              type="checkbox"
              checked={s.showCubePreview}
              onChange={(e) => updateSettings({ showCubePreview: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '显示图表' : 'Show charts'}>
            <input
              type="checkbox"
              checked={s.showCharts}
              onChange={(e) => updateSettings({ showCharts: e.target.checked })}
            />
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '配色（魔方面）' : 'Cube colors'}</h3>
          <div className="color-grid">
            {(['U', 'D', 'F', 'B', 'L', 'R'] as const).map(face => {
              const wcaDefault: Record<typeof face, string> = {
                U: '#FFFFFF', D: '#FFD500', F: '#009B48', B: '#0046AD', L: '#FF5800', R: '#B71234',
              } as const;
              const cur = s.colors[face] ?? wcaDefault[face];
              return (
                <label key={face} className="color-cell">
                  <span>{face}</span>
                  <input
                    type="color"
                    value={cur}
                    onChange={(e) => updateSettings({
                      colors: { ...s.colors, [face]: e.target.value },
                    })}
                  />
                </label>
              );
            })}
          </div>
          <button
            className="reset-btn"
            onClick={() => updateSettings({ colors: {} })}
          >
            {isZh ? '恢复 WCA 配色' : 'Reset to WCA colors'}
          </button>
        </div>

        <div className="modal-actions">
          <button className="danger" onClick={() => {
            if (confirm(isZh ? '把所有设置恢复为默认值？' : 'Reset all settings to defaults?')) {
              resetSettings();
            }
          }}>
            {isZh ? '全部重置' : 'Reset all'}
          </button>
          <button className="primary" onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>

      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">{children}</span>
    </div>
  );
}
