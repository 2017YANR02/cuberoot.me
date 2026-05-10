import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./useTranslation-azoUBVHB.js";import{s as r}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as i}from"./jsx-runtime-DhG3BTtD.js";import{t as a}from"./createLucideIcon-CPGeTK3n.js";import{n as o}from"./CubingPreview-CjZkAl11.js";import{t as s}from"./shuffle-nlPi11Yx.js";import{t as c}from"./sparkles-Cq3zV3Qw.js";import{l,r as u}from"./cube-B98-QT25.js";var d=a(`eraser`,[[`path`,{d:`M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21`,key:`g5wo59`}],[`path`,{d:`m5.082 11.09 8.828 8.828`,key:`1wx5vj`}]]),f=[[8,9,20],[6,18,38],[0,36,47],[2,45,11],[29,26,15],[27,44,24],[33,53,42],[35,17,51]],p=[[5,10],[7,19],[3,37],[1,46],[32,16],[28,25],[30,43],[34,52],[23,12],[21,41],[50,39],[48,14]],m=`URFDLB`,h=`UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`,g=(()=>{let e=Array.from({length:54},()=>[]);for(let[t,n,r]of f)e[t]=[n,r],e[n]=[t,r],e[r]=[t,n];for(let[t,n]of p)e[t]=[n],e[n]=[t];return e})();function _(e){let t=e.replace(/\s+/g,``).toUpperCase();if(t.length!==54)throw Error(`facelet length ${t.length}, expected 54`);return t}function v(e){let t=_(e),n=t[4]+t[13]+t[22]+t[31]+t[40]+t[49],r=Array(54),i=0;for(let e=0;e<54;e++){let a=n.indexOf(t[e]);if(a===-1)throw Error(`facelet ${e} char '${t[e]}' not in centers '${n}'`);r[e]=a,i+=1<<a*4}if(i!==10066329)throw Error(`facelet color counts != 9 each`);let a=Array(8),o=Array(8),s=Array(12),c=Array(12);for(let e=0;e<8;e++){let t=0;for(;t<3&&!(r[f[e][t]]===0||r[f[e][t]]===3);t++);if(t===3)throw Error(`corner ${e}: no U/D sticker found`);let n=r[f[e][(t+1)%3]],i=r[f[e][(t+2)%3]],s=!1;for(let r=0;r<8;r++)if(n===Math.floor(f[r][1]/9)&&i===Math.floor(f[r][2]/9)){a[e]=r,o[e]=t,s=!0;break}if(!s)throw Error(`corner ${e}: no matching piece for colors (${n},${i})`)}for(let e=0;e<12;e++){let t=!1;for(let n=0;n<12;n++){let i=Math.floor(p[n][0]/9),a=Math.floor(p[n][1]/9);if(r[p[e][0]]===i&&r[p[e][1]]===a){s[e]=n,c[e]=0,t=!0;break}if(r[p[e][0]]===a&&r[p[e][1]]===i){s[e]=n,c[e]=1,t=!0;break}}if(!t)throw Error(`edge ${e}: no matching piece`)}return{cp:a,co:o,ep:s,eo:c}}function y(e){let t=Array(54);for(let e=0;e<54;e++)t[e]=m[Math.floor(e/9)];for(let n=0;n<8;n++){let r=e.cp[n],i=e.co[n];for(let e=0;e<3;e++){let a=f[n][(e+i)%3];t[a]=m[Math.floor(f[r][e]/9)]}}for(let n=0;n<12;n++){let r=e.ep[n],i=e.eo[n];for(let e=0;e<2;e++){let a=p[n][(e+i)%2];t[a]=m[Math.floor(p[r][e]/9)]}}return t.join(``)}function b(e){if(new Set(e.cp).size!==8)return`corner permutation not bijective (some piece appears twice)`;if(new Set(e.ep).size!==12)return`edge permutation not bijective (some piece appears twice)`;let t=0;for(let n of e.co)t+=n;if(t%3!=0)return`corner orientation sum ${t} not divisible by 3 (one corner is twisted)`;let n=0;for(let t of e.eo)n+=t;return n%2==0?x(e.cp)===x(e.ep)?null:`corner/edge permutation parity mismatch (single 2-cycle swap is impossible)`:`edge orientation sum ${n} not divisible by 2 (one edge is flipped)`}function x(e){let t=0,n=Array(e.length).fill(!1);for(let r=0;r<e.length;r++){if(n[r])continue;let i=r,a=0;for(;!n[i];)n[i]=!0,i=e[i],a++;a>0&&(t^=a-1&1)}return t}function S(e){let t;try{t=v(e)}catch(e){return e.message}return b(t)}var C=e(t(),1),w=i(),T=[`U`,`R`,`F`,`D`,`L`,`B`],E={U:`#ffffff`,F:`#44ee00`,R:`#ff0000`,D:`#f4f400`,B:`#2266ff`,L:`#ff8000`},D=`#5a5a5a`,O={U:`D`,D:`U`,R:`L`,L:`R`,F:`B`,B:`F`},k=(()=>{let e=Array(54).fill(`X`);return T.forEach((t,n)=>{e[n*9+4]=t}),e.join(``)})();function A(){let e=[];for(let t=0;t<25;t++){let n=Math.floor(Math.random()*18);if(e.length>0&&Math.floor(n/3)===Math.floor(e[e.length-1]/3)){t--;continue}if(e.length>1&&Math.floor(n/3)%3==Math.floor(e[e.length-1]/3)%3&&Math.floor(n/3)===Math.floor(e[e.length-2]/3)){t--;continue}e.push(n)}return y(u(l(),e))}var j={U:[0,1],L:[1,0],F:[1,1],R:[1,2],B:[1,3],D:[2,1]};function M(e,t,n){return T.indexOf(e)*9+t*3+n}function N({facelet:e,onChange:t,activeColor:i,onActiveColorChange:a,pixelSize:l,onSolve:u,solveLabel:f}){let{i18n:p}=n(),m=p.language===`zh`,_=(e,t)=>m?e:t,v=r(),y=(0,C.useMemo)(()=>e.includes(`X`),[e]),b=(0,C.useMemo)(()=>y?null:S(e),[e,y]),x=(0,C.useMemo)(()=>b?P(b,m):null,[b,m]),N=y||!!x,[I,L]=(0,C.useState)(null),R=(0,C.useRef)(null);(0,C.useEffect)(()=>()=>{R.current&&clearTimeout(R.current)},[]);let z=e=>{L(e),R.current&&clearTimeout(R.current),R.current=setTimeout(()=>L(null),2500)},B=Math.max(10,Math.floor(l/13)),V=B*12+16,H=B*9+16,U=[];for(let e of T)for(let t=0;t<3;t++)for(let n=0;n<3;n++)U.push({idx:M(e,t,n),face:e,r:t,c:n});let W=n=>{if(i!==`X`)for(let t of g[n]){let n=e[t];if(n!==`X`){if(n===i){z(_(`一个角/棱块上不能有重复颜色`,`A piece cannot have two stickers of the same color`));return}if(O[n]===i){z(_(`一个角/棱块上不能同时含相对面颜色(${n} 与 ${i})`,`A piece cannot have opposite-face colors (${n} and ${i})`));return}}}L(null);let r=e.split(``);r[n]=i,t(r.join(``))},G=()=>t(h),K=()=>t(k),q=()=>t(A()),J=()=>{N||(u?u(e):v(`/scramble/solver?state=${e}`))};return(0,w.jsxs)(`div`,{className:`vc-net-paint`,children:[(0,w.jsx)(`style`,{children:F}),(0,w.jsx)(`div`,{className:`vc-net-canvas`,style:{width:V,height:H},children:U.map(({idx:t,face:n,r,c:i})=>{let[a,o]=j[n],s=8+(o*3+i)*B,c=8+(a*3+r)*B,l=e[t],u=l===`X`?D:E[l]??`#404040`,d=r===1&&i===1;return(0,w.jsx)(`button`,{type:`button`,className:`vc-net-sticker${d?` is-center`:``}`,style:{left:s,top:c,width:B-1,height:B-1,background:u},onClick:()=>!d&&W(t),disabled:d,title:`${n}${r*3+i+1}`,"aria-label":`Sticker ${n}${r*3+i+1} = ${l}`},t)})}),(0,w.jsxs)(`div`,{className:`vc-net-toolbar`,children:[(0,w.jsxs)(`span`,{className:`vc-net-toolbar-label`,children:[_(`涂色`,`Paint`),`:`]}),T.map(e=>(0,w.jsx)(`button`,{type:`button`,className:`vc-net-swatch${i===e?` is-active`:``}`,style:{background:E[e]},onClick:()=>a(e),title:e,"aria-label":`color ${e}`,children:(0,w.jsx)(`span`,{className:`vc-net-swatch-letter`,children:e})},e)),(0,w.jsx)(`button`,{type:`button`,className:`vc-net-swatch vc-net-swatch-empty${i===`X`?` is-active`:``}`,style:{background:D},onClick:()=>a(`X`),title:_(`空缺(灰)`,`Empty (gray)`),"aria-label":`empty`,children:(0,w.jsx)(`span`,{className:`vc-net-swatch-letter vc-net-swatch-letter-empty`,children:`?`})},`X`),(0,w.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:K,title:_(`全部置灰(保留中心)`,`Clear all stickers (centers preserved)`),children:[(0,w.jsx)(d,{size:14}),(0,w.jsx)(`span`,{children:_(`清空`,`Empty`)})]}),(0,w.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:G,title:_(`还原到 solved`,`Reset to solved`),children:[(0,w.jsx)(o,{size:14}),(0,w.jsx)(`span`,{children:_(`还原`,`Clean`)})]}),(0,w.jsxs)(`button`,{type:`button`,className:`vc-net-btn`,onClick:q,title:_(`随机合法状态(25 步随机 HTM)`,`Random legal state (25 random HTM moves)`),children:[(0,w.jsx)(s,{size:14}),(0,w.jsx)(`span`,{children:_(`随机`,`Random`)})]}),(0,w.jsxs)(`button`,{type:`button`,className:`vc-net-btn vc-net-btn-primary`,disabled:N||e===`UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB`,onClick:J,title:x??(y?_(`还有空缺颜色未填`,`Some stickers are still empty`):_(`用 cubeopt 求最优解`,`Solve optimally with cubeopt`)),children:[(0,w.jsx)(c,{size:14}),(0,w.jsx)(`span`,{children:f?m?f.zh:f.en:_(`求最优解`,`Solve`)})]})]}),I&&(0,w.jsx)(`div`,{className:`vc-net-err vc-net-err-flash`,children:I}),x&&!I&&(0,w.jsxs)(`div`,{className:`vc-net-err`,children:[_(`当前状态非法:`,`Invalid state: `),x]})]})}function P(e,t){let n=e=>e,r=e=>e,i=(e,i)=>t?n(e):r(i);return e.includes(`color counts != 9`)?i(`每种颜色必须正好 9 格`,`Each color must appear exactly 9 times`):e.includes(`not in centers`)?i(`出现了非中心色字符`,`Sticker color does not match any center`):e.includes(`corner permutation not bijective`)?i(`某个角块出现两次(或缺失)`,`Some corner piece appears twice or is missing`):e.includes(`edge permutation not bijective`)?i(`某个棱块出现两次(或缺失)`,`Some edge piece appears twice or is missing`):e.includes(`corner orientation sum`)?i(`单个角块被扭了 ±120°(角朝向之和必须是 3 的倍数)`,`A single corner is twisted (corner orientation invariant)`):e.includes(`edge orientation sum`)?i(`单个棱块被翻了(棱翻转之和必须是偶数)`,`A single edge is flipped (edge orientation invariant)`):e.includes(`parity mismatch`)?i(`角棱排列奇偶不一致(只有两个块对调是不可能的)`,`Corner/edge permutation parity mismatch — single 2-cycle swap is impossible`):e.includes(`no matching piece`)&&e.includes(`corner`)?i(`某个角的颜色组合不存在(角必须由相邻 3 个面组成)`,`A corner has colors that cannot belong to any real cubelet`):e.includes(`no matching piece`)&&e.includes(`edge`)?i(`某个棱的颜色组合不存在(棱必须由相邻 2 个面组成)`,`An edge has colors that cannot belong to any real cubelet`):e.includes(`no U/D sticker`)?i(`某个角没有 U/D 面颜色(每个角必须含 U 或 D)`,`A corner has no U/D sticker (every corner must include U or D)`):e}var F=`
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
`;export{S as a,v as i,N as n,h as r,k as t};