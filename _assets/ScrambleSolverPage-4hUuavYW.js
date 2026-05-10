import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import"./i18n-CLkWSibr.js";import{t as n}from"./useTranslation-azoUBVHB.js";import{l as r}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as i}from"./jsx-runtime-DhG3BTtD.js";import"./chunk-O6HEZXGY-BrRG8fDn.js";import"./chunk-FLK6AZKB-DdmtX8KK.js";import"./chunk-ZU7PSGX4-WUi2q0O2.js";import"./chunk-DQGYYYHZ-DKwl8nI4.js";import"./puzzles-JOSPK-4d.js";import"./twisty-Bi7mmmFW.js";import{t as a}from"./chevron-down-BqoNF2qJ.js";import{t as o}from"./chevron-right-DMvpQ4mQ.js";import{t as s}from"./download-B00-ugdI.js";import{a as ee,i as te,n as ne,t as re}from"./InteractiveCubeNet-CNme2ew2.js";import{t as ie}from"./eye-off-BGhDWWj4.js";import{t as ae}from"./eye-C4VOSnjZ.js";import{t as oe}from"./LangToggle-Dv6oU4WX.js";import{t as se}from"./loader-circle-Dte1yoym.js";import{t as ce}from"./CubingPreview-DFwSXI2b.js";import{t as c}from"./sparkles-Cq3zV3Qw.js";import{t as l}from"./trash-2-B2u0xSx1.js";import{n as le,t as ue}from"./kociemba.worker-BIDcWGBU.js";import{t as u}from"./x-dnhLp9v_.js";import"./alg-DlsROsge.js";import{a as de,c as d,l as fe,o as pe,r as me,s as he}from"./cube-DlwTn_F1.js";import"./mega_svg-CAbaNYsD.js";var f=e(t(),1),p=i(),m=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],ge=[15,16,17,18,19,20,25,30],_e=[1,5,10,20,50,100];function ve(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function h(){let{i18n:e}=n(),t=e.language===`zh`,i=(e,n)=>t?e:n,[h]=r(),g=(0,f.useMemo)(()=>typeof navigator>`u`?!1:!!(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||navigator.maxTouchPoints>1||typeof window<`u`&&window.matchMedia?.(`(pointer: coarse)`).matches),[]),[_,be]=(0,f.useState)(()=>g?`cube48opt1`:`cube48opt3`),[v,xe]=(0,f.useState)(null),[y,b]=(0,f.useState)(`no-solver`),[Se,x]=(0,f.useState)(-1),[S,C]=(0,f.useState)(``),[w,T]=(0,f.useState)(``),[E,Ce]=(0,f.useState)(15),[D,we]=(0,f.useState)(10),[O,Te]=(0,f.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[k,A]=(0,f.useState)(1),j=(0,f.useRef)([]),[M,N]=(0,f.useState)(new Map),P=(0,f.useRef)(new Map),[F,I]=(0,f.useState)(null),[Ee,De]=(0,f.useState)(re),[Oe,ke]=(0,f.useState)(`U`),[Ae,je]=(0,f.useState)(360);(0,f.useEffect)(()=>{let e=()=>je(Math.min(360,Math.max(200,window.innerWidth-64)));return e(),window.addEventListener(`resize`,e),()=>window.removeEventListener(`resize`,e)},[]);let[L,Me]=(0,f.useState)(()=>{let e=localStorage.getItem(`cubeopt.showPreview`);return e===null?!0:e===`1`});(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.showPreview`,L?`1`:`0`)},[L]);let R=(0,f.useRef)(!1),[z,Ne]=(0,f.useState)(()=>{let e=localStorage.getItem(`cubeopt.autoDownload`);return e===null?!0:e===`1`});(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.autoDownload`,z?`1`:`0`)},[z]);let B=(0,f.useRef)(!1),[V,Pe]=(0,f.useState)(()=>localStorage.getItem(`cubeopt.showLogs`)===`1`);(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.showLogs`,V?`1`:`0`)},[V]);let[H,U]=(0,f.useState)(()=>{let e=localStorage.getItem(`cubeopt.inputMode`);return e===`random`||e===`paste`?e:`paint`});(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.inputMode`,H)},[H]);let[W,Fe]=(0,f.useState)(()=>localStorage.getItem(`cubeopt.showAdvanced`)===`1`);(0,f.useEffect)(()=>{localStorage.setItem(`cubeopt.showAdvanced`,W?`1`:`0`)},[W]);let G=(0,f.useRef)(null),K=(0,f.useRef)(null),q=(0,f.useRef)(null),J=(0,f.useRef)(null),Ie=(0,f.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),Y=(0,f.useRef)(null),[X,Z]=(0,f.useState)(!1),Q=(0,f.useRef)(null);(0,f.useEffect)(()=>{let e=h.get(`scramble`);e&&T(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=h.get(`state`);return t&&Le(t).catch(e=>{I(i(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{Y.current?.terminate(),Y.current=null}},[]);async function Le(e){let t=ee(e);if(t){I(i(`非法状态:${t}`,`Invalid state: ${t}`));return}let n=te(e);if(he(n)){I(i(`状态已是还原态,无需打乱。`,`State is already solved.`)),T(``);return}I(i(`状态合法,Kociemba 求解中(首次需 ~3s 建表)…`,`State valid, solving with Kociemba (first call needs ~3s to build tables)…`)),Z(!0),Y.current||=new ue;let r=Y.current,a=Date.now();try{let e=await new Promise((e,t)=>{let i=null,o=()=>{i&&clearTimeout(i),r.removeEventListener(`message`,s),Q.current=null},s=n=>{n.data?.id===a&&(o(),n.data.ok&&typeof n.data.sol==`string`?e(n.data.sol):t(Error(n.data.err||`kociemba failed`)))};r.addEventListener(`message`,s),Q.current=()=>{o(),r.terminate(),Y.current=null,t(Error(`cancelled`))},i=setTimeout(()=>{o(),r.terminate(),Y.current=null,t(Error(`timeout — 状态可能不可解`))},3e4),r.postMessage({id:a,op:`solve`,state:n})});T(e),I(i(`Kociemba 求出 ${e.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${e.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}finally{Z(!1)}}let Re=()=>{Q.current?.(),Z(!1),I(i(`已取消。`,`Cancelled.`))},ze=e=>{e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();C(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&x(parseInt(n[1],10)/100);let r=/^Solution found!:\s*(.+)$/i.exec(e);if(r){let e=r[1].trim().replace(/\s+/g,` `);j.current.push(e);return}let i=/^Cube(\d+)\s+finished\s+in\s/i.exec(e);if(i){let e=parseInt(i[1],10),t=j.current.shift();t!==void 0&&(P.current.set(e,t),N(new Map(P.current)))}return}if(t.code===-2){x(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)if(t.code===1)b(`no-solver`),xe(null),J.current=null;else{let e={name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)};xe(e),J.current=e,b(t.code===0?`ready`:`need-init`)}else if(t.cmd===`generate table`)t.code===0&&(B.current=!0),b(t.code===0?`ready`:`need-init`),x(-1);else if(t.cmd===`upload table`)t.code===0?b(`ready`):(alert(i(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),b(`need-init`)),x(-1);else if(t.cmd===`start solve`)b(`ready`),x(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=J.current?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}b(`ready`)}}};(0,f.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return G.current=e,ze(e),()=>{e.terminate(),G.current=null}},[]);let Be=()=>{if(!G.current)return;G.current.terminate(),R.current=!1,B.current=!1,x(-1),C(e=>e+`[cancelled by user]
`);let e=new Worker(`/cubeopt/wasm-worker.js`);G.current=e,ze(e),b(`busy`),e.postMessage({cmd:`select solver`,data:_})};(0,f.useEffect)(()=>{G.current&&(b(`busy`),C(``),x(-1),R.current=!1,G.current.postMessage({cmd:`select solver`,data:_}))},[_]),(0,f.useEffect)(()=>{O%k!==0&&A(1)},[O,k]),(0,f.useEffect)(()=>{q.current&&(q.current.scrollTop=q.current.scrollHeight)},[S]);let Ve=()=>{y===`need-init`&&(b(`busy`),C(``),G.current?.postMessage({cmd:`generate table`}))},$=()=>{y===`ready`&&(b(`busy`),G.current?.postMessage({cmd:`download table`}))},He=()=>K.current?.click(),Ue=e=>{let t=e.target.files?.[0];if(t){if(t.name!==v?.table_name){alert(i(`文件名应为 ${v?.table_name}`,`Expected ${v?.table_name}`)),e.target.value=``;return}b(`busy`),x(0),G.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},We=()=>{let e=w.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(i(`打乱不能为空`,`No scrambles`));return}T(e),b(`busy`),C(``),P.current=new Map,N(new Map),j.current=[],G.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:O,n_group:k,debug:1})},Ge=()=>{if(y===`ready`){We();return}if(y===`need-init`){if(!w.split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`)){alert(i(`打乱不能为空`,`No scrambles`));return}R.current=!0,Ve()}};(0,f.useEffect)(()=>{if(y===`ready`){if(B.current&&z){B.current=!1;let e=setTimeout(()=>$(),0);return()=>clearTimeout(e)}B.current=!1,R.current&&(R.current=!1,We())}},[y]);let Ke=()=>{let e=[];for(let t=0;t<D;t++)e.push(ve(E));T(e.join(`
`))},qe=()=>{T(w.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return de(pe(d(e)))}catch{return e}}).join(`
`))},Je=(0,f.useMemo)(()=>{let e=[];for(let t=1;t<=O;t++)O%t===0&&e.push(t);return e},[O]),Ye=(()=>{let e=w.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=d(e);return!!me(fe(),t)}catch{return!1}})})(),Xe=(0,f.useMemo)(()=>{let e=w.split(`
`).map(e=>e.trim()).find(Boolean);if(!e)return null;try{return d(e),e}catch{return null}},[w]);return(0,p.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,p.jsx)(`style`,{children:ye}),(0,p.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,p.jsx)(`h1`,{children:i(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,p.jsx)(oe,{variant:`inline`})]}),!Ie&&(0,p.jsx)(`div`,{className:`cubeopt-warn`,children:i(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),g&&(0,p.jsx)(`div`,{className:`cubeopt-info`,children:(0,p.jsx)(`span`,{children:i(`检测到手机端 — 已默认 cube48opt1 (30M)。手机 wasm 内存有限,opt2/3 视机型可能 OK,opt4 起容易 OOM 崩页;生成时长是桌面的 3-5 倍,期间不要切到后台。`,`Mobile detected — defaulted to cube48opt1 (30M). Mobile wasm memory is tight; opt2/3 may work on flagship phones, opt4+ likely OOM. Gen takes 3-5× longer than desktop; don't background the tab during gen.`)})}),(0,p.jsxs)(`div`,{className:`cubeopt-tabs`,role:`tablist`,children:[(0,p.jsx)(`button`,{role:`tab`,"aria-selected":H===`paint`,className:`tab${H===`paint`?` is-active`:``}`,onClick:()=>U(`paint`),children:i(`从状态画`,`Paint state`)}),(0,p.jsx)(`button`,{role:`tab`,"aria-selected":H===`random`,className:`tab${H===`random`?` is-active`:``}`,onClick:()=>U(`random`),children:i(`随机生成`,`Random`)}),(0,p.jsx)(`button`,{role:`tab`,"aria-selected":H===`paste`,className:`tab${H===`paste`?` is-active`:``}`,onClick:()=>U(`paste`),children:i(`直接粘贴`,`Paste`)})]}),H===`paint`&&(0,p.jsx)(`section`,{className:`cubeopt-card`,children:(0,p.jsx)(`div`,{className:`paint-wrap`,children:(0,p.jsx)(ne,{facelet:Ee,onChange:De,activeColor:Oe,onActiveColorChange:ke,pixelSize:Ae,solveLabel:{zh:`求打乱`,en:`Derive scramble`},onSolve:e=>{X||Le(e).catch(e=>{I(i(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))})}})})}),H===`random`&&(0,p.jsx)(`section`,{className:`cubeopt-card`,children:(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`select`,{className:`ctl-sm`,value:E,onChange:e=>Ce(parseInt(e.target.value,10)),children:ge.map(e=>(0,p.jsxs)(`option`,{value:e,children:[e,` `,i(`步`,`moves`)]},e))}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:D,onChange:e=>we(parseInt(e.target.value,10)),children:_e.map(e=>(0,p.jsxs)(`option`,{value:e,children:[e,` `,i(`个`,`cubes`)]},e))}),(0,p.jsx)(`button`,{className:`btn-primary`,onClick:Ke,children:i(`生成到打乱框`,`Generate`)})]})}),F&&(0,p.jsxs)(`div`,{className:`cubeopt-info`,children:[X&&(0,p.jsx)(se,{size:14,className:`spinning`}),(0,p.jsx)(`span`,{children:F}),X&&(0,p.jsxs)(`button`,{className:`btn-cancel-sm`,onClick:Re,children:[(0,p.jsx)(u,{size:12}),` `,i(`取消`,`Cancel`)]})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:i(`打乱`,`Scramble`)}),(0,p.jsx)(`button`,{className:`btn-icon`,onClick:qe,title:i(`每行反向`,`Invert each line`),children:(0,p.jsx)(c,{size:14})}),(0,p.jsx)(`button`,{className:`btn-icon${L?` is-active`:``}`,onClick:()=>Me(e=>!e),title:i(`显示第一行打乱产生的状态`,`Show state after the first scramble`),children:L?(0,p.jsx)(ae,{size:14}):(0,p.jsx)(ie,{size:14})}),(0,p.jsx)(`button`,{className:`btn-icon`,onClick:()=>T(``),title:i(`清空`,`Clear`),children:(0,p.jsx)(l,{size:14})}),(0,p.jsx)(`span`,{className:`row-spacer`}),y===`busy`?(0,p.jsxs)(`button`,{className:`btn-cancel`,onClick:Be,title:i(`终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。`,`Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.`),children:[(0,p.jsx)(u,{size:14}),` `,i(`取消`,`Cancel`)]}):(0,p.jsx)(`button`,{className:`btn-primary`,disabled:y===`no-solver`||!Ye,onClick:Ge,title:y===`need-init`?i(`会先自动生成 prun 表(几十秒)再求最优解`,`Will auto-generate the prun table (tens of seconds) then solve`):i(`用 cubeopt 求 HTM 最少步解`,`Solve optimally with cubeopt`),children:y===`need-init`?(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(c,{size:14}),` `,i(`生成表+求最优`,`Gen Table + Solve`)]}):(0,p.jsx)(p.Fragment,{children:`Solve`})})]}),(0,p.jsx)(`textarea`,{className:`scramble-area`,rows:H===`paste`?6:4,placeholder:H===`paste`?i(`把 cubedb / cstimer / WCA scramble 粘到这里,每行一个,然后 Solve。`,`Paste scrambles here (one per line), then Solve.`):`R U R' U' R' F R2 U' R' U' R U R' F'`,value:w,onChange:e=>T(e.target.value)}),L&&Xe&&(0,p.jsx)(`div`,{className:`scramble-preview-mini`,children:(0,p.jsx)(ce,{event:`333`,scramble:Xe,visualization:`2D`,size:14,className:`scramble-preview-svg`})})]}),M.size>0&&(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:i(`解 (按输入顺序)`,`Solutions (input order)`)}),(0,p.jsx)(`span`,{className:`paint-hint`,children:i(`cubeopt 是按完成顺序输出的;此处按输入序号 1..N 排好,并标注步数。`,`cubeopt outputs in finish order; this panel re-sorts by input index 1..N with move counts.`)}),(0,p.jsx)(`button`,{className:`btn-icon`,onClick:()=>{let e=Array.from(M.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>`${e}. ${t}`).join(`
`);navigator.clipboard?.writeText(e)},title:i(`复制全部`,`Copy all`),children:(0,p.jsx)(c,{size:14})})]}),(0,p.jsx)(`ol`,{className:`solutions-list`,children:Array.from(M.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>{let n=t.split(/\s+/).filter(Boolean).length;return(0,p.jsxs)(`li`,{children:[(0,p.jsxs)(`span`,{className:`sol-idx`,children:[e,`.`]}),(0,p.jsx)(`code`,{className:`sol-alg`,children:t}),(0,p.jsxs)(`span`,{className:`sol-count`,children:[`(`,n,`)`]})]},e)})})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card cubeopt-advanced`,children:[(0,p.jsxs)(`button`,{className:`advanced-toggle`,onClick:()=>Fe(e=>!e),children:[W?(0,p.jsx)(a,{size:14}):(0,p.jsx)(o,{size:14}),(0,p.jsx)(`span`,{children:i(`高级设置`,`Advanced`)}),(0,p.jsxs)(`span`,{className:`advanced-summary`,children:[_,` · `,O,i(`线程`,`threads`),y===`ready`&&(0,p.jsxs)(p.Fragment,{children:[` · `,i(`就绪`,`ready`)]}),y===`need-init`&&(0,p.jsxs)(p.Fragment,{children:[` · `,i(`表未生成`,`table not built`)]}),y===`busy`&&(0,p.jsxs)(p.Fragment,{children:[` · `,(0,p.jsx)(se,{size:12,className:`spinning`}),` `,i(`忙`,`busy`)]})]})]}),W&&(0,p.jsxs)(p.Fragment,{children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,p.jsx)(`select`,{className:`ctl`,value:_,disabled:y===`busy`,onChange:e=>be(e.target.value),children:m.map(e=>(0,p.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,p.jsx)(`span`,{className:`size-badge`,children:m.find(e=>e.value===_)?.size})]}),(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:i(`Prun 表`,`Prun Table`)}),(0,p.jsx)(`span`,{className:`table-name`,children:v?.table_name??i(`未就绪`,`Not Ready`)}),(0,p.jsxs)(`label`,{className:`auto-dl`,children:[(0,p.jsx)(`input`,{type:`checkbox`,checked:z,onChange:e=>Ne(e.target.checked)}),(0,p.jsx)(`span`,{children:i(`生成后自动下载`,`Auto-download after gen`)})]}),y===`need-init`&&(0,p.jsxs)(p.Fragment,{children:[(0,p.jsx)(`button`,{className:`btn`,onClick:Ve,children:i(`生成表`,`Generate Table`)}),(0,p.jsxs)(`button`,{className:`btn`,onClick:He,children:[(0,p.jsx)(le,{size:14}),` `,i(`上传表`,`Upload Table`)]})]}),y===`ready`&&(0,p.jsxs)(`button`,{className:`btn`,onClick:$,children:[(0,p.jsx)(s,{size:14}),` `,i(`下载表`,`Download Table`)]}),(0,p.jsx)(`input`,{ref:K,type:`file`,style:{display:`none`},onChange:Ue})]}),Se>=0&&(0,p.jsx)(`div`,{className:`progress`,children:(0,p.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(Se*100)}%`}})}),(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:i(`线程`,`Threads`)}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:O,onChange:e=>Te(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,p.jsx)(`option`,{value:e,children:e},e))}),(0,p.jsx)(`span`,{className:`lbl`,children:i(`并发块`,`Concurrent`)}),(0,p.jsx)(`select`,{className:`ctl-sm`,value:k,onChange:e=>A(parseInt(e.target.value,10)),children:Je.map(e=>(0,p.jsx)(`option`,{value:e,children:e},e))})]})]})]}),(0,p.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,p.jsxs)(`div`,{className:`row`,children:[(0,p.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,p.jsxs)(`button`,{className:`btn`,onClick:()=>Pe(e=>!e),children:[V?i(`收起`,`Hide`):i(`展开 raw 输出`,`Show raw output`),S?` (${S.split(`
`).length-1})`:``]}),V&&(0,p.jsx)(`button`,{className:`btn-icon`,onClick:()=>C(``),title:`Clear logs`,children:(0,p.jsx)(l,{size:14})})]}),V&&(0,p.jsx)(`textarea`,{ref:q,className:`logs-area`,rows:10,value:S,readOnly:!0})]}),(0,p.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,p.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,p.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var ye=`
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
.cubeopt-tabs {
  display: flex; gap: 0.25rem;
  margin: 0.75rem 0;
  border-bottom: 1px solid var(--border, #333);
}
.cubeopt-tabs .tab {
  background: transparent; border: none; color: var(--text-muted, #aaa);
  padding: 0.45rem 0.9rem; font-size: 0.9rem; cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.12s ease, border-color 0.12s ease;
}
.cubeopt-tabs .tab:hover { color: var(--text); }
.cubeopt-tabs .tab.is-active {
  color: var(--accent, #ff8800);
  border-bottom-color: var(--accent, #ff8800);
}
.row-spacer { flex: 1; }
.advanced-toggle {
  display: flex; align-items: center; gap: 0.4rem;
  width: 100%; background: transparent; border: none; color: var(--text);
  padding: 0.25rem 0; font-size: 0.9rem; cursor: pointer; text-align: left;
}
.advanced-toggle:hover { color: var(--accent, #ff8800); }
.advanced-summary {
  margin-left: auto; color: var(--text-muted, #888); font-size: 0.8rem;
  display: inline-flex; align-items: center; gap: 0.3rem;
}
.cubeopt-advanced { padding-bottom: 0.25rem; }
.scramble-preview-mini {
  margin-top: 0.5rem;
  display: inline-block;
  padding: 0.4rem;
  background: var(--panel-sub, #181818);
  border-radius: 5px;
  border: 1px dashed var(--border, #333);
}
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
.scramble-preview-svg { flex-shrink: 0; }
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
.paint-hint {
  flex: 1; min-width: 12rem;
  font-size: 0.8rem; color: var(--text-muted, #888);
  line-height: 1.4;
}
.paint-wrap {
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
  .lbl { min-width: 3.5rem; font-size: 0.78rem; }
  .ctl, .ctl-sm { font-size: 0.8rem; padding: 0.25rem 0.35rem; }
  .size-badge, .table-name, .auto-dl { font-size: 0.75rem; }
  .auto-dl span { white-space: nowrap; }
  .btn, .btn-primary, .btn-cancel { font-size: 0.78rem; padding: 0.3rem 0.5rem; }
  .row { gap: 0.35rem; }
  .paint-hint { font-size: 0.72rem; line-height: 1.3; }
}
`;export{h as default};