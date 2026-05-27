import"./react-BHPi-aqk.js";import{t as e}from"./LangToggle-vbYmiqWE.js";import{t}from"./useTranslation-azoUBVHB.js";import{n}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as r}from"./jsx-runtime-DhG3BTtD.js";import{t as i}from"./dices-Dfi5TE5a.js";import{t as a}from"./infinity-C_Q2nKsH.js";import{t as o}from"./ThemeToggle-D8eVca2B.js";import{t as s}from"./ruler-Dwlosior.js";import{t as c}from"./sigma-CE3LbgL5.js";import{t as l}from"./useDocumentTitle-22a8Ss3G.js";var u=r(),d=[{to:`/math/god`,Icon:a,zh:{title:`上帝之数`,desc:`17 个 WCA 项目的群直径 (精确值 / 上下界) + 群论 + 现场 BFS`},en:{title:`God's number`,desc:`Cayley-graph diameter for all 17 WCA puzzles (exact / bounds) + group theory + live BFS`}},{to:`/math/demigod`,Icon:i,zh:{title:`半神之数`,desc:`Merino & Subercaseaux 2024:用 500k 样本 + Hoeffding 证 D ≤ 36,概率上界互动版`},en:{title:`Demigod's number`,desc:`Merino & Subercaseaux 2024: 500k samples + Hoeffding prove D ≤ 36 — the high-probability bound interactive`}},{to:`/math/group`,Icon:c,zh:{title:`魔方与群`,desc:`群论长文 26 节,25 个互动面板,KaTeX 渲染`},en:{title:`Cube as a group`,desc:`26-section group-theory essay, 25 interactive panels, KaTeX-rendered`}},{to:`/math/unit-distance`,Icon:s,zh:{title:`单位距离问题`,desc:`OpenAI 2026:AI 自主推翻 Erdős 1946 平面单位距离猜想,5 个互动可视化`},en:{title:`Unit distance problem`,desc:`OpenAI 2026: AI autonomously disproves Erdős 1946 planar unit-distance conjecture — 5 interactive visualisations`}}];function f(){let{i18n:r}=t(),i=r.language.startsWith(`zh`);return l(`数学`,`Math`),(0,u.jsxs)(`div`,{className:`math-hub-page`,children:[(0,u.jsx)(`style`,{children:p}),(0,u.jsxs)(`header`,{className:`hub-header`,children:[(0,u.jsx)(`h1`,{children:((e,t)=>i?e:t)(`数学`,`Math`)}),(0,u.jsxs)(`div`,{className:`hub-toggles`,children:[(0,u.jsx)(e,{variant:`inline`}),(0,u.jsx)(o,{})]})]}),(0,u.jsx)(`div`,{className:`hub-grid`,children:d.map(e=>(0,u.jsxs)(n,{to:e.to,className:`hub-card`,children:[(0,u.jsx)(e.Icon,{size:28}),(0,u.jsx)(`div`,{className:`hub-card-title`,children:(i?e.zh:e.en).title}),(0,u.jsx)(`div`,{className:`hub-card-desc`,children:(i?e.zh:e.en).desc})]},e.to))})]})}var p=`
.math-hub-page {
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
  .math-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;export{f as default};