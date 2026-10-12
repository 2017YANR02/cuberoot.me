'use client';
import {useEffect,useState} from 'react';
import {useAuthUser} from '@/lib/auth-store';
import {useT} from '@/hooks/useT';
import {useCopy} from '@/hooks/useCopy';
import {apiUrl} from '@/lib/api-base';
import {authHeaders,handleApi} from '@/lib/admin-api';
import {sessionFetch} from '@/lib/session-fetch';
import {ClearButton} from '@/components/ClearButton';

type Request={id:string;user_id:number;user_name:string;owner_slug:string;device_slug:string;status:string;os:string};
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
  const prompt=t(`帮我完成这台电脑的 CubeRoot 开发网址接入。入门页固定为 https://cuberoot.me/zh/account/get-started，使用申请时的账号查看本机申请；无需再询问网址，不使用 localhost。等待审批时，请负责人在同一页面批准对应申请，不代替负责人操作。先读仓库 AGENTS.md 和 docs/development.md，检查并安装缺少的 Git、仓库 .node-version 指定的 Node、core/package.json 指定的 pnpm、OpenSSH 客户端和项目依赖。复用已有仓库和独立设备密钥，不打印私钥。确认本机确实运行开发服务；仅 SSH 使用负责人电脑时停止申请并复用其网址。先在 core/ 完成 pnpm install --frozen-lockfile 和 pnpm setup:local。确认仓库包含 scripts/dev-preview/enroll.ts，在 core/ 执行 node scripts/dev-preview/enroll.ts --ticket ${ticket}。这个接入码仅用于本次申请，不转发给其他人。程序自动提交公钥、等待负责人批准、取得连接配置并配置 cuberoot。若等待时间超过本轮，稍后原命令重跑，不重新申请。接入后执行 cuberoot，终端实时显示日志，网址就绪后自动打开；不杀已有服务，不设置第二份自启服务。最后检查网页、启动资源、API 和隧道，说明未完成项。`,
    `Set up CubeRoot preview on this computer. The onboarding URL is https://cuberoot.me/zh/account/get-started; use the requesting account to check this device. Do not ask for the URL or use localhost. When approval is pending, ask the lead to approve the matching request at that URL; never approve on their behalf. Read AGENTS.md and docs/development.md. Install missing Git, Node from .node-version, pnpm from core/package.json, the OpenSSH client and project dependencies. Reuse the checkout and device key; never print private keys. If development only runs on the lead's remote computer, stop and reuse its preview URL. From core run pnpm install --frozen-lockfile and pnpm setup:local first. Ensure scripts/dev-preview/enroll.ts exists, then from core run node scripts/dev-preview/enroll.ts --ticket ${ticket}. Keep this enrollment ticket private. The command submits the public key, waits for approval, obtains the profile and configures cuberoot. Re-run the same command later if needed; do not create another request. Run cuberoot to stream logs and open the ready preview. Do not kill existing servers or register a second startup service. Verify the page, startup assets, API and tunnel, and report remaining work.`);
  const labels:Record<string,string>={preparing:t('等待 AI 配置电脑','Waiting for device setup'),pending:t('等待负责人批准','Awaiting approval'),approved:t('已批准，等待开通','Approved; queued'),provisioning:t('正在配置域名和证书','Configuring domain and certificate'),ready:t('网址已配置，等待电脑接入','Domain configured; connect this computer'),failed:t('开通未完成，负责人可重试','Setup incomplete; owner can retry'),rejected:t('未批准','Declined')};
  return <section className="staff-start-development"><h3>{t('申请开发网址','Request a development URL')}</h3>
    {!user?<p>{t('请先注册或登录。','Register or sign in first.')}</p>:<>
      {failed&&<p role="alert">{t('暂时无法完成，请检查名称是否已被使用后重试。','Unable to complete. Check whether the name is already taken and retry.')}</p>}
      {data&&!data.enabled&&<p>{t('自动开通服务正在准备。','Automatic enrollment is being prepared.')}</p>}
      {data?.enabled&&<form className="staff-start-preview-form" onSubmit={e=>{e.preventDefault();void send('requests',{owner,device,os});}}>
        <label>{t('姓名标识','Name identifier')} <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={25} value={owner} onChange={e=>setOwner(e.target.value)}/>{owner&&<ClearButton variant="standalone" onClick={()=>setOwner('')}/>}</label>{' '}
        <label>{t('电脑标识','Computer identifier')} <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={25} value={device} onChange={e=>setDevice(e.target.value)}/>{device&&<ClearButton variant="standalone" onClick={()=>setDevice('')}/>}</label>{' '}
        <label>{t('系统','System')} <select value={os} onChange={e=>setOs(e.target.value)}><option value="windows">Windows</option><option value="mac">macOS</option></select></label>
        <p>{t('小写字母、数字或连字符。','Lowercase letters, numbers or hyphens.')}</p>
        <button type="submit" className="staff-start-action" disabled={busy}>{t('申请开发网址','Apply')}</button>
      </form>}
      {ticket&&<p><button type="button" className="staff-start-action" onClick={()=>copy(prompt,'preview-setup')}>{copiedKey==='preview-setup'?t('已复制','Copied'):t('复制给 AI，自动接入','Copy for AI setup')}</button></p>}
      <ul className="staff-start-steps">{data?.requests.map(r=><li key={r.id}><strong>{r.user_name} · dev-{r.owner_slug}-{r.device_slug}.cuberoot.me</strong><p>{labels[r.status]}</p>
        {r.status==='preparing'&&Number(r.user_id)===user.uid&&<button type="button" disabled={busy} onClick={()=>void send(`requests/${r.id}/ticket`,{})}>{t('重新生成配置指令','Regenerate setup instructions')}</button>}
        {r.status==='ready'&&<a href={`https://dev-${r.owner_slug}-${r.device_slug}.cuberoot.me/zh`} target="_blank" rel="noreferrer">{t('打开开发网址','Open preview')}</a>}
        {data.canApprove&&['pending','failed'].includes(r.status)&&<><button type="button" disabled={busy} onClick={()=>void send(`requests/${r.id}/decision`,{decision:'approved'})}>{r.status==='failed'?t('重试开通','Retry'):t('批准','Approve')}</button>{' '}<button type="button" disabled={busy} onClick={()=>void send(`requests/${r.id}/decision`,{decision:'rejected'})}>{t('拒绝','Decline')}</button></>}
      </li>)}</ul>
    </>}
  </section>;
}
