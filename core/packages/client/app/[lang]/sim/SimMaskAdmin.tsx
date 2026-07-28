'use client';
// 遮罩清单管理(仅管理员可见,/sim 播放条上的齿轮)。
//
// 能做四件事:改双语名字、调组内顺序、藏起不想看的条目、把当前点选的贴纸存成一条新遮罩。
// 存的是覆盖层(lib/sim-masks-api.ts),代码里的默认清单不动;某条「恢复默认」= 删掉它那行。
// 顺序按组来 —— 一次上/下就把该组全量 keys 发去 /reorder,于是抽屉里看到的顺序就是落库的顺序。
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw, Trash2, X } from 'lucide-react';
import { useT } from '@/hooks/useT';
import {
  deleteSimMask, reorderSimMasks, saveSimMask, PRESET_PREFIX,
  type SimMaskRow,
} from '@/lib/sim-masks-api';
import { maskRowsForOrder } from './engine/nxn/maskConfig';
import type { StickeringGroup } from './engine/nxn/stickering';
import './sim-mask-admin.css';

/** 英文名 → URL 里能看的 key;重名自动加序号,空名回退时间戳。 */
function presetKey(labelEn: string, labelZh: string, taken: Set<string>): string {
  const base = (labelEn || labelZh).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stem = base || `m${Date.now().toString(36)}`;
  let key = PRESET_PREFIX + stem;
  for (let n = 2; taken.has(key); n++) key = `${PRESET_PREFIX}${stem}-${n}`;
  return key;
}

