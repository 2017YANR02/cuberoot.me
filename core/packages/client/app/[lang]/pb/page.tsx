'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { parseAsInteger, parseAsStringEnum, useQueryState } from 'nuqs';
import { BarChart3, IdCard, ListPlus, Share2, Trash2 } from 'lucide-react';
import {
  PB_EVENT_IDS,
  PB_RECORD_OPTIONS,
  parsePbResultInput,
  type PbRecordOption,
  type PbRecordType,
} from '@cuberoot/shared/pb';
import AppLink from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { DateInput } from '@/components/DateInput';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import HeaderToggles from '@/components/HeaderToggles';
import PuzzlePicker from '@/components/PuzzlePicker/PuzzlePicker';
import { tr, useLang } from '@/i18n/tr';
import { useAuthUser } from '@/lib/auth-store';
import { displayCuberName } from '@/lib/cuber-name-display';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';
import { toLocalIsoDate } from '@/lib/iso-date';
import {
  createPbRecord,
  deletePbRecord,
  fetchMyPbs,
  fetchPbLeaderboard,
  fetchPbProfile,
  updatePbVisibility,
  type PbCollection,
  type PbLeaderboardRow,
  type PbRecord,
} from '@/lib/pb-api';
import './pb.css';

type View = 'card' | 'leaderboard' | 'manage';
type OptionKey = `${PbRecordType}:${number}`;

const VIEW_KEYS: readonly View[] = ['card', 'leaderboard', 'manage'];
const OPTION_KEYS = PB_RECORD_OPTIONS.map(optionKey);
const PB_EVENT_SET: ReadonlySet<string> = new Set(PB_EVENT_IDS);
const NO_NON_WCA_EVENTS: ReadonlySet<string> = new Set();

function optionKey(option: PbRecordOption): OptionKey {
  return `${option.recordType}:${option.setSize}`;
}

function optionFromKey(key: OptionKey): PbRecordOption {
  return PB_RECORD_OPTIONS.find((option) => optionKey(option) === key) ?? PB_RECORD_OPTIONS[0];
}

function optionLabel(recordType: PbRecordType, setSize: number): string {
  if (recordType === 'single') return tr({ zh: '单次', en: 'Single' });
  if (recordType === 'mean') return tr({ zh: '三次平均', en: 'Mean of 3' });
  return tr({ zh: `${setSize} 次平均`, en: `Average of ${setSize}` });
}

function formatRecord(record: PbRecord): string {
  return formatWcaResult(
    record.resultValue,
    record.eventId,
    record.recordType === 'single' ? 'single' : 'average',
  );
}

function inputHint(eventId: string, recordType: PbRecordType): string {
  if (eventId === '333mbf') return tr({ zh: '例如 10/12 45:00', en: 'e.g. 10/12 45:00' });
  if (eventId === '333fm') {
    return recordType === 'single'
      ? tr({ zh: '例如 24', en: 'e.g. 24' })
      : tr({ zh: '例如 24.33', en: 'e.g. 24.33' });
  }
  return tr({ zh: '例如 12.34 或 1:02.34', en: 'e.g. 12.34 or 1:02.34' });
}

function friendlyError(): string {
  return tr({ zh: '操作失败，请检查输入或稍后重试。', en: 'The action failed. Check the input or try again.' });
}

