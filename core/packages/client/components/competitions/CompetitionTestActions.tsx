'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { FlaskConical } from 'lucide-react';
import { WCA_TIMED_EVENT_ORDER } from '@cuberoot/shared/wca-events';
import BoolToggle from '@/components/BoolToggle';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { useModalBackdrop } from '@/hooks/useModalDismiss';
import { useEntryRouter } from '@/hooks/useEntryRouter';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { hasAdminAccess, useAuthUser } from '@/lib/auth-store';
import { copyClipboardText } from '@/lib/clipboard';
import { competitionHref, competitionWorkspaceHref } from '@/lib/competition-links';
import {
  cleanupCompetitionTest, createCompetitionTest, getCompetitionTestOptions, startCompetitionTest,
  type CompetitionTestSettings, type OnlineCompetition,
} from '@/lib/online-competition-api';
import { competitionFormatName, competitionModeName } from './CompetitionDraftForm';
import './online-competitions.css';

const testProjects = new Set<string>(WCA_TIMED_EVENT_ORDER);
const noUnofficialProjects = new Set<string>();

export function CompetitionTestBadge() {
  const t = useT();
  return <span className="competition-state">{t('测试赛', 'Test competition')}</span>;
}

function testError(cause: unknown, t: ReturnType<typeof useT>) {
  switch (cause instanceof Error ? cause.message : '') {
    case 'No approved competition organizer is available':
      return t('当前没有获批的主办组织。', 'No approved organizer is available.');
    case 'At least two confirmed competitors are required to start a duel':
      return t('双败赛至少需要两人确认报名。', 'At least two confirmed entrants are needed for double elimination.');
    case 'Wait for held registrations to be resolved before starting':
      return t('还有未完成的报名，请处理后再开赛。', 'Resolve held registrations before starting.');
    case 'A test competition with a non-zero order cannot be cleaned up':
      return t('该赛事有非零金额订单，无法清理。', 'This competition has a non-zero order and cannot be cleaned up.');
    case 'Choose an active organization supervisor or site administrator':
      return t('所选监督员已不可用。', 'The selected supervisor is no longer eligible.');
    default:
      return t('操作未完成，请重试。', 'The action could not be completed. Try again.');
  }
}

export function CompetitionTestCreateButton() {
  const t = useT();
  const user = useAuthUser();
  const [open, setOpen] = useState(false);
  if (!hasAdminAccess(user)) return null;
  return <>
    <button className="competition-secondary" type="button" onClick={() => setOpen(true)}>
      <FlaskConical size={16} aria-hidden />{t('一键测试赛', 'Quick test competition')}
    </button>
    {open && <CreateTestDialog userId={user?.uid} onClose={() => setOpen(false)} />}
  </>;
}

