'use client';
// 遮罩清单管理(仅管理员可见,/sim 播放条上的齿轮)。
//
// 标签与显隐用条目覆盖层；分组顺序、组内顺序与跨组归属一次保存完整布局。
import { useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Trash2, X } from 'lucide-react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import SortableCard from '@/components/SortableCard';
import { useT } from '@/hooks/useT';
import {
  deleteSimMask, saveSimMaskLayout, saveSimMask, PRESET_PREFIX,
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
  defaultLabel: (key: string, lang: 'zh' | 'en') => string;
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (busy || !over || active.id === over.id) return;
    const fromId = String(active.id);
    const toId = String(over.id);
    let next = groups.map((g) => ({ ...g, items: [...g.items] }));
    if (fromId.startsWith('group:')) {
      const from = groups.findIndex((g) => `group:${g.group}` === fromId);
      const to = groups.findIndex((g) => `group:${g.group}` === toId);
      if (from < 0 || to < 0) return;
      next = arrayMove(next, from, to);
    } else {
      const key = fromId.slice(5);
      const from = next.find((g) => g.items.includes(key));
      const targetKey = toId.slice(5);
      const to = next.find((g) => toId.startsWith('group:') ? `group:${g.group}` === toId : g.items.includes(targetKey));
      if (!from || !to) return;
      if (from === to && toId.startsWith('item:')) {
        from.items = arrayMove(from.items, from.items.indexOf(key), from.items.indexOf(targetKey));
      } else {
        from.items.splice(from.items.indexOf(key), 1);
        const at = toId.startsWith('item:') ? to.items.indexOf(targetKey) : to.items.length;
        to.items.splice(at, 0, key);
      }
    }
    void run(() => saveSimMaskLayout({ cubeSize: order, groups: next }));
  };

  const moveToGroup = (key: string, target: string) => {
    if (!groups.some((g) => g.group === target)) return;
    const next = groups.map((g) => ({ ...g, items: g.items.filter((item) => item !== key) }));
    next.find((g) => g.group === target)!.items.push(key);
    void run(() => saveSimMaskLayout({ cubeSize: order, groups: next }));
  };

  const resetRow = (key: string) => {
    const isPreset = key.startsWith(PRESET_PREFIX);
    const label = defaultLabel(key, 'zh') || key;
    const ok = window.confirm(isPreset
      ? t(`删除自建遮罩「${label}」?`, `Delete custom mask “${label}”?`)
      : t(`把「${label}」的名字和显隐恢复默认?`,
        `Reset the label and visibility of “${label}”?`));
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

        <DndContext sensors={sensors} onDragEnd={onDragEnd}
          collisionDetection={(args) => closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) =>
            !String(args.active.id).startsWith('group:') || String(container.id).startsWith('group:')) })}>
        <SortableContext items={groups.map((g) => `group:${g.group}`)} strategy={verticalListSortingStrategy}>
        <div className="sim-mask-admin-list">
          {groups.map((g) => (
            <SortableCard key={g.group} id={`group:${g.group}`} draggable={!busy} stretch={false} className="sim-mask-admin-group" dragLabel={t('拖动调整分组顺序', 'Drag to reorder groups')}>
              <div className="sim-mask-admin-group-title">
                <strong>{groupLabel(g.group)}</strong>
                {g.items.length === 0 && <span>{t('空分组，可移入阶段', 'Empty group; move a stage here')}</span>}
              </div>
              <SortableContext items={g.items.map((key) => `item:${key}`)} strategy={verticalListSortingStrategy}>
              {g.items.map((key) => {
                const r = rowOf(key);
                const d = draftOf(key);
                const hidden = r?.hidden ?? false;
                return (
                  <SortableCard key={key} id={`item:${key}`} draggable={!busy} stretch={false} className={`sim-mask-admin-row${hidden ? ' is-hidden' : ''}`} dragLabel={t('拖动调整阶段顺序或分组', 'Drag to reorder or move stage')}>
                    <code className="sim-mask-admin-key" title={key}>{key}</code>
                    <label className="sim-mask-admin-field">
                    <span>{t('中文名', 'Chinese name')}</span>
                    <input
                      className="sim-mask-admin-input"
                      value={d.zh}
                      onChange={(e) => setDraft((p) => ({ ...p, [key]: { ...draftOf(key), zh: e.target.value } }))}
                      placeholder={defaultLabel(key, 'zh')}
                      aria-label={t('中文名', 'Chinese name')}
                    />
                    </label>
                    <label className="sim-mask-admin-field">
                    <span>{t('英文名', 'English name')}</span>
                    <input
                      className="sim-mask-admin-input"
                      value={d.en}
                      onChange={(e) => setDraft((p) => ({ ...p, [key]: { ...draftOf(key), en: e.target.value } }))}
                      placeholder={defaultLabel(key, 'en')}
                      aria-label={t('英文名', 'English name')}
                    />
                    </label>
                    <label className="sim-mask-admin-field">
                      <span>{t('分组', 'Group')}</span>
                      <select className="sim-mask-admin-input" value={g.group} disabled={busy} aria-label={t('分组', 'Group')}
                        onChange={(e) => moveToGroup(key, e.target.value)}>
                        {groups.map((target) => <option key={target.group} value={target.group}>{groupLabel(target.group)}</option>)}
                      </select>
                    </label>
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
                  </SortableCard>
                );
              })}
              </SortableContext>
            </SortableCard>
          ))}
        </div>
        </SortableContext>
        </DndContext>

        {err && <div className="sim-mask-admin-err">{err}</div>}
      </div>
    </div>
  );
}
