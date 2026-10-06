'use client';
import { TimerSyncSeedSettings, TimerRankSettings, TimerBackupSettings, TimerImportSettings, TimerReanalyzeSettings, TimerDisplaySettings, TimerSoundSettings, TimerMetronomeSettings } from '@cuberoot/timer-ui';

/**
 * Settings panel — modal launched from the topbar gear button.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { getSettings, resetSettings, updateSettings, useSettings } from '../_lib/settings';
import { TimerKeymapSettings, TimerGoalSettings, TimerRoundSettings, TimerSettingsPanel, TimerTypographySettings } from '@cuberoot/timer-ui';
import { warmupSound, play, playInspectionBeep } from '../_lib/sound';
import { isVoiceAvailable } from '../_lib/sound/voice';
import { resetTimerSyncSeed } from '@cuberoot/shared/timer/sync-seed';
import { exportJson, exportSpeedstacks, importJson, inspectImportJson, listBackups, importNamedSessions, loadAll, pushBackup, restoreBackup } from '../_lib/storage/db';



import { exportCstimerJson } from '../_lib/storage/export_cstimer';
import { exportSolvesCsv } from '../_lib/storage/export_csv';
import { uploadBackup, restoreFromCloud, fetchBackupMeta } from '../_lib/storage/cloud';
import { getSessionToken, useAuthStore } from '@/lib/auth-store';
import { useRankCountry } from '../_shared/use-rank-country';
import { reanalyzeAll } from '../_lib/storage/reanalyze';
import { type EventId } from '../_lib/types';

import {
  timerSettingFieldContract,
  timerSettingFieldStates,
  timerWcaScrambleEventId,
  timerWcaSupportsOptimal,
  type TimerSettingCategoryId,
  type TimerSettingFieldId,
} from '@cuberoot/shared/timer';
import { TimerAttemptSplitSettings, TimerScramblePreviewSettings, TimerBooleanSettingRow, TimerTimingSettingsSections, TimerSmartCubeSettingsFields, type TimerBooleanControlProps } from '@cuberoot/timer-ui';
import { canUseRandomOptimal333 } from '../_lib/scramble/optimal333_pool';
import { TimerPreScrambleSettings, TimerColorNeutralSetting } from '@cuberoot/timer-ui';
import { useMetronome, setMetronome, tapTempo } from '@/lib/metronome';
import { CountryInput } from '@/components/CountryInput';

import SharedBoolToggle from '@/components/BoolToggle';
import { TimerResetSettings, TimerExportSettings } from '@cuberoot/timer-ui';
import { tr } from '@/i18n/tr';


// .settings-row* 原语来自 wca-source.css(现已提取到共享 components/)—— 以前靠
// WcaSourceConfig 顺带 import 进来,「打乱来源」那节移出后这里得自己 import,否则每个 Row 掉样式。
import '@/components/wca-source.css';

interface Props {
  onClose: () => void;
  /** Current event — target-time setting applies to this event. */
  event: EventId;
  mergeSlotRef: (element: HTMLDivElement | null) => void;
  /** Called after the local DB is wholesale-replaced (cloud restore) so the host can refresh. */
  onDataReplaced?: () => void;
}

interface SettingsSectionProps {
  category: TimerSettingCategoryId;
  activeCategory: TimerSettingCategoryId;
  title?: string;
  children: React.ReactNode;
  headerControl?: React.ReactNode;
}

function SettingsSection({ category, activeCategory, title, children, headerControl }: SettingsSectionProps) {
  if (category !== activeCategory) return null;
  return (
    <section className="settings-section">
      {(title || headerControl) && (
        <div className="settings-section-head">
          {title && <h4>{title}</h4>}
          {headerControl}
        </div>
      )}
      {children}
    </section>
  );
}

