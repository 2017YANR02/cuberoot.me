import"./react-BHPi-aqk.js";import"./i18n-Bq9LDJhp.js";import{t as e}from"./useTranslation-azoUBVHB.js";import{n as t}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as n}from"./jsx-runtime-DhG3BTtD.js";import"./theme-CCL3-Cd-.js";import{t as r}from"./createLucideIcon-CzqAkZDx.js";import{t as i}from"./chart-column-zwsIqRhk.js";import{t as a}from"./ThemeToggle-BDTVz8gv.js";import{t as o}from"./sparkles-CWy3V8WO.js";import{t as s}from"./LangToggle-9fdnONtj.js";var c=r(`dices`,[[`rect`,{width:`12`,height:`12`,x:`2`,y:`10`,rx:`2`,ry:`2`,key:`6agr2n`}],[`path`,{d:`m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6`,key:`1o487t`}],[`path`,{d:`M6 18h.01`,key:`uhywen`}],[`path`,{d:`M10 14h.01`,key:`ssrbsk`}],[`path`,{d:`M15 6h.01`,key:`cblpky`}],[`path`,{d:`M18 9h.01`,key:`2061c0`}]]),l=r(`microscope`,[[`path`,{d:`M6 18h8`,key:`1borvv`}],[`path`,{d:`M3 22h18`,key:`8prr45`}],[`path`,{d:`M14 22a7 7 0 1 0 0-14h-1`,key:`1jwaiy`}],[`path`,{d:`M9 14h2`,key:`197e7h`}],[`path`,{d:`M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z`,key:`1bmzmy`}],[`path`,{d:`M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3`,key:`1drr47`}]]),u=r(`wand-sparkles`,[[`path`,{d:`m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72`,key:`ul74o6`}],[`path`,{d:`m14 7 3 3`,key:`1r5n42`}],[`path`,{d:`M5 6v4`,key:`ilb8ba`}],[`path`,{d:`M19 14v4`,key:`blhpug`}],[`path`,{d:`M10 2v2`,key:`7u0qdc`}],[`path`,{d:`M7 8H3`,key:`zfb6yr`}],[`path`,{d:`M21 16h-4`,key:`1cnmox`}],[`path`,{d:`M11 3H9`,key:`1obp7u`}]]),d=n(),f=[{to:`/scramble/gen`,Icon:c,zh:{title:`生成`,desc:`17 个 WCA 项目的随机状态打乱,tnoodle 风格 PDF`},en:{title:`Generate`,desc:`Random-state scrambles for 17 WCA events, tnoodle-style PDF`}},{to:`/scramble/solver`,Icon:o,zh:{title:`求解`,desc:`3x3 任意状态最少步公式 — wasm 多线程`},en:{title:`Solve`,desc:`Optimal HTM solution for any 3x3 state — multithreaded wasm`}},{to:`/scramble/analyzer`,Icon:l,zh:{title:`分析`,desc:`3x3 打乱 → 6 色 cross / F2L / OLL / PLL 完整 CFOP 解`},en:{title:`Analyze`,desc:`3x3 scramble → all-color cross / F2L / OLL / PLL CFOP paths`}},{to:`/scramble/stats`,Icon:i,zh:{title:`分布`,desc:`WCA 历史 1,200,000 条三阶打乱阶段最优步数分布`},en:{title:`Distribution`,desc:`Stage-optimal HTM distribution over 1.2M WCA 3x3 scrambles`}},{to:`/scramble/pattern`,Icon:u,zh:{title:`图案`,desc:`著名 3x3 / 4x4 / 5x5 / 6x6 / 7x7 图案集 (棋盘 / 十字 / 立方体中立方等)`},en:{title:`Pattern`,desc:`Famous pretty patterns for 3×3 / 4×4 / 5×5 / 6×6 / 7×7 (checkerboard, cross, cube-in-cube, …)`}}];function p(){let{i18n:n}=e(),r=n.language===`zh`;return(0,d.jsxs)(`div`,{className:`scramble-hub-page`,children:[(0,d.jsx)(`style`,{children:m}),(0,d.jsxs)(`header`,{className:`hub-header`,children:[(0,d.jsx)(`h1`,{children:((e,t)=>r?e:t)(`打乱`,`Scramble`)}),(0,d.jsxs)(`div`,{className:`hub-toggles`,children:[(0,d.jsx)(s,{variant:`inline`}),(0,d.jsx)(a,{})]})]}),(0,d.jsx)(`div`,{className:`hub-grid`,children:f.map(e=>(0,d.jsxs)(t,{to:e.to,className:`hub-card`,children:[(0,d.jsx)(e.Icon,{size:28}),(0,d.jsx)(`div`,{className:`hub-card-title`,children:(r?e.zh:e.en).title}),(0,d.jsx)(`div`,{className:`hub-card-desc`,children:(r?e.zh:e.en).desc})]},e.to))})]})}var m=`
.scramble-hub-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  color: var(--foreground);
}
.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.hub-toggles {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.hub-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.hub-lead {
  color: var(--muted-foreground);
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
  background: var(--card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  color: var(--foreground);
  text-decoration: none;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.hub-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.hub-card-title {
  font-size: 1.15rem;
  font-weight: 600;
}
.hub-card-desc {
  color: var(--muted-foreground);
  font-size: 0.9rem;
  line-height: 1.45;
}
@media (max-width: 480px) {
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;export{p as default};