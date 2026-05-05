// NOTE: /calc 页交互回归脚本 — 每次改 calc 相关代码后必跑
//
// 用法（Claude Code 自动化）:
//   1. 浏览器导航到 http://localhost:5173/calc?lang=zh&event=333
//   2. browser_evaluate 这个文件全部内容（IIFE，返回 { passed, failed, failures }）
//   3. failed > 0 → 修，再跑
//
// 覆盖范围（各 bug 历史 → 锁住）:
//   T1 — DOM 顺序: ☑️ → 头像 → 目标 → #1~#5
//   T2 — 键盘 auto-advance + zigzag (target_A → target_B → #1_A → #1_B → ...)
//   T3 — 键盘 Backspace 反向 zigzag 回到 target
//   T4 — Numpad 在 tavg 输数字 → 写 targetAvg（不是 P0 #1）
//   T5 — Numpad Backspace 在 tavg 上清 tavg（不是清前一个 time-cell）
//   T6 — Numpad DNF 在 tavg → tavg=DNF
//   T7 — 任意时刻 .cell-synced 只在一个格子上

(async () => {
  const failures = [];
  let passed = 0;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  // 等 React 渲染 + requestAnimationFrame 排队的 nav 跑完
  const settle = async () => {
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await wait(50);
  };
  const check = (cond, msg) => { if (cond) passed++; else failures.push(msg); };

  const store = globalThis.__calcStore;
  if (!store) return { passed: 0, failed: 1, failures: ['__calcStore not exposed - dev mode only'] };

  const reset = () => {
    store.getState().resetAll();
    store.getState().clearTargetAvgs();
  };
  const setBoth = (both) => {
    const cbs = document.querySelectorAll('.player-toggle');
    if (!cbs[0].checked) cbs[0].click();
    if (cbs[1].checked !== both) cbs[1].click();
  };
  const focusedInfo = () => {
    const a = document.activeElement;
    if (!a || a.tagName !== 'INPUT') return { kind: 'none' };
    const isTavg = a.classList.contains('tavg-cell');
    const list = isTavg
      ? Array.from(document.querySelectorAll('.input-row .tavg-cell'))
      : Array.from(document.querySelectorAll('.input-row .time-cell:not(.tavg-cell)'));
    return { kind: isTavg ? 'tavg' : 'time', idx: list.indexOf(a), val: a.value };
  };
  const focusTavg = (p) => {
    const tavgs = document.querySelectorAll('.input-row .tavg-cell');
    tavgs[p].focus();
    tavgs[p].select();
  };
  const focusCell = (p, t) => {
    const cells = document.querySelectorAll('.input-row .time-cell:not(.tavg-cell)');
    const sc = store.getState().solveCount();
    cells[p * sc + t].focus();
    cells[p * sc + t].select();
  };
  const pressKey = (key) => {
    const a = document.activeElement;
    if (!a) return;
    a.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  };
  const numpad = (label) => {
    const btns = Array.from(document.querySelectorAll('.np-btn'));
    if (label === 'BS') {
      const bs = btns.find(b => b.querySelector('svg path[d*="M11"]'));
      if (!bs) throw new Error('backspace btn not found');
      bs.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      bs.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      return;
    }
    if (label === 'EN') {
      btns.find(b => b.classList.contains('np-enter'))?.click();
      return;
    }
    btns.find(b => b.textContent?.trim() === label)?.click();
  };

  // ── T1: DOM 顺序 ──
  reset();
  setBoth(true);
  await wait(30);
  {
    const row = document.querySelector('.input-row');
    const order = Array.from(row.children).map(c => {
      if (c.tagName === 'INPUT' && c.type === 'checkbox') return 'CB';
      if (c.tagName === 'BUTTON') return 'AVATAR';
      const inp = c.querySelector('input');
      if (!inp) return '?';
      if (inp.classList.contains('tavg-cell')) return 'TARGET';
      return inp.placeholder || '?';
    });
    check(
      JSON.stringify(order) === JSON.stringify(['CB', 'AVATAR', 'TARGET', '#1', '#2', '#3', '#4', '#5']),
      `T1 DOM order: ${JSON.stringify(order)}`
    );
  }

  // ── T2: 键盘 auto-advance + zigzag (含 tavg) ──
  reset();
  setBoth(true);
  await wait(30);
  focusTavg(0);
  await wait(30);
  pressKey('7'); pressKey('7'); pressKey('7');
  await wait(50);
  {
    const s = store.getState();
    check(s.targetAvgs[0] === 777, `T2.1 target_A=777, got ${s.targetAvgs[0]}`);
    const f = focusedInfo();
    check(f.kind === 'tavg' && f.idx === 1, `T2.1 focus → tavg_B, got ${JSON.stringify(f)}`);
  }
  pressKey('8'); pressKey('8'); pressKey('8');
  await wait(50);
  {
    const s = store.getState();
    check(s.targetAvgs[1] === 888, `T2.2 target_B=888, got ${s.targetAvgs[1]}`);
    const f = focusedInfo();
    check(f.kind === 'time' && f.idx === 0, `T2.2 focus → #1_A, got ${JSON.stringify(f)}`);
  }
  pressKey('5'); pressKey('5'); pressKey('5');
  await wait(50);
  {
    const s = store.getState();
    check(s.times[0][0] === 555, `T2.3 P0 #1=555, got ${s.times[0][0]}`);
    const f = focusedInfo();
    check(f.kind === 'time' && f.idx === 5, `T2.3 focus → #1_B, got ${JSON.stringify(f)}`);
  }

  // ── T3: 键盘 Backspace 反向 zigzag 包括 tavg ──
  // 当前 focus = #1_B(空), 全选/空 backspace → prevCell(1,0,both)=[0,0]=#1_A
  pressKey('Backspace');
  await settle();
  {
    const f = focusedInfo();
    check(f.kind === 'time' && f.idx === 0, `T3.1 BS empty #1_B → #1_A, got ${JSON.stringify(f)}`);
  }
  // #1_A 有 5.55, onFocus 全选, BS → 清 + prev
  pressKey('Backspace');
  await settle();
  {
    const s = store.getState();
    check(s.times[0][0] === 0, `T3.2 BS clears #1_A, got ${s.times[0][0]}`);
    const f = focusedInfo();
    // prevCell(0, 0, both): p===0, t>-1 → [1, -1] = tavg_B
    check(f.kind === 'tavg' && f.idx === 1, `T3.2 focus → tavg_B, got ${JSON.stringify(f)}`);
  }
  // tavg_B 有 8.88, onFocus 全选, BS → 清 + prev
  pressKey('Backspace');
  await settle();
  {
    const s = store.getState();
    check(!s.targetAvgs[1], `T3.3 BS clears tavg_B, got ${s.targetAvgs[1]}`);
    const f = focusedInfo();
    // prevCell(1, -1, both): p===1 → [0, -1] = tavg_A
    check(f.kind === 'tavg' && f.idx === 0, `T3.3 focus → tavg_A, got ${JSON.stringify(f)}`);
  }

  // ── T4: Numpad 数字在 tavg 上写 targetAvg（不是 P0 #1）──
  reset();
  setBoth(true);
  await wait(30);
  focusTavg(0);
  await wait(30);
  numpad('7'); numpad('7'); numpad('7');
  await wait(100);
  {
    const s = store.getState();
    check(s.targetAvgs[0] === 777, `T4 numpad 777 → target_A=777, got ${s.targetAvgs[0]}`);
    check(s.times[0][0] === 0, `T4 numpad on tavg must NOT write P0 #1, got ${s.times[0][0]}`);
    const f = focusedInfo();
    check(f.kind === 'tavg' && f.idx === 1, `T4 focus → tavg_B, got ${JSON.stringify(f)}`);
  }

  // ── T5: Numpad Backspace 在 tavg 清 tavg ──
  // 当前: tavg_A=777, focus on tavg_B(空). 先 focus 回 tavg_A
  focusTavg(0);
  await wait(50);
  numpad('BS');
  await wait(100);
  {
    const s = store.getState();
    check(!s.targetAvgs[0], `T5 numpad BS clears tavg_A, got ${s.targetAvgs[0]}`);
  }

  // ── T6: Numpad DNF 在 tavg ──
  reset();
  setBoth(true);
  await wait(30);
  focusTavg(0);
  await wait(30);
  numpad('DNF');
  await wait(100);
  {
    const s = store.getState();
    check((s.targetAvgs[0] || 0) >= 100000, `T6 numpad DNF on tavg → DNF, got ${s.targetAvgs[0]}`);
  }

  // ── T7: 任意时刻 cell-synced 只 1 个 ──
  reset();
  setBoth(true);
  await wait(30);
  focusCell(0, 0);
  await wait(30);
  pressKey('5'); pressKey('5'); pressKey('5');
  await wait(30);
  pressKey('3'); pressKey('3'); pressKey('3');
  await wait(50);
  {
    const sync = Array.from(document.querySelectorAll('.input-row .time-cell.cell-synced'));
    check(sync.length === 1, `T7 cell-synced count: expected 1, got ${sync.length}`);
  }

  return { passed, failed: failures.length, failures };
})()
