import"./react-BHPi-aqk.js";import"./i18n-kx3ivCG8.js";import{t as e}from"./useTranslation-azoUBVHB.js";import{n as t}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as n}from"./jsx-runtime-DhG3BTtD.js";import{t as r}from"./useDocumentTitle-CfaTL6fp.js";import"./theme-D94cTn7I.js";import{t as i}from"./infinity-DV6hGq0g.js";import{t as a}from"./ThemeToggle-BjTJNp8D.js";import{t as o}from"./sigma-CIPC5lK_.js";import{t as s}from"./LangToggle-egm-oTGS.js";var c=n(),l=[{to:`/math/god`,Icon:i,zh:{title:`上帝之数`,desc:`17 个 WCA 项目的群直径 (精确值 / 上下界) + 群论 + 现场 BFS`},en:{title:`God's number`,desc:`Cayley-graph diameter for all 17 WCA puzzles (exact / bounds) + group theory + live BFS`}},{to:`/math/group`,Icon:o,zh:{title:`魔方与群`,desc:`群论长文 26 节,25 个互动面板,KaTeX 渲染`},en:{title:`Cube as a group`,desc:`26-section group-theory essay, 25 interactive panels, KaTeX-rendered`}}];function u(){let{i18n:n}=e(),i=n.language.startsWith(`zh`);return r(`数学`,`Math`),(0,c.jsxs)(`div`,{className:`math-hub-page`,children:[(0,c.jsx)(`style`,{children:d}),(0,c.jsxs)(`header`,{className:`hub-header`,children:[(0,c.jsx)(`h1`,{children:((e,t)=>i?e:t)(`数学`,`Math`)}),(0,c.jsxs)(`div`,{className:`hub-toggles`,children:[(0,c.jsx)(s,{variant:`inline`}),(0,c.jsx)(a,{})]})]}),(0,c.jsx)(`div`,{className:`hub-grid`,children:l.map(e=>(0,c.jsxs)(t,{to:e.to,className:`hub-card`,children:[(0,c.jsx)(e.Icon,{size:28}),(0,c.jsx)(`div`,{className:`hub-card-title`,children:(i?e.zh:e.en).title}),(0,c.jsx)(`div`,{className:`hub-card-desc`,children:(i?e.zh:e.en).desc})]},e.to))})]})}var d=`
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
`;export{u as default};