/**
 * 魔方公式虚拟键盘——1:1 移植自 recon/submit/recon_submit_page.js L542-1032
 * NOTE: 独立 React 组件，通过 ref 操作外部 textarea
 *
 * 功能：
 * - 双页布局（第 0 页魔方符号 + 第 1 页 QWERTY）
 * - 长按变体弹出（2→1-6，触发器→左/右变体）
 * - 上/下滑手势（逆时针/双层转动）
 * - 双击 180°，长按 180°'
 * - iOS Shift 三态（off / single / capslock）
 * - () 三态（点击→()，下滑→[]，上滑→{}）
 * - 修饰键自动禁用（光标前无字母时 ' 和 w 灰显）
 * - 公式联想（前缀匹配 8 条触发器公式）
 */
import { useState, useRef, useCallback, useEffect, type RefObject } from 'react';
import { t } from '../../../utils/recon_utils';
import './cube_virtual_keyboard.css';

interface Props {
  /** 目标 textarea 的 ref */
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** 输入后的回调（父组件更新统计等） */
  onInput?: () => void;
}

// ── 常量 ──

// NOTE: 长按变体映射——数字 + 触发器
const LONG_PRESS_VARIANTS: Record<string, string[]> = {
  '2': ['1', '2', '3', '4', '5', '6'],
  'trigger-sexy': ["R U R' U'", "L' U' L U"],
  'trigger-sledge': ["R' F R F'", "L F' L' F"],
  'trigger-unsexy': ["R U' R' U", "L' U L U'"],
  'trigger-hedge': ["F R' F' R", "F' L F L'"],
};

// NOTE: 可双击的按键集合
const DOUBLE_TAP_KEYS: Record<string, boolean> = {
  U: true, D: true, F: true, B: true, R: true, L: true,
  x: true, y: true, z: true, M: true, E: true, S: true, '/': true,
};

// NOTE: 面旋转键——支持下滑/上滑手势
const FACE_KEYS: Record<string, boolean> = {
  U: true, D: true, F: true, B: true, R: true, L: true,
};

// NOTE: 公式联想触发器表
const SUGGEST_FORMULAS = [
  { label: "R U R' U'", formula: "R U R' U' " },
  { label: "R U' R' U", formula: "R U' R' U " },
  { label: "R' F R F'", formula: "R' F R F' " },
  { label: "F R' F' R", formula: "F R' F' R " },
  { label: "L' U' L U", formula: "L' U' L U " },
  { label: "L' U L U'", formula: "L' U L U' " },
  { label: "L F' L' F", formula: "L F' L' F " },
  { label: "F' L F L'", formula: "F' L F L' " },
];

