import { useEffect } from 'react';

interface Props {
  isZh: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keys: string[];
  en: string;
  zh: string;
}

const TIMING: ShortcutRow[] = [
  { keys: ['Space'],     en: 'Hold to ready, release to start. Press to stop.', zh: '按住进入准备，松开开始计时；运行中按下停止。' },
  { keys: ['Esc'],       en: 'Cancel current attempt (no solve recorded).',     zh: '取消当前尝试（不计成绩）。' },
  { keys: ['Touch'],     en: 'Same as space — tap-and-hold to ready.',          zh: '同空格 — 按住屏幕进入准备。' },
];

const HISTORY: ShortcutRow[] = [
  { keys: ['Z'],         en: 'Delete the last solve (undo).',                   zh: '删除最近一次成绩（撤销）。' },
  { keys: ['2'],         en: 'Toggle +2 on the last solve.',                    zh: '切换最近成绩的 +2 罚时。' },
  { keys: ['D'],         en: 'Toggle DNF on the last solve.',                   zh: '切换最近成绩的 DNF。' },
  { keys: ['1', '…', '9'], en: 'Open the Nth-most-recent solve detail.',         zh: '打开倒数第 N 次成绩的详情面板。' },
];

const NAV: ShortcutRow[] = [
  { keys: [','],         en: 'Generate a new scramble.',                        zh: '生成下一个打乱。' },
  { keys: ['F'],         en: 'Toggle fullscreen.',                              zh: '切换全屏。' },
  { keys: ['Click strip'], en: 'Refresh scramble.',                             zh: '点击打乱条换打乱。' },
];

export default function ShortcutsModal({ isZh, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="timer-modal-overlay" onClick={onClose}>
      <div className="timer-modal shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isZh ? '快捷键' : 'Shortcuts'}</h2>

        <Section title={isZh ? '计时' : 'Timing'} rows={TIMING} isZh={isZh} />
        <Section title={isZh ? '历史' : 'History'} rows={HISTORY} isZh={isZh} />
        <Section title={isZh ? '导航' : 'Navigation'} rows={NAV} isZh={isZh} />

        <div className="modal-actions">
          <button className="primary" onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, rows, isZh }: { title: string; rows: ShortcutRow[]; isZh: boolean }) {
  return (
    <div className="modal-section">
      <h3 className="settings-h3">{title}</h3>
      <div className="shortcut-rows">
        {rows.map((r, i) => (
          <div className="shortcut-row" key={i}>
            <div className="shortcut-keys">
              {r.keys.map((k, j) => (
                <span key={j}>
                  <kbd>{k}</kbd>
                  {j < r.keys.length - 1 && <span className="key-sep"> · </span>}
                </span>
              ))}
            </div>
            <div className="shortcut-desc">{isZh ? r.zh : r.en}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
