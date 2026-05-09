import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import{t as n}from"./jsx-runtime-CVfOIazI.js";import{f as r,l as i}from"./index-1DEqaX1i.js";import"./chunk-O6HEZXGY-CJWmH-Dl.js";import"./chunk-FLK6AZKB-yCOe3-R0.js";import"./chunk-DQGYYYHZ-D6Akqhs5.js";import"./puzzles-CiXiXTzN.js";import"./twisty-CdJBDPGV.js";import{t as a}from"./download-Bbkxm99D.js";import{t as o}from"./eye-off-Dl_sNkVu.js";import{t as s}from"./eye-BENVZCXJ.js";import{t as ee}from"./LangToggle-CLiHs3h6.js";import{t as te}from"./loader-circle-Dr0GiplR.js";import{t as ne}from"./CubingPreview-By-52xDu.js";import{t as c}from"./sparkles-CIPe-cwn.js";import{t as l}from"./trash-2-CFH2zskc.js";import{n as re,t as ie}from"./kociemba.worker-9IsYC5tj.js";import{t as u}from"./x-BNTjT2hC.js";import"./alg-AA0Y7q6e.js";import{a as ae,c as d,l as oe,o as se,r as ce,s as le}from"./cube-LTg4F11U.js";import{i as ue,n as de,r as fe,t as pe}from"./InteractiveCubeNet-u8CjCoFf.js";var f=e(t(),1),p=n(),m=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],me=[15,16,17,18,19,20,25,30],he=[1,5,10,20,50,100];function ge(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function h(){let{i18n:e}=r(),t=e.language===`zh`,n=(e,n)=>t?e:n,[h]=i(),[g,ve]=(0,f.useState)(()=>typeof navigator<`u`&&/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)?`cube48opt1`:`cube48opt3`),[_,v]=(0,f.useState)(null),[y,b]=(0,f.useState)(`no-solver`),[x,S]=(0,f.useState)(-1),[C,w]=(0,f.useState)(``),[T,E]=(0,f.useState)(``),[D,ye]=(0,f.useState)(15),[O,be]=(0,f.useState)(10),xe=(0,f.useMemo)(()=>typeof navigator<`u`&&/iPhone|iPad|iPod|Android/i.test(navigator.userAgent),[]),[k,Se]=(0,f.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[A,j]=(0,f.useState)(1),M=(0,f.useRef)([]),[N,P]=(0,f.useState)(new Map),F=(0,f.useRef)(new Map),[I,L]=(0,f.useState)(null),[R,Ce]=(0,f.useState)(!1),[we,Te]=(0,f.useState)(de),[Ee,De]=(0,f.useState)(`U`),[Oe,ke]=(0,f.useState)(360);(0,f.useEffect)(()=>{let e=()=>ke(Math.min(360,Math.max(200,window.innerWidth-64)));return e(),window.addEventListener(`resize`,e),()=>window.removeEventListener(`resize`,e)},[]);let[z,Ae]=(0,f.useState)(()=>{let e=localStorage.getItem(`cubeopt.showPreview`);return e===null?!0:e===`1`});(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.showPreview`,z?`1`:`0`)},[z]);let B=(0,f.useRef)(!1),[V,je]=(0,f.useState)(()=>{let e=localStorage.getItem(`cubeopt.autoDownload`);return e===null?!0:e===`1`});(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.autoDownload`,V?`1`:`0`)},[V]);let H=(0,f.useRef)(!1),[U,Me]=(0,f.useState)(()=>localStorage.getItem(`cubeopt.showLogs`)===`1`);(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.showLogs`,U?`1`:`0`)},[U]);let W=(0,f.useRef)(null),G=(0,f.useRef)(null),K=(0,f.useRef)(null),q=(0,f.useRef)(null),Ne=(0,f.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),J=(0,f.useRef)(null),[Y,X]=(0,f.useState)(!1),Z=(0,f.useRef)(null);(0,f.useEffect)(()=>{let e=h.get(`scramble`);e&&E(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=h.get(`state`);return t&&Pe(t).catch(e=>{L(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{J.current?.terminate(),J.current=null}},[]);async function Pe(e){let t=ue(e);if(t){L(n(`非法状态:${t}`,`Invalid state: ${t}`));return}let r=fe(e);if(le(r)){L(n(`状态已是还原态,无需打乱。`,`State is already solved.`)),E(``);return}L(n(`状态合法,Kociemba 求解中(首次需 ~3s 建表)…`,`State valid, solving with Kociemba (first call needs ~3s to build tables)…`)),X(!0),J.current||=new ie;let i=J.current,a=Date.now();try{let e=await new Promise((e,t)=>{let n=null,o=()=>{n&&clearTimeout(n),i.removeEventListener(`message`,s),Z.current=null},s=n=>{n.data?.id===a&&(o(),n.data.ok&&typeof n.data.sol==`string`?e(n.data.sol):t(Error(n.data.err||`kociemba failed`)))};i.addEventListener(`message`,s),Z.current=()=>{o(),i.terminate(),J.current=null,t(Error(`cancelled`))},n=setTimeout(()=>{o(),i.terminate(),J.current=null,t(Error(`timeout — 状态可能不可解`))},3e4),i.postMessage({id:a,op:`solve`,state:r})});E(e),L(n(`Kociemba 求出 ${e.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${e.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}finally{X(!1)}}let Fe=()=>{Z.current?.(),X(!1),L(n(`已取消。`,`Cancelled.`))},Ie=e=>{e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();w(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&S(parseInt(n[1],10)/100);let r=/^Solution found!:\s*(.+)$/i.exec(e);if(r){let e=r[1].trim().replace(/\s+/g,` `);M.current.push(e);return}let i=/^Cube(\d+)\s+finished\s+in\s/i.exec(e);if(i){let e=parseInt(i[1],10),t=M.current.shift();t!==void 0&&(F.current.set(e,t),P(new Map(F.current)))}return}if(t.code===-2){S(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)if(t.code===1)b(`no-solver`),v(null),q.current=null;else{let e={name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)};v(e),q.current=e,b(t.code===0?`ready`:`need-init`)}else if(t.cmd===`generate table`)t.code===0&&(H.current=!0),b(t.code===0?`ready`:`need-init`),S(-1);else if(t.cmd===`upload table`)t.code===0?b(`ready`):(alert(n(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),b(`need-init`)),S(-1);else if(t.cmd===`start solve`)b(`ready`),S(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=q.current?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}b(`ready`)}}};(0,f.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return W.current=e,Ie(e),e.postMessage({cmd:`select solver`,data:g}),()=>{e.terminate(),W.current=null}},[]);let Le=()=>{if(!W.current)return;W.current.terminate(),B.current=!1,H.current=!1,S(-1),w(e=>e+`[cancelled by user]
`);let e=new Worker(`/cubeopt/wasm-worker.js`);W.current=e,Ie(e),b(`busy`),e.postMessage({cmd:`select solver`,data:g})};(0,f.useEffect)(()=>{W.current&&(b(`busy`),w(``),S(-1),B.current=!1,W.current.postMessage({cmd:`select solver`,data:g}))},[g]),(0,f.useEffect)(()=>{k%A!==0&&j(1)},[k,A]),(0,f.useEffect)(()=>{K.current&&(K.current.scrollTop=K.current.scrollHeight)},[C]);let Re=()=>{y===`need-init`&&(b(`busy`),w(``),W.current?.postMessage({cmd:`generate table`}))},Q=()=>{y===`ready`&&(b(`busy`),W.current?.postMessage({cmd:`download table`}))},ze=()=>G.current?.click(),Be=e=>{let t=e.target.files?.[0];if(t){if(t.name!==_?.table_name){alert(n(`文件名应为 ${_?.table_name}`,`Expected ${_?.table_name}`)),e.target.value=``;return}b(`busy`),S(0),W.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},Ve=()=>{let e=T.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(n(`打乱不能为空`,`No scrambles`));return}E(e),b(`busy`),w(``),F.current=new Map,P(new Map),M.current=[],W.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:k,n_group:A,debug:1})},He=()=>{if(y===`ready`){Ve();return}if(y===`need-init`){if(!T.split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`)){alert(n(`打乱不能为空`,`No scrambles`));return}B.current=!0,Re()}};(0,f.useEffect)(()=>{if(y===`ready`){if(H.current&&V){H.current=!1;let e=setTimeout(()=>Q(),0);return()=>clearTimeout(e)}H.current=!1,B.current&&(B.current=!1,Ve())}},[y]);let Ue=()=>{let e=[];for(let t=0;t<O;t++)e.push(ge(D));E(e.join(`
`))},We=()=>{E(T.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return ae(se(d(e)))}catch{return e}}).join(`
`))},Ge=(0,f.useMemo)(()=>{let e=[];for(let t=1;t<=k;t++)k%t===0&&e.push(t);return e},[k]),Ke=(()=>{let e=T.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=d(e);return!!ce(oe(),t)}catch{return!1}})})(),$=(0,f.useMemo)(()=>{let e=T.split(`
`).map(e=>e.trim()).find(Boolean);if(!e)return null;try{return d(e),e}catch{return null}},[T]);return(0,p.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,p.jsx)(`style`,{children:_e}),(0,p.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,p.jsx)(`h1`,{children:n(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,p.jsx)(ee,{variant:`inline`})]}),(0,p.jsx)(`p`,{className:`cubeopt-lead`,children:n(`复刻 cs0x7f/cubeopt-wasm: 给定打乱(或状态),用 cube48opt 系列 wasm 求 HTM 最少步解。`,`A React port of cs0x7f/cubeopt-wasm. Given a scramble (or state), find the optimal HTM solution.`)}),!Ne&&(0,p.jsx)(`div`,{className:`cubeopt-warn`,children:n(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),xe&&(0,p.jsx)(`div`,{className:`cubeopt-info`,children:(0,p.jsx)(`span`,{children:n(`检测到手机端 — 已默认 cube48opt1 (30M)。手机 wasm 内存有限,opt2/3 视机型可能 OK,opt4 起容易 OOM 崩页;生成时长是桌面的 3-5 倍,期间不要切到后台。`,`Mobile detected — defaulted to cube48opt1 (30M). Mobile wasm memory is tight; opt2/3 may work on flagship phones, opt4+ likely OOM. Gen takes 3-5× longer than desktop; don't background the tab during gen.`)})}),I&&(0,p.jsxs)(`div`,{className:`cubeopt-info`,children:[Y&&(0,p.jsx)(te,{size:14,className:`spinning`}),(0,p.jsx)(`span`,{children:I}),Y&&(0,p.jsxs)(`button`,{className:`btn-cancel-sm`,onClick:Fe,children:[(0,p.jsx)(u,{size:12}),` `,n(`取消`,`Cancel`)]})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,p.jsx)(`select`,{className:`ctl`,value:g,disabled:y===`busy`,onChange:e=>ve(e.target.value),children:m.map(e=>(0,p.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,p.jsx)(`span`,{className:`size-badge`,children:m.find(e=>e.value===g)?.size})]}),(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:n(`Prun 表`,`Prun Table`)}),(0,p.jsx)(`span`,{className:`table-name`,children:_?.table_name??n(`未就绪`,`Not Ready`)}),(0,p.jsxs)(`label`,{className:`auto-dl`,children:[(0,p.jsx)(`input`,{type:`checkbox`,checked:V,onChange:e=>je(e.target.checked)}),(0,p.jsx)(`span`,{children:n(`生成后自动下载`,`Auto-download after gen`)})]}),y===`need-init`&&(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(`button`,{className:`btn`,onClick:Re,children:n(`生成表`,`Generate Table`)}),(0,p.jsxs)(`button`,{className:`btn`,onClick:ze,children:[(0,p.jsx)(re,{size:14}),` `,n(`上传表`,`Upload Table`)]})]}),y===`ready`&&(0,p.jsxs)(`button`,{className:`btn`,onClick:Q,children:[(0,p.jsx)(a,{size:14}),` `,n(`下载表`,`Download Table`)]}),y===`busy`&&(0,p.jsxs)(`span`,{className:`busy-marker`,children:[(0,p.jsx)(te,{size:14,className:`spinning`}),` `,n(`忙`,`busy`),`…`]}),(0,p.jsx)(`input`,{ref:G,type:`file`,style:{display:`none`},onChange:Be})]}),x>=0&&(0,p.jsx)(`div`,{className:`progress`,children:(0,p.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(x*100)}%`}})})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row paint-toggle-row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:n(`从状态`,`From state`)}),(0,p.jsx)(`button`,{className:`btn${R?` is-active`:``}`,onClick:()=>Ce(e=>!e),title:n(`画一个魔方状态,自动求出对应打乱`,`Paint a cube state, auto-derive a scramble`),children:R?n(`收起`,`Hide`):n(`展开填色`,`Open paint`)}),(0,p.jsx)(`span`,{className:`paint-hint`,children:n(`点击格子 → 上色 → "求 scramble" → 自动填到下面打乱框,再点 Solve 求最优。`,`Click stickers → paint → "Derive scramble" → fills the box below, then Solve for optimal.`)})]}),R&&(0,p.jsx)(`div`,{className:`paint-wrap`,children:(0,p.jsx)(pe,{facelet:we,onChange:Te,activeColor:Ee,onActiveColorChange:De,pixelSize:Oe,solveLabel:{zh:`求 scramble`,en:`Derive scramble`},onSolve:e=>{Y||Pe(e).catch(e=>{L(n(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))})}})})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:n(`随机`,`Random`)}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:D,onChange:e=>ye(parseInt(e.target.value,10)),children:me.map(e=>(0,p.jsxs)(`option`,{value:e,children:[e,` `,n(`步`,`moves`)]},e))}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:O,onChange:e=>be(parseInt(e.target.value,10)),children:he.map(e=>(0,p.jsxs)(`option`,{value:e,children:[e,` `,n(`个`,`cubes`)]},e))}),(0,p.jsx)(`button`,{className:`btn`,onClick:Ue,children:n(`生成`,`Random`)}),(0,p.jsx)(`button`,{className:`btn-icon`,onClick:We,title:n(`每行反向`,`Invert each line`),children:(0,p.jsx)(c,{size:14})}),(0,p.jsx)(`button`,{className:`btn-icon${z?` is-active`:``}`,onClick:()=>Ae(e=>!e),title:n(`打乱图预览(显示第一行打乱产生的状态)`,`Show preview of the first scramble`),children:z?(0,p.jsx)(s,{size:14}):(0,p.jsx)(o,{size:14})}),(0,p.jsx)(`button`,{className:`btn-icon`,onClick:()=>E(``),title:`Clear`,children:(0,p.jsx)(l,{size:14})})]}),(0,p.jsx)(`textarea`,{className:`scramble-area`,rows:5,placeholder:`R U R' U' R' F R2 U' R' U' R U R' F'`,value:T,onChange:e=>E(e.target.value)}),z&&$&&(0,p.jsxs)(`div`,{className:`scramble-preview`,children:[(0,p.jsx)(ne,{event:`333`,scramble:$,visualization:`2D`,size:28,className:`scramble-preview-svg`}),(0,p.jsx)(`span`,{className:`scramble-preview-label`,children:n(`应用第一行打乱后的状态`,`State after the first scramble`)})]}),(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:n(`线程`,`Threads`)}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:k,onChange:e=>Se(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,p.jsx)(`option`,{value:e,children:e},e))}),(0,p.jsx)(`span`,{className:`lbl`,children:n(`并发块`,`Concurrent`)}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:A,onChange:e=>j(parseInt(e.target.value,10)),children:Ge.map(e=>(0,p.jsx)(`option`,{value:e,children:e},e))}),y===`busy`?(0,p.jsxs)(`button`,{className:`btn-cancel`,onClick:Le,title:n(`终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。`,`Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.`),children:[(0,p.jsx)(u,{size:14}),` `,n(`取消`,`Cancel`)]}):(0,p.jsx)(`button`,{className:`btn-primary`,disabled:y===`no-solver`||!Ke,onClick:He,title:y===`need-init`?n(`会先自动生成 prun 表(几十秒)再求解`,`Will auto-generate the prun table (tens of seconds) then solve`):void 0,children:y===`need-init`?(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(c,{size:14}),` `,n(`生成表+求解`,`Gen Table + Solve`)]}):(0,p.jsx)(p.Fragment,{children:`Solve`})})]})]}),N.size>0&&(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:n(`解 (按输入顺序)`,`Solutions (input order)`)}),(0,p.jsx)(`span`,{className:`paint-hint`,children:n(`cubeopt 是按完成顺序输出的;此处按输入序号 1..N 排好,并标注步数。`,`cubeopt outputs in finish order; this panel re-sorts by input index 1..N with move counts.`)}),(0,p.jsx)(`button`,{className:`btn-icon`,onClick:()=>{let e=Array.from(N.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>`${e}. ${t}`).join(`
`);navigator.clipboard?.writeText(e)},title:n(`复制全部`,`Copy all`),children:(0,p.jsx)(c,{size:14})})]}),(0,p.jsx)(`ol`,{className:`solutions-list`,children:Array.from(N.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>{let n=t.split(/\s+/).filter(Boolean).length;return(0,p.jsxs)(`li`,{children:[(0,p.jsxs)(`span`,{className:`sol-idx`,children:[e,`.`]}),(0,p.jsx)(`code`,{className:`sol-alg`,children:t}),(0,p.jsxs)(`span`,{className:`sol-count`,children:[`(`,n,`)`]})]},e)})})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,p.jsxs)(`button`,{className:`btn`,onClick:()=>Me(e=>!e),children:[U?n(`收起`,`Hide`):n(`展开 raw 输出`,`Show raw output`),C?` (${C.split(`
`).length-1})`:``]}),U&&(0,p.jsx)(`button`,{className:`btn-icon`,onClick:()=>w(``),title:`Clear logs`,children:(0,p.jsx)(l,{size:14})})]}),U&&(0,p.jsx)(`textarea`,{ref:K,className:`logs-area`,rows:10,value:C,readOnly:!0})]}),(0,p.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,p.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,p.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var _e=`
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
.solutions-list {
  list-style: none; margin: 0.25rem 0 0; padding: 0;
  display: flex; flex-direction: column; gap: 0.2rem;
}
.solutions-list li {
  display: flex; align-items: baseline; gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  background: var(--panel-sub, #181818);
  border-radius: 4px;
}
.sol-idx {
  font-variant-numeric: tabular-nums;
  color: var(--text-muted, #888);
  min-width: 1.8rem; text-align: right;
  font-size: 0.8rem;
}
.sol-alg {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.85rem;
  flex: 1; min-width: 0;
  word-break: break-all;
}
.sol-count {
  font-variant-numeric: tabular-nums;
  color: var(--accent, #ff8800);
  font-size: 0.78rem;
}
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
`;export{h as default};