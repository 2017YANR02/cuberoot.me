'use client';

/**
 * 魔方公式虚拟键盘——1:1 移植自 recon/submit/recon_submit_page.js L542-1032
 * NOTE: 独立 React 组件，通过 ref 操作外部目标(textarea 或 contenteditable div)
 *
 * 功能:
 * - 双页布局(第 0 页魔方符号 + 第 1 页 QWERTY)
 * - 长按变体弹出(2→1-6,触发器→左/右变体)
 * - 上/下滑手势(逆时针/双层转动)
 * - 双击 180°,长按 180°'
 * - iOS Shift 三态(off / single / capslock)
 * - () 三态(点击→(),下滑→[],上滑→{})
 * - 修饰键自动禁用(光标前无字母时 ' 和 w 灰显)
 * - space 左侧 `·` 小键(仅 !enableMarks,即 textarea 场景):短按插 `·`,长按出 ↑↓
 * - 公式联想(前缀匹配 8 条触发器公式)
 * - enableMarks: 在 space 左侧露出"记号"入口,弹出 6 项(下划/波浪/删除/↑/↓/·);
 *   下划/波浪/删除把 caret 前最后一个 token 包成 inline 标签,toggle;
 *   ↑/↓/· 直接插字符。前 3 项仅在 contenteditable target 上生效。
 */
import { useState, useRef, useCallback, useEffect, type RefObject, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cleanAlgText } from '@/lib/alg-autospace';
import './cube_virtual_keyboard.css';

type EditorTarget = HTMLTextAreaElement | HTMLDivElement;

interface Props {
  /** 目标编辑器(textarea 或 contenteditable div)的 ref */
  target: RefObject<EditorTarget | null>;
  /** 输入后的回调(父组件更新统计等) */
  onInput?: () => void;
  /** 启用 space 左侧的"记号"弹层 */
  enableMarks?: boolean;
  /** 键盘展开时挪进来的收起按钮(CubeKeyboardSection 传入),挤在触发器行最右侧省一行空间 */
  toggleButton?: ReactNode;
}

// ── 常量 ──

