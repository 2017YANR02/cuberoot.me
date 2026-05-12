import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import"./i18n-BV-At-Q6.js";import{t as n}from"./useTranslation-azoUBVHB.js";import{l as r}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as i}from"./jsx-runtime-DhG3BTtD.js";import"./chunk-O6HEZXGY-BrRG8fDn.js";import"./chunk-FLK6AZKB-DdmtX8KK.js";import"./chunk-ZU7PSGX4-WUi2q0O2.js";import"./chunk-DQGYYYHZ-DKwl8nI4.js";import"./puzzles-JOSPK-4d.js";import"./twisty-Bi7mmmFW.js";import{t as a}from"./chevron-down-BqoNF2qJ.js";import{t as o}from"./chevron-right-DMvpQ4mQ.js";import{t as s}from"./download-B00-ugdI.js";import{a as ee,i as te,n as ne,t as re}from"./InteractiveCubeNet-CFrZdP3I.js";import{t as ie}from"./eye-off-BGhDWWj4.js";import{t as ae}from"./eye-C4VOSnjZ.js";import{t as oe}from"./LangToggle-Cg6G6M0g.js";import{t as se}from"./loader-circle-DXHrZD7A.js";import{t as c}from"./sparkles-CgrQB_-4.js";import{t as ce}from"./trash-2-OOQyvbvv.js";import{n as le,t as ue}from"./kociemba.worker-D__-U0Zg.js";import{t as l}from"./x-BAffn6FA.js";import"./alg-BshNPth9.js";import{a as de,c as u,l as fe,o as pe,r as me,s as he}from"./cube-D9VCJXuS.js";import{t as ge}from"./CubingPreview-BMh9_09t.js";import"./mega_svg-B1c4bUpv.js";var d=e(t(),1),f=i(),p=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],_e=[15,16,17,18,19,20,25,30],ve=[1,5,10,20,50,100];function ye(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function m(){let{i18n:e}=n(),t=e.language===`zh`,i=(e,n)=>t?e:n,[m]=r(),h=(0,d.useMemo)(()=>typeof navigator>`u`?!1:!!(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||navigator.maxTouchPoints>1||typeof window<`u`&&window.matchMedia?.(`(pointer: coarse)`).matches),[]),[g,xe]=(0,d.useState)(()=>h?`cube48opt1`:`cube48opt3`),[_,Se]=(0,d.useState)(null),[v,y]=(0,d.useState)(`no-solver`),[Ce,b]=(0,d.useState)(-1),[x,S]=(0,d.useState)(``),[C,w]=(0,d.useState)(``),[T,we]=(0,d.useState)(15),[E,Te]=(0,d.useState)(10),[D,Ee]=(0,d.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[O,k]=(0,d.useState)(1),A=(0,d.useRef)([]),[j,M]=(0,d.useState)(new Map),N=(0,d.useRef)(new Map),[P,F]=(0,d.useState)(null),[De,Oe]=(0,d.useState)(re),[ke,Ae]=(0,d.useState)(`U`),[je,Me]=(0,d.useState)(360);(0,d.useEffect)(()=>{let e=()=>Me(Math.min(360,Math.max(200,window.innerWidth-64)));return e(),window.addEventListener(`resize`,e),()=>window.removeEventListener(`resize`,e)},[]);let[I,Ne]=(0,d.useState)(()=>{let e=localStorage.getItem(`cubeopt.showPreview`);return e===null?!0:e===`1`});(0,d.useEffect)(()=>{localStorage.setItem(`cubeopt.showPreview`,I?`1`:`0`)},[I]);let L=(0,d.useRef)(!1),[R,Pe]=(0,d.useState)(()=>{let e=localStorage.getItem(`cubeopt.autoDownload`);return e===null?!0:e===`1`});(0,d.useEffect)(()=>{localStorage.setItem(`cubeopt.autoDownload`,R?`1`:`0`)},[R]);let z=(0,d.useRef)(!1),[B,Fe]=(0,d.useState)(()=>localStorage.getItem(`cubeopt.showLogs`)===`1`);(0,d.useEffect)(()=>{localStorage.setItem(`cubeopt.showLogs`,B?`1`:`0`)},[B]);let[V,H]=(0,d.useState)(()=>{let e=localStorage.getItem(`cubeopt.inputMode`);return e===`random`||e===`paste`?e:`paint`});(0,d.useEffect)(()=>{localStorage.setItem(`cubeopt.inputMode`,V)},[V]);let[U,Ie]=(0,d.useState)(()=>localStorage.getItem(`cubeopt.showAdvanced`)===`1`);(0,d.useEffect)(()=>{localStorage.setItem(`cubeopt.showAdvanced`,U?`1`:`0`)},[U]);let W=(0,d.useRef)(null),G=(0,d.useRef)(null),K=(0,d.useRef)(null),q=(0,d.useRef)(null),Le=(0,d.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),J=(0,d.useRef)(null),[Y,X]=(0,d.useState)(!1),Z=(0,d.useRef)(null);(0,d.useEffect)(()=>{let e=m.get(`scramble`);e&&w(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=m.get(`state`);return t&&Re(t).catch(e=>{F(i(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{J.current?.terminate(),J.current=null}},[]);async function Re(e){let t=ee(e);if(t){F(i(`非法状态:${t}`,`Invalid state: ${t}`));return}let n=te(e);if(he(n)){F(i(`状态已是还原态,无需打乱。`,`State is already solved.`)),w(``);return}F(i(`状态合法,Kociemba 求解中(首次需 ~3s 建表)…`,`State valid, solving with Kociemba (first call needs ~3s to build tables)…`)),X(!0),J.current||=new ue;let r=J.current,a=Date.now();try{let e=await new Promise((e,t)=>{let i=null,o=()=>{i&&clearTimeout(i),r.removeEventListener(`message`,s),Z.current=null},s=n=>{n.data?.id===a&&(o(),n.data.ok&&typeof n.data.sol==`string`?e(n.data.sol):t(Error(n.data.err||`kociemba failed`)))};r.addEventListener(`message`,s),Z.current=()=>{o(),r.terminate(),J.current=null,t(Error(`cancelled`))},i=setTimeout(()=>{o(),r.terminate(),J.current=null,t(Error(`timeout — 状态可能不可解`))},3e4),r.postMessage({id:a,op:`solve`,state:n})});w(e),F(i(`Kociemba 求出 ${e.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${e.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}finally{X(!1)}}let ze=()=>{Z.current?.(),X(!1),F(i(`已取消。`,`Cancelled.`))},Be=e=>{e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();S(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&b(parseInt(n[1],10)/100);let r=/^Solution found!:\s*(.+)$/i.exec(e);if(r){let e=r[1].trim().replace(/\s+/g,` `);A.current.push(e);return}let i=/^Cube(\d+)\s+finished\s+in\s/i.exec(e);if(i){let e=parseInt(i[1],10),t=A.current.shift();t!==void 0&&(N.current.set(e,t),M(new Map(N.current)))}return}if(t.code===-2){b(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)if(t.code===1)y(`no-solver`),Se(null),q.current=null;else{let e={name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)};Se(e),q.current=e,y(t.code===0?`ready`:`need-init`)}else if(t.cmd===`generate table`)t.code===0&&(z.current=!0),y(t.code===0?`ready`:`need-init`),b(-1);else if(t.cmd===`upload table`)t.code===0?y(`ready`):(alert(i(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),y(`need-init`)),b(-1);else if(t.cmd===`start solve`)y(`ready`),b(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=q.current?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}y(`ready`)}}};(0,d.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return W.current=e,Be(e),()=>{e.terminate(),W.current=null}},[]);let Ve=()=>{if(!W.current)return;W.current.terminate(),L.current=!1,z.current=!1,b(-1),S(e=>e+`[cancelled by user]
`);let e=new Worker(`/cubeopt/wasm-worker.js`);W.current=e,Be(e),y(`busy`),e.postMessage({cmd:`select solver`,data:g})};(0,d.useEffect)(()=>{W.current&&(y(`busy`),S(``),b(-1),L.current=!1,W.current.postMessage({cmd:`select solver`,data:g}))},[g]),(0,d.useEffect)(()=>{D%O!==0&&k(1)},[D,O]),(0,d.useEffect)(()=>{K.current&&(K.current.scrollTop=K.current.scrollHeight)},[x]);let He=()=>{v===`need-init`&&(y(`busy`),S(``),W.current?.postMessage({cmd:`generate table`}))},Q=()=>{v===`ready`&&(y(`busy`),W.current?.postMessage({cmd:`download table`}))},Ue=()=>G.current?.click(),We=e=>{let t=e.target.files?.[0];if(t){if(t.name!==_?.table_name){alert(i(`文件名应为 ${_?.table_name}`,`Expected ${_?.table_name}`)),e.target.value=``;return}y(`busy`),b(0),W.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},Ge=()=>{let e=C.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(i(`打乱不能为空`,`No scrambles`));return}w(e),y(`busy`),S(``),N.current=new Map,M(new Map),A.current=[],W.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:D,n_group:O,debug:1})},Ke=()=>{if(v===`ready`){Ge();return}if(v===`need-init`){if(!C.split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`)){alert(i(`打乱不能为空`,`No scrambles`));return}L.current=!0,He()}};(0,d.useEffect)(()=>{if(v===`ready`){if(z.current&&R){z.current=!1;let e=setTimeout(()=>Q(),0);return()=>clearTimeout(e)}z.current=!1,L.current&&(L.current=!1,Ge())}},[v]);let qe=()=>{let e=[];for(let t=0;t<E;t++)e.push(ye(T));w(e.join(`
`))},Je=()=>{w(C.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return de(pe(u(e)))}catch{return e}}).join(`
`))},Ye=(0,d.useMemo)(()=>{let e=[];for(let t=1;t<=D;t++)D%t===0&&e.push(t);return e},[D]),Xe=(()=>{let e=C.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=u(e);return!!me(fe(),t)}catch{return!1}})})(),$=(0,d.useMemo)(()=>{let e=C.split(`
`).map(e=>e.trim()).find(Boolean);if(!e)return null;try{return u(e),e}catch{return null}},[C]);return(0,f.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,f.jsx)(`style`,{children:be}),(0,f.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,f.jsx)(`h1`,{children:i(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,f.jsx)(oe,{variant:`inline`})]}),!Le&&(0,f.jsx)(`div`,{className:`cubeopt-warn`,children:i(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),h&&(0,f.jsx)(`div`,{className:`cubeopt-info`,children:(0,f.jsx)(`span`,{children:i(`检测到手机端 — 已默认 cube48opt1 (30M)。手机 wasm 内存有限,opt2/3 视机型可能 OK,opt4 起容易 OOM 崩页;生成时长是桌面的 3-5 倍,期间不要切到后台。`,`Mobile detected — defaulted to cube48opt1 (30M). Mobile wasm memory is tight; opt2/3 may work on flagship phones, opt4+ likely OOM. Gen takes 3-5× longer than desktop; don't background the tab during gen.`)})}),(0,f.jsxs)(`div`,{className:`cubeopt-tabs`,role:`tablist`,children:[(0,f.jsx)(`button`,{role:`tab`,"aria-selected":V===`paint`,className:`tab${V===`paint`?` is-active`:``}`,onClick:()=>H(`paint`),children:i(`从状态画`,`Paint state`)}),(0,f.jsx)(`button`,{role:`tab`,"aria-selected":V===`random`,className:`tab${V===`random`?` is-active`:``}`,onClick:()=>H(`random`),children:i(`随机生成`,`Random`)}),(0,f.jsx)(`button`,{role:`tab`,"aria-selected":V===`paste`,className:`tab${V===`paste`?` is-active`:``}`,onClick:()=>H(`paste`),children:i(`直接粘贴`,`Paste`)})]}),V===`paint`&&(0,f.jsx)(`section`,{className:`cubeopt-card`,children:(0,f.jsx)(`div`,{className:`paint-wrap`,children:(0,f.jsx)(ne,{facelet:De,onChange:Oe,activeColor:ke,onActiveColorChange:Ae,pixelSize:je,solveLabel:{zh:`求打乱`,en:`Derive scramble`},onSolve:e=>{Y||Re(e).catch(e=>{F(i(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))})}})})}),V===`random`&&(0,f.jsx)(`section`,{className:`cubeopt-card`,children:(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`select`,{className:`ctl-sm`,value:T,onChange:e=>we(parseInt(e.target.value,10)),children:_e.map(e=>(0,f.jsxs)(`option`,{value:e,children:[e,` `,i(`步`,`moves`)]},e))}),(0,f.jsx)(`select`,{className:`ctl-sm`,value:E,onChange:e=>Te(parseInt(e.target.value,10)),children:ve.map(e=>(0,f.jsxs)(`option`,{value:e,children:[e,` `,i(`个`,`cubes`)]},e))}),(0,f.jsx)(`button`,{className:`btn-primary`,onClick:qe,children:i(`生成到打乱框`,`Generate`)})]})}),P&&(0,f.jsxs)(`div`,{className:`cubeopt-info`,children:[Y&&(0,f.jsx)(se,{size:14,className:`spinning`}),(0,f.jsx)(`span`,{children:P}),Y&&(0,f.jsxs)(`button`,{className:`btn-cancel-sm`,onClick:ze,children:[(0,f.jsx)(l,{size:12}),` `,i(`取消`,`Cancel`)]})]}),(0,f.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`span`,{className:`lbl`,children:i(`打乱`,`Scramble`)}),(0,f.jsx)(`button`,{className:`btn-icon`,onClick:Je,title:i(`每行反向`,`Invert each line`),children:(0,f.jsx)(c,{size:14})}),(0,f.jsx)(`button`,{className:`btn-icon${I?` is-active`:``}`,onClick:()=>Ne(e=>!e),title:i(`显示第一行打乱产生的状态`,`Show state after the first scramble`),children:I?(0,f.jsx)(ae,{size:14}):(0,f.jsx)(ie,{size:14})}),(0,f.jsx)(`button`,{className:`btn-icon`,onClick:()=>w(``),title:i(`清空`,`Clear`),children:(0,f.jsx)(ce,{size:14})}),(0,f.jsx)(`span`,{className:`row-spacer`}),v===`busy`?(0,f.jsxs)(`button`,{className:`btn-cancel`,onClick:Ve,title:i(`终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。`,`Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.`),children:[(0,f.jsx)(l,{size:14}),` `,i(`取消`,`Cancel`)]}):(0,f.jsx)(`button`,{className:`btn-primary`,disabled:v===`no-solver`||!Xe,onClick:Ke,title:v===`need-init`?i(`会先自动生成 prun 表(几十秒)再求最优解`,`Will auto-generate the prun table (tens of seconds) then solve`):i(`用 cubeopt 求 HTM 最少步解`,`Solve optimally with cubeopt`),children:v===`need-init`?(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(c,{size:14}),` `,i(`生成表+求最优`,`Gen Table + Solve`)]}):(0,f.jsx)(f.Fragment,{children:`Solve`})})]}),(0,f.jsx)(`textarea`,{className:`scramble-area`,rows:V===`paste`?6:4,placeholder:V===`paste`?i(`把 cubedb / cstimer / WCA scramble 粘到这里,每行一个,然后 Solve。`,`Paste scrambles here (one per line), then Solve.`):`R U R' U' R' F R2 U' R' U' R U R' F'`,value:C,onChange:e=>w(e.target.value)}),I&&$&&(0,f.jsx)(`div`,{className:`scramble-preview-mini`,children:(0,f.jsx)(ge,{event:`333`,scramble:$,visualization:`2D`,size:14,className:`scramble-preview-svg`})})]}),j.size>0&&(0,f.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`span`,{className:`lbl`,children:i(`解 (按输入顺序)`,`Solutions (input order)`)}),(0,f.jsx)(`span`,{className:`paint-hint`,children:i(`cubeopt 是按完成顺序输出的;此处按输入序号 1..N 排好,并标注步数。`,`cubeopt outputs in finish order; this panel re-sorts by input index 1..N with move counts.`)}),(0,f.jsx)(`button`,{className:`btn-icon`,onClick:()=>{let e=Array.from(j.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>`${e}. ${t}`).join(`
`);navigator.clipboard?.writeText(e)},title:i(`复制全部`,`Copy all`),children:(0,f.jsx)(c,{size:14})})]}),(0,f.jsx)(`ol`,{className:`solutions-list`,children:Array.from(j.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>{let n=t.split(/\s+/).filter(Boolean).length;return(0,f.jsxs)(`li`,{children:[(0,f.jsxs)(`span`,{className:`sol-idx`,children:[e,`.`]}),(0,f.jsx)(`code`,{className:`sol-alg`,children:t}),(0,f.jsxs)(`span`,{className:`sol-count`,children:[`(`,n,`)`]})]},e)})})]}),(0,f.jsxs)(`section`,{className:`cubeopt-card cubeopt-advanced`,children:[(0,f.jsxs)(`button`,{className:`advanced-toggle`,onClick:()=>Ie(e=>!e),children:[U?(0,f.jsx)(a,{size:14}):(0,f.jsx)(o,{size:14}),(0,f.jsx)(`span`,{children:i(`高级设置`,`Advanced`)}),(0,f.jsxs)(`span`,{className:`advanced-summary`,children:[g,` · `,D,i(`线程`,`threads`),v===`ready`&&(0,f.jsxs)(f.Fragment,{children:[` · `,i(`就绪`,`ready`)]}),v===`need-init`&&(0,f.jsxs)(f.Fragment,{children:[` · `,i(`表未生成`,`table not built`)]}),v===`busy`&&(0,f.jsxs)(f.Fragment,{children:[` · `,(0,f.jsx)(se,{size:12,className:`spinning`}),` `,i(`忙`,`busy`)]})]})]}),U&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,f.jsx)(`select`,{className:`ctl`,value:g,disabled:v===`busy`,onChange:e=>xe(e.target.value),children:p.map(e=>(0,f.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,f.jsx)(`span`,{className:`size-badge`,children:p.find(e=>e.value===g)?.size})]}),(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`span`,{className:`lbl`,children:i(`Prun 表`,`Prun Table`)}),(0,f.jsx)(`span`,{className:`table-name`,children:_?.table_name??i(`未就绪`,`Not Ready`)}),(0,f.jsxs)(`label`,{className:`auto-dl`,children:[(0,f.jsx)(`input`,{type:`checkbox`,checked:R,onChange:e=>Pe(e.target.checked)}),(0,f.jsx)(`span`,{children:i(`生成后自动下载`,`Auto-download after gen`)})]}),v===`need-init`&&(0,f.jsxs)(f.Fragment,{children:[(0,f.jsx)(`button`,{className:`btn`,onClick:He,children:i(`生成表`,`Generate Table`)}),(0,f.jsxs)(`button`,{className:`btn`,onClick:Ue,children:[(0,f.jsx)(le,{size:14}),` `,i(`上传表`,`Upload Table`)]})]}),v===`ready`&&(0,f.jsxs)(`button`,{className:`btn`,onClick:Q,children:[(0,f.jsx)(s,{size:14}),` `,i(`下载表`,`Download Table`)]}),(0,f.jsx)(`input`,{ref:G,type:`file`,style:{display:`none`},onChange:We})]}),Ce>=0&&(0,f.jsx)(`div`,{className:`progress`,children:(0,f.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(Ce*100)}%`}})}),(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`span`,{className:`lbl`,children:i(`线程`,`Threads`)}),(0,f.jsx)(`select`,{className:`ctl-sm`,value:D,onChange:e=>Ee(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,f.jsx)(`option`,{value:e,children:e},e))}),(0,f.jsx)(`span`,{className:`lbl`,children:i(`并发块`,`Concurrent`)}),(0,f.jsx)(`select`,{className:`ctl-sm`,value:O,onChange:e=>k(parseInt(e.target.value,10)),children:Ye.map(e=>(0,f.jsx)(`option`,{value:e,children:e},e))})]})]})]}),(0,f.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,f.jsxs)(`div`,{className:`row`,children:[(0,f.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,f.jsxs)(`button`,{className:`btn`,onClick:()=>Fe(e=>!e),children:[B?i(`收起`,`Hide`):i(`展开 raw 输出`,`Show raw output`),x?` (${x.split(`
`).length-1})`:``]}),B&&(0,f.jsx)(`button`,{className:`btn-icon`,onClick:()=>S(``),title:`Clear logs`,children:(0,f.jsx)(ce,{size:14})})]}),B&&(0,f.jsx)(`textarea`,{ref:K,className:`logs-area`,rows:10,value:x,readOnly:!0})]}),(0,f.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,f.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,f.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var be=`
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
`;export{m as default};