export default function SettingsPanel({ onClose, event, mergeSlotRef, onDataReplaced }: Props) {
  const s = useSettings();
  const optimalUser = useAuthStore((st) => st.user);
  const metro = useMetronome();
  const [activeCategory, setActiveCategory] = useState<TimerSettingCategoryId>('timer');
  // Keep draft in sync when the active seed changes externally (e.g. settings reset).

  // WCA 真题沿用各项目既有的同态最优能力；随机状态只接三阶云端最优表。
  // 偏好本身不清空，切回可用来源/项目时自动恢复。
  const wev = timerWcaScrambleEventId(event);
  const hasOptimal = timerWcaSupportsOptimal(wev);
  const optimalAvailable = s.scrambleSource === 'wca'
    ? hasOptimal
    : canUseRandomOptimal333(event, s.scrambleSource, !!optimalUser, s.syncSeed);
  // ── Import / export status ──
  const [ioMsg, setIoMsg] = useState<string | null>(null);
  const ioMsgTimerRef = useRef<number | null>(null);

  // ── Cloud backup state ──
  const user = useAuthStore((st) => st.user);
  const { accountCountry: rankAccountCountry } = useRankCountry();
  const login = useAuthStore((st) => st.login);
  useEffect(() => {
    return () => {
      if (ioMsgTimerRef.current !== null) window.clearTimeout(ioMsgTimerRef.current);
    };
  }, []);

  function flashIoMsg(msg: string): void {
    setIoMsg(msg);
    if (ioMsgTimerRef.current !== null) window.clearTimeout(ioMsgTimerRef.current);
    ioMsgTimerRef.current = window.setTimeout(() => {
      setIoMsg(null);
      ioMsgTimerRef.current = null;
    }, 2000);
  }

  function downloadText(contents: string, mime: string, fileName: string): void {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onCubeRootExport(): void {
    const date = new Date().toISOString().slice(0, 10);
    downloadText(exportJson(), 'application/json', `cuberoot-timer-${date}.json`);
    flashIoMsg(tr({ zh: 'CubeRoot 备份已导出', en: 'CubeRoot backup exported' }));
  }

  async function onCstimerExport(): Promise<void> {
    try {
      const { json, solveCount, sessionCount } = await exportCstimerJson();
      if (solveCount === 0) {
        alert(tr({ zh: '当前没有可导出的成绩。', en: 'No solves to export.'
        }));
        return;
      }
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      downloadText(json, 'application/json', `cuberoot-export-${yyyy}-${mm}-${dd}.json`);
      flashIoMsg(tr({
        zh: `已导出 ${solveCount} 条成绩（${sessionCount} 个会话）`,
        en: `Exported ${solveCount} solves across ${sessionCount} sessions`,
      }));
    } catch {
      alert(tr({ zh: '导出失败。', en: 'Export failed.'
    }));
    }
  }

  function onCsvExport(): void {
    try {
      const { csv, solveCount } = exportSolvesCsv();
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      downloadText(csv, 'text/csv;charset=utf-8', `cuberoot-solves-${yyyy}-${mm}-${dd}.csv`);
      flashIoMsg(tr({
        zh: `已导出 ${solveCount} 条成绩`,
        en: `Exported ${solveCount} solves`,
      }));
    } catch {
      alert(tr({ zh: '导出失败。', en: 'Export failed.'
    }));
    }
  }

  function onSpeedstacksExport(): void {
    const solves = loadAll()[event] ?? [];
    if (solves.length === 0) {
      alert(tr({ zh: '当前项目没有可导出的成绩。', en: 'No solves to export for this event.' }));
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    downloadText(
      exportSpeedstacks(solves),
      'text/plain;charset=utf-8',
      `cuberoot-timer-${event}-${date}.ss.txt`,
    );
    flashIoMsg(tr({
      zh: `已导出当前项目的 ${solves.length} 条成绩`,
      en: `Exported ${solves.length} solves from this event`,
    }));
  }

  const settingStates = timerSettingFieldStates({
    event,
    source: s.scrambleSource,
    development: process.env.NODE_ENV !== 'production',
    signedIn: !!user,
    optimalAvailable,
    roundEnabled: s.round.on,
    rankEnabled: s.rankScopes.some((scope) => scope === 'NR' || scope === 'CR'),
    rankAccountCountry,
    showCubePreview: s.showCubePreview,
    soundsEnabled: s.soundsEnabled,
    voiceAvailable: isVoiceAvailable(),
    metronomeEnabled: s.metronomeOn,
    localBackupsExpanded: false,
    stagedImport: false,
    importUnresolved: false,
    cloudBusy: false,
    importBusy: false,
    reanalyzeBusy: false,
    syncSeedDraft: s.syncSeed ?? '',
    activeSyncSeed: s.syncSeed,
  });
  function settingState(id: TimerSettingFieldId) {
    const state = settingStates.find((field) => field.id === id);
    if (!state) throw new Error(`Missing timer setting state: ${id}`);
    return state;
  }

  return (
    <TimerSettingsPanel language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'}
      activeCategory={activeCategory} onCategoryChange={setActiveCategory} onClose={onClose}>
            {activeCategory === 'appearance' && (
              <div
                className="settings-appearance-preview"
                style={{
                  '--settings-time-scale': s.timerFontScale,
                  '--settings-scramble-scale': s.scrambleFontScale,
                } as React.CSSProperties}
                aria-label={tr({ zh: '外观预览', en: 'Appearance preview' })}
              >
                <span className="settings-preview-label">{tr({ zh: '预览', en: 'Preview' })}</span>
                <strong className={`tf-${s.timerFont}`}>12.34</strong>
                <span className={`sf-${s.scrambleFont}`}>R U R&apos; U&apos; F2</span>
              </div>
            )}

        <TimerTimingSettingsSections
          active={activeCategory === 'timer'}
          localize={tr}
          onChange={updateSettings}
          renderBooleanControl={renderTimingBooleanControl}
          value={s}
        />

        <SettingsSection
          category="smart-cube"
          activeCategory={activeCategory}
          title={tr({ zh: '连接后的行为', en: 'Connected cube behavior' })}
        >
          {settingState('settings.smart-cube.fake-cube').visible && (
            <BooleanSettingRow
              id="settings.smart-cube.fake-cube"
              value={s.showDevFakeCube}
              onChange={(v) => updateSettings({ showDevFakeCube: v })}
            />
          )}
          <TimerSmartCubeSettingsFields value={s} localize={tr} onChange={updateSettings} renderBooleanControl={renderTimingBooleanControl} />
        </SettingsSection>

        <SettingsSection
          category="training"
          activeCategory={activeCategory}
          title={tr({ zh: '目标与分段', en: 'Goals and splits' })}
        >
          <TimerAttemptSplitSettings
            bldVisible={settingState('settings.training.bld-memo-split').visible}
            localize={tr}
            onChange={updateSettings}
            renderBooleanControl={({ label, onChange, value }) => (
              <SharedBoolToggle label={label} onChange={onChange} value={value} />
            )}
            stageVisible={settingState('settings.training.stage-splits').visible}
            value={s}
          />
          <TimerGoalSettings value={s} event={event} onChange={updateSettings} localize={tr} />
        </SettingsSection>

        <SettingsSection
          category="scramble"
          activeCategory={activeCategory}
          title={tr({ zh: '规则与朝向', en: 'Rules and orientation' })}
        >
          {/* 2x2 的「最优」已挪到打乱条上的口径 picker(Scramble222ModePicker,随机状态与真题统一)。
              其余项目保留同一行：当前来源不支持时置灰，切项目后布局不会跳。 */}
          {settingState('settings.scramble.optimal').visible && (
            <TimerBooleanSettingRow
              field={timerSettingFieldContract('settings.scramble.optimal')}
              label={settingLabel('settings.scramble.optimal')}
              value={optimalAvailable ? s.wcaUseOptimal : false}
              onChange={(v) => updateSettings({ wcaUseOptimal: v })}
              disabled={settingState('settings.scramble.optimal').disabled}
              hint={s.scrambleSource === 'random' && event === '333' && !optimalUser
                ? tr({ zh: '登录后可用', en: 'Sign in to use' })
                : s.scrambleSource === 'random' && event === '333' && !!optimalUser && !!s.syncSeed
                  ? tr({ zh: '同步种子开启时不可用', en: 'Unavailable with a sync seed' })
                  : undefined}
              renderBooleanControl={renderTimingBooleanControl}
            />
          )}
          {settingState('settings.scramble.auto-mark-wca').visible && (
            <BooleanSettingRow
              id="settings.scramble.auto-mark-wca"
              value={s.autoMarkWcaScramble}
              onChange={(v) => updateSettings({ autoMarkWcaScramble: v })}
            />
          )}
          <div ref={mergeSlotRef} />
        </SettingsSection>

        <SettingsSection category="scramble" activeCategory={activeCategory}>
          <TimerPreScrambleSettings value={s} onChange={updateSettings} localize={tr} />
          <TimerColorNeutralSetting event={event} value={s.cnMode} onChange={cnMode => updateSettings({ cnMode })} localize={tr} />
        </SettingsSection>

        <SettingsSection
          category="sound"
          activeCategory={activeCategory}
          title={tr({ zh: '声音', en: 'Sound'
        })}
        >
          <TimerSoundSettings value={s} onChange={updateSettings} localize={tr} voiceAvailable={isVoiceAvailable()} onWarmup={warmupSound} onPreview={() => play('start')} />
        </SettingsSection>

        <SettingsSection
          category="sound"
          activeCategory={activeCategory}
          title={tr({ zh: '节拍器', en: 'Metronome'
        })}
        >
          <TimerMetronomeSettings value={s} bpm={metro.bpm} onChange={updateSettings} onBpmChange={bpm => setMetronome({ bpm })} onTap={tapTempo} onWarmup={warmupSound} onPreviewBeep={playInspectionBeep} localize={tr} />
        </SettingsSection>

        <SettingsSection
          category="advanced"
          activeCategory={activeCategory}
          title={tr({ zh: '同步种子', en: 'Sync seed'
        })}
        >
          <TimerSyncSeedSettings value={s} language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} onReset={seed => updateSettings(resetTimerSyncSeed(getSettings(), seed))} />
        </SettingsSection>

        {activeCategory === 'data' && <TimerBackupSettings language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} every={s.autoBackupEvery} onEveryChange={autoBackupEvery => updateSettings({ autoBackupEvery })}
          owner={getSessionToken()} login={login} local={{ create: pushBackup, list: listBackups, restore: async (key, canCommit) => {
            if (!await restoreBackup(key, canCommit)) throw new Error('Restore failed'); onDataReplaced?.();
          } }} cloud={{ meta: fetchBackupMeta, upload: uploadBackup, restore: async canCommit => {
            const result = await restoreFromCloud(canCommit);
            if (result === 'invalid') throw new Error('Invalid backup');
            if (result === 'ok') onDataReplaced?.();
            return result === 'ok';
          } }} />}

        <SettingsSection
          category="data"
          activeCategory={activeCategory}
          title={tr({ zh: '导入与导出', en: 'Import and export'
        })}
        >
          <TimerImportSettings language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} importSessions={async sessions => {
            if (!importNamedSessions(sessions)) throw new Error('Import failed');
            onDataReplaced?.();
          }} importBackup={async text => {
            const preview = inspectImportJson(text);
            if (!preview) throw new Error('Invalid backup');
            if (!confirm(tr({ en: 'Importing replaces all current solves. Continue?', zh: '导入会覆盖当前全部成绩，是否继续？' }))) return false;
            if (!importJson(text)) throw new Error('Import failed');
            onDataReplaced?.();
            return true;
          }} />
          <TimerExportSettings localize={tr} onExport={format => {
            if (format === 'cuberoot') onCubeRootExport();
            else if (format === 'cstimer') void onCstimerExport();
            else if (format === 'csv') onCsvExport();
            else onSpeedstacksExport();
          }} />
          {ioMsg !== null && (
            <Row label=""><span className="hint" role="status" aria-live="polite">{ioMsg}</span></Row>
          )}
          <TimerReanalyzeSettings language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} run={async () => {
            const result = await reanalyzeAll();
            onDataReplaced?.();
            return result;
          }} />
        </SettingsSection>

        <SettingsSection
          category="appearance"
          activeCategory={activeCategory}
          title={tr({ zh: '外观', en: 'Appearance'
        })}
        >
          <TimerTypographySettings value={s} onChange={updateSettings} language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} />
          <TimerDisplaySettings value={s} onChange={updateSettings} localize={tr} renderBooleanControl={props => <SharedBoolToggle {...props} />}>
          <TimerScramblePreviewSettings
            localize={tr}
            onChange={updateSettings}
            renderBooleanControl={({ disabled, label, onChange, value }) => (
              <SharedBoolToggle
                disabled={disabled}
                label={label}
                onChange={onChange}
                value={value}
              />
            )}
            value={s}
          />
          </TimerDisplaySettings>
          <TimerRankSettings language={tr({ en: 'en', zh: 'zh' }) as 'en' | 'zh'} scopes={s.rankScopes} country={s.rankCountry ?? ''} accountCountry={rankAccountCountry} onScopes={rankScopes => updateSettings({ rankScopes })} onCountry={rankCountry => updateSettings({ rankCountry })} renderCountry={() => <CountryInput value={(s.rankCountry ?? '').toLowerCase()} onChange={iso2 => updateSettings({ rankCountry: iso2.toUpperCase() })} placeholder="" />} login={!user ? login : undefined} />
        </SettingsSection>

        {activeCategory === 'training' && <TimerRoundSettings value={s} onChange={patch => updateSettings({ round: { ...getSettings().round, ...patch } })} localize={tr} />}

        <SettingsSection
          category="advanced"
          activeCategory={activeCategory}
          title={tr({ zh: '快捷键与手势', en: 'Shortcuts and gestures' })}
        >
          <TimerKeymapSettings value={s.keymap} onChange={update => updateSettings({ keymap: update(getSettings().keymap) })} localize={tr} />
          <TimerResetSettings onReset={resetSettings} confirmReset={message => confirm(message)} localize={tr} />
        </SettingsSection>
    </TimerSettingsPanel>
  );
}

