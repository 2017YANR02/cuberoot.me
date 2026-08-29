'use client';

import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import {
  PB_EVENT_IDS,
  PB_RECORD_OPTIONS,
  parsePbResultInput,
  pbRecordOptionLabel,
  type PbRecordOption,
  type PbRecordType,
} from '@cuberoot/shared/pb';
import BoolToggle from '@/components/BoolToggle';
import { ClearButton } from '@/components/ClearButton';
import { CompactSelect } from '@/components/CompactSelect';
import { DateInput } from '@/components/DateInput';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { useT } from '@/hooks/useT';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { toLocalIsoDate } from '@/lib/iso-date';
import {
  createPbRecord,
  deletePbRecord,
  fetchManagedPbs,
  fetchMyPbs,
  fetchPbPerson,
  updatePbRecord,
  updatePbVisibility,
  type CreatePbRecordInput,
  type PbCollection,
  type PbRecord,
} from '@/lib/pb-api';
import { eventDisplayName } from '@/lib/wca-events';
import { formatWcaResult } from '@/lib/wca-format-result';

interface Props {
  wcaId: string;
  isZh: boolean;
}

type OptionKey = `${PbRecordType}:${number}`;
type EntryMode = 'new' | 'edit';

function optionKey(option: PbRecordOption): OptionKey {
  return `${option.recordType}:${option.setSize}`;
}

function optionFromKey(key: OptionKey): PbRecordOption {
  return PB_RECORD_OPTIONS.find((option) => optionKey(option) === key) ?? PB_RECORD_OPTIONS[0];
}

function formatRecord(record: PbRecord): string {
  return formatWcaResult(
    record.resultValue,
    record.eventId,
    record.recordType === 'single' ? 'single' : 'average',
  );
}

function PbCellContent({ record }: { record?: PbRecord }) {
  if (!record) return <strong className="wp-pb-cell-result">—</strong>;

  return (
    <>
      <strong className="wp-pb-cell-result">{formatRecord(record)}</strong>
      <time className="wp-pb-cell-date" dateTime={record.happenedOn}>{record.happenedOn}</time>
      {record.cubeName && <span className="wp-pb-cell-cube" title={record.cubeName}>{record.cubeName}</span>}
    </>
  );
}

