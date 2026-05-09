import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./jsx-runtime-CVfOIazI.js";import{f as r,l as i}from"./index-6EdF-Ojn.js";import{t as a}from"./download-Bbkxm99D.js";import{t as o}from"./LangToggle-ChHbrbL1.js";import{t as s}from"./loader-circle-Dr0GiplR.js";import{t as c}from"./sparkles-CIPe-cwn.js";import{t as l}from"./trash-2-CFH2zskc.js";import{n as u,t as d}from"./kociemba.worker-9IsYC5tj.js";import{a as ee,c as f,l as p,o as m,r as h,s as g}from"./cube-LTg4F11U.js";import{n as _,r as v}from"./facelet-C8sZMd_V.js";var y=e(t(),1),b=n(),x=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],S=[15,16,17,18,19,20,25,30],C=[1,5,10,20,50,100];function w(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function T(){let{i18n:e}=r(),t=e.language===`zh`,n=(e,n)=>t?e:n,[T]=i(),[D,O]=(0,y.useState)(`cube48opt3`),[k,A]=(0,y.useState)(null),[j,M]=(0,y.useState)(`no-solver`),[N,P]=(0,y.useState)(-1),[F,I]=(0,y.useState)(``),[L,R]=(0,y.useState)(``),[z,B]=(0,y.useState)(15),[V,H]=(0,y.useState)(10),[U,W]=(0,y.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[G,K]=(0,y.useState)(1),[q,J]=(0,y.useState)(null),Y=(0,y.useRef)(null),X=(0,y.useRef)(null),Z=(0,y.useRef)(null),Q=(0,y.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),$=(0,y.useRef)(null);(0,y.useEffect)(()=>{let e=T.get(`scramble`);e&&R(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=T.get(`state`);return t&&te(t).catch(e=>{J(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{$.current?.terminate(),$.current=null}},[]);async function te(e){let t=v(e);if(t){J(n(`非法状态:${t}`,`Invalid state: ${t}`));return}J(n(`状态合法,Kociemba 求解中…`,`State valid, solving with Kociemba…`));let r=_(e);if(g(r)){J(n(`状态已是还原态,无需打乱。`,`State is already solved.`)),R(``);return}$.current||=new d;let i=$.current,a=Date.now(),o=await new Promise((e,t)=>{let n=r=>{r.data?.id===a&&(i.removeEventListener(`message`,n),r.data.ok&&typeof r.data.sol==`string`?e(r.data.sol):t(Error(r.data.err||`kociemba failed`)))};i.addEventListener(`message`,n),i.postMessage({id:a,op:`solve`,state:r})});R(o),J(n(`Kociemba 求出 ${o.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${o.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}(0,y.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return Y.current=e,e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();I(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&P(parseInt(n[1],10)/100);return}if(t.code===-2){P(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)t.code===1?(M(`no-solver`),A(null)):(A({name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)}),M(t.code===0?`ready`:`need-init`));else if(t.cmd===`generate table`)M(t.code===0?`ready`:`need-init`),P(-1);else if(t.cmd===`upload table`)t.code===0?M(`ready`):(alert(n(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),M(`need-init`)),P(-1);else if(t.cmd===`start solve`)M(`ready`),P(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=k?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}M(`ready`)}},e.postMessage({cmd:`select solver`,data:D}),()=>{e.terminate(),Y.current=null}},[]),(0,y.useEffect)(()=>{Y.current&&(M(`busy`),I(``),P(-1),Y.current.postMessage({cmd:`select solver`,data:D}))},[D]),(0,y.useEffect)(()=>{U%G!==0&&K(1)},[U,G]),(0,y.useEffect)(()=>{Z.current&&(Z.current.scrollTop=Z.current.scrollHeight)},[F]);let ne=()=>{j===`need-init`&&(M(`busy`),I(``),Y.current?.postMessage({cmd:`generate table`}))},re=()=>{j===`ready`&&(M(`busy`),Y.current?.postMessage({cmd:`download table`}))},ie=()=>X.current?.click(),ae=e=>{let t=e.target.files?.[0];if(t){if(t.name!==k?.table_name){alert(n(`文件名应为 ${k?.table_name}`,`Expected ${k?.table_name}`)),e.target.value=``;return}M(`busy`),P(0),Y.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},oe=()=>{if(j!==`ready`)return;let e=L.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(n(`打乱不能为空`,`No scrambles`));return}R(e),M(`busy`),I(``),Y.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:U,n_group:G,debug:1})},se=()=>{let e=[];for(let t=0;t<V;t++)e.push(w(z));R(e.join(`
`))},ce=()=>{R(L.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return ee(m(f(e)))}catch{return e}}).join(`
`))},le=(0,y.useMemo)(()=>{let e=[];for(let t=1;t<=U;t++)U%t===0&&e.push(t);return e},[U]),ue=(()=>{let e=L.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=f(e);return!!h(p(),t)}catch{return!1}})})();return(0,b.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,b.jsx)(`style`,{children:E}),(0,b.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,b.jsx)(`h1`,{children:n(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,b.jsx)(o,{variant:`inline`})]}),(0,b.jsx)(`p`,{className:`cubeopt-lead`,children:n(`复刻 cs0x7f/cubeopt-wasm: 给定打乱(或状态),用 cube48opt 系列 wasm 求 HTM 最少步解。`,`A React port of cs0x7f/cubeopt-wasm. Given a scramble (or state), find the optimal HTM solution.`)}),!Q&&(0,b.jsx)(`div`,{className:`cubeopt-warn`,children:n(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),q&&(0,b.jsx)(`div`,{className:`cubeopt-info`,children:q}),(0,b.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,b.jsx)(`select`,{className:`ctl`,value:D,disabled:j===`busy`,onChange:e=>O(e.target.value),children:x.map(e=>(0,b.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,b.jsx)(`span`,{className:`size-badge`,children:x.find(e=>e.value===D)?.size})]}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`span`,{className:`lbl`,children:n(`Prun 表`,`Prun Table`)}),(0,b.jsx)(`span`,{className:`table-name`,children:k?.table_name??n(`未就绪`,`Not Ready`)}),j===`need-init`&&(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(`button`,{className:`btn`,onClick:ne,children:n(`生成表`,`Generate Table`)}),(0,b.jsxs)(`button`,{className:`btn`,onClick:ie,children:[(0,b.jsx)(u,{size:14}),` `,n(`上传表`,`Upload Table`)]})]}),j===`ready`&&(0,b.jsxs)(`button`,{className:`btn`,onClick:re,children:[(0,b.jsx)(a,{size:14}),` `,n(`下载表`,`Download Table`)]}),j===`busy`&&(0,b.jsxs)(`span`,{className:`busy-marker`,children:[(0,b.jsx)(s,{size:14,className:`spinning`}),` `,n(`忙`,`busy`),`…`]}),(0,b.jsx)(`input`,{ref:X,type:`file`,style:{display:`none`},onChange:ae})]}),N>=0&&(0,b.jsx)(`div`,{className:`progress`,children:(0,b.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(N*100)}%`}})})]}),(0,b.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`span`,{className:`lbl`,children:n(`随机`,`Random`)}),(0,b.jsx)(`select`,{className:`ctl-sm`,value:z,onChange:e=>B(parseInt(e.target.value,10)),children:S.map(e=>(0,b.jsxs)(`option`,{value:e,children:[e,` `,n(`步`,`moves`)]},e))}),(0,b.jsx)(`select`,{className:`ctl-sm`,value:V,onChange:e=>H(parseInt(e.target.value,10)),children:C.map(e=>(0,b.jsxs)(`option`,{value:e,children:[e,` `,n(`个`,`cubes`)]},e))}),(0,b.jsx)(`button`,{className:`btn`,onClick:se,children:n(`生成`,`Random`)}),(0,b.jsx)(`button`,{className:`btn-icon`,onClick:ce,title:n(`每行反向`,`Invert each line`),children:(0,b.jsx)(c,{size:14})}),(0,b.jsx)(`button`,{className:`btn-icon`,onClick:()=>R(``),title:`Clear`,children:(0,b.jsx)(l,{size:14})})]}),(0,b.jsx)(`textarea`,{className:`scramble-area`,rows:5,placeholder:`R U R' U' R' F R2 U' R' U' R U R' F'`,value:L,onChange:e=>R(e.target.value)}),(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`span`,{className:`lbl`,children:n(`线程`,`Threads`)}),(0,b.jsx)(`select`,{className:`ctl-sm`,value:U,onChange:e=>W(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,b.jsx)(`option`,{value:e,children:e},e))}),(0,b.jsx)(`span`,{className:`lbl`,children:n(`并发块`,`Concurrent`)}),(0,b.jsx)(`select`,{className:`ctl-sm`,value:G,onChange:e=>K(parseInt(e.target.value,10)),children:le.map(e=>(0,b.jsx)(`option`,{value:e,children:e},e))}),(0,b.jsx)(`button`,{className:`btn-primary`,disabled:j!==`ready`||!ue,onClick:oe,children:j===`busy`?(0,b.jsxs)(b.Fragment,{children:[(0,b.jsx)(s,{size:14,className:`spinning`}),` Solving…`]}):`Solve`})]})]}),(0,b.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,b.jsxs)(`div`,{className:`row`,children:[(0,b.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,b.jsx)(`button`,{className:`btn-icon`,onClick:()=>I(``),title:`Clear logs`,children:(0,b.jsx)(l,{size:14})})]}),(0,b.jsx)(`textarea`,{ref:Z,className:`logs-area`,rows:10,value:F,readOnly:!0})]}),(0,b.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,b.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,b.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var E=`
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
@media (max-width: 480px) {
  .cubeopt-header h1 { font-size: 1.3rem; }
  .lbl { min-width: 4rem; }
  .ctl { min-width: 8rem; }
}
`;export{T as default};