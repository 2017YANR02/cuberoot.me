import"./react-BHPi-aqk.js";import"./i18n-CLkWSibr.js";import{t as e}from"./useTranslation-azoUBVHB.js";import{n as t}from"./chunk-LFPYN7LY-5XFbTh5D.js";import{t as n}from"./jsx-runtime-DhG3BTtD.js";import{t as r}from"./createLucideIcon-CPGeTK3n.js";import{t as i}from"./chart-column-CP04zy_B.js";import{t as a}from"./LangToggle-CJ_LhiBJ.js";import{t as o}from"./sparkles-Cq3zV3Qw.js";var s=r(`dices`,[[`rect`,{width:`12`,height:`12`,x:`2`,y:`10`,rx:`2`,ry:`2`,key:`6agr2n`}],[`path`,{d:`m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6`,key:`1o487t`}],[`path`,{d:`M6 18h.01`,key:`uhywen`}],[`path`,{d:`M10 14h.01`,key:`ssrbsk`}],[`path`,{d:`M15 6h.01`,key:`cblpky`}],[`path`,{d:`M18 9h.01`,key:`2061c0`}]]),c=r(`microscope`,[[`path`,{d:`M6 18h8`,key:`1borvv`}],[`path`,{d:`M3 22h18`,key:`8prr45`}],[`path`,{d:`M14 22a7 7 0 1 0 0-14h-1`,key:`1jwaiy`}],[`path`,{d:`M9 14h2`,key:`197e7h`}],[`path`,{d:`M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z`,key:`1bmzmy`}],[`path`,{d:`M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3`,key:`1drr47`}]]),l=n(),u=[{to:`/scramble/stats`,Icon:i,zh:{title:`打乱难度分布`,desc:`WCA 历史 1,200,000 条三阶打乱阶段最优步数分布`},en:{title:`Difficulty Distribution`,desc:`Stage-optimal HTM distribution over 1.2M WCA 3x3 scrambles`}},{to:`/scramble/gen`,Icon:s,zh:{title:`批量生成`,desc:`16 个 WCA 项目的随机状态打乱,带预览图`},en:{title:`Batch Generator`,desc:`Random-state scrambles for 16 WCA events with preview`}},{to:`/scramble/analyzer`,Icon:c,zh:{title:`CFOP 分析器`,desc:`3x3 打乱 → 6 色 cross / F2L / OLL / PLL 完整 CFOP 解`},en:{title:`CFOP Analyzer`,desc:`3x3 scramble → all-color cross / F2L / OLL / PLL CFOP paths`}},{to:`/scramble/solver`,Icon:o,zh:{title:`最优解 (cubeopt)`,desc:`3x3 任意状态最少步公式 — wasm 多线程`},en:{title:`Optimal Solver (cubeopt)`,desc:`Optimal HTM solution for any 3x3 state — multithreaded wasm`}}];function d(){let{i18n:n}=e(),r=n.language===`zh`,i=(e,t)=>r?e:t;return(0,l.jsxs)(`div`,{className:`scramble-hub-page`,children:[(0,l.jsx)(`style`,{children:f}),(0,l.jsxs)(`header`,{className:`hub-header`,children:[(0,l.jsx)(`h1`,{children:i(`打乱`,`Scramble`)}),(0,l.jsx)(a,{variant:`inline`})]}),(0,l.jsx)(`p`,{className:`hub-lead`,children:i(`4 个围绕"打乱"的工具:难度分布、批量生成、CFOP 分析、最优解(cubeopt)。`,`Four tools around scrambles: distribution, batch generation, CFOP analysis, optimal solver (cubeopt).`)}),(0,l.jsx)(`div`,{className:`hub-grid`,children:u.map(e=>(0,l.jsxs)(t,{to:e.to,className:`hub-card`,children:[(0,l.jsx)(e.Icon,{size:28}),(0,l.jsx)(`div`,{className:`hub-card-title`,children:(r?e.zh:e.en).title}),(0,l.jsx)(`div`,{className:`hub-card-desc`,children:(r?e.zh:e.en).desc})]},e.to))})]})}var f=`
.scramble-hub-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  color: var(--text);
}
.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.hub-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.hub-lead {
  color: var(--text-muted, #aaa);
  margin: 0 0 1.5rem;
  line-height: 1.6;
}
.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.hub-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  background: var(--panel, #1f1f1f);
  border: 1px solid var(--border, #333);
  border-radius: 10px;
  color: var(--text);
  text-decoration: none;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.hub-card:hover {
  border-color: var(--accent, #ff8800);
  transform: translateY(-2px);
}
.hub-card-title {
  font-size: 1.15rem;
  font-weight: 600;
}
.hub-card-desc {
  color: var(--text-muted, #aaa);
  font-size: 0.9rem;
  line-height: 1.45;
}
@media (max-width: 480px) {
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;export{d as default};