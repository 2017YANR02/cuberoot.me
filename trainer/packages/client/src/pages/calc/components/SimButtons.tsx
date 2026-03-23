// NOTE: 模拟按钮 + win count badge + ⓘ 信息弹窗
// 从 app.js#289-293, #624-795, index.html#36-104 1:1 迁移
// 功能：🎯 A/🎯 B 单选手模拟 + ⚔️ Race 对决 + rand-fill + Clear + ⓘ 弹窗

import { useState, useCallback } from 'react';
import { useCalcStore } from '../stores/calc_store';
import { sampleOneSolve, simulateForPlayer, simulateRace, type SimResult } from '../engine/sim_engine';

// NOTE: 格式化计数徽章文本
// 'geo' 模式：×N (p=X%)
// 'winrate' 模式：62.3%
function formatBadge(count: number, mode: 'geo' | 'winrate', prob?: number): string {
  if (mode === 'winrate') {
    const pct = count * 100;
    return pct >= 1 ? pct.toFixed(1) + '%' : pct.toFixed(2) + '%';
  }
  let text = '×' + count.toLocaleString();
  if (prob !== undefined && prob > 0) {
    const pct2 = prob * 100;
    const pStr = pct2 >= 1 ? pct2.toFixed(1) : pct2.toFixed(2);
    text += ' (p=' + pStr + '%)';
  }
  return text;
}