function PbResultRows({ records }: { records: readonly PbRecord[] }) {
  const lang = useLang();
  const isZh = lang === 'zh';
  const current = useMemo(
    () => records.filter((record) => record.isCurrent).sort((a, b) => (
      PB_EVENT_IDS.indexOf(a.eventId as typeof PB_EVENT_IDS[number])
      - PB_EVENT_IDS.indexOf(b.eventId as typeof PB_EVENT_IDS[number])
      || a.setSize - b.setSize
    )),
    [records],
  );

  if (current.length === 0) {
    return <p className="pb-empty">{tr({ zh: '还没有公开的个人纪录。', en: 'No personal bests are public yet.' })}</p>;
  }

  return (
    <div className="pb-results">
      {current.map((record) => (
        <div className="pb-result-row" key={record.id}>
          <span className="pb-result-event">
            <EventIcon event={record.eventId} />
            <span>{eventDisplayName(record.eventId, isZh)}</span>
          </span>
          <span className="pb-result-kind">{optionLabel(record.recordType, record.setSize)}</span>
          <strong>{formatRecord(record)}</strong>
          <time dateTime={record.happenedOn}>{record.happenedOn}</time>
          {(record.cubeName || record.comments) && (
            <span className="pb-result-detail">
              {[record.cubeName, record.comments].filter(Boolean).join(' — ')}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PbPage() {
  const lang = useLang();
  const isZh = lang === 'zh';
  const authUser = useAuthUser();
  const signInHref = `/account?next=${encodeURIComponent(tr({
    zh: '/zh/pb?view=manage',
    en: '/pb?view=manage',
  }))}`;
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum<View>([...VIEW_KEYS]).withDefault('card').withOptions({ history: 'push' }),
  );
  const [sharedUserId] = useQueryState('user', parseAsInteger);
  const [eventId, setEventId] = useQueryState(
    'event',
    parseAsStringEnum<string>([...PB_EVENT_IDS]).withDefault('333'),
  );
  const [selectedOptionKey, setSelectedOptionKey] = useQueryState(
    'result',
    parseAsStringEnum<OptionKey>(OPTION_KEYS).withDefault('single:1'),
  );
  const selectedOption = optionFromKey(selectedOptionKey);

  const [myData, setMyData] = useState<PbCollection | null>(null);
  const [myLoading, setMyLoading] = useState(false);
  const [publicData, setPublicData] = useState<PbCollection | null>(null);
  const [publicLoading, setPublicLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<PbLeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [resultInput, setResultInput] = useState('');
  const today = toLocalIsoDate();
  const [dateInput, setDateInput] = useState(today);
  const [cubeName, setCubeName] = useState('');
  const [comments, setComments] = useState('');

  const refreshMine = async (signal?: AbortSignal) => {
    if (!authUser) {
      setMyData(null);
      return;
    }
    setMyLoading(true);
    try {
      setMyData(await fetchMyPbs(signal));
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(friendlyError());
    } finally {
      if (!signal?.aborted) setMyLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void refreshMine(controller.signal);
    return () => controller.abort();
    // refresh when the hydration-safe account identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid, authUser?.wcaId]);

  useEffect(() => {
    if (!sharedUserId) {
      setPublicData(null);
      setPublicLoading(false);
      return;
    }
    const controller = new AbortController();
    setPublicLoading(true);
    setError('');
    fetchPbProfile(sharedUserId, controller.signal)
      .then(setPublicData)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setPublicData(null);
          setError(tr({ zh: '找不到这个公开 PB 页面。', en: 'This public PB page could not be found.' }));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setPublicLoading(false); });
    return () => controller.abort();
  }, [sharedUserId]);

  useEffect(() => {
    if (view !== 'leaderboard') return;
    const controller = new AbortController();
    setLeaderboardLoading(true);
    setError('');
    fetchPbLeaderboard(eventId, selectedOption.recordType, selectedOption.setSize, controller.signal)
      .then(setLeaderboard)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(friendlyError());
      })
      .finally(() => { if (!controller.signal.aborted) setLeaderboardLoading(false); });
    return () => controller.abort();
  }, [eventId, selectedOption.recordType, selectedOption.setSize, view]);

  const onEventSelect = (nextEvent: string) => {
    void setEventId(nextEvent);
    if (nextEvent === '333mbf') void setSelectedOptionKey('single:1');
  };

  const onOptionSelect = (next: OptionKey) => {
    if (eventId === '333mbf' && next !== 'single:1') return;
    void setSelectedOptionKey(next);
  };

  const onVisibilityChange = async (isPublic: boolean) => {
    if (!myData || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updatePbVisibility(isPublic);
      setMyData({ ...myData, profile: { ...myData.profile, isPublic } });
      setMessage(tr({ zh: '公开设置已保存。', en: 'Visibility saved.' }));
    } catch {
      setError(friendlyError());
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const resultValue = parsePbResultInput(resultInput, eventId, selectedOption.recordType);
    if (resultValue == null) {
      setError(tr({ zh: '成绩格式无效。请按输入框示例填写。', en: 'Invalid result format. Follow the input example.' }));
      return;
    }
    if (!dateInput) {
      setError(tr({ zh: '请选择纪录日期。', en: 'Choose the PB date.' }));
      return;
    }
    const currentRecord = myData?.records.find((record) => (
      record.isCurrent
      && record.eventId === eventId
      && record.recordType === selectedOption.recordType
      && record.setSize === selectedOption.setSize
    ));
    if (currentRecord && resultValue >= currentRecord.resultValue) {
      setError(tr({ zh: '新成绩必须优于当前 PB。', en: 'The new result must beat the current PB.' }));
      return;
    }
    if (currentRecord && dateInput < currentRecord.happenedOn) {
      setError(tr({ zh: '新纪录的日期不能早于当前 PB。', en: 'The new entry cannot predate the current PB.' }));
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await createPbRecord({
        eventId,
        recordType: selectedOption.recordType,
        setSize: selectedOption.setSize,
        resultValue,
        happenedOn: dateInput,
        cubeName,
        comments,
      });
      setResultInput('');
      setCubeName('');
      setComments('');
      await refreshMine();
      setMessage(tr({ zh: '新 PB 已保存。', en: 'New PB saved.' }));
    } catch {
      setError(tr({
        zh: '保存失败。新纪录必须优于当前成绩，日期也不能早于上一条 PB。',
        en: 'Could not save. A new entry must beat the current result and cannot predate it.',
      }));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (record: PbRecord) => {
    if (!window.confirm(tr({ zh: '删除这条 PB 记录？', en: 'Delete this PB entry?' }))) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deletePbRecord(record.id);
      await refreshMine();
      setMessage(tr({ zh: '记录已删除。', en: 'Entry deleted.' }));
    } catch {
      setError(friendlyError());
    } finally {
      setSaving(false);
    }
  };

  const sharedData = sharedUserId ? publicData : myData;
  const sharedLoading = sharedUserId ? publicLoading : myLoading;
  const shareProfile = async () => {
    if (!sharedData) return;
    const prefix = lang === 'zh' ? '/zh' : '';
    const url = new URL(`${prefix}/pb`, window.location.origin);
    url.searchParams.set('user', String(sharedData.profile.userId));
    try {
      await navigator.clipboard.writeText(url.toString());
      setMessage(tr({ zh: '公开链接已复制。', en: 'Public link copied.' }));
    } catch {
      setError(tr({ zh: '复制失败，请从地址栏复制。', en: 'Copy failed. Copy the address bar URL instead.' }));
    }
  };

  const optionItems = PB_RECORD_OPTIONS.map((option) => ({
    value: optionKey(option),
    label: optionLabel(option.recordType, option.setSize),
    disabled: eventId === '333mbf' && optionKey(option) !== 'single:1',
  }));

  return (
    <main className="pb-page">
      <header className="pb-header">
        <div className="pb-header-row">
          <BackHome />
          <HeaderToggles />
        </div>
        <div className="pb-title-row">
          <div>
            <h1>{tr({ zh: '个人纪录', en: 'Personal Bests' })}</h1>
            <p>{tr({ zh: '记录每一次突破，生成公开成绩卡，并和其他魔友比较。', en: 'Track every breakthrough, publish a PB card, and compare with other cubers.' })}</p>
          </div>
          <a href="https://github.com/cubing/CubePB" target="_blank" rel="noreferrer" className="pb-source">
            {tr({ zh: '基于 CubePB', en: 'Based on CubePB' })}
          </a>
        </div>
        <nav className="pb-tabs" aria-label={tr({ zh: '个人纪录页面', en: 'Personal best views' })}>
          <button type="button" className={`pb-tab-button${view === 'card' ? ' is-active' : ''}`} onClick={() => void setView('card')}>
            <IdCard size={17} /> {tr({ zh: '成绩卡', en: 'PB card' })}
          </button>
          <button type="button" className={`pb-tab-button${view === 'leaderboard' ? ' is-active' : ''}`} onClick={() => void setView('leaderboard')}>
            <BarChart3 size={17} /> {tr({ zh: '排行榜', en: 'Leaderboard' })}
          </button>
          <button type="button" className={`pb-tab-button${view === 'manage' ? ' is-active' : ''}`} onClick={() => void setView('manage')}>
            <ListPlus size={17} /> {tr({ zh: '维护记录', en: 'Manage' })}
          </button>
        </nav>
      </header>

      <section className="pb-content">
        {message && <p className="pb-message" role="status">{message}</p>}
        {error && <p className="pb-error" role="alert">{error}</p>}

        {view === 'card' && (
          <div className="pb-card-view">
            {sharedLoading && <p className="pb-muted">{tr({ zh: '加载中…', en: 'Loading…' })}</p>}
            {!sharedLoading && !sharedData && !sharedUserId && (
              <div className="pb-intro">
                <h2>{tr({ zh: '把你的 PB 放在一张长期更新的公开卡片里', en: 'Keep your PBs on one living public card' })}</h2>
                <p>{tr({ zh: '登录后录入成绩即可生成分享链接。成绩保存在账号下，不依赖这台设备。', en: 'Sign in and add results to create a share link. Records stay with your account, not this device.' })}</p>
                <AppLink href={signInHref} prefetch={false} className="pb-primary-link">
                  {tr({ zh: '登录并开始记录', en: 'Sign in and start' })}
                </AppLink>
              </div>
            )}
            {!sharedLoading && sharedData && (
              <>
                <div className="pb-profile-head">
                  <div>
                    <span className="pb-eyebrow">{tr({ zh: '个人最佳', en: 'PERSONAL BESTS' })}</span>
                    <h2>{displayCuberName(sharedData.profile.name, isZh)}</h2>
                    {sharedData.profile.wcaId && <span className="pb-muted">{sharedData.profile.wcaId}</span>}
                  </div>
                  {sharedData.profile.isPublic && (
                    <button type="button" className="pb-secondary-button" onClick={() => void shareProfile()}>
                      <Share2 size={16} /> {tr({ zh: '复制公开链接', en: 'Copy public link' })}
                    </button>
                  )}
                </div>
                {!sharedData.profile.isPublic && (
                  <p className="pb-private-note">{tr({ zh: '你的成绩卡目前仅自己可见。', en: 'Your PB card is currently private.' })}</p>
                )}
                <PbResultRows records={sharedData.records} />
              </>
            )}
          </div>
        )}

        {view === 'leaderboard' && (
          <div className="pb-leaderboard-view">
            <div className="pb-filter-row">
              <PuzzlePicker
                isZh={isZh}
                selectedEvent={eventId}
                wcaEvents={PB_EVENT_SET}
                availableEvents={NO_NON_WCA_EVENTS}
                onSelect={onEventSelect}
              />
              <CompactSelect
                label={optionLabel(selectedOption.recordType, selectedOption.setSize)}
                items={optionItems}
                value={selectedOptionKey}
                onChange={onOptionSelect}
                ariaLabel={tr({ zh: '成绩类型', en: 'Result type' })}
              />
            </div>
            <div className="pb-leaderboard-head">
              <h2>{eventDisplayName(eventId, isZh)} {optionLabel(selectedOption.recordType, selectedOption.setSize)}</h2>
              <span className="pb-muted">{tr({ zh: '仅包含公开的当前 PB', en: 'Public current PBs only' })}</span>
            </div>
            {leaderboardLoading ? (
              <p className="pb-muted">{tr({ zh: '加载中…', en: 'Loading…' })}</p>
            ) : leaderboard.length === 0 ? (
              <p className="pb-empty">{tr({ zh: '这个项目还没有公开纪录。', en: 'No public records for this event yet.' })}</p>
            ) : (
              <ol className="pb-leaderboard-list">
                {leaderboard.map((row) => (
                  <li key={row.record.id}>
                    <span className="pb-rank">{row.rank}</span>
                    <AppLink href={`/pb?user=${row.profile.userId}`} prefetch={false}>
                      {displayCuberName(row.profile.name, isZh)}
                    </AppLink>
                    <strong>{formatRecord(row.record)}</strong>
                    <time dateTime={row.record.happenedOn}>{row.record.happenedOn}</time>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {view === 'manage' && !authUser && (
          <div className="pb-intro">
            <h2>{tr({ zh: '登录后维护你的纪录', en: 'Sign in to manage your records' })}</h2>
            <p>{tr({ zh: 'PB 与 CubeRoot 账号同步，可在其他设备继续更新。', en: 'PBs sync with your CubeRoot account so you can update them on any device.' })}</p>
            <AppLink href={signInHref} prefetch={false} className="pb-primary-link">
              {tr({ zh: '去登录', en: 'Sign in' })}
            </AppLink>
          </div>
        )}

        {view === 'manage' && authUser && (
          <div className="pb-manage-view">
            <section className="pb-visibility">
              <div>
                <h2>{tr({ zh: '公开成绩卡', en: 'Public PB card' })}</h2>
                <p>{tr({ zh: '关闭后，公开链接和排行榜都会隐藏你的成绩。', en: 'Turn this off to hide your card and results from public rankings.' })}</p>
              </div>
              <BoolToggle
                value={myData?.profile.isPublic ?? true}
                onChange={(value) => void onVisibilityChange(value)}
                label={tr({ zh: '允许公开', en: 'Public' })}
                disabled={!myData || saving}
              />
            </section>

            <section className="pb-editor">
              <h2>{tr({ zh: '添加新 PB', en: 'Add a new PB' })}</h2>
              <p className="pb-muted">{tr({ zh: '同一项目与类型请从旧到新录入；新纪录必须严格更好。', en: 'For each event and type, enter PBs oldest to newest; each new result must be strictly better.' })}</p>
              <form onSubmit={(event) => void onSubmit(event)}>
                <div className="pb-filter-row">
                  <PuzzlePicker
                    isZh={isZh}
                    selectedEvent={eventId}
                    wcaEvents={PB_EVENT_SET}
                    availableEvents={NO_NON_WCA_EVENTS}
                    onSelect={onEventSelect}
                  />
                  <CompactSelect
                    label={optionLabel(selectedOption.recordType, selectedOption.setSize)}
                    items={optionItems}
                    value={selectedOptionKey}
                    onChange={onOptionSelect}
                    ariaLabel={tr({ zh: '成绩类型', en: 'Result type' })}
                  />
                </div>
                <div className="pb-form-grid">
                  <label>
                    <span>{tr({ zh: '成绩', en: 'Result' })}</span>
                    <span className="pb-input-wrap">
                      <input
                        className="pb-form-control pb-clearable-control"
                        value={resultInput}
                        onChange={(event) => setResultInput(event.target.value)}
                        placeholder={inputHint(eventId, selectedOption.recordType)}
                        inputMode={eventId === '333mbf' ? 'text' : 'decimal'}
                        required
                      />
                      {resultInput && <ClearButton onClick={() => setResultInput('')} preserveFocus />}
                    </span>
                  </label>
                  <label>
                    <span>{tr({ zh: '日期', en: 'Date' })}</span>
                    <DateInput value={dateInput} max={today} onChange={setDateInput} required />
                  </label>
                  <label>
                    <span>{tr({ zh: '魔方或产品', en: 'Cube or product' })}</span>
                    <span className="pb-input-wrap">
                      <input className="pb-form-control pb-clearable-control" value={cubeName} onChange={(event) => setCubeName(event.target.value)} maxLength={120} />
                      {cubeName && <ClearButton onClick={() => setCubeName('')} preserveFocus />}
                    </span>
                  </label>
                  <label className="pb-comments-field">
                    <span>{tr({ zh: '备注', en: 'Comments' })}</span>
                    <span className="pb-input-wrap">
                      <textarea className="pb-form-control pb-form-textarea pb-clearable-control" value={comments} onChange={(event) => setComments(event.target.value)} maxLength={1000} rows={3} />
                      {comments && <ClearButton onClick={() => setComments('')} preserveFocus />}
                    </span>
                  </label>
                </div>
                <button type="submit" className="pb-primary-button" disabled={saving || myLoading}>
                  {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存 PB', en: 'Save PB' })}
                </button>
              </form>
            </section>

            <section className="pb-history">
              <h2>{tr({ zh: '纪录历史', en: 'PB history' })}</h2>
              {myLoading ? (
                <p className="pb-muted">{tr({ zh: '加载中…', en: 'Loading…' })}</p>
              ) : !myData || myData.records.length === 0 ? (
                <p className="pb-empty">{tr({ zh: '还没有纪录。', en: 'No entries yet.' })}</p>
              ) : (
                <ul>
                  {myData.records.map((record) => (
                    <li key={record.id}>
                      <span className="pb-history-event"><EventIcon event={record.eventId} /> {eventDisplayName(record.eventId, isZh)}</span>
                      <span>{optionLabel(record.recordType, record.setSize)}</span>
                      <strong>{formatRecord(record)}</strong>
                      <time dateTime={record.happenedOn}>{record.happenedOn}</time>
                      {record.isCurrent && <span className="pb-current">{tr({ zh: '当前', en: 'Current' })}</span>}
                      <button
                        type="button"
                        className="pb-delete-button"
                        onClick={() => void onDelete(record)}
                        disabled={saving}
                        aria-label={tr({ zh: '删除纪录', en: 'Delete entry' })}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
