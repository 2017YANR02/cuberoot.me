import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./jsx-runtime-CVfOIazI.js";import{f as r,l as i}from"./index-DAtcpobS.js";import"./chunk-O6HEZXGY-CJWmH-Dl.js";import"./chunk-FLK6AZKB-yCOe3-R0.js";import"./chunk-DQGYYYHZ-D6Akqhs5.js";import"./puzzles-CiXiXTzN.js";import"./twisty-CdJBDPGV.js";import{t as a}from"./download-Bbkxm99D.js";import{t as o}from"./eye-off-Dl_sNkVu.js";import{t as s}from"./eye-BENVZCXJ.js";import{t as ee}from"./LangToggle-D6O5BPVG.js";import{t as c}from"./loader-circle-Dr0GiplR.js";import{t as te}from"./CubingPreview-By-52xDu.js";import{t as l}from"./sparkles-CIPe-cwn.js";import{t as u}from"./trash-2-CFH2zskc.js";import{n as ne,t as re}from"./kociemba.worker-9IsYC5tj.js";import{t as d}from"./x-BNTjT2hC.js";import"./alg-AA0Y7q6e.js";import{a as ie,c as f,l as ae,o as oe,r as se,s as ce}from"./cube-LTg4F11U.js";import{i as le,n as ue,r as de,t as fe}from"./InteractiveCubeNet-B_KILcbD.js";var p=e(t(),1),m=n(),h=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],pe=[15,16,17,18,19,20,25,30],me=[1,5,10,20,50,100];function he(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function g(){let{i18n:e}=r(),t=e.language===`zh`,n=(e,n)=>t?e:n,[g]=i(),[_,_e]=(0,p.useState)(`cube48opt3`),[v,y]=(0,p.useState)(null),[b,x]=(0,p.useState)(`no-solver`),[S,C]=(0,p.useState)(-1),[w,T]=(0,p.useState)(``),[E,D]=(0,p.useState)(``),[O,ve]=(0,p.useState)(15),[k,ye]=(0,p.useState)(10),[A,be]=(0,p.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[j,M]=(0,p.useState)(1),[N,P]=(0,p.useState)(null),[F,xe]=(0,p.useState)(!1),[Se,Ce]=(0,p.useState)(ue),[we,Te]=(0,p.useState)(`U`),[Ee,De]=(0,p.useState)(360);(0,p.useEffect)(()=>{let e=()=>De(Math.min(360,Math.max(200,window.innerWidth-64)));return e(),window.addEventListener(`resize`,e),()=>window.removeEventListener(`resize`,e)},[]);let[I,Oe]=(0,p.useState)(()=>{let e=localStorage.getItem(`cubeopt.showPreview`);return e===null?!0:e===`1`});(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.showPreview`,I?`1`:`0`)},[I]);let L=(0,p.useRef)(!1),[R,ke]=(0,p.useState)(()=>{let e=localStorage.getItem(`cubeopt.autoDownload`);return e===null?!0:e===`1`});(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.autoDownload`,R?`1`:`0`)},[R]);let z=(0,p.useRef)(!1),B=(0,p.useRef)(null),V=(0,p.useRef)(null),H=(0,p.useRef)(null),U=(0,p.useRef)(null),Ae=(0,p.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),W=(0,p.useRef)(null),[G,K]=(0,p.useState)(!1),q=(0,p.useRef)(null);(0,p.useEffect)(()=>{let e=g.get(`scramble`);e&&D(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=g.get(`state`);return t&&J(t).catch(e=>{P(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{W.current?.terminate(),W.current=null}},[]);async function J(e){let t=le(e);if(t){P(n(`非法状态:${t}`,`Invalid state: ${t}`));return}let r=de(e);if(ce(r)){P(n(`状态已是还原态,无需打乱。`,`State is already solved.`)),D(``);return}P(n(`状态合法,Kociemba 求解中(首次需 ~3s 建表)…`,`State valid, solving with Kociemba (first call needs ~3s to build tables)…`)),K(!0),W.current||=new re;let i=W.current,a=Date.now();try{let e=await new Promise((e,t)=>{let n=null,o=()=>{n&&clearTimeout(n),i.removeEventListener(`message`,s),q.current=null},s=n=>{n.data?.id===a&&(o(),n.data.ok&&typeof n.data.sol==`string`?e(n.data.sol):t(Error(n.data.err||`kociemba failed`)))};i.addEventListener(`message`,s),q.current=()=>{o(),i.terminate(),W.current=null,t(Error(`cancelled`))},n=setTimeout(()=>{o(),i.terminate(),W.current=null,t(Error(`timeout — 状态可能不可解`))},3e4),i.postMessage({id:a,op:`solve`,state:r})});D(e),P(n(`Kociemba 求出 ${e.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${e.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}finally{K(!1)}}let je=()=>{q.current?.(),K(!1),P(n(`已取消。`,`Cancelled.`))},Y=e=>{e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();T(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&C(parseInt(n[1],10)/100);return}if(t.code===-2){C(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)if(t.code===1)x(`no-solver`),y(null),U.current=null;else{let e={name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)};y(e),U.current=e,x(t.code===0?`ready`:`need-init`)}else if(t.cmd===`generate table`)t.code===0&&(z.current=!0),x(t.code===0?`ready`:`need-init`),C(-1);else if(t.cmd===`upload table`)t.code===0?x(`ready`):(alert(n(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),x(`need-init`)),C(-1);else if(t.cmd===`start solve`)x(`ready`),C(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=U.current?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}x(`ready`)}}};(0,p.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return B.current=e,Y(e),e.postMessage({cmd:`select solver`,data:_}),()=>{e.terminate(),B.current=null}},[]);let Me=()=>{if(!B.current)return;B.current.terminate(),L.current=!1,z.current=!1,C(-1),T(e=>e+`[cancelled by user]
`);let e=new Worker(`/cubeopt/wasm-worker.js`);B.current=e,Y(e),x(`busy`),e.postMessage({cmd:`select solver`,data:_})};(0,p.useEffect)(()=>{B.current&&(x(`busy`),T(``),C(-1),L.current=!1,B.current.postMessage({cmd:`select solver`,data:_}))},[_]),(0,p.useEffect)(()=>{A%j!==0&&M(1)},[A,j]),(0,p.useEffect)(()=>{H.current&&(H.current.scrollTop=H.current.scrollHeight)},[w]);let X=()=>{b===`need-init`&&(x(`busy`),T(``),B.current?.postMessage({cmd:`generate table`}))},Z=()=>{b===`ready`&&(x(`busy`),B.current?.postMessage({cmd:`download table`}))},Ne=()=>V.current?.click(),Pe=e=>{let t=e.target.files?.[0];if(t){if(t.name!==v?.table_name){alert(n(`文件名应为 ${v?.table_name}`,`Expected ${v?.table_name}`)),e.target.value=``;return}x(`busy`),C(0),B.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},Q=()=>{let e=E.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(n(`打乱不能为空`,`No scrambles`));return}D(e),x(`busy`),T(``),B.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:A,n_group:j,debug:1})},Fe=()=>{if(b===`ready`){Q();return}if(b===`need-init`){if(!E.split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`)){alert(n(`打乱不能为空`,`No scrambles`));return}L.current=!0,X()}};(0,p.useEffect)(()=>{if(b===`ready`){if(z.current&&R){z.current=!1;let e=setTimeout(()=>Z(),0);return()=>clearTimeout(e)}z.current=!1,L.current&&(L.current=!1,Q())}},[b]);let Ie=()=>{let e=[];for(let t=0;t<k;t++)e.push(he(O));D(e.join(`
`))},Le=()=>{D(E.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return ie(oe(f(e)))}catch{return e}}).join(`
`))},Re=(0,p.useMemo)(()=>{let e=[];for(let t=1;t<=A;t++)A%t===0&&e.push(t);return e},[A]),ze=(()=>{let e=E.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=f(e);return!!se(ae(),t)}catch{return!1}})})(),$=(0,p.useMemo)(()=>{let e=E.split(`
`).map(e=>e.trim()).find(Boolean);if(!e)return null;try{return f(e),e}catch{return null}},[E]);return(0,m.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,m.jsx)(`style`,{children:ge}),(0,m.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,m.jsx)(`h1`,{children:n(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,m.jsx)(ee,{variant:`inline`})]}),(0,m.jsx)(`p`,{className:`cubeopt-lead`,children:n(`复刻 cs0x7f/cubeopt-wasm: 给定打乱(或状态),用 cube48opt 系列 wasm 求 HTM 最少步解。`,`A React port of cs0x7f/cubeopt-wasm. Given a scramble (or state), find the optimal HTM solution.`)}),!Ae&&(0,m.jsx)(`div`,{className:`cubeopt-warn`,children:n(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),N&&(0,m.jsxs)(`div`,{className:`cubeopt-info`,children:[G&&(0,m.jsx)(c,{size:14,className:`spinning`}),(0,m.jsx)(`span`,{children:N}),G&&(0,m.jsxs)(`button`,{className:`btn-cancel-sm`,onClick:je,children:[(0,m.jsx)(d,{size:12}),` `,n(`取消`,`Cancel`)]})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,m.jsx)(`select`,{className:`ctl`,value:_,disabled:b===`busy`,onChange:e=>_e(e.target.value),children:h.map(e=>(0,m.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,m.jsx)(`span`,{className:`size-badge`,children:h.find(e=>e.value===_)?.size})]}),(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:n(`Prun 表`,`Prun Table`)}),(0,m.jsx)(`span`,{className:`table-name`,children:v?.table_name??n(`未就绪`,`Not Ready`)}),(0,m.jsxs)(`label`,{className:`auto-dl`,children:[(0,m.jsx)(`input`,{type:`checkbox`,checked:R,onChange:e=>ke(e.target.checked)}),(0,m.jsx)(`span`,{children:n(`生成后自动下载`,`Auto-download after gen`)})]}),b===`need-init`&&(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(`button`,{className:`btn`,onClick:X,children:n(`生成表`,`Generate Table`)}),(0,m.jsxs)(`button`,{className:`btn`,onClick:Ne,children:[(0,m.jsx)(ne,{size:14}),` `,n(`上传表`,`Upload Table`)]})]}),b===`ready`&&(0,m.jsxs)(`button`,{className:`btn`,onClick:Z,children:[(0,m.jsx)(a,{size:14}),` `,n(`下载表`,`Download Table`)]}),b===`busy`&&(0,m.jsxs)(`span`,{className:`busy-marker`,children:[(0,m.jsx)(c,{size:14,className:`spinning`}),` `,n(`忙`,`busy`),`…`]}),(0,m.jsx)(`input`,{ref:V,type:`file`,style:{display:`none`},onChange:Pe})]}),S>=0&&(0,m.jsx)(`div`,{className:`progress`,children:(0,m.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(S*100)}%`}})})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row paint-toggle-row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:n(`从状态`,`From state`)}),(0,m.jsx)(`button`,{className:`btn${F?` is-active`:``}`,onClick:()=>xe(e=>!e),title:n(`画一个魔方状态,自动求出对应打乱`,`Paint a cube state, auto-derive a scramble`),children:F?n(`收起`,`Hide`):n(`展开填色`,`Open paint`)}),(0,m.jsx)(`span`,{className:`paint-hint`,children:n(`点击格子 → 上色 → "求 scramble" → 自动填到下面打乱框,再点 Solve 求最优。`,`Click stickers → paint → "Derive scramble" → fills the box below, then Solve for optimal.`)})]}),F&&(0,m.jsx)(`div`,{className:`paint-wrap`,children:(0,m.jsx)(fe,{facelet:Se,onChange:Ce,activeColor:we,onActiveColorChange:Te,pixelSize:Ee,solveLabel:{zh:`求 scramble`,en:`Derive scramble`},onSolve:e=>{G||J(e).catch(e=>{P(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))})}})})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:n(`随机`,`Random`)}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:O,onChange:e=>ve(parseInt(e.target.value,10)),children:pe.map(e=>(0,m.jsxs)(`option`,{value:e,children:[e,` `,n(`步`,`moves`)]},e))}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:k,onChange:e=>ye(parseInt(e.target.value,10)),children:me.map(e=>(0,m.jsxs)(`option`,{value:e,children:[e,` `,n(`个`,`cubes`)]},e))}),(0,m.jsx)(`button`,{className:`btn`,onClick:Ie,children:n(`生成`,`Random`)}),(0,m.jsx)(`button`,{className:`btn-icon`,onClick:Le,title:n(`每行反向`,`Invert each line`),children:(0,m.jsx)(l,{size:14})}),(0,m.jsx)(`button`,{className:`btn-icon${I?` is-active`:``}`,onClick:()=>Oe(e=>!e),title:n(`打乱图预览(显示第一行打乱产生的状态)`,`Show preview of the first scramble`),children:I?(0,m.jsx)(s,{size:14}):(0,m.jsx)(o,{size:14})}),(0,m.jsx)(`button`,{className:`btn-icon`,onClick:()=>D(``),title:`Clear`,children:(0,m.jsx)(u,{size:14})})]}),(0,m.jsx)(`textarea`,{className:`scramble-area`,rows:5,placeholder:`R U R' U' R' F R2 U' R' U' R U R' F'`,value:E,onChange:e=>D(e.target.value)}),I&&$&&(0,m.jsxs)(`div`,{className:`scramble-preview`,children:[(0,m.jsx)(te,{event:`333`,scramble:$,visualization:`2D`,size:28,className:`scramble-preview-svg`}),(0,m.jsx)(`span`,{className:`scramble-preview-label`,children:n(`应用第一行打乱后的状态`,`State after the first scramble`)})]}),(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:n(`线程`,`Threads`)}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:A,onChange:e=>be(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,m.jsx)(`option`,{value:e,children:e},e))}),(0,m.jsx)(`span`,{className:`lbl`,children:n(`并发块`,`Concurrent`)}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:j,onChange:e=>M(parseInt(e.target.value,10)),children:Re.map(e=>(0,m.jsx)(`option`,{value:e,children:e},e))}),b===`busy`?(0,m.jsxs)(`button`,{className:`btn-cancel`,onClick:Me,title:n(`终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。`,`Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.`),children:[(0,m.jsx)(d,{size:14}),` `,n(`取消`,`Cancel`)]}):(0,m.jsx)(`button`,{className:`btn-primary`,disabled:b===`no-solver`||!ze,onClick:Fe,title:b===`need-init`?n(`会先自动生成 prun 表(几十秒)再求解`,`Will auto-generate the prun table (tens of seconds) then solve`):void 0,children:b===`need-init`?(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(l,{size:14}),` `,n(`生成表+求解`,`Gen Table + Solve`)]}):(0,m.jsx)(m.Fragment,{children:`Solve`})})]})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,m.jsx)(`button`,{className:`btn-icon`,onClick:()=>T(``),title:`Clear logs`,children:(0,m.jsx)(u,{size:14})})]}),(0,m.jsx)(`textarea`,{ref:H,className:`logs-area`,rows:10,value:w,readOnly:!0})]}),(0,m.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,m.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,m.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var ge=`
.cubeopt-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
  color: var(--text);
  overflow-x: hidden;
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
  display: flex; align-items: center; gap: 0.5rem;
}
.cubeopt-info > span { flex: 1; }
.btn-cancel, .btn-cancel-sm {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: #4a1f1f; border: 1px solid #8a3a3a; color: #ffaaaa;
  border-radius: 5px; cursor: pointer;
  font-weight: 600;
}
.btn-cancel { padding: 0.35rem 0.8rem; font-size: 0.85rem; }
.btn-cancel-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }
.btn-cancel:hover, .btn-cancel-sm:hover { background: #5a2a2a; border-color: #c14747; }
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
  max-width: 100%; box-sizing: border-box;
}
.ctl { flex: 1; min-width: 0; }
.ctl-sm { min-width: 0; flex: 1 1 6rem; }
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
.btn-icon.is-active { border-color: var(--accent, #ff8800); color: var(--accent, #ff8800); }
.scramble-preview {
  margin: 0.5rem 0; padding: 0.5rem;
  display: flex; align-items: center; gap: 0.75rem;
  background: var(--panel-sub, #181818); border-radius: 5px;
  border: 1px dashed var(--border, #333);
}
.scramble-preview-svg { flex-shrink: 0; }
.scramble-preview-label { font-size: 0.8rem; color: var(--text-muted, #888); }
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
  .cubeopt-page { padding: 0.75rem 0.5rem 2rem; }
  .cubeopt-header h1 { font-size: 1.2rem; flex: 1; min-width: 0; }
  .cubeopt-lead { font-size: 0.85rem; }
  .lbl { min-width: 3.5rem; font-size: 0.78rem; }
  .ctl, .ctl-sm { font-size: 0.8rem; padding: 0.25rem 0.35rem; }
  .size-badge, .table-name, .auto-dl { font-size: 0.75rem; }
  .auto-dl span { white-space: nowrap; }
  .btn, .btn-primary, .btn-cancel { font-size: 0.78rem; padding: 0.3rem 0.5rem; }
  .row { gap: 0.35rem; }
  .paint-hint { font-size: 0.72rem; line-height: 1.3; }
  .paint-wrap { padding-top: 0.25rem; }
}
`;export{g as default};