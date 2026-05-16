/**
 * /scramble/gen — "Import" mode: load real scrambles from a WCA competition
 * via /v1/recon/wca-scrambles (cached proxy to wca.org/api/v0/competitions/
 * <id>/scrambles). User pastes the comp URL or compId, we render the same
 * SheetView used by TNoodle mode.
 *
 * No login required — WCA publishes scrambles for posted competitions on the
 * public API; the proxy handles upstream availability + 30-day cache.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, Trash2, CloudDownload } from 'lucide-react';
import WcaEventSelector from '../../components/WcaEventSelector';
import { CompPicker } from '../../components/CompPicker';
import { CompCell } from '../../components/CompCell/CompCell';
import type { Comp } from '../../utils/comp_search';
import { loadFlagData, flagDataVersion } from '../../utils/country_flags';
import { localizeCompName } from '../../utils/comp_localize';
import { type WcaScrambleRow } from '../../utils/wca_results_api';
import { fetchCompName } from '../../utils/comp_wcif';
import { apiUrl } from '../../utils/api_base';
import { ALLOWED_FORMATS, type WcaFormat } from './wca_round';
import SheetView, { type AttemptScramble, type RoundSheet } from './SheetView';
import ProgressButton from './ProgressButton';
import type { RoundSheetInput } from './tnoodle_pdf';

const GENERATOR_TAG = 'TNoodle-WCA-1.2.3-port';

interface Props {
  t: (zh: string, en: string) => string;
  isZh: boolean;
}

const ROUND_INDEX: Record<string, number> = {
  '1': 0, 'b': 0, 'd': 0,
  '2': 1, 'c': 1, 'e': 1,
  '3': 2, 'g': 2,
  'f': 3, 'h': 3,
};

function roundIdxOf(roundTypeId: string): number {
  return ROUND_INDEX[roundTypeId] ?? 0;
}

function groupIdxOf(groupId: string): number {
  if (!groupId) return 0;
  const c = groupId.toUpperCase().charCodeAt(0);
  if (c >= 65 && c <= 90) return c - 65;
  return 0;
}

function inferFormat(event: string, nonExtraCount: number): WcaFormat {
  const allowed = ALLOWED_FORMATS[event] ?? ['1'];
  // 优先在 allowed 里找 attempts 数匹配的;否则回退到 event 默认。
  const COUNT: Record<WcaFormat, number> = { 'a': 5, 'm': 3, '5': 5, '3': 3, '2': 2, '1': 1 };
  const hit = allowed.find((f) => COUNT[f] === nonExtraCount);
  return hit ?? allowed[0];
}

/** OddDayinHongKong2026 / 完整 URL / 带 query / 带 #anchor 都能识别。 */
function parseCompId(input: string): string {
  const s = input.trim();
  if (!s) return '';
  const m = s.match(/competitions\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return s.replace(/[^A-Za-z0-9_-]/g, '');
}

/** 流式读取响应体,边收边报告字节进度。proxy 失败则 fallback 到 WCA 直拉。 */
async function streamFetchScrambles(
  compId: string,
  onProgress: (received: number, total: number) => void,
): Promise<WcaScrambleRow[] | null> {
  const candidates = [
    apiUrl(`/v1/recon/wca-scrambles?compId=${encodeURIComponent(compId)}`),
    `https://www.worldcubeassociation.org/api/v0/competitions/${encodeURIComponent(compId)}/scrambles`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok || !res.body) continue;
      const total = Number(res.headers.get('Content-Length') ?? 0);
      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let text = '';
      let received = 0;
      onProgress(0, total);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        received += value.length;
        onProgress(received, total);
      }
      text += decoder.decode();
      const json = JSON.parse(text);
      return Array.isArray(json) ? (json as WcaScrambleRow[]) : null;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function buildSheets(rows: WcaScrambleRow[]): RoundSheet[] {
  // 按 (event, roundIdx, groupId) 聚合
  type Key = string;
  const groups = new Map<Key, WcaScrambleRow[]>();
  for (const r of rows) {
    const k = `${r.event_id}|${roundIdxOf(r.round_type_id)}|${r.group_id}`;
    let arr = groups.get(k);
    if (!arr) { arr = []; groups.set(k, arr); }
    arr.push(r);
  }
  // 每个 event+round 的 totalGroups
  const groupCountByER = new Map<string, number>();
  for (const k of groups.keys()) {
    const [ev, ri] = k.split('|');
    const erKey = `${ev}|${ri}`;
    groupCountByER.set(erKey, (groupCountByER.get(erKey) ?? 0) + 1);
  }
  const sheets: RoundSheet[] = [];
  for (const [k, arr] of groups) {
    const [event, riStr, groupId] = k.split('|');
    const roundIdx = Number(riStr);
    const main = arr.filter((r) => !r.is_extra).sort((a, b) => a.scramble_num - b.scramble_num);
    const extras = arr.filter((r) => r.is_extra).sort((a, b) => a.scramble_num - b.scramble_num);
    const attempts: AttemptScramble[] = [
      ...main.map((r, i) => ({ label: String(i + 1), scramble: r.scramble, isExtra: false })),
      ...extras.map((r, i) => ({ label: `E${i + 1}`, scramble: r.scramble, isExtra: true })),
    ];
    sheets.push({
      event,
      roundIdx,
      groupIdx: groupIdxOf(groupId),
      format: inferFormat(event, main.length || 1),
      attempts,
      totalGroups: groupCountByER.get(`${event}|${roundIdx}`) ?? 1,
    });
  }
  // 排序:event 在 WCA 标准顺序在 SheetView 上方的 WcaEventSelector 自带,sheet 自身按 roundIdx → groupIdx
  sheets.sort((a, b) => {
    if (a.event !== b.event) return a.event.localeCompare(b.event);
    if (a.roundIdx !== b.roundIdx) return a.roundIdx - b.roundIdx;
    return a.groupIdx - b.groupIdx;
  });
  return sheets;
}

export default function ImportMode({ t, isZh }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlComp = searchParams.get('comp') ?? '';
  const [input, setInput] = useState('');
  const [loadedCompId, setLoadedCompId] = useState<string | null>(null);
  const [loadedCompName, setLoadedCompName] = useState<string | null>(null);
  const [sheets, setSheets] = useState<RoundSheet[] | null>(null);
  const [viewedEvent, setViewedEvent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfBuilding, setPdfBuilding] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const autoLoadedRef = useRef<string | null>(null);
  const [viewedRoundIdx, setViewedRoundIdx] = useState<number | null>(null);
  // comp_names_zh.json 加载完后 bump 一次让标题切到中文
  const [flagVer, setFlagVer] = useState(flagDataVersion());
  useEffect(() => {
    loadFlagData().then((v) => { if (v !== flagVer) setFlagVer(v); });
  }, [flagVer]);

  const eventsInSheets = useMemo(
    () => Array.from(new Set((sheets ?? []).map((s) => s.event))),
    [sheets],
  );
  const activeView = viewedEvent && eventsInSheets.includes(viewedEvent)
    ? viewedEvent
    : eventsInSheets[0];

  const load = async (idOverride?: string, nameOverride?: string) => {
    const compId = idOverride ?? parseCompId(input);
    if (!compId) {
      setError(t('请输入比赛 ID 或 URL', 'Enter a competition ID or URL'));
      return;
    }
    setLoading(true);
    setLoadProgress({ done: 0, total: 0 });
    setError(null);
    try {
      const [data, name] = await Promise.all([
        streamFetchScrambles(compId, (done, total) => setLoadProgress({ done, total })),
        nameOverride ? Promise.resolve(nameOverride) : fetchCompName(compId),
      ]);
      if (!data || data.length === 0) {
        setError(t('未找到该比赛或暂无已公布的打乱', 'Competition not found or no published scrambles'));
        return;
      }
      const built = buildSheets(data);
      setSheets(built);
      setViewedEvent(built[0]?.event ?? null);
      setViewedRoundIdx(null);
      setLoadedCompId(compId);
      setLoadedCompName(name);
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        p.set('comp', compId);
        return p;
      }, { replace: true });
    } catch (err) {
      setError(t('网络错误', 'Network error') + ': ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
      setLoadProgress(null);
    }
  };

  const onPickComp = (c: Comp) => {
    // 输入框临时回显(picker 点选→进 loading)用本地化名;loadedCompName 内部存 raw
    // 英文名,让 display 层(localizeCompName)按 isZh 实时切换。
    setInput(localizeCompName(c.id, c.name, isZh));
    load(c.id, c.name);
  };

  const reset = () => {
    setSheets(null);
    setLoadedCompId(null);
    setLoadedCompName(null);
    setViewedEvent(null);
    setViewedRoundIdx(null);
    setError(null);
    setInput('');
    autoLoadedRef.current = null;
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete('comp');
      return p;
    }, { replace: true });
  };

  // URL ?comp=... → mount 时(或 URL 变更时)自动加载,只触发一次。
  useEffect(() => {
    if (!urlComp || urlComp === loadedCompId || urlComp === autoLoadedRef.current || loading) return;
    autoLoadedRef.current = urlComp;
    load(urlComp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlComp]);

  const downloadPdf = async () => {
    if (!sheets || sheets.length === 0) return;
    setPdfBuilding(true);
    setPdfProgress({ done: 0, total: 1 });
    try {
      const { generateTnoodlePdf } = await import('./tnoodle_pdf');
      const sheetInputs: RoundSheetInput[] = sheets.map((s) => ({
        event: s.event,
        roundIdx: s.roundIdx,
        groupIdx: s.groupIdx,
        format: s.format,
        attemptNumber: s.attemptNumber,
        attempts: s.attempts.map((a) => ({ label: a.label, isExtra: a.isExtra, scramble: a.scramble })),
        locales: s.locales,
        copies: s.copies,
        totalGroups: s.totalGroups,
      }));
      const blob = await generateTnoodlePdf(sheetInputs, {
        competitionTitle: loadedCompName ?? loadedCompId ?? 'Scrambles',
        generatorTag: GENERATOR_TAG,
        isZh,
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(loadedCompName ?? loadedCompId ?? 'scrambles').replace(/[^\w一-龥-]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[import] pdf failed', err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPdfBuilding(false);
      setPdfProgress(null);
    }
  };

  const sheetsInEvent = sheets ? sheets.filter((s) => s.event === activeView) : [];
  const roundIdxsInEvent = useMemo(
    () => Array.from(new Set(sheetsInEvent.map((s) => s.roundIdx))).sort((a, b) => a - b),
    [sheetsInEvent],
  );
  const activeRoundIdx = viewedRoundIdx !== null && roundIdxsInEvent.includes(viewedRoundIdx)
    ? viewedRoundIdx
    : roundIdxsInEvent[0] ?? null;
  const visible = activeRoundIdx === null
    ? sheetsInEvent
    : sheetsInEvent.filter((s) => s.roundIdx === activeRoundIdx);
  const roundLabel = (idx: number): string => {
    if (idx === 3) return t('决赛', 'Final');
    return `R${idx + 1}`;
  };

  // 切 event 时清掉旧的 round 选择,让默认落回新 event 的第一个轮次
  useEffect(() => {
    setViewedRoundIdx(null);
  }, [activeView]);

  // 字节进度 → 显示用 "12.3 / 45.6 KB" 或 received-only。
  const fmtKB = (b: number) => `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
  const loadLabel = (() => {
    if (!loading) return t('加载', 'Load');
    if (!loadProgress) return t('加载中…', 'Loading…');
    const { done, total } = loadProgress;
    if (total > 0) return `${fmtKB(done)} / ${fmtKB(total)}`;
    if (done > 0) return fmtKB(done);
    return t('加载中…', 'Loading…');
  })();

  return (
    <>
      <div className={`gen-tn-controls${loadedCompId ? ' is-loaded' : ''}`}>
        <div
          className="gen-control-group"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !loadedCompId && !loading) load();
          }}
        >
          {loadedCompId ? (
            // country-flag skill:比赛名前必须带国旗 → 走 CompCell(自带 iso2 + 本地化)
            <div className="gen-tn-comp-display">
              <CompCell compId={loadedCompId} compName={loadedCompName} isZh={isZh} />
            </div>
          ) : (
            <CompPicker
              className="gen-tn-comp-picker"
              value={input}
              onChange={setInput}
              onUrlPaste={setInput}
              onPick={onPickComp}
              isZh={isZh}
              placeholder={t('搜索比赛名 / 粘贴 ID 或 URL', 'Search competition / paste ID or URL')}
            />
          )}
        </div>
        <div className="gen-control-group gen-control-actions">
          {loadedCompId ? (
            <>
              <ProgressButton
                icon={<Download size={14} className={pdfBuilding ? 'gen-spin' : ''} />}
                label={pdfBuilding
                  ? <span className="gen-btn-progress-num">{`${pdfProgress?.done ?? 0}/${pdfProgress?.total ?? 1}`}</span>
                  : ''}
                progress={pdfProgress}
                onClick={downloadPdf}
                disabled={pdfBuilding}
                title={t('下载 PDF (tnoodle 风格)', 'Download PDF (tnoodle style)')}
              />
              <button
                type="button"
                className="gen-btn"
                onClick={reset}
                title={t('换一场比赛', 'Load another competition')}
                aria-label={t('换一场比赛', 'Load another competition')}
              >
                <Trash2 size={14} />
              </button>
            </>
          ) : (
            <ProgressButton
              primary
              icon={<CloudDownload size={14} className={loading ? 'gen-spin' : ''} />}
              label={loadLabel}
              progress={loading ? loadProgress : null}
              onClick={load}
              disabled={loading || !input.trim()}
              title={t('加载打乱', 'Load scrambles')}
            />
          )}
        </div>
      </div>

      {error && <div className="gen-tn-empty" style={{ color: 'var(--gen-accent)' }}>{error}</div>}

      {!sheets && !error && (
        <div className="gen-tn-empty">
          {t(
            '粘贴 WCA 比赛页 URL 或 ID(如 OddDayinHongKong2026),按 Enter 或 Load 加载该比赛的全部打乱。',
            'Paste a WCA competition URL or ID (e.g. OddDayinHongKong2026), press Enter or Load to fetch all published scrambles.',
          )}
        </div>
      )}

      {sheets && sheets.length > 0 && activeView && (
        <>
          <WcaEventSelector
            availableEvents={new Set(eventsInSheets)}
            selectedEvent={activeView}
            onSelect={setViewedEvent}
            onlyAvailable
            isZh={isZh}
          />
          {roundIdxsInEvent.length > 1 && (
            <div className="gen-tn-round-chips" role="tablist">
              {roundIdxsInEvent.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={r === activeRoundIdx}
                  className={`gen-tn-round-chip${r === activeRoundIdx ? ' is-active' : ''}`}
                  onClick={() => setViewedRoundIdx(r)}
                >
                  {roundLabel(r)}
                </button>
              ))}
            </div>
          )}
          <div className="gen-tn-sheets">
            {visible.map((sh, i) => (
              <SheetView key={i} sheet={sh} isZh={isZh} t={t} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
