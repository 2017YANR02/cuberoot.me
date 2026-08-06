'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from 'nuqs';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink,
  RefreshCw, Save, ShieldCheck,
} from 'lucide-react';
import Link from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import { SearchInput } from '@/components/SearchInput';
import WcaAuth from '@/components/WcaAuth';
import { useAuthUser, useIsAdmin } from '@/lib/auth-store';
import {
  getGroundTruthDetail,
  listGroundTruthCandidates,
  saveGroundTruthDecision,
  type CandidatePage,
  type GroundTruthCandidate,
  type GroundTruthDetail,
  type GroundTruthStatus,
  type SavedGroundTruthStatus,
} from '@/lib/recon-ground-truth-api';
import { tr } from '@/i18n/tr';
import './ground-truth.css';

const FILTERS = ['all', 'pending', 'discussion', 'confirmed', 'rejected'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_TEXT: Record<GroundTruthStatus, { zh: string; en: string }> = {
  pending: { zh: '未决定', en: 'Pending' },
  discussion: { zh: '待讨论', en: 'Discuss' },
  confirmed: { zh: '已纳入', en: 'Included' },
  rejected: { zh: '不采用', en: 'Rejected' },
};

const ISSUE_TEXT: Record<string, { zh: string; en: string }> = {
  missing_scramble: { zh: '缺少打乱', en: 'Missing scramble' },
  missing_solution: { zh: '缺少文字解法', en: 'Missing reconstruction text' },
  dnf_or_dns: { zh: '成绩是 DNF 或 DNS', en: 'Result is DNF or DNS' },
  fail_marker: { zh: '文字解法含 Fail', en: 'Reconstruction contains Fail' },
  source_not_solved: { zh: '打乱加文字解法不能完整复原', en: 'Scramble plus reconstruction does not solve' },
  short_scramble: { zh: '打乱异常短', en: 'Unusually short scramble' },
  missing_result: { zh: '成绩为空', en: 'Missing result' },
  missing_comp_or_date: { zh: '比赛或日期为空', en: 'Missing competition or date' },
  replay_malformed: { zh: 'Replay 内容无法解析', en: 'Replay cannot be decoded' },
  replay_event_not_333: { zh: 'Replay 不是标准三阶', en: 'Replay is not standard 3×3' },
  replay_scramble_missing: { zh: 'Replay 缺少打乱', en: 'Replay has no scramble' },
  replay_scramble_mismatch: { zh: 'Replay 打乱与复盘来源不一致', en: 'Replay scramble differs from the source' },
  replay_moves_invalid: { zh: 'Replay 转动或时间序列无效', en: 'Replay moves or timestamps are invalid' },
  replay_time_invalid: { zh: 'Replay 总时间无效', en: 'Replay total time is invalid' },
  replay_not_solved: { zh: 'Replay 没有完整复原魔方', en: 'Replay does not solve the cube completely' },
};

function statusText(status: GroundTruthStatus): string {
  const text = STATUS_TEXT[status];
  return tr({ zh: text.zh, en: text.en });
}

function issueText(code: string): string {
  const text = ISSUE_TEXT[code];
  return text ? tr({ zh: text.zh, en: text.en }) : code;
}

function CandidateRow({ item, selected, onSelect }: {
  item: GroundTruthCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`gt-candidate${selected ? ' is-selected' : ''}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="gt-candidate-main">
        <span className="gt-candidate-id">#{item.id}</span>
        <span className="gt-candidate-person">{item.person || tr({ zh: '未填写选手', en: 'No solver' })}</span>
      </span>
      <span className="gt-candidate-sub">
        <span>{item.value || tr({ zh: '无成绩', en: 'No result' })}</span>
        <span>{item.official}</span>
        <span className={`gt-status gt-status-${item.status}`}>{statusText(item.status)}</span>
        {item.sourceChanged ? <span className="gt-source-changed">{tr({ zh: '来源已变', en: 'Source changed' })}</span> : null}
      </span>
    </button>
  );
}

export default function ReconGroundTruthPage() {
  const user = useAuthUser();
  const isAdmin = useIsAdmin();
  const [q, setQ] = useQueryState('q', parseAsString.withDefault('').withOptions({ history: 'replace' }));
  const [filter, setFilter] = useQueryState(
    'status',
    parseAsStringEnum<Filter>([...FILTERS]).withDefault('all').withOptions({ history: 'replace' }),
  );
  const [page, setPage] = useQueryState(
    'page', parseAsInteger.withDefault(1).withOptions({ history: 'replace' }),
  );

  const [data, setData] = useState<CandidatePage | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<GroundTruthDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [decisionStatus, setDecisionStatus] = useState<SavedGroundTruthStatus>('discussion');
  const [replay, setReplay] = useState('');
  const [note, setNote] = useState('');
  const [currentWrong, setCurrentWrong] = useState('');
  const [acknowledgeWarnings, setAcknowledgeWarnings] = useState(false);

  const loadCandidates = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const next = await listGroundTruthCandidates({ q, status: filter, page, limit: 40 });
      setData(next);
      setSelectedId((current) => {
        if (current && next.items.some((item) => item.id === current)) return current;
        return next.items[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter, isAdmin, page, q]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadCandidates(); }, 180);
    return () => clearTimeout(timer);
  }, [loadCandidates]);

  useEffect(() => {
    if (!isAdmin || selectedId == null) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setSaveError(null);
    getGroundTruthDetail(selectedId).then((next) => {
      if (!active) return;
      setDetail(next);
      setDecisionStatus(next.decision?.status ?? 'discussion');
      setReplay(next.decision?.replay ?? '');
      setNote(next.decision?.note ?? '');
      setCurrentWrong(next.decision?.currentWrong ?? '');
      setAcknowledgeWarnings(false);
    }).catch((e) => {
      if (active) setSaveError(e instanceof Error ? e.message : String(e));
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [isAdmin, selectedId]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const selected = useMemo(
    () => data?.items.find((item) => item.id === selectedId) ?? null,
    [data, selectedId],
  );

  const save = async () => {
    if (!detail) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveGroundTruthDecision(detail.source.id, {
        status: decisionStatus,
        replay,
        note,
        currentWrong,
        acknowledgeWarnings,
      });
      setDetail((prev) => prev ? { ...prev, ...saved } : prev);
      await loadCandidates();
    } catch (e) {
      setSaveError(issueText(e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (!user || !isAdmin) {
    return (
      <main className="gt-page">
        <header className="gt-header">
          <div className="gt-kicker">Recon Ground Truth</div>
          <h1>{tr({ zh: '复盘测试样本', en: 'Reconstruction test corpus' })}</h1>
        </header>
        <div className="gt-access">
          <ShieldCheck size={20} />
          <span>{tr({ zh: '此页面只对管理员开放。', en: 'This page is restricted to administrators.' })}</span>
          <WcaAuth />
        </div>
      </main>
    );
  }

  return (
    <main className="gt-page">
      <header className="gt-header">
        <div className="gt-kicker">Recon Ground Truth</div>
        <div className="gt-title-row">
          <div>
            <h1>{tr({ zh: '复盘测试样本', en: 'Reconstruction test corpus' })}</h1>
            <p>{tr({
              zh: '候选范围固定为标准三阶，且发布者为颜瑞民。候选不会自动进入测试，必须逐条确认。',
              en: 'Candidates are standard 3×3 reconstructions published by Ruimin Yan. Nothing enters the tests without a manual decision.',
            })}</p>
          </div>
          <button type="button" className="gt-refresh" onClick={() => void loadCandidates()} disabled={loading}>
            <RefreshCw size={15} /> {tr({ zh: '刷新', en: 'Refresh' })}
          </button>
        </div>
        <div className="gt-scope" aria-label={tr({ zh: '候选范围', en: 'Candidate scope' })}>
          <span>event = 3x3</span>
          <span>added_by_id = 2017YANR02</span>
          <span>{data?.total ?? '—'} {tr({ zh: '条', en: 'rows' })}</span>
        </div>
      </header>

      <div className="gt-filters">
        <SearchInput
          value={q}
          onChange={(value) => { void setQ(value); void setPage(1); }}
          placeholder={tr({ zh: '按 ID、选手或比赛搜索', en: 'Search ID, solver or competition' })}
          className="gt-search"
          inputClassName="gt-search-input"
        />
        <label className="gt-filter-label">
          <span>{tr({ zh: '决定', en: 'Decision' })}</span>
          <select className="gt-filter-select" value={filter} onChange={(e) => { void setFilter(e.target.value as Filter); void setPage(1); }}>
            {FILTERS.map((value) => (
              <option value={value} key={value}>
                {value === 'all' ? tr({ zh: '全部', en: 'All' }) : statusText(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="gt-error"><AlertTriangle size={16} /> {error}</div> : null}

      <div className="gt-workbench">
        <section className="gt-candidates" aria-label={tr({ zh: '候选列表', en: 'Candidate list' })}>
          <div className="gt-section-head">
            <span>{tr({ zh: '候选', en: 'Candidates' })}</span>
            {loading ? <span>{tr({ zh: '加载中…', en: 'Loading…' })}</span> : null}
          </div>
          <div className="gt-candidate-list">
            {data?.items.map((item) => (
              <CandidateRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
            {!loading && data?.items.length === 0 ? (
              <div className="gt-empty">{tr({ zh: '没有匹配的候选', en: 'No matching candidates' })}</div>
            ) : null}
          </div>
          <div className="gt-pages">
            <button className="gt-page-button" type="button" disabled={page <= 1} onClick={() => void setPage(page - 1)} aria-label={tr({ zh: '上一页', en: 'Previous page' })}>
              <ChevronLeft size={16} />
            </button>
            <span>{page} / {totalPages}</span>
            <button className="gt-page-button" type="button" disabled={page >= totalPages} onClick={() => void setPage(page + 1)} aria-label={tr({ zh: '下一页', en: 'Next page' })}>
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        <section className="gt-detail" aria-label={tr({ zh: '候选详情', en: 'Candidate details' })}>
          {detailLoading ? <div className="gt-empty">{tr({ zh: '正在检查完整复原…', en: 'Checking full solve…' })}</div> : null}
          {!detailLoading && !detail ? <div className="gt-empty">{tr({ zh: '选择一条候选', en: 'Select a candidate' })}</div> : null}
          {!detailLoading && detail ? (
            <>
              <div className="gt-detail-head">
                <div>
                  <span className="gt-detail-id">#{detail.source.id}</span>
                  <h2>{detail.source.person || tr({ zh: '未填写选手', en: 'No solver' })}</h2>
                  <p>{[detail.source.value, detail.source.comp, detail.source.date].filter(Boolean).join(' / ')}</p>
                </div>
                <Link href={`/recon/${detail.source.id}`} className="gt-source-link" prefetch={false}>
                  {tr({ zh: '打开复盘', en: 'Open recon' })} <ExternalLink size={14} />
                </Link>
              </div>

              {detail.sourceChanged ? (
                <div className="gt-warning"><AlertTriangle size={16} /> {tr({
                  zh: '公开复盘在上次决定后发生了变化，请重新核对并保存。',
                  en: 'The public reconstruction changed after the last decision. Review and save it again.',
                })}</div>
              ) : null}

              <div className={`gt-eligibility${detail.assessment.eligible ? ' is-ok' : ' is-blocked'}`}>
                {detail.assessment.eligible ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                <div>
                  <strong>{detail.assessment.eligible
                    ? tr({ zh: '文字解法可完整复原', en: 'Source reconstruction solves completely' })
                    : tr({ zh: '不能确认纳入', en: 'Cannot be included' })}</strong>
                  {detail.assessment.blockers.length > 0 ? (
                    <span>{detail.assessment.blockers.map(issueText).join('；')}</span>
                  ) : null}
                </div>
              </div>

              {detail.assessment.warnings.length > 0 ? (
                <div className="gt-issues">
                  <span>{tr({ zh: '需要人工留意：', en: 'Manual review: ' })}</span>
                  {detail.assessment.warnings.map((code) => <span key={code}>{issueText(code)}</span>)}
                </div>
              ) : null}

              <div className="gt-text-compare">
                <div>
                  <h3>{tr({ zh: '数据库原文', en: 'Database source' })}</h3>
                  <pre>{detail.source.scramble}{'\n'}{detail.source.solution}</pre>
                </div>
                <div>
                  <h3>
                    {tr({ zh: '最终测试文本', en: 'Final test text' })}
                    {detail.assessment.crossNormalized ? <span>{tr({ zh: '已 Normalize cross', en: 'Cross normalized' })}</span> : null}
                  </h3>
                  <pre>{detail.assessment.truth}</pre>
                </div>
              </div>

              <div className="gt-editor">
                <label>
                  <span>{tr({ zh: '决定', en: 'Decision' })}</span>
                  <select className="gt-decision-select" value={decisionStatus} onChange={(e) => setDecisionStatus(e.target.value as SavedGroundTruthStatus)}>
                    <option value="discussion">{statusText('discussion')}</option>
                    <option value="confirmed" disabled={!detail.assessment.eligible}>{statusText('confirmed')}</option>
                    <option value="rejected">{statusText('rejected')}</option>
                  </select>
                </label>
                <label>
                  <span>{tr({ zh: 'Timer replay 链接', en: 'Timer replay URL' })}</span>
                  <textarea
                    className="gt-editor-textarea"
                    value={replay}
                    onChange={(e) => setReplay(e.target.value)}
                    rows={3}
                    spellCheck={false}
                    placeholder="https://cuberoot.me/zh/timer?replay=…"
                  />
                </label>
                <label>
                  <span>{decisionStatus === 'confirmed'
                    ? tr({ zh: '备注（可选）', en: 'Note (optional)' })
                    : tr({ zh: '讨论或不采用的原因', en: 'Reason for discussion or rejection' })}</span>
                  <textarea className="gt-editor-textarea" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                </label>
                <details>
                  <summary>{tr({ zh: '保存当前错误输出（可选）', en: 'Store current wrong output (optional)' })}</summary>
                  <textarea className="gt-editor-textarea" value={currentWrong} onChange={(e) => setCurrentWrong(e.target.value)} rows={6} spellCheck={false} />
                </details>
                {decisionStatus === 'confirmed' && detail.assessment.warnings.length > 0 ? (
                  <BoolToggle
                    value={acknowledgeWarnings}
                    onChange={setAcknowledgeWarnings}
                    label={tr({ zh: '我已检查这些警告，仍确认纳入', en: 'I reviewed the warnings and still want to include it' })}
                  />
                ) : null}
                {saveError ? <div className="gt-error"><AlertTriangle size={16} /> {saveError}</div> : null}
                <button
                  type="button"
                  className="gt-save"
                  onClick={() => void save()}
                  disabled={saving || (decisionStatus !== 'confirmed' && !note.trim())}
                >
                  <Save size={16} /> {saving ? tr({ zh: '保存中…', en: 'Saving…' }) : tr({ zh: '保存决定', en: 'Save decision' })}
                </button>
              </div>
            </>
          ) : null}
        </section>
      </div>
      {selected ? <span className="gt-selected-announcer" aria-live="polite">#{selected.id} {statusText(selected.status)}</span> : null}
    </main>
  );
}
