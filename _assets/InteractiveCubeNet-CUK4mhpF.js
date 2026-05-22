import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./useTranslation-azoUBVHB.js";import{s as r}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as i}from"./jsx-runtime-DhG3BTtD.js";import{t as a}from"./eraser-DMfpYEys.js";import{t as o}from"./rotate-ccw-BGwBGsMp.js";import{t as s}from"./shuffle-B0Wy1ezN.js";import{t as c}from"./sparkles-CPZ31vBs.js";import{l,r as u}from"./cube-VSt2lJZR.js";var d=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]],f=[[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]],p=`URFDLB`,m=`UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`,h=(()=>{let e=Array.from({length:54},()=>[]);for(let[t,n,r]of d)e[t]=[n,r],e[n]=[t,r],e[r]=[t,n];for(let[t,n]of f)e[t]=[n],e[n]=[t];return e})();function g(e){let t=e.replace(/\s+/g,``).toUpperCase();if(t.length!==54)throw Error(`facelet length ${t.length}, expected 54`);return t}function _(e){let t=g(e),n=t[4]+t[13]+t[22]+t[31]+t[40]+t[49],r=Array(54),i=0;for(let e=0;e<54;e++){let a=n.indexOf(t[e]);if(a===-1)throw Error(`facelet ${e} char '${t[e]}' not in centers '${n}'`);r[e]=a,i+=1<<a*4}if(i!==10066329)throw Error(`facelet color counts != 9 each`);let a=Array(8),o=Array(8),s=Array(12),c=Array(12);for(let e=0;e<8;e++){let t=0;for(;t<3&&!(r[d[e][t]]===0||r[d[e][t]]===3);t++);if(t===3)throw Error(`corner ${e}: no U/D sticker found`);let n=r[d[e][(t+1)%3]],i=r[d[e][(t+2)%3]],s=!1;for(let r=0;r<8;r++)if(n===Math.floor(d[r][1]/9)&&i===Math.floor(d[r][2]/9)){a[e]=r,o[e]=t,s=!0;break}if(!s)throw Error(`corner ${e}: no matching piece for colors (${n},${i})`)}for(let e=0;e<12;e++){let t=!1;for(let n=0;n<12;n++){let i=Math.floor(f[n][0]/9),a=Math.floor(f[n][1]/9);if(r[f[e][0]]===i&&r[f[e][1]]===a){s[e]=n,c[e]=0,t=!0;break}if(r[f[e][0]]===a&&r[f[e][1]]===i){s[e]=n,c[e]=1,t=!0;break}}if(!t)throw Error(`edge ${e}: no matching piece`)}return{cp:a,co:o,ep:s,eo:c}}function v(e){let t=Array(54);for(let e=0;e<54;e++)t[e]=p[Math.floor(e/9)];for(let n=0;n<8;n++){let r=e.cp[n],i=e.co[n];for(let e=0;e<3;e++){let a=d[n][(e+i)%3];t[a]=p[Math.floor(d[r][e]/9)]}}for(let n=0;n<12;n++){let r=e.ep[n],i=e.eo[n];for(let e=0;e<2;e++){let a=f[n][(e+i)%2];t[a]=p[Math.floor(f[r][e]/9)]}}return t.join(``)}function y(e){if(new Set(e.cp).size!==8)return`corner permutation not bijective (some piece appears twice)`;if(new Set(e.ep).size!==12)return`edge permutation not bijective (some piece appears twice)`;let t=0;for(let n of e.co)t+=n;if(t%3!=0)return`corner orientation sum ${t} not divisible by 3 (one corner is twisted)`;let n=0;for(let t of e.eo)n+=t;return n%2==0?b(e.cp)===b(e.ep)?null:`corner/edge permutation parity mismatch (single 2-cycle swap is impossible)`:`edge orientation sum ${n} not divisible by 2 (one edge is flipped)`}function b(e){let t=0,n=Array(e.length).fill(!1);for(let r=0;r<e.length;r++){if(n[r])continue;let i=r,a=0;for(;!n[i];)n[i]=!0,i=e[i],a++;a>0&&(t^=a-1&1)}return t}function x(e){let t;try{t=_(e)}catch(e){return e.message}return y(t)}var S=e(t(),1),C=i(),w=[`U`,`R`,`F`,`D`,`L`,`B`],T={U:`#ffffff`,F:`#44ee00`,R:`#ff0000`,D:`#f4f400`,B:`#2266ff`,L:`#ff8000`},E=`#5a5a5a`,D={U:`D`,D:`U`,R:`L`,L:`R`,F:`B`,B:`F`},O=(()=>{let e=Array(54).fill(`X`);return w.forEach((t,n)=>{e[n*9+4]=t}),e.join(``)})();function k(){let e=[];for(let t=0;t<25;t++){let n=Math.floor(Math.random()*18);if(e.length>0&&Math.floor(n/3)===Math.floor(e[e.length-1]/3)){t--;continue}if(e.length>1&&Math.floor(n/3)%3==Math.floor(e[e.length-1]/3)%3&&Math.floor(n/3)===Math.floor(e[e.length-2]/3)){t--;continue}e.push(n)}return v(u(l(),e))}var A={U:[0,1],L:[1,0],F:[1,1],R:[1,2],B:[1,3],D:[2,1]};function j(e,t,n){return w.indexOf(e)*9+t*3+n}function M({facelet:e,onChange:t,activeColor:i,onActiveColorChange:l,pixelSize:u,onSolve:d,solveLabel:f}){let{i18n:p}=n(),g=p.language===`zh`,_=(e,t)=>g?e:t,v=r(),y=(0,S.useMemo)(()=>e.includes(`X`),[e]),b=(0,S.useMemo)(()=>y?null:x(e),[e,y]),M=(0,S.useMemo)(()=>b?N(b,g):null,[b,g]),F=y||!!M,[I,L]=(0,S.useState)(null),R=(0,S.useRef)(null);(0,S.useEffect)(()=>()=>{R.current&&clearTimeout(R.current)},[]);let z=e=>{L(e),R.current&&clearTimeout(R.current),R.current=setTimeout(()=>L(null),2500)},B=Math.max(10,Math.floor(u/13)),V=B*12+16,H=B*9+16,U=[];for(let e of w)for(let t=0;t<3;t++)for(let n=0;n<3;n++)U.push({idx:j(e,t,n),face:e,r:t,c:n});let W=n=>{if(i!==`X`)for(let t of h[n]){let n=e[t];if(n!==`X`){if(n===i){z(_(`一个角/棱块上不能有重复颜色`,`A piece cannot have two stickers of the same color`));return}if(D[n]===i){z(_(`一个角/棱块上不能同时含相对面颜色(${n} 与 ${i})`,`A piece cannot have opposite-face colors (${n} and ${i})`));return}}}L(null);let r=e.split(``);r[n]=i,t(r.join(``))},G=()=>t(m),K=()=>t(O),q=()=>t(k()),J=()=>{F||(d?d(e):v(`/scramble/solver?state=${e}`))};return(0,C.jsxs)(`div`,{className:`vc-net-paint`,children:[(0,C.jsx)(`style`,{children:P}),(0,C.jsx)(`div`,{className:`vc-net-canvas`,style:{width:V,height:H},children:U.map(({idx:t,face:n,r,c:i})=>{let[a,o]=A[n],s=8+(o*3+i)*B,c=8+(a*3+r)*B,l=e[t],u=l===`X`?E:T[l]??`#404040`,d=r===1&&i===1;return(0,C.jsx)(`button`,{type:`button`,className:`vc-net-sticker${d?` is-center`:``}`,style:{left:s,top:c,width:B-1,height:B-1,background:u},onClick:()=>!d&&W(t),disabled:d,title:`${n}${r*3+i+1}`,"aria-label":`Sticker ${n}${r*3+i+1} = ${l}`},t)})}),(0,C.jsxs)(`div`,{className:`vc-net-toolbar`,children:[(0,C.jsxs)(`span`,{className:`vc-net-toolbar-label`,children:[_(`涂色`,`Paint`),`:`]}),w.map(e=>(0,C.jsx)(`button`,{type:`button`,className:`vc-net-swatch${i===e?` is-active`:``}`,style:{background:T[e]},onClick:()=>l(e),title:e,"aria-label":`color ${e}`,children:(0,C.jsx)(`span`,{className:`vc-net-swatch-letter`,children:e})},e)),(0,C.jsx)(`button`,{type:`button`,className:`vc-net-swatch vc-net-swatch-empty${i===`X`?` is-active`:``}`,style:{background:E},onClick:()=>l(`X`),title:_(`空缺(灰)`,`Empty (gray)`),"aria-label":`empty`,children:(0,C.jsx)(`span`,{className:`vc-net-swatch-letter vc-net-swatch-letter-empty`,children:`?`})},`X`),(0,C.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:K,title:_(`全部置灰(保留中心)`,`Clear all stickers (centers preserved)`),children:[(0,C.jsx)(a,{size:14}),(0,C.jsx)(`span`,{children:_(`清空`,`Empty`)})]}),(0,C.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:G,title:_(`还原到 solved`,`Reset to solved`),children:[(0,C.jsx)(o,{size:14}),(0,C.jsx)(`span`,{children:_(`还原`,`Clean`)})]}),(0,C.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:q,title:_(`随机合法状态(25 步随机 HTM)`,`Random legal state (25 random HTM moves)`),children:[(0,C.jsx)(s,{size:14}),(0,C.jsx)(`span`,{children:_(`随机`,`Random`)})]}),(0,C.jsxs)(`button`,{type:`button`,className:`vc-net-btn vc-net-btn-primary`,disabled:F||e===`UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`,onClick:J,title:M??(y?_(`还有空缺颜色未填`,`Some stickers are still empty`):_(`用 cubeopt 求最优解`,`Solve optimally with cubeopt`)),children:[(0,C.jsx)(c,{size:14}),(0,C.jsx)(`span`,{children:f?g?f.zh:f.en:_(`求最优解`,`Solve`)})]})]}),I&&(0,C.jsx)(`div`,{className:`vc-net-err vc-net-err-flash`,children:I}),M&&!I&&(0,C.jsxs)(`div`,{className:`vc-net-err`,children:[_(`当前状态非法:`,`Invalid state: `),M]})]})}function N(e,t){let n=e=>e,r=e=>e,i=(e,i)=>t?n(e):r(i);return e.includes(`color counts != 9`)?i(`每种颜色必须正好 9 格`,`Each color must appear exactly 9 times`):e.includes(`not in centers`)?i(`出现了非中心色字符`,`Sticker color does not match any center`):e.includes(`corner permutation not bijective`)?i(`某个角块出现两次(或缺失)`,`Some corner piece appears twice or is missing`):e.includes(`edge permutation not bijective`)?i(`某个棱块出现两次(或缺失)`,`Some edge piece appears twice or is missing`):e.includes(`corner orientation sum`)?i(`单个角块被扭了 ±120°(角朝向之和必须是 3 的倍数)`,`A single corner is twisted (corner orientation invariant)`):e.includes(`edge orientation sum`)?i(`单个棱块被翻了(棱翻转之和必须是偶数)`,`A single edge is flipped (edge orientation invariant)`):e.includes(`parity mismatch`)?i(`角棱排列奇偶不一致(只有两个块对调是不可能的)`,`Corner/edge permutation parity mismatch — single 2-cycle swap is impossible`):e.includes(`no matching piece`)&&e.includes(`corner`)?i(`某个角的颜色组合不存在(角必须由相邻 3 个面组成)`,`A corner has colors that cannot belong to any real cubelet`):e.includes(`no matching piece`)&&e.includes(`edge`)?i(`某个棱的颜色组合不存在(棱必须由相邻 2 个面组成)`,`An edge has colors that cannot belong to any real cubelet`):e.includes(`no U/D sticker`)?i(`某个角没有 U/D 面颜色(每个角必须含 U 或 D)`,`A corner has no U/D sticker (every corner must include U or D)`):e}var P=`
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
  color: rgba(0,0,0,0.85);
  pointer-events: none;
}
.vc-net-swatch-letter-empty {
  color: rgba(255,255,255,0.85);
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
.vc-net-err-flash {
  background: rgba(255,80,80,0.12);
  border: 1px solid rgba(255,120,80,0.45);
  color: #ffb38a;
  padding: 0.35rem 0.7rem;
  border-radius: 5px;
  animation: vcNetFlash 0.18s ease-out;
}
@keyframes vcNetFlash {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
`;export{x as a,_ as i,M as n,m as r,O as t};