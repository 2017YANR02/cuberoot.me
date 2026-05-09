import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./jsx-runtime-CVfOIazI.js";import{f as r,s as i}from"./index-CniPwIe0.js";import{n as a}from"./CubingPreview-By-52xDu.js";import{t as o}from"./sparkles-CIPe-cwn.js";var s=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]],c=[[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]],l=`UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`;function u(e){let t=e.replace(/\s+/g,``).toUpperCase();if(t.length!==54)throw Error(`facelet length ${t.length}, expected 54`);return t}function d(e){let t=u(e),n=t[4]+t[13]+t[22]+t[31]+t[40]+t[49],r=Array(54),i=0;for(let e=0;e<54;e++){let a=n.indexOf(t[e]);if(a===-1)throw Error(`facelet ${e} char '${t[e]}' not in centers '${n}'`);r[e]=a,i+=1<<a*4}if(i!==10066329)throw Error(`facelet color counts != 9 each`);let a=Array(8),o=Array(8),l=Array(12),d=Array(12);for(let e=0;e<8;e++){let t=0;for(;t<3&&!(r[s[e][t]]===0||r[s[e][t]]===3);t++);if(t===3)throw Error(`corner ${e}: no U/D sticker found`);let n=r[s[e][(t+1)%3]],i=r[s[e][(t+2)%3]],c=!1;for(let r=0;r<8;r++)if(n===Math.floor(s[r][1]/9)&&i===Math.floor(s[r][2]/9)){a[e]=r,o[e]=t,c=!0;break}if(!c)throw Error(`corner ${e}: no matching piece for colors (${n},${i})`)}for(let e=0;e<12;e++){let t=!1;for(let n=0;n<12;n++){let i=Math.floor(c[n][0]/9),a=Math.floor(c[n][1]/9);if(r[c[e][0]]===i&&r[c[e][1]]===a){l[e]=n,d[e]=0,t=!0;break}if(r[c[e][0]]===a&&r[c[e][1]]===i){l[e]=n,d[e]=1,t=!0;break}}if(!t)throw Error(`edge ${e}: no matching piece`)}return{cp:a,co:o,ep:l,eo:d}}function f(e){if(new Set(e.cp).size!==8)return`corner permutation not bijective (some piece appears twice)`;if(new Set(e.ep).size!==12)return`edge permutation not bijective (some piece appears twice)`;let t=0;for(let n of e.co)t+=n;if(t%3!=0)return`corner orientation sum ${t} not divisible by 3 (one corner is twisted)`;let n=0;for(let t of e.eo)n+=t;return n%2==0?p(e.cp)===p(e.ep)?null:`corner/edge permutation parity mismatch (single 2-cycle swap is impossible)`:`edge orientation sum ${n} not divisible by 2 (one edge is flipped)`}function p(e){let t=0,n=Array(e.length).fill(!1);for(let r=0;r<e.length;r++){if(n[r])continue;let i=r,a=0;for(;!n[i];)n[i]=!0,i=e[i],a++;a>0&&(t^=a-1&1)}return t}function m(e){let t;try{t=d(e)}catch(e){return e.message}return f(t)}var h=e(t(),1),g=n(),_=[`U`,`R`,`F`,`D`,`L`,`B`],v={U:`#FEFE00`,R:`#00D800`,F:`#EE0000`,D:`#FFFFFF`,L:`#0000F2`,B:`#FFA100`},y={U:[0,1],L:[1,0],F:[1,1],R:[1,2],B:[1,3],D:[2,1]};function b(e,t,n){return _.indexOf(e)*9+t*3+n}function x({facelet:e,onChange:t,activeColor:n,onActiveColorChange:s,pixelSize:c,onSolve:u,solveLabel:d}){let{i18n:f}=r(),p=f.language===`zh`,x=(e,t)=>p?e:t,C=i(),w=(0,h.useMemo)(()=>m(e),[e]),T=Math.max(10,Math.floor(c/13)),E=T*12+16,D=T*9+16,O=[];for(let e of _)for(let t=0;t<3;t++)for(let n=0;n<3;n++)O.push({idx:b(e,t,n),face:e,r:t,c:n});let k=r=>{let i=e.split(``);i[r]=n,t(i.join(``))};return(0,g.jsxs)(`div`,{className:`vc-net-paint`,children:[(0,g.jsx)(`style`,{children:S}),(0,g.jsx)(`div`,{className:`vc-net-canvas`,style:{width:E,height:D},children:O.map(({idx:t,face:n,r,c:i})=>{let[a,o]=y[n],s=8+(o*3+i)*T,c=8+(a*3+r)*T,l=e[t],u=v[l]??`#404040`,d=r===1&&i===1;return(0,g.jsx)(`button`,{type:`button`,className:`vc-net-sticker${d?` is-center`:``}`,style:{left:s,top:c,width:T-1,height:T-1,background:u},onClick:()=>!d&&k(t),disabled:d,title:`${n}${r*3+i+1}`,"aria-label":`Sticker ${n}${r*3+i+1} = ${l}`},t)})}),(0,g.jsxs)(`div`,{className:`vc-net-toolbar`,children:[(0,g.jsxs)(`span`,{className:`vc-net-toolbar-label`,children:[x(`涂色`,`Paint`),`:`]}),_.map(e=>(0,g.jsx)(`button`,{type:`button`,className:`vc-net-swatch${n===e?` is-active`:``}`,style:{background:v[e]},onClick:()=>s(e),title:e,"aria-label":`color ${e}`,children:(0,g.jsx)(`span`,{className:`vc-net-swatch-letter`,children:e})},e)),(0,g.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:()=>t(l),title:x(`重置为还原态`,`Reset to solved`),children:[(0,g.jsx)(a,{size:14}),(0,g.jsx)(`span`,{children:x(`重置`,`Reset`)})]}),(0,g.jsxs)(`button`,{type:`button`,className:`vc-net-btn vc-net-btn-primary`,disabled:!!w||e===`UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`,onClick:()=>{w||(u?u(e):C(`/scramble/solver?state=${e}`))},title:w??x(`用 cubeopt 求最优解`,`Solve optimally with cubeopt`),children:[(0,g.jsx)(o,{size:14}),(0,g.jsx)(`span`,{children:d?p?d.zh:d.en:x(`求最优解`,`Solve`)})]})]}),w&&(0,g.jsxs)(`div`,{className:`vc-net-err`,children:[x(`当前状态非法:`,`Invalid state: `),w]})]})}var S=`
.vc-net-paint {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
}
.vc-net-canvas {
  position: relative;
  background: rgba(255,255,255,0.04);
  border-radius: 6px;
}
.vc-net-sticker {
  position: absolute;
  border: 1px solid rgba(0,0,0,0.5);
  border-radius: 2px;
  padding: 0;
  cursor: crosshair;
  transition: transform 0.08s ease, border-color 0.08s ease;
}
.vc-net-sticker:hover:not(:disabled) {
  transform: scale(1.08);
  border-color: #fff;
  z-index: 1;
}
.vc-net-sticker.is-center {
  cursor: default;
  border-color: rgba(0,0,0,0.7);
}
.vc-net-toolbar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem;
}
.vc-net-toolbar-label {
  font-size: 0.85rem; color: var(--text-muted, #aaa);
}
.vc-net-swatch {
  width: 30px; height: 30px;
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 5px; padding: 0;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.12s ease, transform 0.08s ease;
}
.vc-net-swatch:hover { transform: scale(1.08); }
.vc-net-swatch.is-active {
  border-color: var(--accent, #ff8800);
  box-shadow: 0 0 0 2px rgba(255,136,0,0.3);
}
.vc-net-swatch-letter {
  font-size: 0.75rem; font-weight: 700;
  text-shadow: 0 0 2px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.6);
  color: rgba(0,0,0,0.85);
  pointer-events: none;
}
.vc-net-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: var(--panel-sub, #2a2a2a);
  border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.35rem 0.6rem;
  border-radius: 5px; font-size: 0.8rem; cursor: pointer;
}
.vc-net-btn:hover:not(:disabled) { border-color: var(--accent, #ff8800); }
.vc-net-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.vc-net-btn-primary {
  background: var(--accent, #ff8800); color: #000;
  border-color: var(--accent, #ff8800); font-weight: 600;
}
.vc-net-err {
  font-size: 0.85rem; color: #ff8866;
  text-align: center; max-width: 28rem; line-height: 1.4;
}
`;export{m as i,l as n,d as r,x as t};