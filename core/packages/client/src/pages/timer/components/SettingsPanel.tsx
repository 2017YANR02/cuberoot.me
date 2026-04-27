/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect, useState } from 'react';
import { resetSettings, updateSettings, useSettings } from '../settings';
import { warmupSound, play } from '../sound';
import { getMetronome } from '../sound/metronome';
import { isVoiceAvailable } from '../sound/voice';
import { getSeedCounter, resetSeedCounter } from '../scramble';
import { listBackups, pushBackup, restoreBackup } from '../storage/db';

interface Props {
  isZh: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isZh, onClose }: Props) {
  const s = useSettings();
  const [seedTick, setSeedTick] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Drive the metronome from settings.
  useEffect(() => {
    const m = getMetronome();
    if (s.metronomeEnabled) {
      if (!m.isRunning()) m.start(s.metronomeBpm);
      else m.setBpm(s.metronomeBpm);
    } else if (m.isRunning()) {
      m.stop();
    }
  }, [s.metronomeEnabled, s.metronomeBpm]);

  function showBackupPicker(): void {
    const list = listBackups();
    if (list.length === 0) {
      alert(isZh ? '尚无自动备份。' : 'No auto-backups yet.');
      return;
    }
    const lines = list.map((e, i) => {
      const d = new Date(e.ts);
      const stamp = d.toISOString().replace('T', ' ').slice(0, 19);
      const kb = (e.size / 1024).toFixed(1);
      return `${i + 1}. ${stamp}  (${kb} KB)`;
    }).join('\n');
    const prompt1 = isZh
      ? `备份列表（输入序号恢复，留空取消）：\n\n${lines}`
      : `Auto-backups (enter index to restore, blank to cancel):\n\n${lines}`;
    const ans = window.prompt(prompt1, '');
    if (!ans) return;
    const idx = parseInt(ans, 10) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      alert(isZh ? '无效序号。' : 'Invalid index.');
      return;
    }
    const target = list[idx]!;
    if (!confirm(isZh
      ? `确认用 ${new Date(target.ts).toLocaleString()} 的备份覆盖当前数据？`
      : `Restore backup from ${new Date(target.ts).toLocaleString()} (overwrites current data)?`)) return;
    const ok = restoreBackup(target.key);
    alert(ok
      ? (isZh ? '已恢复。请刷新页面。' : 'Restored. Please reload the page.')
      : (isZh ? '恢复失败。' : 'Restore failed.'));
  }

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
          <Row label={isZh ? 'CFOP 分阶段计时' : 'CFOP stage splits'}>
            <input
              type="checkbox"
              checked={s.multiStage}
              onChange={(e) => updateSettings({ multiStage: e.target.checked })}
            />
            <span className="hint">{isZh
              ? '按 1=Cross 完成，2=F2L，3=OLL；蓝牙连接时自动检测'
              : 'Press 1=Cross, 2=F2L, 3=OLL; auto-detected when bluetooth connected'}</span>
          </Row>
          <Row label={isZh ? '盲拧记忆 / 执行分段' : 'BLD memo split'}>
            <input
              type="checkbox"
              checked={s.bldMemo}
              onChange={(e) => updateSettings({ bldMemo: e.target.checked })}
            />
            <span className="hint">{isZh
              ? '盲拧项目运行中按 Enter 标记记忆完成'
              : 'On BLD events, press Enter while running to mark memo done'}</span>
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
          <Row label={isZh ? '颜色中立' : 'Color neutral'}>
            <select
              value={s.cnMode}
              onChange={(e) => updateSettings({ cnMode: e.target.value as 'none' | 'single' | 'dual' | 'six' })}
            >
              <option value="none">{isZh ? '固定白底' : 'None (white)'}</option>
              <option value="single">{isZh ? '单面随机' : 'Single (random)'}</option>
              <option value="dual">{isZh ? '双面（白黄）' : 'Dual (white/yellow)'}</option>
              <option value="six">{isZh ? '六面' : 'Six-sided'}</option>
            </select>
            <span className="hint">{isZh ? '仅 3x3 类项目生效' : '3x3 events only'}</span>
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
          <Row label={isZh ? '语音观察' : 'Voice inspection'}>
            <select
              value={s.voiceInspection}
              onChange={(e) => {
                updateSettings({ voiceInspection: e.target.value as 'none' | 'en' | 'zh' });
                warmupSound();
              }}
              disabled={!isVoiceAvailable()}
            >
              <option value="none">{isZh ? '关闭（用提示音）' : 'Off (beeps)'}</option>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
            <span className="hint">{isVoiceAvailable()
              ? (isZh ? '念 8 秒 / 12 秒 / 开始' : 'reads 8s / 12s / go')
              : (isZh ? '浏览器不支持' : 'unsupported by browser')}</span>
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '节拍器' : 'Metronome'}</h3>
          <Row label={isZh ? '开启' : 'Enabled'}>
            <input
              type="checkbox"
              checked={s.metronomeEnabled}
              onChange={(e) => {
                updateSettings({ metronomeEnabled: e.target.checked });
                if (e.target.checked) warmupSound();
              }}
            />
          </Row>
          <Row label={isZh ? '速度（BPM）' : 'Tempo (BPM)'}>
            <input
              type="number" min={30} max={240} step={1}
              value={s.metronomeBpm}
              onChange={(e) => updateSettings({ metronomeBpm: Math.max(30, Math.min(240, Number(e.target.value) || 60)) })}
            />
            <span className="hint">{isZh ? '离开本页时自动停止' : 'auto-stops on page leave'}</span>
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '同步种子' : 'Sync seed'}</h3>
          <Row label={isZh ? '种子' : 'Seed'}>
            <input
              type="text"
              value={s.syncSeed ?? ''}
              placeholder={isZh ? '留空 = 关闭' : 'blank = off'}
              onChange={(e) => {
                const v = e.target.value;
                updateSettings({ syncSeed: v === '' ? null : v });
                resetSeedCounter();
                setSeedTick((t) => t + 1);
              }}
            />
          </Row>
          <Row label={isZh ? '已生成' : 'Generated'}>
            <span className="hint">{isZh ? `${getSeedCounter()} 次` : `${getSeedCounter()} scrambles`}</span>
            <button
              className="hint-btn"
              onClick={() => { resetSeedCounter(); setSeedTick((t) => t + 1); }}
              title={String(seedTick)}
            >
              {isZh ? '重置计数' : 'Reset counter'}
            </button>
            <span className="hint">{isZh ? '相同种子在不同设备打出相同序列' : 'same seed → same sequence across devices'}</span>
          </Row>
        </div>

        <div className="modal-section">
          <h3 className="settings-h3">{isZh ? '自动备份' : 'Auto-backup'}</h3>
          <Row label={isZh ? '每 N 次写入触发' : 'Every N saves'}>
            <input
              type="number" min={0} max={30} step={1}
              value={s.autoBackupEvery}
              onChange={(e) => updateSettings({ autoBackupEvery: Math.max(0, Math.min(30, Number(e.target.value) | 0)) })}
            />
            <span className="hint">{s.autoBackupEvery === 0
              ? (isZh ? '已禁用' : 'disabled')
              : (isZh ? '保留最近 10 份' : 'keeps last 10')}</span>
          </Row>
          <Row label={isZh ? '操作' : 'Actions'}>
            <button className="hint-btn" onClick={() => { pushBackup(); alert(isZh ? '已写入备份。' : 'Backup written.'); }}>
              {isZh ? '立即备份' : 'Back up now'}
            </button>
            <button className="hint-btn" onClick={showBackupPicker}>
              {isZh ? '查看备份' : 'View backups'}
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
          <Row label={isZh ? '使用 3D 立方体' : 'Use 3D cube'}>
            <input
              type="checkbox"
              checked={s.use3D}
              onChange={(e) => updateSettings({ use3D: e.target.checked })}
            />
            <span className="hint">{isZh ? '可拖动旋转' : 'drag to rotate'}</span>
          </Row>
          <Row label={isZh ? '显示图表' : 'Show charts'}>
            <input
              type="checkbox"
              checked={s.showCharts}
              onChange={(e) => updateSettings({ showCharts: e.target.checked })}
            />
          </Row>
          <Row label={isZh ? '显示练习日历' : 'Show practice heatmap'}>
            <input
              type="checkbox"
              checked={s.showHeatmap}
              onChange={(e) => updateSettings({ showHeatmap: e.target.checked })}
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
