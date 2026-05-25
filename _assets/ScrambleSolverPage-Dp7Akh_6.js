import{a as e}from"./chunk-Byb_VWJN.js";import{t}from"./react-BHPi-aqk.js";import"./i18n-D_AwgRlv.js";import{t as n}from"./useTranslation-azoUBVHB.js";import{l as r}from"./chunk-LFPYN7LY-DZAbSnaa.js";import{t as i}from"./jsx-runtime-DhG3BTtD.js";import{t as a}from"./useDocumentTitle-CfaTL6fp.js";import"./chunk-O6HEZXGY-C4e57qZZ.js";import"./chunk-FLK6AZKB-1f3vB7OV.js";import"./chunk-ZU7PSGX4-BnBSvhnu.js";import"./chunk-DQGYYYHZ-DdB0WRm6.js";import"./puzzles-B11ltfYd.js";import"./twisty-cwJdn_aA.js";import{t as o}from"./chevron-down-BOTeUcF-.js";import{t as s}from"./chevron-right-CWEpMgMr.js";import{t as ee}from"./download-DCVmJKdg.js";import{t as te}from"./eye-off-CWK4lWFC.js";import{t as ne}from"./eye-CdvpEs4d.js";import{t as c}from"./loader-circle-B11kRx4w.js";import{t as l}from"./sparkles-DKiTHME2.js";import{t as u}from"./trash-2-BDBTRN4a.js";import{n as re,t as ie}from"./kociemba.worker-CN3TzVo6.js";import{t as d}from"./x-kZ6PGhhE.js";import{t as ae}from"./LangToggle-B26evJYn.js";import"./alg-NM6EQtum.js";import"./sq1_svg-CorKB9LN.js";import{a as oe,c as f,l as se,o as ce,r as le,s as ue}from"./cube-DxaM-XyU.js";import{t as de}from"./CubingPreview-BkFa8MsV.js";import"./mega_svg-CJjfZwUI.js";import{a as fe,i as pe,n as me,t as he}from"./InteractiveCubeNet-C1VNYzpi.js";var p=e(t(),1),m=i(),ge=[{value:`cube48opt1`,size:`30.4M`},{value:`cube48opt2`,size:`121M`},{value:`cube48opt3`,size:`243M`},{value:`cube48opt4`,size:`486M`},{value:`cube48opt5`,size:`972M`},{value:`cube48opt6`,size:`1.9G`},{value:`cube48opt7`,size:`3.8G`},{value:`cube48opt8`,size:`7.6G`},{value:`cube48opt9`,size:`15G`}],_e=[15,16,17,18,19,20,25,30],ve=[1,5,10,20,50,100];function ye(e){let t=[];for(let n=0;n<e;n++){let e=Math.floor(Math.random()*18);if(t.length>0&&Math.floor(e/3)===Math.floor(t[t.length-1]/3)){n--;continue}if(t.length>1&&Math.floor(e/3)%3==Math.floor(t[t.length-1]/3)%3&&Math.floor(e/3)===Math.floor(t[t.length-2]/3)){n--;continue}t.push(e)}return t.map(e=>`URFDLB`.charAt(Math.floor(e/3))+[``,`2`,`'`][e%3]).join(` `)}function h(){let{i18n:e}=n(),t=e.language===`zh`;a(`求解器`,`Solver`);let i=(e,n)=>t?e:n,[h]=r(),g=(0,p.useMemo)(()=>typeof navigator>`u`?!1:!!(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||navigator.maxTouchPoints>1||typeof window<`u`&&window.matchMedia?.(`(pointer: coarse)`).matches),[]),[_,xe]=(0,p.useState)(()=>g?`cube48opt1`:`cube48opt3`),[v,y]=(0,p.useState)(null),[b,x]=(0,p.useState)(`no-solver`),[S,C]=(0,p.useState)(-1),[w,T]=(0,p.useState)(``),[E,D]=(0,p.useState)(``),[O,Se]=(0,p.useState)(15),[k,Ce]=(0,p.useState)(10),[A,we]=(0,p.useState)(()=>typeof navigator<`u`&&navigator.hardwareConcurrency||4),[j,M]=(0,p.useState)(1),N=(0,p.useRef)([]),[P,F]=(0,p.useState)(new Map),I=(0,p.useRef)(new Map),[Te,L]=(0,p.useState)(null),[Ee,De]=(0,p.useState)(he),[Oe,ke]=(0,p.useState)(`U`),[Ae,je]=(0,p.useState)(360);(0,p.useEffect)(()=>{let e=()=>je(Math.min(360,Math.max(200,window.innerWidth-64)));return e(),window.addEventListener(`resize`,e),()=>window.removeEventListener(`resize`,e)},[]);let[R,Me]=(0,p.useState)(()=>{let e=localStorage.getItem(`cubeopt.showPreview`);return e===null?!0:e===`1`});(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.showPreview`,R?`1`:`0`)},[R]);let z=(0,p.useRef)(!1),[B,Ne]=(0,p.useState)(()=>{let e=localStorage.getItem(`cubeopt.autoDownload`);return e===null?!0:e===`1`});(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.autoDownload`,B?`1`:`0`)},[B]);let V=(0,p.useRef)(!1),[H,Pe]=(0,p.useState)(()=>localStorage.getItem(`cubeopt.showLogs`)===`1`);(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.showLogs`,H?`1`:`0`)},[H]);let[U,W]=(0,p.useState)(()=>{let e=localStorage.getItem(`cubeopt.inputMode`);return e===`random`||e===`paste`?e:`paint`});(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.inputMode`,U)},[U]);let[G,Fe]=(0,p.useState)(()=>localStorage.getItem(`cubeopt.showAdvanced`)===`1`);(0,p.useEffect)(()=>{localStorage.setItem(`cubeopt.showAdvanced`,G?`1`:`0`)},[G]);let K=(0,p.useRef)(null),Ie=(0,p.useRef)(null),q=(0,p.useRef)(null),J=(0,p.useRef)(null),Le=(0,p.useMemo)(()=>typeof window<`u`&&typeof SharedArrayBuffer<`u`&&window.crossOriginIsolated,[]),Y=(0,p.useRef)(null),[X,Z]=(0,p.useState)(!1),Q=(0,p.useRef)(null);(0,p.useEffect)(()=>{let e=h.get(`scramble`);e&&D(e.replace(/\+/g,` `).replace(/_/g,` `).replace(/\\n/g,`
`).replace(/\|/g,`
`).trim());let t=h.get(`state`);return t&&Re(t).catch(e=>{L(i(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))}),()=>{Y.current?.terminate(),Y.current=null}},[]);async function Re(e){let t=fe(e);if(t){L(i(`非法状态:${t}`,`Invalid state: ${t}`));return}let n=pe(e);if(ue(n)){L(i(`状态已是还原态,无需打乱。`,`State is already solved.`)),D(``);return}L(i(`状态合法,Kociemba 求解中(首次需 ~3s 建表)…`,`State valid, solving with Kociemba (first call needs ~3s to build tables)…`)),Z(!0),Y.current||=new ie;let r=Y.current,a=Date.now();try{let e=await new Promise((e,t)=>{let i=null,o=()=>{i&&clearTimeout(i),r.removeEventListener(`message`,s),Q.current=null},s=n=>{n.data?.id===a&&(o(),n.data.ok&&typeof n.data.sol==`string`?e(n.data.sol):t(Error(n.data.err||`kociemba failed`)))};r.addEventListener(`message`,s),Q.current=()=>{o(),r.terminate(),Y.current=null,t(Error(`cancelled`))},i=setTimeout(()=>{o(),r.terminate(),Y.current=null,t(Error(`timeout — 状态可能不可解`))},3e4),r.postMessage({id:a,op:`solve`,state:n})});D(e),L(i(`Kociemba 求出 ${e.split(/\s+/).length} 步打乱(非最优)。点击 Solve 求最优解。`,`Kociemba scramble: ${e.split(/\s+/).length} moves (non-optimal). Click Solve for optimal.`))}finally{Z(!1)}}let ze=()=>{Q.current?.(),Z(!1),L(i(`已取消。`,`Cancelled.`))},Be=e=>{e.onmessage=e=>{let t=e.data;if(t.code===-1){let e=String(t.data??``).trim();T(t=>t+e+`
`);let n=/handled (\d+)%,/.exec(e);n&&C(parseInt(n[1],10)/100);let r=/^Solution found!:\s*(.+)$/i.exec(e);if(r){let e=r[1].trim().replace(/\s+/g,` `);N.current.push(e);return}let i=/^Cube(\d+)\s+finished\s+in\s/i.exec(e);if(i){let e=parseInt(i[1],10),t=N.current.shift();t!==void 0&&(I.current.set(e,t),F(new Map(I.current)))}return}if(t.code===-2){C(typeof t.data==`number`?t.data:-1);return}if(t.cmd===`select solver`)if(t.code===1)x(`no-solver`),y(null),J.current=null;else{let e={name:t.solver,table_name:t.table_name,table_size:Number(t.table_size)};y(e),J.current=e,x(t.code===0?`ready`:`need-init`)}else if(t.cmd===`generate table`)t.code===0&&(V.current=!0),x(t.code===0?`ready`:`need-init`),C(-1);else if(t.cmd===`upload table`)t.code===0?x(`ready`):(alert(i(`文件大小不匹配,请用对应 .dat`,`Wrong file size — use the matching .dat`)),x(`need-init`)),C(-1);else if(t.cmd===`start solve`)x(`ready`),C(-1);else if(t.cmd===`download table`){if(t.code===0){let e=new Blob([new Uint8Array(t.data)],{type:`application/octet-stream`}),n=URL.createObjectURL(e),r=document.createElement(`a`);r.href=n,r.download=J.current?.table_name||`cubeopt-table.dat`,r.click(),URL.revokeObjectURL(n)}x(`ready`)}}};(0,p.useEffect)(()=>{let e=new Worker(`/cubeopt/wasm-worker.js`);return K.current=e,Be(e),()=>{e.terminate(),K.current=null}},[]);let Ve=()=>{if(!K.current)return;K.current.terminate(),z.current=!1,V.current=!1,C(-1),T(e=>e+`[cancelled by user]
`);let e=new Worker(`/cubeopt/wasm-worker.js`);K.current=e,Be(e),x(`busy`),e.postMessage({cmd:`select solver`,data:_})};(0,p.useEffect)(()=>{K.current&&(x(`busy`),T(``),C(-1),z.current=!1,K.current.postMessage({cmd:`select solver`,data:_}))},[_]),(0,p.useEffect)(()=>{A%j!==0&&M(1)},[A,j]),(0,p.useEffect)(()=>{q.current&&(q.current.scrollTop=q.current.scrollHeight)},[w]);let He=()=>{b===`need-init`&&(x(`busy`),T(``),K.current?.postMessage({cmd:`generate table`}))},Ue=()=>{b===`ready`&&(x(`busy`),K.current?.postMessage({cmd:`download table`}))},We=()=>Ie.current?.click(),Ge=e=>{let t=e.target.files?.[0];if(t){if(t.name!==v?.table_name){alert(i(`文件名应为 ${v?.table_name}`,`Expected ${v?.table_name}`)),e.target.value=``;return}x(`busy`),C(0),K.current?.postMessage({cmd:`upload table`,data:t}),e.target.value=``}},Ke=()=>{let e=E.split(`
`).map(e=>e.trim()).filter(e=>e.length>0).join(`
`);if(!e){alert(i(`打乱不能为空`,`No scrambles`));return}D(e),x(`busy`),T(``),I.current=new Map,F(new Map),N.current=[],K.current?.postMessage({cmd:`start solve`,scramble:e,n_threads:A,n_group:j,debug:1})},qe=()=>{if(b===`ready`){Ke();return}if(b===`need-init`){if(!E.split(`
`).map(e=>e.trim()).filter(Boolean).join(`
`)){alert(i(`打乱不能为空`,`No scrambles`));return}z.current=!0,He()}};(0,p.useEffect)(()=>{if(b===`ready`){if(V.current&&B){V.current=!1;let e=setTimeout(()=>Ue(),0);return()=>clearTimeout(e)}V.current=!1,z.current&&(z.current=!1,Ke())}},[b]);let Je=()=>{let e=[];for(let t=0;t<k;t++)e.push(ye(O));D(e.join(`
`))},Ye=()=>{D(E.split(`
`).map(e=>e.trim()).filter(Boolean).map(e=>{try{return oe(ce(f(e)))}catch{return e}}).join(`
`))},Xe=(0,p.useMemo)(()=>{let e=[];for(let t=1;t<=A;t++)A%t===0&&e.push(t);return e},[A]),Ze=(()=>{let e=E.split(`
`).map(e=>e.trim()).filter(Boolean);return e.length===0?!1:e.every(e=>{try{let t=f(e);return!!le(se(),t)}catch{return!1}})})(),$=(0,p.useMemo)(()=>{let e=E.split(`
`).map(e=>e.trim()).find(Boolean);if(!e)return null;try{return f(e),e}catch{return null}},[E]);return(0,m.jsxs)(`div`,{className:`cubeopt-page`,children:[(0,m.jsx)(`style`,{children:be}),(0,m.jsxs)(`header`,{className:`cubeopt-header`,children:[(0,m.jsx)(`h1`,{children:i(`最优解 (cubeopt)`,`Optimal Solver (cubeopt)`)}),(0,m.jsx)(ae,{variant:`inline`})]}),!Le&&(0,m.jsx)(`div`,{className:`cubeopt-warn`,children:i(`当前页面没有 SharedArrayBuffer/COI,wasm 多线程跑不起来。如果是首次访问,刷新页面让 service worker 注入 COOP/COEP。`,`SharedArrayBuffer / cross-origin isolation not active — multithreaded wasm wont run. On first visit, reload after the service worker installs.`)}),g&&(0,m.jsx)(`div`,{className:`cubeopt-info`,children:(0,m.jsx)(`span`,{children:i(`检测到手机端 — 已默认 cube48opt1 (30M)。手机 wasm 内存有限,opt2/3 视机型可能 OK,opt4 起容易 OOM 崩页;生成时长是桌面的 3-5 倍,期间不要切到后台。`,`Mobile detected — defaulted to cube48opt1 (30M). Mobile wasm memory is tight; opt2/3 may work on flagship phones, opt4+ likely OOM. Gen takes 3-5× longer than desktop; don't background the tab during gen.`)})}),(0,m.jsxs)(`div`,{className:`cubeopt-tabs`,role:`tablist`,children:[(0,m.jsx)(`button`,{role:`tab`,"aria-selected":U===`paint`,className:`tab${U===`paint`?` is-active`:``}`,onClick:()=>W(`paint`),children:i(`从状态画`,`Paint state`)}),(0,m.jsx)(`button`,{role:`tab`,"aria-selected":U===`random`,className:`tab${U===`random`?` is-active`:``}`,onClick:()=>W(`random`),children:i(`随机生成`,`Random`)}),(0,m.jsx)(`button`,{role:`tab`,"aria-selected":U===`paste`,className:`tab${U===`paste`?` is-active`:``}`,onClick:()=>W(`paste`),children:i(`直接粘贴`,`Paste`)})]}),U===`paint`&&(0,m.jsx)(`section`,{className:`cubeopt-card`,children:(0,m.jsx)(`div`,{className:`paint-wrap`,children:(0,m.jsx)(me,{facelet:Ee,onChange:De,activeColor:Oe,onActiveColorChange:ke,pixelSize:Ae,solveLabel:{zh:`求打乱`,en:`Derive scramble`},onSolve:e=>{X||Re(e).catch(e=>{L(i(`从状态求解失败:${e.message}`,`Solve from state failed: ${e.message}`))})}})})}),U===`random`&&(0,m.jsx)(`section`,{className:`cubeopt-card`,children:(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`select`,{className:`ctl-sm`,value:O,onChange:e=>Se(parseInt(e.target.value,10)),children:_e.map(e=>(0,m.jsxs)(`option`,{value:e,children:[e,` `,i(`步`,`moves`)]},e))}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:k,onChange:e=>Ce(parseInt(e.target.value,10)),children:ve.map(e=>(0,m.jsxs)(`option`,{value:e,children:[e,` `,i(`个`,`cubes`)]},e))}),(0,m.jsx)(`button`,{className:`btn-primary`,onClick:Je,children:i(`生成到打乱框`,`Generate`)})]})}),Te&&(0,m.jsxs)(`div`,{className:`cubeopt-info`,children:[X&&(0,m.jsx)(c,{size:14,className:`spinning`}),(0,m.jsx)(`span`,{children:Te}),X&&(0,m.jsxs)(`button`,{className:`btn-cancel-sm`,onClick:ze,children:[(0,m.jsx)(d,{size:12}),` `,i(`取消`,`Cancel`)]})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:i(`打乱`,`Scramble`)}),(0,m.jsx)(`button`,{className:`btn-icon`,onClick:Ye,title:i(`每行反向`,`Invert each line`),children:(0,m.jsx)(l,{size:14})}),(0,m.jsx)(`button`,{className:`btn-icon${R?` is-active`:``}`,onClick:()=>Me(e=>!e),title:i(`显示第一行打乱产生的状态`,`Show state after the first scramble`),children:R?(0,m.jsx)(ne,{size:14}):(0,m.jsx)(te,{size:14})}),(0,m.jsx)(`button`,{className:`btn-icon`,onClick:()=>D(``),title:i(`清空`,`Clear`),children:(0,m.jsx)(u,{size:14})}),(0,m.jsx)(`span`,{className:`row-spacer`}),b===`busy`?(0,m.jsxs)(`button`,{className:`btn-cancel`,onClick:Ve,title:i(`终止当前任务。会重建 wasm,prun 表会丢失需重新生成或上传。`,`Abort current task. Wasm will be reset; prun table is lost and must be re-generated or uploaded.`),children:[(0,m.jsx)(d,{size:14}),` `,i(`取消`,`Cancel`)]}):(0,m.jsx)(`button`,{className:`btn-primary`,disabled:b===`no-solver`||!Ze,onClick:qe,title:b===`need-init`?i(`会先自动生成 prun 表(几十秒)再求最优解`,`Will auto-generate the prun table (tens of seconds) then solve`):i(`用 cubeopt 求 HTM 最少步解`,`Solve optimally with cubeopt`),children:b===`need-init`?(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(l,{size:14}),` `,i(`生成表+求最优`,`Gen Table + Solve`)]}):(0,m.jsx)(m.Fragment,{children:`Solve`})})]}),(0,m.jsx)(`textarea`,{className:`scramble-area`,rows:U===`paste`?6:4,placeholder:U===`paste`?i(`把 cubedb / cstimer / WCA scramble 粘到这里,每行一个,然后 Solve。`,`Paste scrambles here (one per line), then Solve.`):`R U R' U' R' F R2 U' R' U' R U R' F'`,value:E,onChange:e=>D(e.target.value)}),R&&$&&(0,m.jsx)(`div`,{className:`scramble-preview-mini`,children:(0,m.jsx)(de,{event:`333`,scramble:$,visualization:`2D`,size:14,className:`scramble-preview-svg`})})]}),P.size>0&&(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:i(`解 (按输入顺序)`,`Solutions (input order)`)}),(0,m.jsx)(`span`,{className:`paint-hint`,children:i(`cubeopt 是按完成顺序输出的;此处按输入序号 1..N 排好,并标注步数。`,`cubeopt outputs in finish order; this panel re-sorts by input index 1..N with move counts.`)}),(0,m.jsx)(`button`,{className:`btn-icon`,onClick:()=>{let e=Array.from(P.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>`${e}. ${t}`).join(`
`);navigator.clipboard?.writeText(e)},title:i(`复制全部`,`Copy all`),children:(0,m.jsx)(l,{size:14})})]}),(0,m.jsx)(`ol`,{className:`solutions-list`,children:Array.from(P.entries()).sort((e,t)=>e[0]-t[0]).map(([e,t])=>{let n=t.split(/\s+/).filter(Boolean).length;return(0,m.jsxs)(`li`,{children:[(0,m.jsxs)(`span`,{className:`sol-idx`,children:[e,`.`]}),(0,m.jsx)(`code`,{className:`sol-alg`,children:t}),(0,m.jsxs)(`span`,{className:`sol-count`,children:[`(`,n,`)`]})]},e)})})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card cubeopt-advanced`,children:[(0,m.jsxs)(`button`,{className:`advanced-toggle`,onClick:()=>Fe(e=>!e),children:[G?(0,m.jsx)(o,{size:14}):(0,m.jsx)(s,{size:14}),(0,m.jsx)(`span`,{children:i(`高级设置`,`Advanced`)}),(0,m.jsxs)(`span`,{className:`advanced-summary`,children:[_,` · `,A,i(`线程`,`threads`),b===`ready`&&(0,m.jsxs)(m.Fragment,{children:[` · `,i(`就绪`,`ready`)]}),b===`need-init`&&(0,m.jsxs)(m.Fragment,{children:[` · `,i(`表未生成`,`table not built`)]}),b===`busy`&&(0,m.jsxs)(m.Fragment,{children:[` · `,(0,m.jsx)(c,{size:12,className:`spinning`}),` `,i(`忙`,`busy`)]})]})]}),G&&(0,m.jsxs)(m.Fragment,{children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:`Solver`}),(0,m.jsx)(`select`,{className:`ctl`,value:_,disabled:b===`busy`,onChange:e=>xe(e.target.value),children:ge.map(e=>(0,m.jsxs)(`option`,{value:e.value,children:[e.value,` (`,e.size,`)`]},e.value))}),(0,m.jsx)(`span`,{className:`size-badge`,children:ge.find(e=>e.value===_)?.size})]}),(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:i(`Prun 表`,`Prun Table`)}),(0,m.jsx)(`span`,{className:`table-name`,children:v?.table_name??i(`未就绪`,`Not Ready`)}),(0,m.jsxs)(`label`,{className:`auto-dl`,children:[(0,m.jsx)(`input`,{type:`checkbox`,checked:B,onChange:e=>Ne(e.target.checked)}),(0,m.jsx)(`span`,{children:i(`生成后自动下载`,`Auto-download after gen`)})]}),b===`need-init`&&(0,m.jsxs)(m.Fragment,{children:[(0,m.jsx)(`button`,{className:`btn`,onClick:He,children:i(`生成表`,`Generate Table`)}),(0,m.jsxs)(`button`,{className:`btn`,onClick:We,children:[(0,m.jsx)(re,{size:14}),` `,i(`上传表`,`Upload Table`)]})]}),b===`ready`&&(0,m.jsxs)(`button`,{className:`btn`,onClick:Ue,children:[(0,m.jsx)(ee,{size:14}),` `,i(`下载表`,`Download Table`)]}),(0,m.jsx)(`input`,{ref:Ie,type:`file`,style:{display:`none`},onChange:Ge})]}),S>=0&&(0,m.jsx)(`div`,{className:`progress`,children:(0,m.jsx)(`div`,{className:`progress-bar`,style:{width:`${Math.round(S*100)}%`}})}),(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:i(`线程`,`Threads`)}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:A,onChange:e=>we(parseInt(e.target.value,10)),children:Array.from({length:navigator.hardwareConcurrency||4},(e,t)=>t+1).map(e=>(0,m.jsx)(`option`,{value:e,children:e},e))}),(0,m.jsx)(`span`,{className:`lbl`,children:i(`并发块`,`Concurrent`)}),(0,m.jsx)(`select`,{className:`ctl-sm`,value:j,onChange:e=>M(parseInt(e.target.value,10)),children:Xe.map(e=>(0,m.jsx)(`option`,{value:e,children:e},e))})]})]})]}),(0,m.jsxs)(`section`,{className:`cubeopt-card`,children:[(0,m.jsxs)(`div`,{className:`row`,children:[(0,m.jsx)(`span`,{className:`lbl`,children:`Logs`}),(0,m.jsxs)(`button`,{className:`btn`,onClick:()=>Pe(e=>!e),children:[H?i(`收起`,`Hide`):i(`展开 raw 输出`,`Show raw output`),w?` (${w.split(`
`).length-1})`:``]}),H&&(0,m.jsx)(`button`,{className:`btn-icon`,onClick:()=>T(``),title:`Clear logs`,children:(0,m.jsx)(u,{size:14})})]}),H&&(0,m.jsx)(`textarea`,{ref:q,className:`logs-area`,rows:10,value:w,readOnly:!0})]}),(0,m.jsxs)(`p`,{className:`cubeopt-foot`,children:[`Inspired by `,(0,m.jsx)(`a`,{href:`https://github.com/cs0x7f/cubeopt-wasm`,target:`_blank`,rel:`noopener noreferrer`,children:`cs0x7f/cubeopt-wasm`}),` (BSD-3), original demo at `,(0,m.jsx)(`a`,{href:`https://cstimer.net/cubeopt/`,target:`_blank`,rel:`noopener noreferrer`,children:`cstimer.net/cubeopt`}),`.`]})]})}var be=`
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