import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./jsx-runtime-CVfOIazI.js";import{f as r,l as i}from"./index-R7t8N2Ez.js";import{t as a}from"./download-Bbkxm99D.js";import{t as o}from"./LangToggle-CE7OnsKx.js";import{t as s}from"./loader-circle-Dr0GiplR.js";import{t as c}from"./sparkles-CIPe-cwn.js";import{t as l}from"./trash-2-CFH2zskc.js";import{n as u,t as ee}from"./kociemba.worker-9IsYC5tj.js";import{a as d,c as f,l as p,o as te,r as ne,s as re}from"./cube-LTg4F11U.js";import{i as ie,n as m,r as h,t as g}from"./InteractiveCubeNet-Dbgf3xbs.js";var _=e(t(),1),v=n(),y=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],ae=[15,16,17,18,19,20,25,30],oe=[1,5,10,20,50,100];function se(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function b(){let{i18n:e}=r(),t=e.language===`zh`,n=(e,n)=>t?e:n,[b]=i(),[S,ce]=(0,_.useState)(`cube48opt3`),[C,w]=(0,_.useState)(null),[T,E]=(0,_.useState)(`no-solver`),[D,O]=(0,_.useState)(-1),[k,A]=(0,_.useState)(``),[j,M]=(0,_.useState)(``),[N,le]=(0,_.useState)(15),[P,ue]=(0,_.useState)(10),[F,I]=(0,_.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[L,R]=(0,_.useState)(1),[z,B]=(0,_.useState)(null),[V,H]=(0,_.useState)(!1),[de,fe]=(0,_.useState)(m),[pe,me]=(0,_.useState)(`U`),U=(0,_.useRef)(!1),[W,he]=(0,_.useState)(()=>{let e=localStorage.getItem(`cubeopt.autoDownload`);return e===null?!0:e===`1`});(0,_.useEffect)(()=>{localStorage.setItem(`cubeopt.autoDownload`,W?`1`:`0`)},[W]);let G=(0,_.useRef)(!1),K=(0,_.useRef)(null),q=(0,_.useRef)(null),J=(0,_.useRef)(null),ge=(0,_.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),Y=(0,_.useRef)(null);(0,_.useEffect)(()=>{let e=b.get(`scramble`);e&&M(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=b.get(`state`);return t&&X(t).catch(e=>{B(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{Y.current?.terminate(),Y.current=null}},[]);async function X(e){let t=ie(e);if(t){B(n(`非法状态:${t}`,`Invalid state: ${t}`));return}B(n(`状态合法,Kociemba 求解中…`,`State valid, solving with Kociemba…`));let r=h(e);if(re(r)){B(n(`状态已是还原态,无需打乱。`,`State is already solved.`)),M(``);return}Y.current||=new ee;let i=Y.current,a=Date.now(),o=await new Promise((e,t)=>{let n=r=>{r.data?.id===a&&(i.removeEventListener(`message`,n),r.data.ok&&typeof r.data.sol==`string`?e(r.data.sol):t(Error(r.data.err||`kociemba failed`)))};i.addEventListener(`message`,n),i.postMessage({id:a,op:`solve`,state:r})});M(o),B(n(`Kociemba 求出 ${o.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${o.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}(0,_.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return K.current=e,e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();A(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&O(parseInt(n[1],10)/100);return}if(t.code===-2){O(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)t.code===1?(E(`no-solver`),w(null)):(w({name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)}),E(t.code===0?`ready`:`need-init`));else if(t.cmd===`generate table`)t.code===0&&(G.current=!0),E(t.code===0?`ready`:`need-init`),O(-1);else if(t.cmd===`upload table`)t.code===0?E(`ready`):(alert(n(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),E(`need-init`)),O(-1);else if(t.cmd===`start solve`)E(`ready`),O(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=C?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}E(`ready`)}},e.postMessage({cmd:`select solver`,data:S}),()=>{e.terminate(),K.current=null}},[]),(0,_.useEffect)(()=>{K.current&&(E(`busy`),A(``),O(-1),U.current=!1,K.current.postMessage({cmd:`select solver`,data:S}))},[S]),(0,_.useEffect)(()=>{F%L!==0&&R(1)},[F,L]),(0,_.useEffect)(()=>{J.current&&(J.current.scrollTop=J.current.scrollHeight)},[k]);let Z=()=>{T===`need-init`&&(E(`busy`),A(``),K.current?.postMessage({cmd:`generate table`}))},Q=()=>{T===`ready`&&(E(`busy`),K.current?.postMessage({cmd:`download table`}))},_e=()=>q.current?.click(),ve=e=>{let t=e.target.files?.[0];if(t){if(t.name!==C?.table_name){alert(n(`文件名应为 ${C?.table_name}`,`Expected ${C?.table_name}`)),e.target.value=``;return}E(`busy`),O(0),K.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},$=()=>{let e=j.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(n(`打乱不能为空`,`No scrambles`));return}M(e),E(`busy`),A(``),K.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:F,n_group:L,debug:1})},ye=()=>{if(T===`ready`){$();return}if(T===`need-init`){if(!j.split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`)){alert(n(`打乱不能为空`,`No scrambles`));return}U.current=!0,Z()}};(0,_.useEffect)(()=>{if(T===`ready`){if(G.current&&W){G.current=!1;let e=setTimeout(()=>Q(),0);return()=>clearTimeout(e)}G.current=!1,U.current&&(U.current=!1,$())}},[T]);let be=()=>{let e=[];for(let t=0;t<P;t++)e.push(se(N));M(e.join(`
`))},xe=()=>{M(j.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return d(te(f(e)))}catch{return e}}).join(`
`))},Se=(0,_.useMemo)(()=>{let e=[];for(let t=1;t<=F;t++)F%t===0&&e.push(t);return e},[F]),Ce=(()=>{let e=j.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=f(e);return!!ne(p(),t)}catch{return!1}})})();return(0,v.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,v.jsx)(`style`,{children:x}),(0,v.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,v.jsx)(`h1`,{children:n(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,v.jsx)(o,{variant:`inline`})]}),(0,v.jsx)(`p`,{className:`cubeopt-lead`,children:n(`复刻 cs0x7f/cubeopt-wasm: 给定打乱(或状态),用 cube48opt 系列 wasm 求 HTM 最少步解。`,`A React port of cs0x7f/cubeopt-wasm. Given a scramble (or state), find the optimal HTM solution.`)}),!ge&&(0,v.jsx)(`div`,{className:`cubeopt-warn`,children:n(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),z&&(0,v.jsx)(`div`,{className:`cubeopt-info`,children:z}),(0,v.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,v.jsxs)(`div`,{className:`row`,children:[(0,v.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,v.jsx)(`select`,{className:`ctl`,value:S,disabled:T===`busy`,onChange:e=>ce(e.target.value),children:y.map(e=>(0,v.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,v.jsx)(`span`,{className:`size-badge`,children:y.find(e=>e.value===S)?.size})]}),(0,v.jsxs)(`div`,{className:`row`,children:[(0,v.jsx)(`span`,{className:`lbl`,children:n(`Prun 表`,`Prun Table`)}),(0,v.jsx)(`span`,{className:`table-name`,children:C?.table_name??n(`未就绪`,`Not Ready`)}),(0,v.jsxs)(`label`,{className:`auto-dl`,children:[(0,v.jsx)(`input`,{type:`checkbox`,checked:W,onChange:e=>he(e.target.checked)}),(0,v.jsx)(`span`,{children:n(`生成后自动下载`,`Auto-download after gen`)})]}),T===`need-init`&&(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)(`button`,{className:`btn`,onClick:Z,children:n(`生成表`,`Generate Table`)}),(0,v.jsxs)(`button`,{className:`btn`,onClick:_e,children:[(0,v.jsx)(u,{size:14}),` `,n(`上传表`,`Upload Table`)]})]}),T===`ready`&&(0,v.jsxs)(`button`,{className:`btn`,onClick:Q,children:[(0,v.jsx)(a,{size:14}),` `,n(`下载表`,`Download Table`)]}),T===`busy`&&(0,v.jsxs)(`span`,{className:`busy-marker`,children:[(0,v.jsx)(s,{size:14,className:`spinning`}),` `,n(`忙`,`busy`),`…`]}),(0,v.jsx)(`input`,{ref:q,type:`file`,style:{display:`none`},onChange:ve})]}),D>=0&&(0,v.jsx)(`div`,{className:`progress`,children:(0,v.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(D*100)}%`}})})]}),(0,v.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,v.jsxs)(`div`,{className:`row paint-toggle-row`,children:[(0,v.jsx)(`span`,{className:`lbl`,children:n(`从状态`,`From state`)}),(0,v.jsx)(`button`,{className:`btn${V?` is-active`:``}`,onClick:()=>H(e=>!e),title:n(`画一个魔方状态,自动求出对应打乱`,`Paint a cube state, auto-derive a scramble`),children:V?n(`收起`,`Hide`):n(`展开填色`,`Open paint`)}),(0,v.jsx)(`span`,{className:`paint-hint`,children:n(`点击格子 → 上色 → "求 scramble" → 自动填到下面打乱框,再点 Solve 求最优。`,`Click stickers → paint → "Derive scramble" → fills the box below, then Solve for optimal.`)})]}),V&&(0,v.jsx)(`div`,{className:`paint-wrap`,children:(0,v.jsx)(g,{facelet:de,onChange:fe,activeColor:pe,onActiveColorChange:me,pixelSize:360,solveLabel:{zh:`求 scramble`,en:`Derive scramble`},onSolve:e=>{X(e).catch(e=>{B(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))})}})})]}),(0,v.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,v.jsxs)(`div`,{className:`row`,children:[(0,v.jsx)(`span`,{className:`lbl`,children:n(`随机`,`Random`)}),(0,v.jsx)(`select`,{className:`ctl-sm`,value:N,onChange:e=>le(parseInt(e.target.value,10)),children:ae.map(e=>(0,v.jsxs)(`option`,{value:e,children:[e,` `,n(`步`,`moves`)]},e))}),(0,v.jsx)(`select`,{className:`ctl-sm`,value:P,onChange:e=>ue(parseInt(e.target.value,10)),children:oe.map(e=>(0,v.jsxs)(`option`,{value:e,children:[e,` `,n(`个`,`cubes`)]},e))}),(0,v.jsx)(`button`,{className:`btn`,onClick:be,children:n(`生成`,`Random`)}),(0,v.jsx)(`button`,{className:`btn-icon`,onClick:xe,title:n(`每行反向`,`Invert each line`),children:(0,v.jsx)(c,{size:14})}),(0,v.jsx)(`button`,{className:`btn-icon`,onClick:()=>M(``),title:`Clear`,children:(0,v.jsx)(l,{size:14})})]}),(0,v.jsx)(`textarea`,{className:`scramble-area`,rows:5,placeholder:`R U R' U' R' F R2 U' R' U' R U R' F'`,value:j,onChange:e=>M(e.target.value)}),(0,v.jsxs)(`div`,{className:`row`,children:[(0,v.jsx)(`span`,{className:`lbl`,children:n(`线程`,`Threads`)}),(0,v.jsx)(`select`,{className:`ctl-sm`,value:F,onChange:e=>I(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,v.jsx)(`option`,{value:e,children:e},e))}),(0,v.jsx)(`span`,{className:`lbl`,children:n(`并发块`,`Concurrent`)}),(0,v.jsx)(`select`,{className:`ctl-sm`,value:L,onChange:e=>R(parseInt(e.target.value,10)),children:Se.map(e=>(0,v.jsx)(`option`,{value:e,children:e},e))}),(0,v.jsx)(`button`,{className:`btn-primary`,disabled:T===`busy`||T===`no-solver`||!Ce,onClick:ye,title:T===`need-init`?n(`会先自动生成 prun 表(几十秒)再求解`,`Will auto-generate the prun table (tens of seconds) then solve`):void 0,children:T===`busy`?(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)(s,{size:14,className:`spinning`}),` `,n(`求解中`,`Solving`),`…`]}):T===`need-init`?(0,v.jsxs)(v.Fragment,{children:[(0,v.jsx)(c,{size:14}),` `,n(`生成表+求解`,`Gen Table + Solve`)]}):(0,v.jsx)(v.Fragment,{children:`Solve`})})]})]}),(0,v.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,v.jsxs)(`div`,{className:`row`,children:[(0,v.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,v.jsx)(`button`,{className:`btn-icon`,onClick:()=>A(``),title:`Clear logs`,children:(0,v.jsx)(l,{size:14})})]}),(0,v.jsx)(`textarea`,{ref:J,className:`logs-area`,rows:10,value:k,readOnly:!0})]}),(0,v.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,v.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,v.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var x=`
.cubeopt-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
  color: var(--text);
}
.cubeopt-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.25rem;
}
.cubeopt-header h1 { margin: 0; font-size: 1.6rem; font-weight: 600; }
.cubeopt-lead { color: var(--text-muted, #aaa); margin: 0 0 1rem; line-height: 1.55; }
.cubeopt-warn {
  background: #3a2912; border: 1px solid #ff8800; color: #ffcc88;
  padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.9rem;
}
.cubeopt-info {
  background: #18242a; border: 1px solid #2b6a8a; color: #88d4ff;
  padding: 0.5rem 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;
  font-size: 0.9rem;
}
.cubeopt-card {
  background: var(--panel, #1a1a1a);
  border: 1px solid var(--border, #333);
  border-radius: 8px;
  padding: 0.75rem 0.75rem 0.5rem;
  margin-bottom: 0.75rem;
}
.row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem;
  margin-bottom: 0.5rem;
}
.lbl {
  min-width: 5rem; font-size: 0.85rem; color: var(--text-muted, #999);
}
.ctl, .ctl-sm {
  background: var(--panel-sub, #2a2a2a); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.3rem 0.5rem; border-radius: 5px; font-size: 0.9rem;
}
.ctl { flex: 1; min-width: 12rem; }
.ctl-sm { min-width: 6rem; }
.size-badge {
  background: var(--panel-sub, #2a2a2a); padding: 0.3rem 0.6rem;
  border-radius: 5px; font-size: 0.85rem; color: var(--text-muted, #aaa);
  border: 1px solid var(--border, #444);
}
.table-name {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem; color: var(--text-muted, #aaa);
  flex: 1; min-width: 8rem;
}
.btn, .btn-primary, .btn-icon {
  background: var(--panel-sub, #2a2a2a); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.35rem 0.7rem; border-radius: 5px; font-size: 0.85rem;
  cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;
  transition: border-color 0.12s ease;
}
.btn:hover, .btn-primary:hover, .btn-icon:hover { border-color: var(--accent, #ff8800); }
.btn-primary {
  background: var(--accent, #ff8800); color: #000; border-color: var(--accent, #ff8800);
  font-weight: 600;
}
.btn-primary:disabled, .btn:disabled {
  opacity: 0.45; cursor: not-allowed;
}
.btn-icon { padding: 0.35rem 0.45rem; }
.busy-marker {
  display: inline-flex; align-items: center; gap: 0.35rem;
  color: var(--text-muted, #aaa); font-size: 0.85rem;
}
.spinning { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.progress {
  height: 6px; background: var(--panel-sub, #2a2a2a); border-radius: 3px;
  margin: 0.5rem 0; overflow: hidden;
}
.progress-bar {
  height: 100%; background: var(--accent, #ff8800);
  transition: width 0.2s ease;
}
.scramble-area, .logs-area {
  width: 100%; box-sizing: border-box;
  background: var(--panel-sub, #1c1c1c); border: 1px solid var(--border, #444);
  color: var(--text); padding: 0.5rem; border-radius: 5px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem; resize: vertical;
}
.logs-area { white-space: pre; overflow-x: auto; }
.cubeopt-foot {
  margin-top: 1rem; color: var(--text-muted, #888); font-size: 0.8rem;
}
.cubeopt-foot a { color: var(--accent, #ff8800); }
.paint-toggle-row { gap: 0.5rem; }
.paint-toggle-row .btn.is-active { border-color: var(--accent, #ff8800); }
.paint-hint {
  flex: 1; min-width: 12rem;
  font-size: 0.8rem; color: var(--text-muted, #888);
  line-height: 1.4;
}
.paint-wrap {
  margin-top: 0.5rem; padding-top: 0.5rem;
  border-top: 1px dashed var(--border, #333);
  display: flex; justify-content: center;
}
.auto-dl {
  display: inline-flex; align-items: center; gap: 0.35rem;
  font-size: 0.8rem; color: var(--text-muted, #aaa); cursor: pointer;
  user-select: none;
}
.auto-dl input { margin: 0; cursor: pointer; }
@media (max-width: 480px) {
  .cubeopt-header h1 { font-size: 1.3rem; }
  .lbl { min-width: 4rem; }
  .ctl { min-width: 8rem; }
}
`;export{b as default};