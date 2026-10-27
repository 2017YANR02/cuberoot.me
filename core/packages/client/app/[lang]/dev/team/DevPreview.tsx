'use client';
import {useEffect,useState} from 'react';
import {useAuthUser} from '@/lib/auth-store';
import {useT} from '@/hooks/useT';
import {useCopy} from '@/hooks/useCopy';
import {apiUrl} from '@/lib/api-base';
import {authHeaders,handleApi} from '@/lib/admin-api';
import {sessionFetch} from '@/lib/session-fetch';
import {ClearButton} from '@/components/ClearButton';

type Request={id:string;user_id:number;user_name:string;owner_slug:string;device_slug:string;status:string;os:string;connected?:boolean};
type List={enabled:boolean;canApprove:boolean;requests:Request[]};
export default function DevPreview(){
  const t=useT(),user=useAuthUser(),{copy,copiedKey}=useCopy();
  const [data,setData]=useState<List|null>(null),[owner,setOwner]=useState(''),[device,setDevice]=useState('');
  const [os,setOs]=useState('windows'),[ticket,setTicket]=useState(''),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  const load=()=>sessionFetch(apiUrl('/v1/dev-preview/requests'),{headers:authHeaders(false),cache:'no-store'}).then(handleApi<List>);
  useEffect(()=>{setOs(/Macintosh/.test(navigator.userAgent)?'mac':'windows');},[]);
  useEffect(()=>{
    setTicket('');setData(null);if(!user?.uid)return;
    let cancelled=false;const refresh=async()=>{try{const d=await load();if(!cancelled){setData(d);setFailed(false);}}catch{if(!cancelled)setFailed(true);}};
    void refresh();const timer=setInterval(()=>{if(!document.hidden)void refresh();},10000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[user?.uid]);
  async function send(path:string,body:unknown){
    setBusy(true);setFailed(false);
    try{const r=await handleApi<{ticket?:string}>(await sessionFetch(apiUrl(`/v1/dev-preview/${path}`),{method:'POST',headers:authHeaders(),body:JSON.stringify(body)}));if(r.ticket)setTicket(r.ticket);setData(await load());}catch{setFailed(true);}finally{setBusy(false);}
  }
  const prompt=t(`请连续完成这台电脑的 CubeRoot 开发网址接入，不只给计划，也不要每完成一步就问是否继续。复用已有对话和成功结果，进度说明后继续执行。只有本人登录、系统明确要求本人授权、负责人审批、凭据缺失或无法安全处理的冲突才提出具体问题。入门页固定为 https://cuberoot.me/zh/admin/team?section=onboarding，使用申请时的账号查看本机申请；无需再询问网址，不使用 localhost。等待审批时，请负责人在同一页面批准对应申请，不代替负责人操作。先读仓库 AGENTS.md 和 docs/development.md，检查并安装缺少的 Git、仓库 .node-version 指定的 Node、core/package.json 指定的 pnpm、OpenSSH 客户端和项目依赖。复用已有仓库和独立设备密钥，不打印私钥。确认本机确实运行开发服务；仅 SSH 使用负责人电脑时停止申请并复用其网址。先检查 core/scripts/dev-preview/enroll.ts 和 core/package.json 的 setup:local。无论脚本是否已存在，都先安全同步最新代码，再安装依赖；不能使用旧版接入程序或手写替代脚本。核对 Git remote 指向 https://github.com/2017YANR02/cuberoot.me.git（或其官方 SSH 地址），检查分支与未提交修改，再 fetch origin；仅在不会覆盖本地工作的情况下快进更新，需要处理分叉或冲突时保留修改并说明具体问题，禁止 reset --hard、强推或删除旧密钥及交接文件。GitHub 失败时检查实际错误、DNS、现有 Git 代理与正在运行的本机代理；已有授权代理可在本次命令范围内复用，不全局改代理、不关闭 TLS 校验、不切未知镜像、不安装第二套代理。设置连接超时，有限重试；确实无法联网时报告具体阻塞，不能宣称完成或反复索要已提供的信息。更新后重新读取仓库版本要求，确认脚本齐全，再在 core/ 完成 pnpm install --frozen-lockfile 和 pnpm setup:local。在 core/ 执行 node scripts/dev-preview/enroll.ts --ticket ${ticket}。这个接入码仅用于本次申请，不转发给其他人。程序自动提交公钥、持续等待批准和开通、配置 cuberoot 并直接启动开发服务与隧道；临时网络故障会自动退避重试，不要结束进程或重新申请。审批等待期间保持接入进程运行，在工具允许范围内检查输出；负责人批准后自动继续，不再问是否继续。若会话中断，恢复后先检查原进程，仍在运行则复用，已退出才重跑原命令，不同时运行两份、不重新申请。程序已自动启动服务，不再另开第二个 cuberoot。保持终端运行；负责人端验收 HTTPS、网页、全部启动资源及 API 后，页面才显示“已连通，可用”。只看到“等待电脑接入和验收”不算完成。不杀已有服务，不设置第二份自启服务；需要本人登录或权限、密钥冲突时一次性说明具体阻塞。`,
    `Complete CubeRoot preview setup continuously, not just a plan. Do not ask whether to continue after each step. Reuse prior context and verified work. Ask only for personal sign-in, required system approval, lead approval, missing credentials or an unsafe unresolved conflict. The onboarding URL is https://cuberoot.me/zh/admin/team?section=onboarding; use the requesting account to check this device. Do not ask for the URL or use localhost. When approval is pending, ask the lead to approve the matching request at that URL; never approve on their behalf. Read AGENTS.md and docs/development.md. Install missing Git, Node from .node-version, pnpm from core/package.json, the OpenSSH client and project dependencies. Reuse the checkout and device key; never print private keys. If development only runs on the lead's remote computer, stop and reuse its preview URL. First check core/scripts/dev-preview/enroll.ts and the setup:local script in core/package.json. Safely update the checkout even if the scripts already exist, before installing dependencies. Do not use an outdated enrollment program or invent replacement scripts. Verify the remote is https://github.com/2017YANR02/cuberoot.me.git or its official SSH equivalent, inspect the branch and local changes, then fetch origin. Fast-forward only when local work is preserved; report unresolved divergence or conflicts without hard resets, force pushes or deleting keys or handoff files. For GitHub failures, inspect the actual error, DNS, Git proxy settings and existing local proxy. Reuse an already authorized proxy only for the current command; do not change global proxy settings, disable TLS checks, use unknown mirrors or install another proxy. Use connection timeouts and bounded retries. Report real connectivity blockers without claiming completion or repeatedly asking for known information. After updating, reread repository version requirements and verify scripts exist, then run pnpm install --frozen-lockfile and pnpm setup:local from core. Next, from core run node scripts/dev-preview/enroll.ts --ticket ${ticket}. Keep this enrollment ticket private. The command submits the key, keeps waiting for approval and provisioning, configures cuberoot and automatically starts the existing development and tunnel runner. Temporary transport failures retry with backoff; keep the process alive and never reapply. Keep the enrollment process running while waiting for lead approval and inspect output within tool limits; proceed automatically once approved. After interruption, reuse the existing process if alive and rerun the original command only if it exited. Never run duplicate enrollment processes or create another request. The command already starts the runner; do not start a second cuberoot process. Keep its terminal open. The trusted worker verifies HTTPS, the page, all startup assets and API before the page reports Connected and available. Waiting for connection and verification is not completion. Do not kill existing servers or register another startup service. Report only concrete sign-in, permission or key-conflict blockers.`);
  const labels:Record<string,string>={preparing:t('等待 AI 配置电脑','Waiting for device setup'),pending:t('等待负责人批准','Awaiting approval'),approved:t('已批准，等待开通','Approved; queued'),provisioning:t('正在开通，临时故障自动重试','Provisioning; temporary failures retry automatically'),ready:t('等待电脑接入和验收','Waiting for connection and verification'),failed:t('需要负责人处理，电脑端会继续等待','Owner attention needed; device keeps waiting'),rejected:t('未批准','Declined')};
  return <section className="staff-start-development"><h3>{t('申请开发网址','Request a development URL')}</h3>
    {!user?<p>{t('请先注册或登录。','Register or sign in first.')}</p>:<>
      {failed&&<p role="alert">{t('暂时无法完成，请检查名称是否已被使用后重试。','Unable to complete. Check whether the name is already taken and retry.')}</p>}
      {data&&!data.enabled&&<p>{t('自动开通服务正在准备。','Automatic enrollment is being prepared.')}</p>}
      {data?.enabled&&<form className="staff-start-preview-form" onSubmit={e=>{e.preventDefault();void send('requests',{owner,device,os});}}>
        <label>{t('姓名标识','Name identifier')} <input className="staff-start-preview-control" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={25} value={owner} onChange={e=>setOwner(e.target.value)}/>{owner&&<ClearButton variant="standalone" onClick={()=>setOwner('')}/>}</label>{' '}
        <label>{t('电脑标识','Computer identifier')} <input className="staff-start-preview-control" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={25} value={device} onChange={e=>setDevice(e.target.value)}/>{device&&<ClearButton variant="standalone" onClick={()=>setDevice('')}/>}</label>{' '}
        <label>{t('系统','System')} <select className="staff-start-preview-control" value={os} onChange={e=>setOs(e.target.value)}><option value="windows">Windows</option><option value="mac">macOS</option></select></label>
        <p>{t('小写字母、数字或连字符。','Lowercase letters, numbers or hyphens.')}</p>
        <button type="submit" className="staff-start-action" disabled={busy}>{t('申请开发网址','Apply')}</button>
      </form>}
      {ticket&&<p><button type="button" className="staff-start-action" onClick={()=>copy(prompt,'preview-setup')}>{copiedKey==='preview-setup'?t('已复制','Copied'):t('复制给 AI，自动接入','Copy for AI setup')}</button></p>}
      <ul className="staff-start-steps">{data?.requests.map(r=><li key={r.id}><div className="staff-start-device-label"><strong>{r.user_name}</strong><span className="staff-start-device-detail">dev-{r.owner_slug}-{r.device_slug}.cuberoot.me</span></div>{!(data.canApprove&&r.status==='pending')&&<p>{r.status==='ready'&&r.connected?t('已连通，可用','Connected and available'):labels[r.status]}</p>}
        {r.status==='preparing'&&Number(r.user_id)===user.uid&&<button type="button" className="staff-start-inline-action" disabled={busy} onClick={()=>void send(`requests/${r.id}/ticket`,{})}>{t('重新生成配置指令','Regenerate setup instructions')}</button>}
        {r.status==='ready'&&r.connected&&<a href={`https://dev-${r.owner_slug}-${r.device_slug}.cuberoot.me/zh`} target="_blank" rel="noreferrer">{t('打开开发网址','Open preview')}</a>}
        {data.canApprove&&['pending','failed'].includes(r.status)&&<><button type="button" className="staff-start-action" disabled={busy} onClick={()=>void send(`requests/${r.id}/decision`,{decision:'approved'})}>{r.status==='failed'?t('重试开通','Retry'):t('批准','Approve')}</button>{' '}<button type="button" className="staff-start-action" disabled={busy} onClick={()=>void send(`requests/${r.id}/decision`,{decision:'rejected'})}>{t('拒绝','Decline')}</button></>}
      </li>)}</ul>
    </>}
  </section>;
}