export function SimButtons() {
  const state = useCalcStore();
  const sc = state.solveCount();

  // NOTE: 徽章状态 — 每个按钮旁的计数/胜率显示
  const [badgeA, setBadgeA] = useState<{ text: string; color: string } | null>(null);
  const [badgeB, setBadgeB] = useState<{ text: string; color: string } | null>(null);
  const [badgeRace, setBadgeRace] = useState<{ text: string; color: string } | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // NOTE: 隐藏所有徽章
  const hideBadges = useCallback(() => {
    setBadgeA(null);
    setBadgeB(null);
    setBadgeRace(null);
  }, []);

  // NOTE: rand-fill — 只填空格，全满时覆盖所有
  const handleRandFill = useCallback(() => {
    // NOTE: 只检查已启用行是否全满（原版 app.js#238-245）
    let allFilled = true;
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!state.times[state.seedOn + p][t]) { allFilled = false; break; }
      }
      if (!allFilled) break;
    }

    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      for (let t = 0; t < sc; t++) {
        if (!allFilled && state.times[state.seedOn + p][t]) continue;
        const cs = sampleOneSolve(p);
        state.updateTime(state.seedOn + p, t, cs);
      }
    }
    state.saveToUrl();
  }, [state, sc]);

  // NOTE: 🎯 A / 🎯 B — 单选手模拟
  const handleSimPlayer = useCallback((p: number) => {
    hideBadges();
    const result: SimResult = simulateForPlayer(p);
    if (result.error) {
      alert(result.error);
      return;
    }
    state.saveToUrl();
    // NOTE: 显示徽章
    if (p === 0 && result.countA !== undefined) {
      setBadgeA({ text: formatBadge(result.countA, 'geo', result.probA), color: '#555' });
    }
    if (p === 1 && result.countB !== undefined) {
      setBadgeB({ text: formatBadge(result.countB, 'geo', result.probB), color: '#555' });
    }
  }, [state, hideBadges]);

  // NOTE: ⚔️ Race — 100K 对决
  const handleRace = useCallback(() => {
    hideBadges();
    const result: SimResult = simulateRace();
    if (result.error) {
      alert(result.error);
      return;
    }
    state.saveToUrl();
    if (result.countA !== undefined) {
      setBadgeA({
        text: formatBadge(result.countA, 'winrate'),
        color: result.winnerA ? '#006400' : '#999',
      });
    }
    if (result.countB !== undefined) {
      setBadgeB({
        text: formatBadge(result.countB, 'winrate'),
        color: result.winnerB ? '#006400' : '#999',
      });
    }
  }, [state, hideBadges]);

  // NOTE: 清空当前 seed 对（原版 app.js#210-223）
  const clearAll = useCallback(() => {
    for (let p = 0; p < 2; p++) {
      const absIdx = state.seedOn + p;
      for (let t = 0; t < sc; t++) {
        state.updateTime(absIdx, t, 0);
      }
    }
    state.clearTargetAvgs();
    state.saveToUrl();
    hideBadges();
  }, [state, sc, hideBadges]);

  return (
    <>
      <div className="controls">
        {/* NOTE: 隐藏 rand-fill 按钮 — numpad Rand 和此处都触发 */}
        <button id="rand-fill" style={{ display: 'none' }} onClick={handleRandFill}>Rand</button>

        <button className="sim-btn sim-a" onClick={() => handleSimPlayer(0)}>
          🎯 A
        </button>
        {badgeA && (
          <span className="sim-count visible" style={{ color: badgeA.color }}>{badgeA.text}</span>
        )}

        <button className="sim-btn sim-b" onClick={() => handleSimPlayer(1)}>
          🎯 B
        </button>
        {badgeB && (
          <span className="sim-count visible" style={{ color: badgeB.color }}>{badgeB.text}</span>
        )}

        <button className="sim-btn sim-race" onClick={handleRace}>
          ⚔️ Race
        </button>
        {badgeRace && (
          <span className="sim-count visible" style={{ color: badgeRace.color }}>{badgeRace.text}</span>
        )}

        {/* NOTE: ⓘ 信息按钮 — 原版 index.html#45 */}
        <span className="rand-info" onClick={() => setShowInfo(true)}>ⓘ</span>
      </div>

      {/* NOTE: ⓘ 方法说明弹窗 — 原版 index.html#48-104 */}
      {showInfo && (
        <div
          className="info-modal-overlay visible"
          onClick={(e) => { if (e.target === e.currentTarget) setShowInfo(false); }}
        >
          <div className="info-modal">
            <button className="info-modal-close" onClick={() => setShowInfo(false)}>&times;</button>
            <div className="info-modal-body">
              <p><strong>📊 PA Bar (right side)</strong> — The vertical bar on the right shows the range from Best
                Possible Avg (BPA, bottom) to Worst Possible Avg (WPA, top). Drag the top or bottom end to
                reverse-calculate what the missing solve needs to be.</p>

              <p><strong>🎲 Rand</strong> — Randomly fill empty cells using <em>Kernel Density Estimation
                (KDE)</em>. For each player, a real solve is randomly sampled from their official Ao100,
                then Gaussian jitter is added (bandwidth from Silverman's rule: h = 0.9·min(σ,
                IQR/1.34)·n<sup>−0.2</sup>). This produces smooth, realistic variance around their actual
                performance. Events without Ao100 data (333fm, 444bf, 555bf) fall back to log-normal
                distribution. If all cells are filled, Rand overwrites all values.</p>

              <p><strong>🎯 A / 🎯 B</strong> — "How many Ao5 rounds until this player beats the Target?"</p>
              <p style={{ marginLeft: 12, marginTop: -8 }}>
                <strong>Step 1 — Estimate p:</strong> 100,000 independent Ao5 sets are sampled using the same
                KDE distribution. Each Ao5 is checked against the Target Avg. The fraction that beat the target
                gives <em>p̂</em> = P(Ao5 ≤ Target).<br />
                <strong>Step 2 — Geometric median:</strong> Each attempt is a Bernoulli trial with success
                probability p. The number of attempts until success follows the <em>Geometric distribution</em>
                Geo(p). Its median is:<br />
                <span style={{ fontFamily: 'serif', fontSize: 15, marginLeft: 12 }}>median = ⌈−ln2 /
                  ln(1−p)⌉</span><br />
                <strong>Step 3 — Display data:</strong> One additional round runs until it beats the target.
                That round's solves are written to the cells.<br />
                <strong>×N</strong> = The theoretical median attempts. <strong>(p=X%)</strong> = The estimated
                probability of beating the target in a single Ao5. A higher p means easier target; lower p means
                harder.
              </p>

              <p><strong>⚔️ Race</strong> — Simulates 100,000 head-to-head Ao5 rounds between A and B.
                Each round, both players independently generate an Ao5 from their KDE distributions; the
                lower Ao5 wins that round. After all rounds, the win rate for each player is displayed
                (draws excluded). The player with the higher win rate appears in green.<br />
                <strong>Requires both players to be loaded</strong> — click the avatar buttons to search
                for WCA players first. KDE uses each player's most recent 100 official singles.</p>

              <p><strong>📈 Improvement Slider (A / B)</strong> — Models hypothetical form change. Range: −20% to +100%.<br />
                • <strong>0%</strong> = current baseline (Ao100 trimmed mean)<br />
                • <strong>+N%</strong> = N% progress toward Target — expected avg shrinks proportionally<br />
                • <strong>−N%</strong> = N% worse than baseline — expected avg grows proportionally</p>

              <p><strong>👤 Avatar Buttons (right of checkbox)</strong> — Search for any WCA player to load
                their personal data.<br />
                Click the avatar on either row to open the search modal. Type a name or WCA ID to find
                a player. Their recent official singles (up to 100) are loaded for KDE sampling, and the
                Target Avg is set to their official average PR.<br />
                When activated (orange glow), that row uses the selected player's data.
                Click again to switch back to world record data.</p>

              <p><strong>⌫ Long press</strong> = Clear All (resets all cells and Target Avg).</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SimButtons;
