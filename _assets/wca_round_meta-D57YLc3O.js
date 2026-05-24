function e(e){return e>0}var t={h:0,1:1,d:1,2:2,g:2,3:3,sf:3,b:4,c:4,f:5};function n(n,r){let i=new Map(r.map(e=>[e.id,e.start_date])),a=n.slice().sort((e,n)=>{let r=i.get(e.competition_id)??``,a=i.get(n.competition_id)??``;if(r!==a)return r.localeCompare(a);if(e.competition_id!==n.competition_id)return e.competition_id.localeCompare(n.competition_id);let o=t[e.round_type_id]??99,s=t[n.round_type_id]??99;return o===s?e.id-n.id:o-s}),o=new Map,s=new Map,c=new Map,l=(e,t)=>{let n=0;for(let r of t)r<e&&n++;return n+1};for(let t of a){let n=t.event_id,r=null,i=null;if(e(t.best)){let e=s.get(n)??new Set;r=l(t.best,e),e.add(t.best),s.set(n,e)}if(e(t.average)){let e=c.get(n)??new Set;i=l(t.average,e),e.add(t.average),c.set(n,e)}o.set(t.id,{singleRank:r,averageRank:i})}return o}var r={f:0,c:1,b:2,3:3,2:4,g:4,1:5,d:5,h:6},i=`轮次缩写:
R1 / R2 / R3 — 初赛 / 复赛 / 半决赛 (打满 5 把)
Fi — 决赛
C- 前缀 (组合赛制) — 带 cutoff,前几把过线才能继续打完整 Ao5
h — head-to-head 1v1 淘汰 (非 WCA 项目)`,a=`Round abbreviations:
R1 / R2 / R3 — First / Second / Third Round (full attempts)
Fi — Final
C- prefix (Combined) — cutoff format; must beat cutoff in first attempts to continue full Ao5
h — Head-to-head (1v1 elimination, non-WCA)`;function o(e){return{f:`Fi`,c:`C-Fi`,b:`B-Fi`,3:`R3`,2:`R2`,g:`C-R2`,1:`R1`,d:`C-R1`,h:`R1`}[e]??e}function s(e){return e===`f`||e===`c`||e===`b`?`wp-round-final`:e===`3`?`wp-round-semi`:e===`2`||e===`g`?`wp-round-quarter`:`wp-round-first`}export{o as a,s as i,i as n,n as o,r,a as t};