function settingLabel(id: TimerSettingFieldId): string {
  return tr(timerSettingFieldContract(id).copy);
}

/** Keeps the canonical site-wide switch DOM while shared timer-ui owns the setting row. */
function renderTimingBooleanControl({
  disabled,
  label,
  onChange,
  value,
}: TimerBooleanControlProps) {
  return (
    <SharedBoolToggle
      disabled={disabled}
      label={label}
      onChange={onChange}
      value={value}
    />
  );
}

function Row({
  label,
  children,
  settingId,
}: {
  label: string;
  children: React.ReactNode;
  settingId?: TimerSettingFieldId;
}) {
  const labelId = useId();
  return (
    <div className="settings-row" data-setting-id={settingId}>
      <span id={label ? labelId : undefined} className="settings-row-label">{label}</span>
      <span
        className="settings-row-control"
        role={label ? 'group' : undefined}
        aria-labelledby={label ? labelId : undefined}
      >
        {children}
      </span>
    </div>
  );
}

function BooleanSettingRow({
  id,
  value,
  onChange,
  children,
  disabled,
}: {
  id: TimerSettingFieldId;
  value: boolean;
  onChange: (value: boolean) => void;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const label = settingLabel(id);
  return (
    <div className="settings-row settings-row-boolean" data-setting-id={id}>
      <span className="settings-row-label">{label}</span>
      <span className="settings-row-control">
        <SharedBoolToggle value={value} onChange={onChange} label={label} disabled={disabled} />
        {children}
      </span>
    </div>
  );
}