// NOTE: 长按变体映射——数字 + 触发器 + 面旋转键(变体 / 双层)
const LONG_PRESS_VARIANTS: Record<string, string[]> = {
  '2': ['1', '2', '3', '4', '5', '6'],
  'trigger-sexy': ["R U R' U'", "L' U' L U"],
  'trigger-sledge': ["R' F R F'", "L F' L' F"],
  'trigger-unsexy': ["R U' R' U", "L' U L U'"],
  'trigger-hedge': ["F R' F' R", "F' L F L'"],
  U: ["U'", 'U2', 'u'],
  D: ["D'", 'D2', 'd'],
  F: ["F'", 'F2', 'f'],
  B: ["B'", 'B2', 'b'],
  R: ["R'", 'R2', 'r'],
  L: ["L'", 'L2', 'l'],
  // NOTE: space 左侧的 `·` 小键——短按插 `·`,长按出 ↑↓(走变体 popup 通道,选中插 `↑ ` / `↓ `)
  'dot-mark': ['↑', '↓'],
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
const SUGGEST_ALGS = [
  { label: "R U R' U'", alg: "R U R' U' " },
  { label: "R U' R' U", alg: "R U' R' U " },
  { label: "R' F R F'", alg: "R' F R F' " },
  { label: "F R' F' R", alg: "F R' F' R " },
  { label: "L' U' L U", alg: "L' U' L U " },
  { label: "L' U L U'", alg: "L' U L U' " },
  { label: "L F' L' F", alg: "L F' L' F " },
  { label: "F' L F L'", alg: "F' L F L' " },
];


/** 词法解析——把魔方公式字符串切成 token 数组 */
function tokenizeAlg(str: string): string[] {
  const re = /([UDFBRLMESxyz]w?['2]?)/g;
  const tokens: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(str)) !== null) tokens.push(m[1]);
  return tokens;
}

/** 前缀匹配——从光标前 N 个 token 中找出匹配的公式建议 */
function getSuggestions(inputStr: string) {
  const inputTokens = tokenizeAlg(inputStr);
  const results: Array<{ label: string; alg: string; prefixLen: number }> = [];
  for (const def of SUGGEST_ALGS) {
    const defTokens = tokenizeAlg(def.alg);
    const maxCheck = Math.min(inputTokens.length, defTokens.length - 1);
    for (let n = maxCheck; n >= 1; n--) {
      const tail = inputTokens.slice(-n);
      const prefix = defTokens.slice(0, n);
      if (tail.join(' ') === prefix.join(' ')) {
        results.push({ label: def.label, alg: def.alg, prefixLen: n });
        break;
      }
    }
  }
  return results;
}

// ── target helpers (textarea ↔ contenteditable 兼容) ──

const isCE = (el: EditorTarget): el is HTMLDivElement => !(el instanceof HTMLTextAreaElement);

function getTextBeforeCaret(el: EditorTarget): string {
  if (!isCE(el)) {
    const pos = el.selectionStart ?? 0;
    return el.value.slice(0, pos);
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return el.textContent ?? '';
  const r = sel.getRangeAt(0);
  if (!el.contains(r.endContainer) && r.endContainer !== el) return el.textContent ?? '';
  const range = document.createRange();
  range.selectNodeContents(el);
  range.setEnd(r.endContainer, r.endOffset);
  return range.toString();
}

function focusTarget(el: EditorTarget) {
  el.focus();
  if (isCE(el)) {
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }
}

/** caret 前删 n 个字符 */
function deleteBack(el: EditorTarget, n = 1) {
  if (!isCE(el)) {
    const start = el.selectionStart ?? 0;
    if (start <= 0) return;
    const k = Math.min(n, start);
    el.focus();
    el.setSelectionRange(start - k, start);
    document.execCommand('delete', false);
    return;
  }
  el.focus();
  for (let i = 0; i < n; i++) document.execCommand('delete', false);
}

/** 找 caret 前最后一个 token 的边界,返回 {token, len} 或 null;边界靠 tokenizeAlg 判 */
function findPrevTokenInfo(el: EditorTarget): { token: string; offsetFromCaret: number } | null {
  const before = getTextBeforeCaret(el);
  // NOTE: 取最后一个 token + 它和 caret 之间的空白长度
  const m = /([UDFBRLMESxyz]w?['2]?)(\s*)$/.exec(before);
  if (!m) return null;
  return { token: m[1], offsetFromCaret: m[2].length };
}

/** 把 caret 前最后一个 token 包成 inline 标签;若已被同标签包则去掉(toggle) */
function wrapPrevToken(el: EditorTarget, kind: 'u' | 's' | 'em' | 'wavy'): boolean {
  if (!isCE(el)) return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const info = findPrevTokenInfo(el);
  if (!info) return false;

  // NOTE: 把 caret 倒退 info.offsetFromCaret 个字符,再选中 info.token.length 个字符
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(true);
  // NOTE: setStart/setEnd 不能跨字符 offset 移动整个 DOM,只能在 text node 上。
  // 简化做法:用 selection.modify 来移动 caret 然后 extend selection。
  // 退到 token 末尾(若有空白)
  for (let i = 0; i < info.offsetFromCaret; i++) {
    sel.modify('move', 'backward', 'character');
  }
  // extend 选中整个 token
  for (let i = 0; i < info.token.length; i++) {
    sel.modify('extend', 'backward', 'character');
  }
  // NOTE: 现在 selection 是 token 文本(方向反了:anchor 在右,focus 在左);extractContents 不依赖方向
  const range = sel.getRangeAt(0);
  // 把方向规整(便于 ancestor 检查):若 anchor 在 focus 之后,翻转
  // 实际我们用 range.startContainer / endContainer 即可

  // ── toggle:若 token 已在同种标签内,移除标签 ──
  // NOTE: 项目约定 — 下划=<u>, 波浪=<u class="wavy">, 删除=<s>, 斜体=<em>
  const tagOf = (k: typeof kind): 'u' | 's' | 'em' =>
    k === 's' ? 's' : k === 'em' ? 'em' : 'u';
  const cls = kind === 'wavy' ? 'wavy' : '';
  const startNode = range.startContainer;
  const ancestorMatching = findAncestorMatching(startNode, el, kind);
  if (ancestorMatching) {
    // NOTE: 已包过——unwrap 该祖先节点(只 unwrap,不打散其他 token)
    unwrapNode(ancestorMatching);
    placeCaretAfterText(el, info.token);
    return true;
  }

  // 包裹
  const frag = range.extractContents();
  const wrapper = document.createElement(tagOf(kind));
  if (cls) wrapper.className = cls;
  wrapper.appendChild(frag);
  range.insertNode(wrapper);
  // NOTE: caret 紧贴 inline 元素右边时 Chrome/Safari 会继承样式,继续输入仍然带样式。
  // 解决:确保 wrapper 之后存在一个空格 text node,caret 落在空格之后(text node 内部,非边界)。
  // 公式语法本身就要求 token 间空格,这步不会污染输出。
  const next = wrapper.nextSibling;
  let anchor: Text;
  if (next && next.nodeType === 3 && (next as Text).data.startsWith(' ')) {
    anchor = next as Text;
  } else {
    anchor = document.createTextNode(' ');
    wrapper.parentNode?.insertBefore(anchor, next);
  }
  const after = document.createRange();
  after.setStart(anchor, 1);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  return true;
}

/** 在 root 内沿祖先链找匹配 kind 的元素 */
function findAncestorMatching(node: Node, root: HTMLElement, kind: 'u' | 's' | 'em' | 'wavy'): HTMLElement | null {
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const el = n as HTMLElement;
      const tag = el.tagName.toLowerCase();
      const isWavy = tag === 'u' && el.classList.contains('wavy');
      if (kind === 'u' && tag === 'u' && !isWavy) return el;
      if (kind === 'wavy' && isWavy) return el;
      if (kind === 's' && tag === 's') return el;
      if (kind === 'em' && tag === 'em') return el;
    }
    n = n.parentNode;
  }
  return null;
}

function unwrapNode(node: HTMLElement) {
  const parent = node.parentNode;
  if (!parent) return;
  while (node.firstChild) parent.insertBefore(node.firstChild, node);
  parent.removeChild(node);
}

/** 把 caret 放到 root 内某段文字之后(用于 unwrap 后恢复光标);简化:放到 root 末尾 */
function placeCaretAfterText(root: HTMLElement, _text: string) {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

type ShiftState = 'off' | 'single' | 'capslock';

const MARK_ITEMS: Array<{ key: string; label: ReactNode; tip: string }> = [
  // NOTE: 入口短按 = 下划,所以 popup 里不再列 mark-u
  { key: 'mark-em',    label: <em>U</em>,                tip: 'italic' },
  { key: 'mark-wavy',  label: <u className="wavy">U</u>, tip: 'wavy' },
  { key: 'mark-s',     label: <s>U</s>,                  tip: 'strike' },
  { key: 'mark-up',    label: '↑',   tip: 'up arrow' },
  { key: 'mark-down',  label: '↓',   tip: 'down arrow' },
  { key: 'mark-mid',   label: '·',   tip: 'middle dot' },
];

export default function CubeVirtualKeyboard({ target, onInput, enableMarks = false, toggleButton }: Props) {
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState(0);
  const [shiftState, setShiftState] = useState<ShiftState>('off');
  const [suggestions, setSuggestions] = useState<Array<{ label: string; alg: string; prefixLen: number }>>([]);
  const [modifierDisabled, setModifierDisabled] = useState(true);

  // NOTE: 长按/手势相关 ref
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const marksLongPressRef = useRef(false);
  const [activeMark, setActiveMark] = useState<string | null>(null);
  const activeBtnRef = useRef<HTMLButtonElement | null>(null);
  const startYRef = useRef(0);
  // NOTE: 双击检测
  const lastKeyRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  // NOTE: Shift 双击计时
  const shiftLastTapRef = useRef(0);

  // NOTE: popup 相关(长按变体)
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupVariants, setPopupVariants] = useState<string[]>([]);
  const [popupPos, setPopupPos] = useState({ left: 0, top: 0 });
  const [activeVariant, setActiveVariant] = useState<string | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // NOTE: 记号弹层(独立于长按 popup)
  const [marksPopupVisible, setMarksPopupVisible] = useState(false);
  const [marksPopupPos, setMarksPopupPos] = useState({ left: 0, top: 0 });
  const marksPopupRef = useRef<HTMLDivElement>(null);

  // NOTE: QWERTY 键的大小写受 Shift 控制
  const isUpper = shiftState !== 'off';

  /** 清洗输入 + 通知父组件(只在 textarea 模式下洗)。
   *  规则和键盘输入同一份 —— 撇号只留直撇号、全角折半角、汉字删掉、`//` 注释不动。 */
  const normAndNotify = useCallback(() => {
    const el = target.current;
    if (!el) return;
    if (!isCE(el)) {
      const val = el.value;
      const c = cleanAlgText(val, el.selectionStart ?? 0);
      // `R''` 是敲重了,不是四分之二圈
      const newVal = c.value.replace(/''+/g, "'");
      if (newVal !== val) {
        const cursor = Math.min(c.cursor, newVal.length);
        el.value = newVal;
        el.setSelectionRange(cursor, cursor);
      }
    }
    onInput?.();
  }, [target, onInput]);

  /** 向目标插入文本 */
  const vkbInsert = useCallback((text: string) => {
    const el = target.current;
    if (!el) return;
    focusTarget(el);
    document.execCommand('insertText', false, text);
    normAndNotify();
    updateModifierState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, normAndNotify]);

  /** 更新修饰键禁用状态 */
  const updateModifierState = useCallback(() => {
    const el = target.current;
    if (!el) return;
    const before = getTextBeforeCaret(el);
    const prevChar = before.length > 0 ? before.charAt(before.length - 1) : '';
    setModifierDisabled(!/[a-zA-Z]/.test(prevChar));
  }, [target]);

  /** 刷新建议条 */
  const refreshSuggestions = useCallback(() => {
    const el = target.current;
    if (!el) return;
    const before = getTextBeforeCaret(el);
    const line = before.split('\n').pop() || '';
    setSuggestions(getSuggestions(line));
  }, [target]);

  // NOTE: 监听目标事件更新修饰键和建议
  useEffect(() => {
    const el = target.current;
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
  }, [target, updateModifierState, refreshSuggestions]);

  /** 显示长按弹出气泡 */
  const showPopup = useCallback((btn: HTMLButtonElement, variants: string[]) => {
    setPopupVariants(variants);
    setActiveVariant(null);
    setPopupVisible(true);
    // NOTE: 定位在按键上方居中(需要在下一帧读取 popup 尺寸)
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

  /** 显示记号弹层 */
  const showMarksPopup = useCallback((btn: HTMLButtonElement) => {
    setMarksPopupVisible(true);
    requestAnimationFrame(() => {
      const rect = btn.getBoundingClientRect();
      const popup = marksPopupRef.current;
      if (!popup) return;
      const popW = popup.offsetWidth;
      let left = rect.left + rect.width / 2 - popW / 2;
      left = Math.max(4, Math.min(left, window.innerWidth - popW - 4));
      setMarksPopupPos({ left, top: rect.top - popup.offsetHeight - 6 });
    });
  }, []);

  const hideMarksPopup = useCallback(() => setMarksPopupVisible(false), []);

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

  /** 根据指针坐标高亮 marks popup item */
  const highlightMarksItem = useCallback((clientX: number, clientY: number) => {
    const popup = marksPopupRef.current;
    if (!popup) return;
    const items = popup.querySelectorAll<HTMLSpanElement>('.vkb-popup-item');
    let found: string | null = null;
    items.forEach(item => {
      const r = item.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        found = item.dataset.mk ?? null;
      }
    });
    setActiveMark(found);
  }, []);

  /** 执行一个 mark item 的动作 */
  const handleMarkItem = useCallback((mk: string) => {
    const el = target.current;
    if (!el) return;
    focusTarget(el);
    if (mk === 'mark-u' || mk === 'mark-s' || mk === 'mark-em' || mk === 'mark-wavy') {
      const kind = mk === 'mark-u' ? 'u' : mk === 'mark-s' ? 's' : mk === 'mark-em' ? 'em' : 'wavy';
      wrapPrevToken(el, kind);
      onInput?.();
      return;
    }
    if (mk === 'mark-up')   { vkbInsert('↑ '); return; }
    if (mk === 'mark-down') { vkbInsert('↓ '); return; }
    if (mk === 'mark-mid')  { vkbInsert('·'); return; }
  }, [target, onInput, vkbInsert]);

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

    if (key === 'marks-trigger') {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        marksLongPressRef.current = true;
        showMarksPopup(btn);
      }, 250);
    } else if (LONG_PRESS_VARIANTS[key]) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        showPopup(btn, LONG_PRESS_VARIANTS[key]);
      }, 250);
    } else if (DOUBLE_TAP_KEYS[key]) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
      }, 250);
    }
  }, [showPopup, showMarksPopup]);

  // NOTE: pointermove
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isLongPressRef.current && popupVisible) {
      highlightPopupItem(e.clientX, e.clientY);
    }
    if (isLongPressRef.current && marksPopupVisible) {
      highlightMarksItem(e.clientX, e.clientY);
    }
  }, [popupVisible, marksPopupVisible, highlightPopupItem, highlightMarksItem]);

  // NOTE: pointerup
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    const btn = activeBtnRef.current;
    activeBtnRef.current = null;
    if (!btn) return;
    const key = btn.dataset.key ?? '';

    // NOTE: 长按 marks 弹层——按住拖到选项上松开 = 执行该记号
    if (isLongPressRef.current && marksLongPressRef.current && marksPopupVisible) {
      highlightMarksItem(e.clientX, e.clientY);
      const popup = marksPopupRef.current;
      let mk: string | null = null;
      if (popup) {
        const items = popup.querySelectorAll<HTMLSpanElement>('.vkb-popup-item');
        items.forEach(item => {
          const r = item.getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
            mk = item.dataset.mk ?? null;
          }
        });
      }
      hideMarksPopup();
      setActiveMark(null);
      isLongPressRef.current = false;
      marksLongPressRef.current = false;
      if (mk) handleMarkItem(mk);
      return;
    }

    // NOTE: 长按模式(有变体 popup)——从 popup 获取选择的变体
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

    // NOTE: UDFBRL/xyzMES 长按(无 popup)——直接输出 X2'
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

    // NOTE: Tab 键——派发 Tab keydown 给目标 textarea,由 ReconAutofill 接管(开补全 / 接受高亮项)
    if (key === 'tab') {
      const el = target.current;
      if (el && !isCE(el)) {
        el.focus();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
      }
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

    // NOTE: 短按 marks-trigger = 下划线
    if (key === 'marks-trigger') {
      const el = target.current;
      if (el) {
        focusTarget(el);
        wrapPrevToken(el, 'u');
        onInput?.();
      }
      return;
    }

    // NOTE: 禁用态按键不响应
    if (btn.classList.contains('vkb-disabled')) return;

    if (key === 'backspace') {
      const el = target.current;
      if (!el) return;
      const before = getTextBeforeCaret(el);
      if (before.length > 0) {
        deleteBack(el, 1);
        normAndNotify();
        updateModifierState();
        refreshSuggestions();
      }
      return;
    }

    // NOTE: () / [] 双键——textarea 时点击插入并把光标放到中间;contenteditable 直接插字面;() 上滑 {}
    if (key === '()' || key === '[]') {
      const dy = e.clientY - startYRef.current;
      const pair = key === '()' && dy < -20 ? '{}' : key;
      const el = target.current;
      if (!el) return;
      if (!isCE(el)) {
        const pos = el.selectionStart ?? 0;
        el.focus();
        el.setSelectionRange(pos, pos);
        document.execCommand('insertText', false, pair);
        el.setSelectionRange(pos + 1, pos + 1);
      } else {
        vkbInsert(pair);
      }
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

    // NOTE: 快速双击检测(textarea 模式专属——caret 文本替换难在 contenteditable 上稳)
    const el = target.current;
    const now = Date.now();
    if (el && !isCE(el) && DOUBLE_TAP_KEYS[key] && key === lastKeyRef.current && (now - lastKeyTimeRef.current) < 300) {
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
  }, [target, popupVisible, marksPopupVisible, vkbInsert, hidePopup, hideMarksPopup, showMarksPopup, highlightPopupItem, normAndNotify, updateModifierState, refreshSuggestions]);

  /** 点击建议按钮——删除已输入前缀,插入完整公式 */
  const handleSuggestionClick = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.vkb-suggest-btn');
    if (!btn) return;
    const alg = btn.dataset.alg ?? '';
    const prefixLen = parseInt(btn.dataset.prefixLen ?? '0', 10);

    const el = target.current;
    if (!el) return;
    const before = getTextBeforeCaret(el);
    const line = before.split('\n').pop() || '';
    const tokens = tokenizeAlg(line);
    const prefixTokens = tokens.slice(-prefixLen);

    // NOTE: 从字符串末尾找到前缀 token 序列的起始位置
    const searchIn = line.trimEnd();
    const re = new RegExp(
      prefixTokens.map(t => t.replace(/[.*+?^$()|[\]\\]/g, '\\$&')).join('[\\s]+') + '[\\s]*$'
    );
    const match = re.exec(searchIn);
    if (!match) {
      vkbInsert(alg);
      setSuggestions([]);
      return;
    }

    const deleteCount = (searchIn.length - match.index) + (line.length - searchIn.length);

    if (!isCE(el)) {
      const pos = el.selectionStart ?? 0;
      el.focus();
      el.setSelectionRange(pos - deleteCount, pos);
      document.execCommand('insertText', false, alg);
    } else {
      // NOTE: contenteditable——倒退 deleteCount 字符然后插入
      focusTarget(el);
      deleteBack(el, deleteCount);
      document.execCommand('insertText', false, alg);
    }
    normAndNotify();
    updateModifierState();
    setSuggestions([]);
  }, [target, vkbInsert, normAndNotify, updateModifierState]);

  // NOTE: touchstart 阻止默认行为
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button[data-key]')) {
      e.preventDefault();
    }
  }, []);

  // NOTE: pointerleave——手指离开键盘区域时取消长按计时器
  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // NOTE: 全局 pointerup——popup 外松开时关闭
  useEffect(() => {
    const handler = () => {
      if (isLongPressRef.current) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        if (marksLongPressRef.current) {
          hideMarksPopup();
          if (activeMark) handleMarkItem(activeMark);
          setActiveMark(null);
          marksLongPressRef.current = false;
        } else {
          hidePopup();
          if (activeVariant) vkbInsert(activeVariant + ' ');
        }
        isLongPressRef.current = false;
      }
    };
    document.addEventListener('pointerup', handler);
    return () => document.removeEventListener('pointerup', handler);
  }, [activeVariant, activeMark, hidePopup, hideMarksPopup, vkbInsert, handleMarkItem]);

  // NOTE: 全局 pointermove——支持手指从按键滑到 popup 区域
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (isLongPressRef.current && popupVisible) {
        highlightPopupItem(e.clientX, e.clientY);
      }
      if (isLongPressRef.current && marksPopupVisible) {
        highlightMarksItem(e.clientX, e.clientY);
      }
    };
    document.addEventListener('pointermove', handler);
    return () => document.removeEventListener('pointermove', handler);
  }, [popupVisible, marksPopupVisible, highlightPopupItem, highlightMarksItem]);

  // ── 渲染 ──

  /** 生成 QWERTY 行按键文本(根据 Shift 状态切换大小写) */
  const qwertyKey = (k: string) => isUpper ? k.toUpperCase() : k;

  return (
    <div>
      {/* 联想建议条——始终保留高度,空态防止键盘上移 */}
      <div className="vkb-suggest-bar" onPointerDown={handleSuggestionClick}>
        {suggestions.map(s => (
          <button
            key={s.label}
            type="button"
            className="vkb-suggest-btn"
            data-alg={s.alg}
            data-prefix-len={s.prefixLen}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* 键盘主体 */}
      <div
        className="vkb"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onTouchStart={handleTouchStart}
      >
        {/* 第 0 页——魔方公式符号 */}
        <div className="vkb-page" style={{ display: activePage === 0 ? undefined : 'none' }}>
          <div className="vkb-row">
            <button type="button" className="vkb-key-btn" data-key="U">U</button>
            <button type="button" className="vkb-key-btn" data-key="D">D</button>
            <button type="button" className="vkb-key-btn" data-key="F">F</button>
            <button type="button" className="vkb-key-btn" data-key="B">B</button>
            <button type="button" className="vkb-key-btn" data-key="R">R</button>
            <button type="button" className="vkb-key-btn" data-key="L">L</button>
          </div>
          <div className="vkb-row">
            <button type="button" data-key="' " className={`vkb-key-btn${modifierDisabled ? ' vkb-disabled' : ''}`}>{'\''}
            </button>
            <button type="button" className="vkb-key-btn" data-key="2">2</button>
            <button type="button" data-key="w " className={`vkb-key-btn${modifierDisabled ? ' vkb-disabled' : ''}`}>w</button>
            <button type="button" className="vkb-key-btn" data-key="/">/</button>
            <button type="button" className="vkb-key-btn" data-key="()">()</button>
            <button type="button" className="vkb-key-btn" data-key="[]">[]</button>
          </div>
          <div className="vkb-row">
            <button type="button" className="vkb-key-btn" data-key="x">x</button>
            <button type="button" className="vkb-key-btn" data-key="y">y</button>
            <button type="button" className="vkb-key-btn" data-key="z">z</button>
            <button type="button" className="vkb-key-btn" data-key="M">M</button>
            <button type="button" className="vkb-key-btn" data-key="E">E</button>
            <button type="button" className="vkb-key-btn" data-key="S">S</button>
            <button type="button" className="vkb-key-btn" data-key="+">+</button>
            <button type="button" className="vkb-key-btn" data-key="-">-</button>
          </div>
          <div className="vkb-row vkb-row-bottom">
            <button type="button" data-key="switch" className="vkb-fn vkb-key-btn">🌐</button>
            {enableMarks && (
              <button type="button" data-key="marks-trigger" className="vkb-fn vkb-marks-trigger vkb-key-btn"
                title="tap = underline · hold = more">
                <u>U</u>
              </button>
            )}
            <button type="button" data-key="tab" className="vkb-fn vkb-tab vkb-key-btn">Tab</button>
            {!enableMarks && (
              <button type="button" data-key="dot-mark" data-val="·"
                className="vkb-fn vkb-dot-mark vkb-key-btn" title="hold for ↑↓">·</button>
            )}
            <button type="button" data-key=" " className="vkb-space vkb-key-btn">space</button>
            <button type="button" data-key="enter" className="vkb-return vkb-key-btn">return</button>
            <button type="button" data-key="backspace" className="vkb-fn vkb-fn-del vkb-key-btn">
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
            {toggleButton}
          </div>
        </div>

        {/* 第 1 页——QWERTY 英文键盘 */}
        <div className="vkb-page" style={{ display: activePage === 1 ? undefined : 'none' }}>
          <div className="vkb-row">
            {['q','w','e','r','t','y','u','i','o','p'].map(k => (
              <button key={k} type="button" className="vkb-key-btn" data-key={qwertyKey(k)}>{qwertyKey(k)}</button>
            ))}
          </div>
          <div className="vkb-row">
            <div className="vkb-spacer" style={{ flex: 0.5 }} />
            {['a','s','d','f','g','h','j','k','l'].map(k => (
              <button key={k} type="button" className="vkb-key-btn" data-key={qwertyKey(k)}>{qwertyKey(k)}</button>
            ))}
            <div className="vkb-spacer" style={{ flex: 0.5 }} />
          </div>
          <div className="vkb-row">
            <button
              type="button"
              data-key="shift"
              className={`vkb-fn vkb-shift vkb-key-btn ${shiftState === 'single' ? 'vkb-shift-on' : ''} ${shiftState === 'capslock' ? 'vkb-shift-on vkb-capslock' : ''}`}
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
              <button key={k} type="button" className="vkb-key-btn" data-key={qwertyKey(k)}>{qwertyKey(k)}</button>
            ))}
            <button type="button" data-key="backspace" className="vkb-fn vkb-fn-del vkb-key-btn">
              <svg width="24" height="16" viewBox="0 0 33 22">
                <path d="M12.5 1h17A2.5 2.5 0 0 1 32 3.5v15a2.5 2.5 0 0 1-2.5 2.5h-17a2.5 2.5 0 0 1-1.77-.73l-9.5-9.5a1 1 0 0 1 0-1.41l9.5-9.5A2.5 2.5 0 0 1 12.5 1Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M17 7l8 8M25 7l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <div className="vkb-row vkb-row-bottom">
            <button type="button" data-key="switch" className="vkb-fn vkb-key-btn">🌐</button>
            <button type="button" data-key=" " className="vkb-space vkb-key-btn">space</button>
            <button type="button" data-key="enter" className="vkb-return vkb-key-btn">return</button>
            {toggleButton}
          </div>
        </div>
      </div>

      {/* 手势说明 */}
      <p className="vkb-gesture-hint">
        <span><em>{t('recon.gestureTap', 'tap')}</em> R</span>
        <span><em>{t('recon.gestureDown', 'slide down')}</em> R&apos;</span>
        <span><em>{t('recon.gestureUp', 'slide up')}</em> r</span>
        <span><em>{t('recon.gestureDouble', 'double tap')}</em> R2</span>
        <span><em>{t('recon.gestureHold', 'hold')}</em> R2&apos;</span>
        <span><em>{t('recon.gestureBracket', '() up')}</em> {'{ }'}</span>
      </p>

      {/* 长按弹出气泡(portal 到 body) */}
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

      {/* 记号弹层 */}
      {marksPopupVisible && (
        <div
          ref={marksPopupRef}
          className="vkb-popup vkb-marks-popup"
          style={{ left: marksPopupPos.left, top: marksPopupPos.top }}
        >
          {MARK_ITEMS.map(it => (
            <span
              key={it.key}
              className={`vkb-popup-item ${activeMark === it.key ? 'active' : ''}`}
              title={it.tip}
              data-mk={it.key}
            >
              {it.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
