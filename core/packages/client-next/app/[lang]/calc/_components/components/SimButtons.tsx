'use client';

// NOTE: 模拟按钮 + win count badge + ⓘ 信息弹窗
// 从 app.js#289-293, #624-795, index.html#36-104 1:1 迁移
// 功能：🎯 A/🎯 B 单选手模拟 + ⚔️ Race 对决 + rand-fill + Clear + ⓘ 弹窗

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useCalcStore } from '../stores/calc_store';
import { sampleOneSolve, simulateForPlayer, simulateRace, type SimResult } from '../engine/sim_engine';
import { tr } from '@/i18n/tr';
import i18n from "@/i18n/i18n-client";

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
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
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
        <button id="rand-fill" style={{ display: 'none' }} onClick={handleRandFill}>{tr({ zh: '随机', en: 'Rand',
            zhHant: "隨機"
        })}</button>
        {/* NOTE: 隐藏 clear-all 按钮 — Numpad 长按 ⌫ 联动触发 */}
        <button id="clear-all" style={{ display: 'none' }} onClick={clearAll}>{tr({ zh: '清空', en: 'Clear' })}</button>

        {state.playerEnabled[0] && (
          <>
            <button className="sim-btn sim-a" onClick={() => handleSimPlayer(0)}>
              🎯 A
            </button>
            {badgeA && (
              <span className="sim-count visible" style={{ color: badgeA.color }}>{badgeA.text}</span>
            )}
          </>
        )}

        {state.playerEnabled[1] && (
          <>
            <button className="sim-btn sim-b" onClick={() => handleSimPlayer(1)}>
              🎯 B
            </button>
            {badgeB && (
              <span className="sim-count visible" style={{ color: badgeB.color }}>{badgeB.text}</span>
            )}
          </>
        )}

        {state.playerEnabled[0] && state.playerEnabled[1] && (
          <>
            <button className="sim-btn sim-race" onClick={handleRace}>
              ⚔️ Race
            </button>
            {badgeRace && (
              <span className="sim-count visible" style={{ color: badgeRace.color }}>{badgeRace.text}</span>
            )}
          </>
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
              {i18n.language === 'zh-Hant' ? ((
                                          <>
                                            <p><strong>📊 PA 豎條（右側）</strong> — 右側豎條顯示從最好可能平均（BPA，底部）到最差可能平均（WPA，頂部）的範圍。拖動頂端或底端可反推缺失把數需要達到什麼成績。</p>

                                            <p><strong>🎲 隨機</strong> — 使用<em>核密度估計 (KDE)</em>隨機填充空格。對每位選手，從其官方 Ao100 中隨機取樣一把真實成績，然後疊加高斯擾動（頻寬來自 Silverman 法則：h = 0.9·min(σ, IQR/1.34)·n<sup>−0.2</sup>）。這會在其真實水平附近產生平滑、真實的波動。沒有 Ao100 資料的項目（333fm、444bf、555bf）退回到對數正態分佈。若所有格子已填滿，隨機會覆蓋全部值。</p>

                                            <p><strong>🎯 A / 🎯 B</strong> — "選手平均擊敗目標平均需要多少輪 Ao5？"</p>
                                            <p style={{ marginLeft: 12, marginTop: -8 }}>
                                              <strong>第 1 步 — 估計 p：</strong> 使用相同的 KDE 分佈取樣 10 萬組獨立 Ao5。每組 Ao5 與目標平均比較，擊中目標的比例為 <em>p̂</em> = P(Ao5 ≤ Target)。<br />
                                              <strong>第 2 步 — 幾何分佈中位數：</strong> 每次嘗試是成功機率為 p 的伯努利試驗。直到成功所需的嘗試次數服從<em>幾何分佈</em> Geo(p)。其中位數為：<br />
                                              <span style={{ fontFamily: 'serif', fontSize: 15, marginLeft: 12 }}>median = ⌈−ln2 / ln(1−p)⌉</span><br />
                                              <strong>第 3 步 — 展示資料：</strong> 額外進行一輪直到擊敗目標，將該輪的成績寫入格子。<br />
                                              <strong>×N</strong> = 理論中位數次數。<strong>(p=X%)</strong> = 單輪 Ao5 擊敗目標的估計機率。p 越大目標越容易；越小越難。
                                            </p>

                                            <p><strong>⚔️ Race</strong> — 模擬 A 與 B 之間的 10 萬輪 Ao5 對決。每一輪兩位選手從各自的 KDE 分佈獨立生成 Ao5；較低的 Ao5 贏得該輪。全部輪次後顯示兩位的勝率（平局除外）。勝率較高的一方顯示為綠色。<br />
                                              <strong>需要兩位選手都已載入</strong> — 請先點選頭像按鈕搜尋 WCA 選手。KDE 使用該選手最近 100 把官方單次成績。</p>

                                            <p><strong>📈 進步滑桿（A / B）</strong> — 模擬假設的狀態變化。範圍：−20% 到 +100%。<br />
                                              • <strong>0%</strong> = 當前基線（Ao100 修剪均值）<br />
                                              • <strong>+N%</strong> = 朝目標進步 N% — 期望平均按比例縮小<br />
                                              • <strong>−N%</strong> = 較基線差 N% — 期望平均按比例增大</p>

                                            <p><strong>👤 頭像按鈕（checkbox 右側）</strong> — 搜尋任何 WCA 選手以載入其個人資料。<br />
                                              點選任一行的頭像開啟搜尋彈窗。輸入名字或 WCA ID 查詢選手。載入其最近的官方單次成績（最多 100 把）用於 KDE 取樣，目標平均會被設為該選手的官方平均 PR。<br />
                                              啟用後（橙色光暈）該行使用所選選手的資料。再次點選可切換回世界紀錄資料。</p>

                                            <p><strong>⌫ 長按</strong> = 清空全部（重置所有格子和目標平均）。</p>
                                          </>
                                        )) : (isZh ? (
                                          <>
                                            <p><strong>📊 PA 竖条（右侧）</strong> — 右侧竖条显示从最好可能平均（BPA，底部）到最差可能平均（WPA，顶部）的范围。拖动顶端或底端可反推缺失把数需要达到什么成绩。</p>

                                            <p><strong>🎲 随机</strong> — 使用<em>核密度估计 (KDE)</em>随机填充空格。对每位选手，从其官方 Ao100 中随机采样一把真实成绩，然后叠加高斯扰动（带宽来自 Silverman 法则：h = 0.9·min(σ, IQR/1.34)·n<sup>−0.2</sup>）。这会在其真实水平附近产生平滑、真实的波动。没有 Ao100 数据的项目（333fm、444bf、555bf）退回到对数正态分布。若所有格子已填满，随机会覆盖全部值。</p>

                                            <p><strong>🎯 A / 🎯 B</strong> — "选手平均击败目标平均需要多少轮 Ao5？"</p>
                                            <p style={{ marginLeft: 12, marginTop: -8 }}>
                                              <strong>第 1 步 — 估计 p：</strong> 使用相同的 KDE 分布采样 10 万组独立 Ao5。每组 Ao5 与目标平均比较，击中目标的比例为 <em>p̂</em> = P(Ao5 ≤ Target)。<br />
                                              <strong>第 2 步 — 几何分布中位数：</strong> 每次尝试是成功概率为 p 的伯努利试验。直到成功所需的尝试次数服从<em>几何分布</em> Geo(p)。其中位数为：<br />
                                              <span style={{ fontFamily: 'serif', fontSize: 15, marginLeft: 12 }}>median = ⌈−ln2 / ln(1−p)⌉</span><br />
                                              <strong>第 3 步 — 展示数据：</strong> 额外进行一轮直到击败目标，将该轮的成绩写入格子。<br />
                                              <strong>×N</strong> = 理论中位数次数。<strong>(p=X%)</strong> = 单轮 Ao5 击败目标的估计概率。p 越大目标越容易；越小越难。
                                            </p>

                                            <p><strong>⚔️ Race</strong> — 模拟 A 与 B 之间的 10 万轮 Ao5 对决。每一轮两位选手从各自的 KDE 分布独立生成 Ao5；较低的 Ao5 赢得该轮。全部轮次后显示两位的胜率（平局除外）。胜率较高的一方显示为绿色。<br />
                                              <strong>需要两位选手都已加载</strong> — 请先点击头像按钮搜索 WCA 选手。KDE 使用该选手最近 100 把官方单次成绩。</p>

                                            <p><strong>📈 进步滑杆（A / B）</strong> — 模拟假设的状态变化。范围：−20% 到 +100%。<br />
                                              • <strong>0%</strong> = 当前基线（Ao100 修剪均值）<br />
                                              • <strong>+N%</strong> = 朝目标进步 N% — 期望平均按比例缩小<br />
                                              • <strong>−N%</strong> = 较基线差 N% — 期望平均按比例增大</p>

                                            <p><strong>👤 头像按钮（checkbox 右侧）</strong> — 搜索任何 WCA 选手以加载其个人数据。<br />
                                              点击任一行的头像打开搜索弹窗。输入名字或 WCA ID 查找选手。加载其最近的官方单次成绩（最多 100 把）用于 KDE 采样，目标平均会被设为该选手的官方平均 PR。<br />
                                              激活后（橙色光晕）该行使用所选选手的数据。再次点击可切换回世界纪录数据。</p>

                                            <p><strong>⌫ 长按</strong> = 清空全部（重置所有格子和目标平均）。</p>
                                          </>
                                        ) : (
                                          <>
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
                                          </>
                                        ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default SimButtons;