// NOTE: 自动替换非标准标点
const PUNCT_MAP: Record<string, string> = {
  '\u2018': "'", '\u2019': "'",
  '\u201C': "'", '\u201D': "'",
  '"': "'",
  '\uFF08': '(', '\uFF09': ')',
  '\uFF0C': ',', '\u3002': '.',
};
const PUNCT_RE = /[\u2018\u2019\u201C\u201D"\uFF08\uFF09\uFF0C\u3002]/g;

/** 词法解析——把魔方公式字符串切成 token 数组 */
function tokenizeFormula(str: string): string[] {
  const re = /([UDFBRLMESxyz]w?['2]?)/g;
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) tokens.push(m[1]);
  return tokens;
}

/** 前缀匹配——从光标前 N 个 token 中找出匹配的公式建议 */
function getSuggestions(inputStr: string) {
  const inputTokens = tokenizeFormula(inputStr);
  const results: Array<{ label: string; formula: string; prefixLen: number }> = [];
  for (const def of SUGGEST_FORMULAS) {
    const defTokens = tokenizeFormula(def.formula);
    const maxCheck = Math.min(inputTokens.length, defTokens.length - 1);
    for (let n = maxCheck; n >= 1; n--) {
      const tail = inputTokens.slice(-n);
      const prefix = defTokens.slice(0, n);
      if (tail.join(' ') === prefix.join(' ')) {
        results.push({ label: def.label, formula: def.formula, prefixLen: n });
        break;
      }
    }
  }
  return results;
}

type ShiftState = 'off' | 'single' | 'capslock';

export default function CubeVirtualKeyboard({ textareaRef, onInput }: Props) {
  const [activePage, setActivePage] = useState(0);
  const [shiftState, setShiftState] = useState<ShiftState>('off');
  const [suggestions, setSuggestions] = useState<Array<{ label: string; formula: string; prefixLen: number }>>([]);
  const [modifierDisabled, setModifierDisabled] = useState(true);

  // NOTE: 长按/手势相关 ref
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);
  const startYRef = useRef(0);
  // NOTE: 双击检测
  const lastKeyRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  // NOTE: Shift 双击计时
  const shiftLastTapRef = useRef(0);

  // NOTE: popup 相关
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupVariants, setPopupVariants] = useState<string[]>([]);
  const [popupPos, setPopupPos] = useState({ left: 0, top: 0 });
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // NOTE: QWERTY 键的大小写受 Shift 控制
  const isUpper = shiftState !== 'off';

  /** 标准化标点 + 通知父组件 */
  const normAndNotify = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const val = el.value;
    let newVal = val.replace(PUNCT_RE, ch => PUNCT_MAP[ch] || ch);
    newVal = newVal.replace(/''+/g, "'");
    if (newVal !== val) {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      el.value = newVal;
      el.selectionStart = s;
      el.selectionEnd = e;
    }
    onInput?.();
  }, [textareaRef, onInput]);

  /** 向 textarea 插入文本 */
  const vkbInsert = useCallback((text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    document.execCommand('insertText', false, text);
    normAndNotify();
    updateModifierState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textareaRef, normAndNotify]);

  /** 更新修饰键禁用状态 */
  const updateModifierState = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart || 0;
    const prevChar = pos > 0 ? el.value.charAt(pos - 1) : '';
    setModifierDisabled(!/[a-zA-Z]/.test(prevChar));
  }, [textareaRef]);

  /** 刷新建议条 */
  const refreshSuggestions = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart || 0;
    const before = el.value.slice(0, pos);
    const line = before.split('\n').pop() || '';
    setSuggestions(getSuggestions(line));
  }, [textareaRef]);

  // NOTE: 监听 textarea 事件更新修饰键和建议
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = () => { updateModifierState(); refreshSuggestions(); };
    el.addEventListener('input', handler);
    el.addEventListener('click', handler);
    el.addEventListener('keyup', handler);
    return () => {
      el.removeEventListener('input', handler);
      el.removeEventListener('click', handler);
      el.removeEventListener('keyup', handler);
    };
  }, [textareaRef, updateModifierState, refreshSuggestions]);

  /** 显示长按弹出气泡 */
  const showPopup = useCallback((btn: HTMLButtonElement, variants: string[]) => {
    setPopupVariants(variants);
    setActiveVariant(null);
    setPopupVisible(true);
    // NOTE: 定位在按键上方居中（需要在下一帧读取 popup 尺寸）
    requestAnimationFrame(() => {
      const rect = btn.getBoundingClientRect();
      const popup = popupRef.current;
      if (!popup) return;
      const popW = popup.offsetWidth;
      let left = rect.left + rect.width / 2 - popW / 2;
      left = Math.max(4, Math.min(left, window.innerWidth - popW - 4));
      setPopupPos({ left, top: rect.top - popup.offsetHeight - 6 });
    });
  }, []);

  const hidePopup = useCallback(() => {
    setPopupVisible(false);
    setPopupVariants([]);
    setActiveVariant(null);
  }, []);

  /** 根据指针坐标高亮 popup item */
  const highlightPopupItem = useCallback((clientX: number, clientY: number) => {
    const popup = popupRef.current;
    if (!popup) return;
    const items = popup.querySelectorAll<HTMLSpanElement>('.vkb-popup-item');
    let found: string | null = null;
    items.forEach(item => {
      const r = item.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        found = item.dataset.val ?? null;
      }
    });
    setActiveVariant(found);
  }, []);

  // NOTE: pointerdown
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-key]');
    if (!btn) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    activeBtnRef.current = btn;
    isLongPressRef.current = false;
    startYRef.current = e.clientY;
    const key = btn.dataset.key ?? '';

    if (LONG_PRESS_VARIANTS[key]) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        showPopup(btn, LONG_PRESS_VARIANTS[key]);
      }, 250);
    } else if (DOUBLE_TAP_KEYS[key]) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
      }, 250);
    }
  }, [showPopup]);

  // NOTE: pointermove
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isLongPressRef.current && popupVisible) {
      highlightPopupItem(e.clientX, e.clientY);
    }
  }, [popupVisible, highlightPopupItem]);

  // NOTE: pointerup
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const btn = activeBtnRef.current;
    activeBtnRef.current = null;
    if (!btn) return;
    const key = btn.dataset.key ?? '';

    // NOTE: 长按模式（有 popup）——从 popup 获取选择的变体
    if (isLongPressRef.current && popupVisible) {
      highlightPopupItem(e.clientX, e.clientY);
      const popup = popupRef.current;
      let val: string | null = null;
      if (popup) {
        const items = popup.querySelectorAll<HTMLSpanElement>('.vkb-popup-item');
        items.forEach(item => {
          const r = item.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            val = item.dataset.val ?? null;
          }
        });
      }
      hidePopup();
      isLongPressRef.current = false;
      if (val) vkbInsert(val + ' ');
      return;
    }

    // NOTE: UDFBRL/xyzMES 长按（无 popup）——直接输出 X2'
    if (isLongPressRef.current && DOUBLE_TAP_KEYS[key]) {
      isLongPressRef.current = false;
      vkbInsert(key + "2' ");
      return;
    }
    isLongPressRef.current = false;
    hidePopup();

    // NOTE: 短按处理
    if (key === 'switch') {
      setActivePage(p => (p === 0 ? 1 : 0));
      return;
    }

    if (key === 'shift') {
      const now = Date.now();
      setShiftState(prev => {
        if (prev === 'off') {
          shiftLastTapRef.current = now;
          return 'single';
        }
        if (prev === 'single' && (now - shiftLastTapRef.current) < 300) {
          return 'capslock';
        }
        return 'off';
      });
      return;
    }

    // NOTE: 禁用态按键不响应
    if (btn.classList.contains('vkb-disabled')) return;

    if (key === 'backspace') {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? 0;
      if (start > 0) {
        el.focus();
        el.setSelectionRange(start - 1, start);
        document.execCommand('delete', false);
        normAndNotify();
        updateModifierState();
        refreshSuggestions();
      }
      return;
    }

    // NOTE: () 三态——点击(), 下滑[], 上滑{}
    if (key === '()') {
      const dy = e.clientY - startYRef.current;
      const pair = dy > 20 ? '[]' : dy < -20 ? '{}' : '()';
      const el = textareaRef.current;
      if (!el) return;
      const pos = el.selectionStart ?? 0;
      el.focus();
      el.setSelectionRange(pos, pos);
      document.execCommand('insertText', false, pair);
      el.setSelectionRange(pos + 1, pos + 1);
      normAndNotify();
      updateModifierState();
      refreshSuggestions();
      return;
    }

    // NOTE: 滑动手势——仅对面旋转键 UDFBRL 生效
    let ch: string;
    if (FACE_KEYS[key]) {
      const dy = e.clientY - startYRef.current;
      if (dy > 20) {
        ch = key + "' ";
      } else if (dy < -20) {
        ch = key.toLowerCase() + ' ';
      } else {
        ch = btn.dataset.val || key;
      }
    } else {
      ch = btn.dataset.val || (key === 'enter' ? '\n' : key);
    }

    // NOTE: 快速双击检测
    const now = Date.now();
    if (DOUBLE_TAP_KEYS[key] && key === lastKeyRef.current && (now - lastKeyTimeRef.current) < 300) {
      const el = textareaRef.current;
      if (el) {
        const pos = el.selectionStart ?? 0;
        const prevText = el.value.slice(0, pos);
        const re = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
        const match = re.exec(prevText);
        if (match) {
          el.focus();
          el.setSelectionRange(pos - match[0].length, pos);
          const doubleTapOut = key === '/' ? ' // ' : key + '2 ';
          document.execCommand('insertText', false, doubleTapOut);
          normAndNotify();
        }
      }
      lastKeyRef.current = '';
      lastKeyTimeRef.current = 0;
    } else {
      vkbInsert(ch);
      lastKeyRef.current = key;
      lastKeyTimeRef.current = now;
    }

    // NOTE: 单次 shift 模式——输入一个字母后自动回小写
    if (/^[a-zA-Z]$/.test(key)) {
      setShiftState(prev => prev === 'single' ? 'off' : prev);
    }
    updateModifierState();
    refreshSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textareaRef, popupVisible, vkbInsert, hidePopup, highlightPopupItem, normAndNotify, updateModifierState, refreshSuggestions]);

  /** 点击建议按钮——删除已输入前缀，插入完整公式 */
  const handleSuggestionClick = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.vkb-suggest-btn');
    if (!btn) return;
    const formula = btn.dataset.formula ?? '';
    const prefixLen = parseInt(btn.dataset.prefixLen ?? '0', 10);

    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const line = before.split('\n').pop() || '';
    const tokens = tokenizeFormula(line);
    const prefixTokens = tokens.slice(-prefixLen);

    // NOTE: 从字符串末尾找到前缀 token 序列的起始位置
    const searchIn = line.trimEnd();
    const re = new RegExp(
      prefixTokens.map(t => t.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[\\s]+') + '[\\s]*$'
    );
    const match = re.exec(searchIn);
    if (!match) {
      vkbInsert(formula);
      setSuggestions([]);
      return;
    }

    let deleteCount = searchIn.length - match.index;
    deleteCount += (line.length - searchIn.length);

    el.focus();
    el.setSelectionRange(pos - deleteCount, pos);
    document.execCommand('insertText', false, formula);
    normAndNotify();
    updateModifierState();
    setSuggestions([]);
  }, [textareaRef, vkbInsert, normAndNotify, updateModifierState]);

  // NOTE: touchstart 阻止默认行为
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button[data-key]')) {
      e.preventDefault();
    }
  }, []);

  // NOTE: 全局 pointerup——popup 外松开时关闭
  useEffect(() => {
    const handler = () => {
      if (isLongPressRef.current) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        hidePopup();
        isLongPressRef.current = false;
        if (activeVariant) vkbInsert(activeVariant + ' ');
      }
    };
    document.addEventListener('pointerup', handler);
    return () => document.removeEventListener('pointerup', handler);
  }, [activeVariant, hidePopup, vkbInsert]);

  // NOTE: 全局 pointermove——支持手指从按键滑到 popup 区域
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (isLongPressRef.current && popupVisible) {
        highlightPopupItem(e.clientX, e.clientY);
      }
    };
    document.addEventListener('pointermove', handler);
    return () => document.removeEventListener('pointermove', handler);
  }, [popupVisible, highlightPopupItem]);

  // ── 渲染 ──

  /** 生成 QWERTY 行按键文本（根据 Shift 状态切换大小写） */
  const qwertyKey = (k: string) => isUpper ? k.toUpperCase() : k;

  return (
    <div>
      {/* 联想建议条 */}
      {suggestions.length > 0 && (
        <div className="vkb-suggest-bar" onPointerDown={handleSuggestionClick}>
          {suggestions.map(s => (
            <button
              key={s.label}
              type="button"
              className="vkb-suggest-btn"
              data-formula={s.formula}
              data-prefix-len={s.prefixLen}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* 键盘主体 */}
      <div
        className="vkb"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
      >
        {/* 第 0 页——魔方公式符号 */}
        <div className="vkb-page" style={{ display: activePage === 0 ? undefined : 'none' }}>
          <div className="vkb-row">
            <button type="button" data-key="U">U</button>
            <button type="button" data-key="D">D</button>
            <button type="button" data-key="F">F</button>
            <button type="button" data-key="B">B</button>
            <button type="button" data-key="R">R</button>
            <button type="button" data-key="L">L</button>
          </div>
          <div className="vkb-row">
            <button type="button" data-key="' " className={modifierDisabled ? 'vkb-disabled' : ''}>{'\''}
            </button>
            <button type="button" data-key="2">2</button>
            <button type="button" data-key="w " className={modifierDisabled ? 'vkb-disabled' : ''}>w</button>
            <button type="button" data-key="/">/</button>
            <button type="button" data-key="()" style={{ flex: 2 }}>()</button>
          </div>
          <div className="vkb-row">
            <button type="button" data-key="x">x</button>
            <button type="button" data-key="y">y</button>
            <button type="button" data-key="z">z</button>
            <button type="button" data-key="M">M</button>
            <button type="button" data-key="E">E</button>
            <button type="button" data-key="S">S</button>
            <button type="button" data-key="+">+</button>
            <button type="button" data-key="-">-</button>
          </div>
          <div className="vkb-row vkb-row-bottom">
            <button type="button" data-key="switch" className="vkb-fn">🌐</button>
            <button type="button" data-key=" " className="vkb-space">space</button>
            <button type="button" data-key="enter" className="vkb-return">return</button>
            <button type="button" data-key="backspace" className="vkb-fn vkb-fn-del">
              <svg width="24" height="16" viewBox="0 0 33 22">
                <path d="M12.5 1h17A2.5 2.5 0 0 1 32 3.5v15a2.5 2.5 0 0 1-2.5 2.5h-17a2.5 2.5 0 0 1-1.77-.73l-9.5-9.5a1 1 0 0 1 0-1.41l9.5-9.5A2.5 2.5 0 0 1 12.5 1Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M17 7l8 8M25 7l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          {/* 触发器 */}
          <div className="vkb-triggers" style={{ paddingTop: 4 }}>
            <button type="button" className="vkb-trigger-btn" data-key="trigger-sexy" data-val="R U R' U' ">sexy</button>
            <button type="button" className="vkb-trigger-btn" data-key="trigger-unsexy" data-val="R U' R' U ">unsexy</button>
            <button type="button" className="vkb-trigger-btn" data-key="trigger-sledge" data-val="R' F R F' ">sledge</button>
            <button type="button" className="vkb-trigger-btn" data-key="trigger-hedge" data-val="F R' F' R ">hedge</button>
          </div>
        </div>

        {/* 第 1 页——QWERTY 英文键盘 */}
        <div className="vkb-page" style={{ display: activePage === 1 ? undefined : 'none' }}>
          <div className="vkb-row">
            {['q','w','e','r','t','y','u','i','o','p'].map(k => (
              <button key={k} type="button" data-key={qwertyKey(k)}>{qwertyKey(k)}</button>
            ))}
          </div>
          <div className="vkb-row">
            <div className="vkb-spacer" style={{ flex: 0.5 }} />
            {['a','s','d','f','g','h','j','k','l'].map(k => (
              <button key={k} type="button" data-key={qwertyKey(k)}>{qwertyKey(k)}</button>
            ))}
            <div className="vkb-spacer" style={{ flex: 0.5 }} />
          </div>
          <div className="vkb-row">
            <button
              type="button"
              data-key="shift"
              className={`vkb-fn vkb-shift ${shiftState === 'single' ? 'vkb-shift-on' : ''} ${shiftState === 'capslock' ? 'vkb-shift-on vkb-capslock' : ''}`}
            >
              {/* NOTE: Shift 图标用简单 SVG 代替外部引用 */}
              <svg width="20" height="20" viewBox={shiftState === 'capslock' ? '0 0 24 28' : '0 0 24 24'}>
                <path d="M12 3L2 14h5v6h10v-6h5L12 3z"
                  fill={shiftState !== 'off' ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.5" />
                {shiftState === 'capslock' && (
                  <line x1="4" y1="26" x2="20" y2="26" stroke="currentColor" strokeWidth="2" />
                )}
              </svg>
            </button>
            {['z','x','c','v','b','n','m'].map(k => (
              <button key={k} type="button" data-key={qwertyKey(k)}>{qwertyKey(k)}</button>
            ))}
            <button type="button" data-key="backspace" className="vkb-fn vkb-fn-del">
              <svg width="24" height="16" viewBox="0 0 33 22">
                <path d="M12.5 1h17A2.5 2.5 0 0 1 32 3.5v15a2.5 2.5 0 0 1-2.5 2.5h-17a2.5 2.5 0 0 1-1.77-.73l-9.5-9.5a1 1 0 0 1 0-1.41l9.5-9.5A2.5 2.5 0 0 1 12.5 1Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M17 7l8 8M25 7l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="vkb-row vkb-row-bottom">
            <button type="button" data-key="switch" className="vkb-fn">🌐</button>
            <button type="button" data-key=" " className="vkb-space">space</button>
            <button type="button" data-key="enter" className="vkb-return">return</button>
          </div>
        </div>
      </div>

      {/* 手势说明 */}
      <p className="vkb-gesture-hint">
        <span><em>{t('点击', 'tap')}</em> R</span>
        <span><em>{t('下滑', 'slide down')}</em> R&apos;</span>
        <span><em>{t('上滑', 'slide up')}</em> r</span>
        <span><em>{t('双击', 'double tap')}</em> R2</span>
        <span><em>{t('长按', 'hold')}</em> R2&apos;</span>
        <span><em>{t('()下滑/上滑', '() down/up')}</em> []/{'{ }'}</span>
      </p>

      {/* 长按弹出气泡（portal 到 body） */}
      {popupVisible && (
        <div
          ref={popupRef}
          className="vkb-popup"
          style={{ left: popupPos.left, top: popupPos.top }}
        >
          {popupVariants.map(v => (
            <span
              key={v}
              className={`vkb-popup-item ${activeVariant === v ? 'active' : ''}`}
              data-val={v}
            >
              {v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