export default function PersonPbTable({ wcaId, isZh }: Props) {
  const t = useT();
  const authUser = useAuthUser();
  const isAdmin = useIsAdmin();
  const viewerWcaId = authUser?.wcaId?.toUpperCase() ?? '';
  const isOwner = Boolean(viewerWcaId && viewerWcaId === wcaId.toUpperCase());
  const canManage = isOwner || isAdmin;
  const today = toLocalIsoDate();

  const [collection, setCollection] = useState<PbCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [eventId, setEventId] = useState<string>('333');
  const [selectedOptionKey, setSelectedOptionKey] = useState<OptionKey>('single:1');
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<PbRecord | null>(null);
  const [resultInput, setResultInput] = useState('');
  const [dateInput, setDateInput] = useState(today);
  const [cubeName, setCubeName] = useState('');
  const [comments, setComments] = useState('');
  const selectedOption = optionFromKey(selectedOptionKey);

  const optionLabel = (recordType: PbRecordType, setSize: number) => (
    pbRecordOptionLabel(recordType, setSize, t('单次', 'Single'))
  );

  const friendlyError = () => t(
    '操作失败，请检查输入或稍后重试。',
    'The action failed. Check the input or try again.',
  );

  const clearEditor = () => {
    setActiveCellKey(null);
    setEditingRecord(null);
    setResultInput('');
    setDateInput(today);
    setCubeName('');
    setComments('');
  };

  const loadCollection = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = isOwner
        ? await fetchMyPbs(signal)
        : isAdmin
          ? await fetchManagedPbs(wcaId, signal)
          : await fetchPbPerson(wcaId, signal);
      setCollection(canManage || data.profile.isPublic ? data : null);
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        setCollection(null);
        if (canManage) setError(friendlyError());
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setCollection(null);
    setMessage('');
    setError('');
    void loadCollection(controller.signal);
    return () => controller.abort();
    // Reload when the viewed person or signed-in WCA identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage, isAdmin, isOwner, wcaId]);

  const recordsByEvent = useMemo(() => {
    const grouped = new Map<string, Map<string, PbRecord>>();
    for (const record of collection?.records ?? []) {
      if (!record.isCurrent) continue;
      const eventRecords = grouped.get(record.eventId) ?? new Map<string, PbRecord>();
      eventRecords.set(`${record.recordType}:${record.setSize}`, record);
      grouped.set(record.eventId, eventRecords);
    }
    return grouped;
  }, [collection]);
  const currentCellRecord = recordsByEvent.get(eventId)?.get(selectedOptionKey);
  const entryModeItems: Array<{ value: EntryMode; label: string; disabled?: boolean }> = [
    { value: 'new', label: t('新增', 'Add') },
    { value: 'edit', label: t('改当前', 'Edit current'), disabled: !currentCellRecord },
  ];

  const history = useMemo(() => (
    [...(collection?.records ?? [])].sort((a, b) => (
      b.happenedOn.localeCompare(a.happenedOn) || b.id - a.id
    ))
  ), [collection]);

  const onVisibilityChange = async (isPublic: boolean) => {
    if (!collection || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updatePbVisibility(isPublic, wcaId);
      setCollection({ ...collection, profile: { ...collection.profile, isPublic } });
      setMessage(t('公开设置已保存。', 'Visibility saved.'));
    } catch {
      setError(friendlyError());
    } finally {
      setSaving(false);
    }
  };

  const beginNewPb = (nextEventId: string, option: PbRecordOption, record?: PbRecord) => {
    if (saving) return;
    const nextOptionKey = optionKey(option);
    setEventId(nextEventId);
    setSelectedOptionKey(nextOptionKey);
    setActiveCellKey(`${nextEventId}:${nextOptionKey}`);
    setEditingRecord(null);
    setResultInput('');
    setDateInput(today);
    setCubeName(record?.cubeName ?? '');
    setComments('');
    setMessage('');
    setError('');
  };

  const beginCurrentCorrection = (record: PbRecord) => {
    setEditingRecord(record);
    setResultInput(formatRecord(record));
    setDateInput(record.happenedOn);
    setCubeName(record.cubeName);
    setComments(record.comments);
    setMessage('');
    setError('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const resultValue = parsePbResultInput(resultInput, eventId, selectedOption.recordType);
    if (resultValue == null) {
      setError(t('成绩格式无效。请按输入框示例填写。', 'Invalid result format. Follow the input example.'));
      return;
    }
    if (!dateInput) {
      setError(t('请选择纪录日期。', 'Choose the PB date.'));
      return;
    }

    const sameKind = (collection?.records ?? []).filter((record) => (
      record.eventId === eventId
      && record.recordType === selectedOption.recordType
      && record.setSize === selectedOption.setSize
      && record.id !== editingRecord?.id
    ));
    const comparisonRecords = editingRecord
      ? sameKind
      : sameKind.filter((record) => record.isCurrent);
    if (comparisonRecords.some((record) => resultValue > record.resultValue)) {
      setError(editingRecord
        ? t('修改后的成绩不能差于此前 PB。', 'The edited result cannot be worse than an earlier PB.')
        : t('新成绩不能差于当前 PB。', 'The new result cannot be worse than the current PB.'));
      return;
    }
    if (comparisonRecords.some((record) => dateInput < record.happenedOn)) {
      setError(editingRecord
        ? t('修改后的日期不能早于此前 PB。', 'The edited date cannot predate an earlier PB.')
        : t('新纪录的日期不能早于当前 PB。', 'The new entry cannot predate the current PB.'));
      return;
    }

    const input: CreatePbRecordInput = {
      eventId,
      recordType: selectedOption.recordType,
      setSize: selectedOption.setSize,
      resultValue,
      happenedOn: dateInput,
      cubeName,
      comments,
    };
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingRecord) {
        await updatePbRecord(editingRecord.id, input, wcaId);
      } else {
        await createPbRecord(input, wcaId);
      }
      const savedEditing = Boolean(editingRecord);
      clearEditor();
      await loadCollection();
      setMessage(savedEditing ? t('PB 已更新。', 'PB updated.') : t('新 PB 已保存。', 'New PB saved.'));
    } catch {
      setError(t(
        '保存失败。成绩不能差于此前纪录，日期也不能早于上一条 PB。',
        'Could not save. The result cannot be worse than earlier records or predate the previous PB.',
      ));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (record: PbRecord) => {
    if (!window.confirm(t('删除这条 PB 记录？', 'Delete this PB entry?'))) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await deletePbRecord(record.id, wcaId);
      if (editingRecord?.id === record.id) clearEditor();
      await loadCollection();
      setMessage(t('记录已删除。', 'Entry deleted.'));
    } catch {
      setError(friendlyError());
    } finally {
      setSaving(false);
    }
  };

  const title = t('个人 PB', 'Personal Bests');

  return (
    <section className="wp-card wp-pr-card wp-pb-card" aria-label={title}>
      {message && <p className="wp-pb-message" role="status">{message}</p>}
      {error && <p className="wp-pb-error" role="alert">{error}</p>}
      {loading && <p className="wp-pb-muted">{t('加载中…', 'Loading…')}</p>}
      {!loading && !collection && !canManage && (
        <p className="wp-pb-muted">{t('暂时没有公开 PB。', 'No public PBs yet.')}</p>
      )}

      <div className="wp-table-scroll">
        <table className="wp-pr-table wp-pb-table">
          <thead>
            <tr>
              <th className="wp-th-event" scope="col">{t('项目', 'Event')}</th>
              {PB_RECORD_OPTIONS.map((option) => (
                <th key={optionKey(option)} scope="col">
                  {optionLabel(option.recordType, option.setSize)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PB_EVENT_IDS.map((currentEventId) => {
              const eventRecords = recordsByEvent.get(currentEventId);
              const isEditingEvent = activeCellKey?.startsWith(`${currentEventId}:`) ?? false;
              return (
                <Fragment key={currentEventId}>
                  <tr>
                    <th className="wp-cell-event" scope="row">
                      <span className="wp-event-inner">
                        <EventIcon event={currentEventId} />
                        <span>{eventDisplayName(currentEventId, isZh)}</span>
                      </span>
                    </th>
                    {PB_RECORD_OPTIONS.map((option) => {
                      const key = optionKey(option);
                      const record = eventRecords?.get(key);
                      const isApplicable = currentEventId !== '333mbf' || key === 'single:1';
                      const isActive = activeCellKey === `${currentEventId}:${key}`;
                      return (
                        <td className="wp-cell-result" key={key}>
                          {canManage && collection && isApplicable ? (
                            <button
                              type="button"
                              className={`wp-pb-cell-button${isActive ? ' is-active' : ''}`}
                              onClick={() => beginNewPb(currentEventId, option, record)}
                              disabled={saving}
                              aria-label={t('添加这项的新 PB', 'Add a new PB for this result type')}
                            >
                              <PbCellContent record={record} />
                            </button>
                          ) : (
                            <span className="wp-pb-cell-display">
                              <PbCellContent record={record} />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {canManage && collection && isEditingEvent && (
                    <tr className="wp-pb-inline-edit-row">
                      <td colSpan={PB_RECORD_OPTIONS.length + 1}>
                        <form className="wp-pb-inline-form" onSubmit={(formEvent) => void onSubmit(formEvent)}>
                          <div className="wp-pb-inline-main-row">
                            <div className="wp-pb-inline-heading">
                              <strong>
                                {eventDisplayName(eventId, isZh)} {optionLabel(selectedOption.recordType, selectedOption.setSize)}
                              </strong>
                              <CompactSelect
                                label={editingRecord ? t('改当前', 'Edit current') : t('新增', 'Add')}
                                items={entryModeItems}
                                value={editingRecord ? 'edit' : 'new'}
                                onChange={(mode) => {
                                  if (mode === 'edit' && currentCellRecord) {
                                    beginCurrentCorrection(currentCellRecord);
                                  } else {
                                    beginNewPb(eventId, selectedOption, currentCellRecord);
                                  }
                                }}
                                ariaLabel={t('录入方式', 'Entry mode')}
                              />
                            </div>
                            <div className="wp-pb-form-grid">
                            <label>
                              <span>{t('成绩', 'Result')}</span>
                              <span className="wp-pb-input-wrap">
                                <input
                                  className="wp-pb-form-control wp-pb-clearable-control"
                                  value={resultInput}
                                  onChange={(inputEvent) => setResultInput(inputEvent.target.value)}
                                  inputMode={eventId === '333mbf' ? 'text' : 'decimal'}
                                  required
                                  autoFocus
                                />
                                {resultInput && <ClearButton onClick={() => setResultInput('')} preserveFocus />}
                              </span>
                            </label>
                            <label>
                              <span>{t('日期', 'Date')}</span>
                              <DateInput value={dateInput} max={today} onChange={setDateInput} required />
                            </label>
                            <label>
                              <span>{t('魔方', 'Cube')}</span>
                              <span className="wp-pb-input-wrap">
                                <input
                                  className="wp-pb-form-control wp-pb-clearable-control"
                                  value={cubeName}
                                  onChange={(inputEvent) => setCubeName(inputEvent.target.value)}
                                  maxLength={120}
                                />
                                {cubeName && <ClearButton onClick={() => setCubeName('')} preserveFocus />}
                              </span>
                            </label>
                            </div>
                          </div>
                          <label className="wp-pb-comments-field">
                            <span>{t('备注', 'Comments')}</span>
                            <span className="wp-pb-input-wrap">
                              <textarea
                                className="wp-pb-form-control wp-pb-form-textarea wp-pb-clearable-control"
                                value={comments}
                                onChange={(inputEvent) => setComments(inputEvent.target.value)}
                                maxLength={1000}
                                rows={3}
                              />
                              {comments && <ClearButton onClick={() => setComments('')} preserveFocus />}
                            </span>
                          </label>
                          <div className="wp-pb-form-actions">
                            <button type="submit" className="wp-pb-primary-button" disabled={saving || loading}>
                              {saving
                                ? t('保存中…', 'Saving…')
                                : editingRecord
                                  ? t('保存修改', 'Save changes')
                                  : t('保存', 'Save')}
                            </button>
                            <button
                              type="button"
                              className="wp-pb-secondary-button"
                              onClick={clearEditor}
                              disabled={saving}
                            >
                              {t('取消', 'Cancel')}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {canManage && collection && (
        <div className="wp-pb-manage">
          <section className="wp-pb-visibility">
            <BoolToggle
              value={collection.profile.isPublic}
              onChange={(value) => void onVisibilityChange(value)}
              label={t('公开', 'Public')}
              disabled={saving}
            />
          </section>

          <section className="wp-pb-history">
            <h3>{t('纪录历史', 'PB history')}</h3>
            {history.length === 0 ? (
              <p className="wp-pb-muted">{t('还没有纪录。', 'No entries yet.')}</p>
            ) : (
              <ul>
                {history.map((record) => (
                  <li key={record.id}>
                    <span className="wp-pb-history-event">
                      <EventIcon event={record.eventId} />
                      <span>{eventDisplayName(record.eventId, isZh)}</span>
                    </span>
                    <span className="wp-pb-history-kind">{optionLabel(record.recordType, record.setSize)}</span>
                    <strong className="wp-pb-history-result">{formatRecord(record)}</strong>
                    <time className="wp-pb-history-date" dateTime={record.happenedOn}>{record.happenedOn}</time>
                    {record.isCurrent && <span className="wp-pb-current">{t('当前', 'Current')}</span>}
                    <span className="wp-pb-history-actions">
                      <button
                        type="button"
                        className="wp-pb-icon-button is-delete"
                        onClick={() => void onDelete(record)}
                        disabled={saving}
                        aria-label={t('删除纪录', 'Delete entry')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
