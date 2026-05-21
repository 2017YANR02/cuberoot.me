import { useEffect, useId, useRef } from 'react';
import { useIsMobile } from '../../../hooks/useIsMobile';

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
  { keys: ['2'],         en: 'Toggle +2 on the last solve (when stopped).',     zh: '已停止时切换最近成绩的 +2 罚时。' },
  { keys: ['D'],         en: 'Toggle DNF on the last solve (when stopped).',    zh: '已停止时切换最近成绩的 DNF。' },
  { keys: ['1', '…', '9'], en: 'Open the Nth-most-recent solve detail.',         zh: '打开倒数第 N 次成绩的详情面板。' },
];

const MULTISTAGE: ShortcutRow[] = [
  { keys: ['1'], en: 'During solve: mark Cross done.',          zh: '运行中：标记十字完成。' },
  { keys: ['2'], en: 'During solve: mark F2L done.',            zh: '运行中：标记 F2L 完成。' },
  { keys: ['3'], en: 'During solve: mark OLL done.',            zh: '运行中：标记 OLL 完成。' },
];

const BLD: ShortcutRow[] = [
  { keys: ['Enter'], en: 'During BLD solve: mark memo done.',   zh: '盲拧运行中：标记记忆完成。' },
];

const NAV: ShortcutRow[] = [
  { keys: [','],         en: 'Generate a new scramble.',                        zh: '生成下一个打乱。' },
  { keys: ['F'],         en: 'Toggle fullscreen.',                              zh: '切换全屏。' },
  { keys: ['Click strip'], en: 'Refresh scramble.',                             zh: '点击打乱条换打乱。' },
];

export default function ShortcutsModal({ isZh, onClose }: Props) {
  const titleId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile(480);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Initial focus → close button (the only focusable element). Mount-only.
  useEffect(() => {
    closeBtnRef.current?.focus();
  }, []);

  // --- Mobile inline overrides (≤480px) ---
  // Overlay: shrink padding so the modal can take the full viewport width.
  // Modal: full-width, dvh-capped, tighter padding so the table fits.
  // Close button: ≥44px tap target, stretch to row width.
  const overlayStyle = isMobile ? { padding: 8 } : undefined;
  const modalStyle = isMobile
    ? { padding: 14, maxWidth: '100%', maxHeight: '90dvh' }
    : undefined;
  const closeBtnStyle = isMobile
    ? ({ minHeight: 44, padding: '10px 14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' })
    : undefined;
  const actionsStyle = isMobile
    ? ({ flexDirection: 'column' as const, alignItems: 'stretch' as const })
    : undefined;

  return (
    <div className="timer-modal-overlay" style={overlayStyle} onClick={onClose}>
      <div
        className="timer-modal shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{isZh ? '快捷键' : 'Shortcuts'}</h2>

        {isMobile && (
          <div className="modal-section" style={{ fontSize: 12, color: '#888' }}>
            {isZh
              ? '提示：触屏设备无键盘快捷键；接外接键盘后可用以下绑定。'
              : 'Note: shortcuts apply when an external keyboard is attached.'}
          </div>
        )}

        <Section title={isZh ? '计时' : 'Timing'} rows={TIMING} isZh={isZh} isMobile={isMobile} />
        <Section title={isZh ? '历史' : 'History'} rows={HISTORY} isZh={isZh} isMobile={isMobile} />
        <Section title={isZh ? 'CFOP 分阶段（设置里开启）' : 'CFOP splits (enable in settings)'} rows={MULTISTAGE} isZh={isZh} isMobile={isMobile} />
        <Section title={isZh ? '盲拧（设置里开启）' : 'BLD (enable in settings)'} rows={BLD} isZh={isZh} isMobile={isMobile} />
        <Section title={isZh ? '导航' : 'Navigation'} rows={NAV} isZh={isZh} isMobile={isMobile} />

        <div className="modal-actions" style={actionsStyle}>
          <button ref={closeBtnRef} className="primary" style={closeBtnStyle} onClick={onClose}>{isZh ? '关闭' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, rows, isZh, isMobile }: { title: string; rows: ShortcutRow[]; isZh: boolean; isMobile: boolean }) {
  // On mobile, tighten section padding and force the desc to wrap below the keys.
  const sectionStyle = isMobile ? { marginBottom: 10 } : undefined;
  const rowStyle = isMobile
    ? ({ display: 'flex', flexDirection: 'column' as const, gap: 2, padding: '6px 0', borderBottom: '1px solid #1f1f23' })
    : undefined;
  const descStyle = isMobile ? { fontSize: 13, lineHeight: 1.4, color: '#bbb' } : undefined;
  return (
    <div className="modal-section" style={sectionStyle}>
      <h3 className="settings-h3">{title}</h3>
      <div className="shortcut-rows">
        {rows.map((r, i) => (
          <div className="shortcut-row" key={i} style={rowStyle}>
            <div className="shortcut-keys">
              {r.keys.map((k, j) => (
                <span key={j}>
                  <kbd>{k}</kbd>
                  {j < r.keys.length - 1 && <span className="key-sep"> · </span>}
                </span>
              ))}
            </div>
            <div className="shortcut-desc" style={descStyle}>{isZh ? r.zh : r.en}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
