'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { tr } from '@/i18n/tr';
import { useT } from '@/hooks/useT';
import { COMMAND_KEYS, type CommandId, type KeyBinding } from '../_lib/shortcuts';
import { TOOLS } from './Toolbar';

interface Props {
  open: boolean;
  onClose: () => void;
}

// Pretty single-key labels (arrows / named keys → symbols).
const KEY_LABEL: Record<string, string> = {
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  delete: 'Del',
  backspace: 'Backspace',
  escape: 'Esc',
  '-': '−',
};
function prettyKey(k: string): string {
  return KEY_LABEL[k] ?? (k.length === 1 ? k.toUpperCase() : k);
}
function comboLabel(b: KeyBinding): string {
  const parts: string[] = [];
  if (b.mod) parts.push('Ctrl');
  if (b.shift) parts.push('Shift');
  parts.push(prettyKey(b.key));
  return parts.join(' + ');
}
// First binding declared for a command (keys live solely in shortcuts.ts → no drift).
function comboFor(cmd: CommandId): string {
  const b = COMMAND_KEYS.find((k) => k.command === cmd);
  return b ? comboLabel(b) : '';
}

// Command groups — labels + ordering are presentation only; the key combos are
// pulled from shortcuts.ts so they never drift from the actual bindings.
const EDIT: { cmd: CommandId; zh: string; en: string }[] = [
  { cmd: 'undo', zh: '撤销', en: 'Undo' },
  { cmd: 'redo', zh: '重做', en: 'Redo' },
  { cmd: 'copy', zh: '复制', en: 'Copy' },
  { cmd: 'cut', zh: '剪切', en: 'Cut' },
  { cmd: 'paste', zh: '粘贴', en: 'Paste' },
  { cmd: 'duplicate', zh: '直接复制', en: 'Duplicate' },
  { cmd: 'delete', zh: '删除', en: 'Delete' },
  { cmd: 'selectAll', zh: '全选', en: 'Select all' },
  { cmd: 'escape', zh: '取消选择 / 回到选择工具', en: 'Deselect / back to Select' },
];
const ARRANGE: { cmd: CommandId; zh: string; en: string }[] = [
  { cmd: 'group', zh: '编组', en: 'Group' },
  { cmd: 'ungroup', zh: '取消编组', en: 'Ungroup' },
  { cmd: 'toFront', zh: '置于顶层', en: 'Bring to front' },
  { cmd: 'forward', zh: '上移一层', en: 'Bring forward' },
  { cmd: 'backward', zh: '下移一层', en: 'Send backward' },
  { cmd: 'toBack', zh: '置于底层', en: 'Send to back' },
];
const VIEW: { cmd: CommandId; zh: string; en: string }[] = [
  { cmd: 'zoomIn', zh: '放大', en: 'Zoom in' },
  { cmd: 'zoomOut', zh: '缩小', en: 'Zoom out' },
  { cmd: 'zoomFit', zh: '适应画布', en: 'Fit to view' },
  { cmd: 'zoom100', zh: '实际大小 (100%)', en: 'Actual size (100%)' },
];
// Pointer/gesture affordances that have no single key — easy to miss, so listed.
const GESTURES: { zh: string; en: string; combo: string }[] = [
  { zh: '平移画布', en: 'Pan canvas', combo: tr({ zh: '空格 + 拖动', en: 'Space + drag' }) },
  { zh: '缩放', en: 'Zoom', combo: tr({ zh: 'Ctrl + 滚轮', en: 'Ctrl + scroll' }) },
  { zh: '平移', en: 'Pan', combo: tr({ zh: '滚轮 / Shift+滚轮', en: 'Scroll / Shift+scroll' }) },
  { zh: '触摸', en: 'Touch', combo: tr({ zh: '双指捏合 / 拖动', en: 'Two-finger pinch / drag' }) },
  { zh: '画多边形/星形时改边数', en: 'Polygon/star point count', combo: '↑ / ↓' },
];

function Row({ name, combo }: { name: string; combo: string }) {
  return (
    <div className="paint-sc-row">
      <span className="paint-sc-name">{name}</span>
      <span className="paint-sc-combo">
        {combo.split(' + ').map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="paint-sc-plus">+</span>}
            <kbd className="paint-kbd">{part}</kbd>
          </span>
        ))}
      </span>
    </div>
  );
}

export default function ShortcutsPanel({ open, onClose }: Props) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const tools = TOOLS.filter((tl) => tl.key && !tl.stub);

  return (
    <div
      className="paint-modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="paint-modal paint-shortcuts" role="dialog" aria-modal="true" aria-label={tr({ zh: '键盘快捷键', en: 'Keyboard shortcuts' })}>
        <div className="paint-sh-head">
          <span className="paint-sh-title">{t('键盘快捷键 / 手势', 'Shortcuts & gestures')}</span>
          <button type="button" className="paint-btn paint-sh-close" onClick={onClose} aria-label={tr({ zh: '关闭', en: 'Close' })}>
            <X size={15} />
          </button>
        </div>

        <div className="paint-sc-body">
          <section className="paint-sc-group">
            <h3 className="paint-sc-h">{t('工具', 'Tools')}</h3>
            {tools.map((tl) => (
              <Row key={tl.id} name={tr(tl.label)} combo={tl.key!} />
            ))}
          </section>

          <section className="paint-sc-group">
            <h3 className="paint-sc-h">{t('编辑', 'Edit')}</h3>
            {EDIT.map((r) => (
              <Row key={r.cmd} name={t(r.zh, r.en)} combo={comboFor(r.cmd)} />
            ))}
            <Row name={t('微移(Shift 为 ×10)', 'Nudge (Shift = ×10)')} combo="← → ↑ ↓" />
          </section>

          <section className="paint-sc-group">
            <h3 className="paint-sc-h">{t('排列', 'Arrange')}</h3>
            {ARRANGE.map((r) => (
              <Row key={r.cmd} name={t(r.zh, r.en)} combo={comboFor(r.cmd)} />
            ))}
          </section>

          <section className="paint-sc-group">
            <h3 className="paint-sc-h">{t('视图', 'View')}</h3>
            {VIEW.map((r) => (
              <Row key={r.cmd} name={t(r.zh, r.en)} combo={comboFor(r.cmd)} />
            ))}
          </section>

          <section className="paint-sc-group">
            <h3 className="paint-sc-h">{t('鼠标 / 触摸', 'Pointer / touch')}</h3>
            {GESTURES.map((r, i) => (
              <Row key={i} name={t(r.zh, r.en)} combo={r.combo} />
            ))}
          </section>
        </div>

        <div className="paint-sc-foot">{t('Mac 上 Ctrl 即 ⌘;按 ? 可随时打开此面板。', 'On Mac, Ctrl = ⌘. Press ? anytime to reopen this panel.')}</div>
      </div>
    </div>
  );
}