export default function SimMaskAdmin({
  order, groups, rows, onReload, onClose, groupLabel, defaultLabel,
  pickedSids, pick, rest,
}: {
  /** 阶数(覆盖行按阶存:点选清单绑死阶数,内置条目也按阶各记一份)。 */
  order: number;
  /** 含隐藏项的完整分组(applyMaskConfig 的 includeHidden 版本),顺序即当前显示顺序。 */
  groups: StickeringGroup[];
  rows: SimMaskRow[];
  onReload: () => Promise<void>;
  onClose: () => void;
  groupLabel: (group: string) => string;
  /** 代码里的默认标签(改名输入框的 placeholder,让人看得见默认是什么)。 */
  defaultLabel: (key: string) => string;
  /** 当前「自定义阶段」点选的贴纸清单 + 画法 —— 存成新遮罩用的就是这三样。 */
  pickedSids: string;
  pick: string;
  rest: string;
}) {
  const t = useT();
  const cfg = useMemo(() => maskRowsForOrder(rows, order), [rows, order]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 改名草稿:key → { zh, en };没进过输入框的条目不在里面(= 未改动)
  const [draft, setDraft] = useState<Record<string, { zh: string; en: string }>>({});
  const [newZh, setNewZh] = useState('');
  const [newEn, setNewEn] = useState('');

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const rowOf = (key: string): SimMaskRow | undefined => cfg.get(key);
  const draftOf = (key: string) => {
    const d = draft[key];
    if (d) return d;
    const r = rowOf(key);
    return { zh: r?.labelZh ?? '', en: r?.labelEn ?? '' };
  };
  const dirty = (key: string) => {
    const d = draft[key];
    if (!d) return false;
    const r = rowOf(key);
    return d.zh !== (r?.labelZh ?? '') || d.en !== (r?.labelEn ?? '');
  };

  /** 一行的完整 upsert(标签 / 显隐 都走它;custom 行要把 sids 原样带回去,别被覆盖成空)。 */
  const saveRow = (key: string, patch: { zh?: string; en?: string; hidden?: boolean }) => {
    const r = rowOf(key);
    const d = draftOf(key);
    const isPreset = key.startsWith(PRESET_PREFIX);
    void run(async () => {
      await saveSimMask({
        maskKey: key,
        kind: isPreset ? 'custom' : 'builtin',
        cubeSize: order,
        hidden: patch.hidden ?? r?.hidden ?? false,
        labelZh: patch.zh ?? d.zh,
        labelEn: patch.en ?? d.en,
        sids: r?.sids ?? '',
        pick: r?.pick ?? 'regular',
        rest: r?.rest ?? 'ignored',
      });
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  };

  const move = (groupIdx: number, i: number, delta: number) => {
    const g = groups[groupIdx];
    const items = [...g.items];
    const j = i + delta;
    if (j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    // 只发这一组的全量 keys:组间顺序由代码决定,不跨组搬
    void run(() => reorderSimMasks(order, items));
  };

  const resetRow = (key: string) => {
    const isPreset = key.startsWith(PRESET_PREFIX);
    const label = defaultLabel(key) || key;
    const ok = window.confirm(isPreset
      ? t(`删除自建遮罩「${label}」?`, `Delete custom mask “${label}”?`)
      : t(`把「${label}」恢复成代码默认(名字 / 顺序 / 显隐 全部还原)?`,
        `Reset “${label}” to the code default (label, order and visibility)?`));
    if (!ok) return;
    void run(() => deleteSimMask(key));
  };

  const createPreset = () => {
    if (!pickedSids) return;
    const taken = new Set(rows.map((r) => r.maskKey));
    void run(async () => {
      await saveSimMask({
        maskKey: presetKey(newEn, newZh, taken),
        kind: 'custom',
        cubeSize: order,
        hidden: false,
        labelZh: newZh.trim(),
        labelEn: newEn.trim(),
        sids: pickedSids,
        pick,
        rest,
      });
      setNewZh('');
      setNewEn('');
    });
  };

  return (
    <div className="sim-mask-admin-scrim" role="dialog" aria-modal="true" aria-label={t('遮罩清单管理', 'Manage mask list')}>
      <div className="sim-mask-admin">
        <div className="sim-mask-admin-head">
          <strong>{t('遮罩清单管理', 'Manage mask list')}</strong>
          <span className="sim-mask-admin-note">
            {t(`${order} 阶;改动对所有人生效`, `Cube size ${order}; changes are live for everyone`)}
          </span>
          <button type="button" className="sim-mask-admin-x" onClick={onClose} aria-label={t('关闭', 'Close')}>
            <X size={16} />
          </button>
        </div>

        <div className="sim-mask-admin-new">
          <span className="sim-mask-admin-new-label">{t('把当前点选存成遮罩', 'Save current pick as a mask')}</span>
          {pickedSids ? (
            <>
              <input
                className="sim-mask-admin-input"
                value={newZh}
                onChange={(e) => setNewZh(e.target.value)}
                placeholder={t('中文名', 'Chinese name')}
                aria-label={t('中文名', 'Chinese name')}
              />
              <input
                className="sim-mask-admin-input"
                value={newEn}
                onChange={(e) => setNewEn(e.target.value)}
                placeholder={t('英文名', 'English name')}
                aria-label={t('英文名', 'English name')}
              />
              <button
                type="button"
                className="sim-mask-admin-btn"
                onClick={createPreset}
                disabled={busy || (!newZh.trim() && !newEn.trim())}
              >
                {t('保存', 'Save')}
              </button>
            </>
          ) : (
            <span className="sim-mask-admin-hint">
              {t('先在阶段下拉里选「自定义」并点几枚贴纸', 'Pick “custom” in the stage select and click some stickers first')}
            </span>
          )}
        </div>

        <div className="sim-mask-admin-list">
          {groups.map((g, gi) => (
            <div key={g.group} className="sim-mask-admin-group">
              <div className="sim-mask-admin-group-title">{groupLabel(g.group)}</div>
              {g.items.map((key, i) => {
                const r = rowOf(key);
                const d = draftOf(key);
                const hidden = r?.hidden ?? false;
                return (
                  <div key={key} className={`sim-mask-admin-row${hidden ? ' is-hidden' : ''}`}>
                    <button
                      type="button" className="sim-mask-admin-icon" disabled={busy || i === 0}
                      onClick={() => move(gi, i, -1)} title={t('上移', 'Move up')} aria-label={t('上移', 'Move up')}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button" className="sim-mask-admin-icon" disabled={busy || i === g.items.length - 1}
                      onClick={() => move(gi, i, 1)} title={t('下移', 'Move down')} aria-label={t('下移', 'Move down')}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <code className="sim-mask-admin-key" title={key}>{key}</code>
                    <input
                      className="sim-mask-admin-input"
                      value={d.zh}
                      onChange={(e) => setDraft((p) => ({ ...p, [key]: { ...draftOf(key), zh: e.target.value } }))}
                      placeholder={defaultLabel(key)}
                      aria-label={t('中文名', 'Chinese name')}
                    />
                    <input
                      className="sim-mask-admin-input"
                      value={d.en}
                      onChange={(e) => setDraft((p) => ({ ...p, [key]: { ...draftOf(key), en: e.target.value } }))}
                      placeholder={defaultLabel(key)}
                      aria-label={t('英文名', 'English name')}
                    />
                    <button
                      type="button" className="sim-mask-admin-btn" disabled={busy || !dirty(key)}
                      onClick={() => saveRow(key, {})}
                    >
                      {t('保存', 'Save')}
                    </button>
                    <button
                      type="button" className="sim-mask-admin-icon" disabled={busy}
                      onClick={() => saveRow(key, { hidden: !hidden })}
                      title={hidden ? t('取消隐藏', 'Show again') : t('隐藏', 'Hide')}
                      aria-label={hidden ? t('取消隐藏', 'Show again') : t('隐藏', 'Hide')}
                    >
                      {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button" className="sim-mask-admin-icon" disabled={busy || !r}
                      onClick={() => resetRow(key)}
                      title={key.startsWith(PRESET_PREFIX) ? t('删除', 'Delete') : t('恢复默认', 'Reset to default')}
                      aria-label={key.startsWith(PRESET_PREFIX) ? t('删除', 'Delete') : t('恢复默认', 'Reset to default')}
                    >
                      {key.startsWith(PRESET_PREFIX) ? <Trash2 size={14} /> : <RotateCcw size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {err && <div className="sim-mask-admin-err">{err}</div>}
      </div>
    </div>
  );
}