function CreateTestDialog({ userId, onClose }: { userId?: number; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useEntryRouter();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const retry = useRef<{ payload: string; key: string } | null>(null);
  const [format, setFormat] = useState<CompetitionTestSettings['format']>('average');
  const [mode, setMode] = useState<CompetitionTestSettings['supervisionMode']>('self_service');
  const [device, setDevice] = useState<CompetitionTestSettings['device']>('smart');
  const [project, setProject] = useState<CompetitionTestSettings['project']>('333');
  const [autoEnter, setAutoEnter] = useState(true);
  const [supervisor, setSupervisor] = useState<number | undefined>(userId);
  const [options, setOptions] = useState<Awaited<ReturnType<typeof getCompetitionTestOptions>> | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [optionsRevision, setOptionsRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const directEntry = format === 'average' && mode === 'self_service';
  const supervised = mode === 'supervised';

  function close() {
    if (pending.current) return;
    dialog.current?.close();
    onClose();
  }
  const backdrop = useModalBackdrop(close);
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal(); }, []);
  useEffect(() => {
    if (!supervised || options) return;
    let active = true;
    setOptionsError('');
    void getCompetitionTestOptions().then(result => {
      if (!active) return;
      setOptions(result);
      setSupervisor(current => result.supervisors.some(user => user.id === current) ? current : result.supervisors[0]?.id);
    }).catch(cause => { if (active) setOptionsError(testError(cause, t)); });
    return () => { active = false; };
  }, [options, optionsRevision, supervised, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (supervised && (!options || supervisor === undefined))) return;
    const body: CompetitionTestSettings = {
      format, supervisionMode: mode, device, project: device === 'smart' ? '333' : project, autoEnter: directEntry && autoEnter,
      ...(supervised ? { organizationId: options?.organizationId, supervisorUserId: supervisor } : {}),
    };
    const payload = JSON.stringify(body);
    if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await createCompetitionTest(body, retry.current.key);
      const href = result.registrationId
        ? `${competitionHref(result.slug)}?entry=${encodeURIComponent(result.registrationId)}`
        : competitionWorkspaceHref('manage', result.id);
      pending.current = false;
      close();
      router.push((lang === 'zh' ? '/zh' : '') + href);
    } catch (cause) {
      setError(testError(cause, t));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <dialog ref={dialog} className="competition-report-dialog competition-test-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); close(); }} {...backdrop}>
    <form className="competition-report-panel competition-test-form" data-site-surface="popover" onSubmit={submit}>
      <header><h3 id={titleId}>{t('一键测试赛', 'Quick test competition')}</h3></header>
      <fieldset className="competition-test-fields" disabled={busy}>
        <label className="competition-field">{t('赛制', 'Format')}
          <select className="platform-field-control competition-test-select" value={format} onChange={event => setFormat(event.target.value as typeof format)}>
            {(['average', 'advancement'] as const).map(value => <option key={value} value={value}>{competitionFormatName(value, t)}</option>)}
          </select>
        </label>
        <label className="competition-field">{t('形态', 'Mode')}
          <select className="platform-field-control competition-test-select" value={mode} onChange={event => setMode(event.target.value as typeof mode)}>
            {(['self_service', 'supervised'] as const).map(value => <option key={value} value={value}>{competitionModeName(value, t)}</option>)}
          </select>
        </label>
        <label className="competition-field">{t('设备', 'Equipment')}
          <select className="platform-field-control competition-test-select" value={device} onChange={event => setDevice(event.target.value as typeof device)}>
            <option value="smart">{t('智能三阶', 'Smart 3x3')}</option>
            <option value="ordinary">{t('普通魔方', 'Standard cube')}</option>
          </select>
        </label>
        {device === 'ordinary' && <div className="competition-field">
          <span>{t('项目', 'Event')}</span>
          <PuzzlePicker wcaEvents={testProjects} availableEvents={noUnofficialProjects} selectedEvent={project} isZh={lang === 'zh'}
            showTriggerIcon showTriggerLabel showArrow triggerVariant="pill"
            onSelect={value => setProject(value as typeof project)} />
        </div>}
        {supervised && <div className="competition-test-wide">
          <label className="competition-field">{t('监督员', 'Supervisor')}
            <select className="platform-field-control competition-test-select" value={supervisor ?? ''} disabled={!options}
              onChange={event => setSupervisor(Number(event.target.value))}>
              {!options && <option value="">{optionsError ? t('加载失败', 'Loading failed') : t('正在加载…', 'Loading…')}</option>}
              {options?.supervisors.map(user => <option key={user.id} value={user.id}>{user.name || user.id}</option>)}
            </select>
          </label>
          <p className="competition-muted">{t('请用另一个账号参赛。', 'Use a separate account to compete.')}</p>
          {optionsError && <div className="competition-toolbar">
            <span role="alert">{optionsError}</span>
            <button type="button" className="competition-secondary" onClick={() => setOptionsRevision(value => value + 1)}>{t('重试', 'Retry')}</button>
          </div>}
        </div>}
        {directEntry && <div className="competition-test-wide">
          <BoolToggle label={t('创建后直接进入赛场', 'Enter the arena after creating')} value={autoEnter} onChange={setAutoEnter} />
        </div>}
      </fieldset>
      {error && <p role="alert" className="competition-error">{error}</p>}
      <div className="competition-toolbar">
        <button type="submit" className="competition-primary" disabled={busy || (supervised && (!options || supervisor === undefined))}>
          {busy ? t('创建中…', 'Creating…') : t('创建测试赛', 'Create test competition')}
        </button>
        <button type="button" className="competition-secondary" disabled={busy} onClick={close}>{t('取消', 'Cancel')}</button>
      </div>
    </form>
  </dialog>;
}

export function CompetitionTestControls({ competition, canStart, onStarted }: {
  competition: OnlineCompetition; canStart: boolean; onStarted: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const router = useEntryRouter();
  const pending = useRef(false);
  const keys = useRef<Partial<Record<'start' | 'cleanup', string>>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function copy() {
    const path = (lang === 'zh' ? '/zh' : '') + competitionHref(competition.slug);
    const copied = await copyClipboardText(new URL(path, window.location.origin).href);
    setNotice(copied ? t('已复制参赛链接', 'Entry link copied') : '');
    setError(copied ? '' : t('复制失败，请从赛事页复制网址。', 'Copy failed. Copy the URL from the competition page.'));
  }
  async function mutate(action: 'start' | 'cleanup') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    setError('');
    const key = keys.current[action] ??= crypto.randomUUID();
    try {
      if (action === 'start') {
        await startCompetitionTest(competition.id, key);
        onStarted();
        setNotice(t('测试赛已开始', 'Test competition started'));
      } else {
        await cleanupCompetitionTest(competition.id, key);
        router.push((lang === 'zh' ? '/zh' : '') + competitionWorkspaceHref('manage'));
      }
    } catch (cause) {
      setError(testError(cause, t));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="competition-toolbar">
    <button className="competition-secondary" type="button" disabled={busy} onClick={() => void copy()}>{t('复制参赛链接', 'Copy entry link')}</button>
    {canStart && <button className="competition-primary" type="button" disabled={busy || confirm} onClick={() => void mutate('start')}>{t('立即开赛', 'Start now')}</button>}
    {confirm ? <>
      <span className="competition-muted">{t('这会下线赛事并关闭监督视频。', 'This takes the competition offline and closes supervision video.')}</span>
      <button className="competition-secondary" type="button" disabled={busy} onClick={() => void mutate('cleanup')}>{t('确认清理', 'Confirm cleanup')}</button>
      <button className="competition-secondary" type="button" disabled={busy} onClick={() => setConfirm(false)}>{t('取消', 'Cancel')}</button>
    </> : <button className="competition-secondary" type="button" disabled={busy} onClick={() => setConfirm(true)}>{t('清理测试赛', 'Clean up test competition')}</button>}
    {notice && <span role="status">{notice}</span>}
    {error && <span role="alert" className="competition-error">{error}</span>}
  </div>;
}
