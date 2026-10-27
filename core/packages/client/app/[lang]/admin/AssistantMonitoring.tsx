'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/hooks/useT';
import { ClearButton } from '@/components/ClearButton';
import { SearchInput } from '@/components/SearchInput';
import { fetchChatMonitoring, reviewAssistantRequest, type ChatSummary, type ChatRecords, type ChatDetail, type ChatInsights } from '@/lib/admin-assistant-api';
import { DashboardChart } from './Dashboard';
import { LoadingIndicator } from '@/components/LoadingIndicator';

const statuses = ['success', 'error', 'cancelled', 'rejected', 'running', 'interrupted'] as const;
const seconds = (value: number | null | undefined) => value == null ? '—' : `${(value / 1000).toFixed(2)} s`;
const number = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();
const timestamp = (value: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
const wrap = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } as const;

export default function AssistantMonitoring() {
  const t = useT();
  const [insights,setInsights]=useState<ChatInsights|null>(null),[poll,setPoll]=useState(0);
  const [feedback,setFeedback]=useState('all'),[conversation,setConversation]=useState<{id:string;user:string}|null>(null);
  const [reviewStatus,setReviewStatus]=useState('open'),[reviewNote,setReviewNote]=useState(''),[reviewBusy,setReviewBusy]=useState(false),[reviewError,setReviewError]=useState(false);
  const [days, setDays] = useState('30'), [status, setStatus] = useState('all');
  const [q, setQ] = useState(''), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [summary, setSummary] = useState<ChatSummary | null>(null), [records, setRecords] = useState<ChatRecords | null>(null);
  const [selected, setSelected] = useState<string | null>(null), [detail, setDetail] = useState<ChatDetail | null>(null);
  const modelEstimates=detail?.metrics.models?.flatMap(model=>model.cacheAdjustedCny?[model.cacheAdjustedCny]:[]) ?? [];
  const modelEstimateMin=modelEstimates.reduce((sum,value)=>sum+value.min,0),modelEstimateMax=modelEstimates.reduce((sum,value)=>sum+value.max,0);
  const [error, setError] = useState(false), [detailError, setDetailError] = useState(false), [loading, setLoading] = useState(false), [summaryError,setSummaryError]=useState(false);
  const labels: Record<string, string> = { all: t('全部状态', 'All states'), success: t('成功', 'Success'), error: t('失败', 'Failed'), cancelled: t('取消 / 断开', 'Cancelled / disconnected'), rejected: t('限流拒绝', 'Rate limited'), running: t('进行中', 'Running'), interrupted: t('异常中断', 'Interrupted') };
  const feedbackLabels: Record<string,string>={ helpful:t('有帮助','Helpful'),incorrect:t('回答有误','Incorrect'),irrelevant:t('未解决问题','Unresolved'),bad_source:t('资料不合适','Poor sources'),bad_link:t('入口不对','Wrong destination'),other:t('其他','Other') };
  const reviewLabels: Record<string,string>={open:t('待复核','Open'),confirmed:t('问题已确认','Confirmed'),resolved:t('已改进','Resolved'),dismissed:t('无需处理','Dismissed')};
  useEffect(()=>{const timer=setInterval(()=>{if(document.visibilityState==='visible')setPoll(n=>n+1);},60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{const controller=new AbortController();void fetchChatMonitoring<ChatInsights>('insights',{days},controller.signal).then(v=>{if(!controller.signal.aborted)setInsights(v);}).catch(()=>{if(!controller.signal.aborted)setInsights(null);});return()=>controller.abort();},[days,refresh,poll]);
  useEffect(()=>{setReviewStatus(detail?.review_status??'open');setReviewNote(detail?.review_note??'');setReviewError(false);},[detail]);
  useEffect(() => {
    const controller = new AbortController();
    void fetchChatMonitoring<ChatSummary>('summary', { days }, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setSummary(value);setSummaryError(false); } })
      .catch(() => { if(!controller.signal.aborted)setSummaryError(true); });
    return () => controller.abort();
  }, [days, refresh, poll]);
  useEffect(() => {
    const controller = new AbortController(); setRecords(null); setLoading(true); setError(false);
    void fetchChatMonitoring<ChatRecords>('requests', { days, status, q, feedback, ...(conversation ? {conversation:conversation.id,user:conversation.user} : {}), page: String(page) }, controller.signal)
      .then(value => { if (!controller.signal.aborted) setRecords(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [days, status, q, page, refresh, feedback, conversation]);
  useEffect(() => {
    setDetail(null); setDetailError(false);
    if (!selected) return;
    const controller = new AbortController();
    void fetchChatMonitoring<ChatDetail>(`requests/${selected}`, {}, controller.signal)
      .then(value => { if (!controller.signal.aborted) setDetail(value); })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true); });
    return () => controller.abort();
  }, [selected, refresh]);
  const totals = summary?.totals;
  const settled = totals ? totals.success + totals.errors + totals.interrupted : 0;
  const rate = settled ? `${(totals!.success / settled * 100).toFixed(1)}%` : '—';
  return <section className="admin-dashboard" id="chat-monitoring" aria-busy={loading}>
    <div className="admin-dashboard__toolbar"><div><h2>{t('AI 聊天监控', 'AI chat monitoring')}</h2>
      <p>{t('按北京时间统计已通过身份校验且模型已配置的请求。每次发送或重试单独计数；成功指请求完成，不代表答案正确。', 'Beijing calendar days; authenticated requests with a configured model. Sends and retries count separately. Success means completion, not answer correctness.')}</p></div>
      <label>{t('统计范围', 'Period')} <select className="admin-dashboard-select" value={days} onChange={e => { setDays(e.target.value); setSummary(null); setPage(1); setSelected(null); }}>{[7,30,90].map(n => <option key={n} value={n}>{t(`最近 ${n} 天`, `Last ${n} days`)}</option>)}</select></label>
      <button type="button" className="admin-boot__refresh" disabled={loading} onClick={() => setRefresh(n => n + 1)}>{t('刷新聊天统计', 'Refresh chat metrics')}</button>
    </div>
    <p>{t('问答正文与复核备注保留 30 天，个人明细保留 90 天，无身份日汇总保留 2 年；账号注销删除个人记录。历史未记录的聊天无法补回。图片和思考原文不保存；常见密钥会尝试遮盖，正文仍可能包含个人信息。', 'Text and review notes: 30 days; individual records: 90 days; anonymous daily totals: 2 years. Account deletion removes individual records. Unrecorded history cannot be recovered. Images and reasoning text are excluded. Common credentials are redacted where recognized, but text may still contain personal information.')}</p>
    {summaryError && summary && <p role="alert">{t('汇总更新失败，当前显示上次成功读取的数据。','Summary refresh failed; showing the last successful snapshot.')}</p>}
    {!summary && <p role="status">{t('统计尚未加载；若刷新后仍不可用，请检查监控接口是否已部署。', 'Metrics have not loaded. If refreshing does not help, check whether the monitoring API is deployed.')}</p>}
    {!!summary?.health.failedWrites && <p role="alert" className="admin-dashboard__notice">{t(`当前进程发生 ${summary.health.failedWrites} 次记录写入故障；待重放 ${summary.health.pendingCompletions ?? 0} 条。请结合告警和累计故障检查恢复情况。`, `${summary.health.failedWrites} recording faults in this process; ${summary.health.pendingCompletions ?? 0} completions awaiting replay. Check alerts and durable failure totals.`)}</p>}
    {summary?.state&&<p>{t('累计记录故障','Recorded write faults')}: {number(summary.state.failed_writes)} · {t('待补记','Awaiting replay')}: {summary.health.pendingCompletions??0}</p>}
    {summary?.state?.last_cleanup_at && Date.parse(summary.updatedAt)-Date.parse(summary.state.last_cleanup_at)>300000&&<p role="alert">{t('后台维护超过 5 分钟未更新，请检查告警。','Background maintenance is over 5 minutes stale. Check alerts.')}</p>}
    {summary && <>
      <div className="admin-dashboard__metrics">{[
        [t('提问请求', 'Requests'), number(totals?.requests)], [t('提问用户', 'Distinct users'), number(totals?.users)],
        [t('完成成功率', 'Completion rate'), rate], [t('含图片请求', 'Requests with images'), number(totals?.images)],
        [t('平均耗时', 'Average latency'), seconds(totals?.avg_ms)], [t('P50 耗时', 'P50 latency'), seconds(totals?.p50_ms)],
        [t('P95 耗时', 'P95 latency'), seconds(totals?.p95_ms)], [t('首段回答', 'First answer text'), seconds(totals?.first_answer_ms)],
      ].map(([label, value]) => <div data-site-surface="panel" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p>{t('成功率不含取消、限流和进行中的请求。耗时分位数仅统计成功请求；首段回答仅统计实际发送正文的流式请求。', 'Completion rate excludes cancellations, rate limits and pending requests. Latency percentiles cover successful requests; first-answer latency covers streams that emitted answer text.')}</p>
      <div className="admin-dashboard__grid">
        <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('每日提问与结果', 'Daily questions and outcomes')}</h3>
          {summary.daily.length ? <DashboardChart label={t('每日聊天请求', 'Daily chat requests')} labels={summary.daily.map(d => d.day)} series={[
            { name: t('请求', 'Requests'), type: 'bar', data: summary.daily.map(d => d.requests) },
            { name: t('成功', 'Success'), type: 'line', data: summary.daily.map(d => d.success) },
            { name: t('失败与中断', 'Failed or interrupted'), type: 'line', data: summary.daily.map(d => d.errors + d.interrupted) },
          ]} /> : <p>{t('所选范围暂无记录。', 'No records in this period.')}</p>}
        </section>
        <section className="admin-dashboard__panel" data-site-surface="panel"><h3>{t('错误与调用工具', 'Errors and tools')}</h3>
          <p>{statuses.map(key => `${labels[key]}: ${number(totals?.[key === 'error' ? 'errors' : key])}`).join(' · ')}</p>
          {summary.errors.map(row => <p key={row.error_code}>{row.error_code}: {row.requests}</p>)}
          {summary.tools.map(row => <p key={row.tool}>{row.tool}: {row.calls}</p>)}
        </section>
      </div>
      <details className="admin-dashboard__table"><summary>{t('每日用户、状态与耗时明细', 'Daily users, outcomes and latency')}</summary><div className="sticky-scroll admin-dashboard__table-scroll"><table className="sticky-thead"><thead><tr>{[t('日期', 'Date'),t('请求', 'Requests'),t('用户', 'Users'),...statuses.map(s => labels[s]),t('平均耗时', 'Average latency'),t('P95 耗时', 'P95 latency')].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{summary.daily.map(day => <tr key={day.day}><th>{day.day}</th><td>{day.requests}</td><td>{day.users}</td>{statuses.map(s => <td key={s}>{day[s === 'error' ? 'errors' : s]}</td>)}<td>{seconds(day.avg_ms)}</td><td>{seconds(day.p95_ms)}</td></tr>)}</tbody></table></div></details>
      <h3>{t('模型用量', 'Model usage')}</h3><p>{t('包含同一问题的多轮和修复调用。缺失用量不是零；缓存与思考 tokens 是输入或输出的子集，不重复相加。向量区分在线查询和离线建库；实际费用以服务商账单为准。', 'Includes multiple rounds and repair calls. Missing usage is not zero. Cache/reasoning tokens are subsets, not additional totals. Embeddings distinguish online queries from offline indexing. Provider billing is authoritative.')}</p>
      <div className="admin-dashboard__table"><div className="sticky-scroll admin-dashboard__table-scroll"><table className="sticky-thead"><thead><tr>{[t('模型', 'Model'),t('类型', 'Kind'),t('调用', 'Calls'),t('思考调用', 'Thinking calls'),t('输入', 'Input'),t('输出', 'Output'),t('缓存命中', 'Cache read'),t('思考', 'Reasoning'),t('用量缺失', 'Missing usage')].map(v => <th key={v}>{v}</th>)}</tr></thead><tbody>{summary.models.map(m => <tr key={m.kind + m.model}><th>{m.model}</th><td>{({chat:t('聊天','Chat'),embedding:t('查询向量','Query embeddings'),embedding_index:t('建库向量','Index embeddings'),rerank:t('重排序','Reranking')} as Record<string,string>)[m.kind]??m.kind}</td><td>{m.calls}</td><td>{m.thinking_calls}</td><td>{number(m.input_tokens)}</td><td>{number(m.output_tokens)}</td><td>{number(m.cached_tokens)}</td><td>{number(m.reasoning_tokens)}</td><td>{m.missing_usage}</td></tr>)}</tbody></table></div></div>
      <p>{summary.state && <>{t('开始记录', 'Recording since')} {timestamp(summary.state.enabled_at)} · {t('最近清理', 'Last cleanup')} {summary.state.last_cleanup_at ? timestamp(summary.state.last_cleanup_at) : '—'} · </>}{t('更新时间', 'Updated')} {timestamp(summary.updatedAt)} (UTC+8)</p>
    </>}
    <h3>{t('质量、检索与运行状况','Quality, retrieval and operations')}</h3>
    {!insights ? <p role="status">{t('诊断统计暂不可用，请刷新。','Diagnostics are unavailable. Please refresh.')}</p> : <>
      <p>{t('页面可见时每分钟自动更新汇总。入口拒绝单独计数，不保存未通过校验的正文；网页在发请求前拦截的输入不计入服务端统计。','Summaries refresh every minute while visible. Pre-admission failures are counted without content; browser-side rejections never sent to the API are excluded.')}</p>
      <div className="admin-dashboard__metrics">{[
        [t('收到评价','Ratings'),number(insights.feedback.reduce((n,r)=>n+r.requests,0))],
        [t('有帮助','Helpful'),number(insights.feedback.filter(r=>r.feedback==='helpful').reduce((n,r)=>n+r.requests,0))],
        [t('待复核差评','Negative ratings to review'),number(insights.feedback.filter(r=>r.feedback!=='helpful'&&r.review_status==='open').reduce((n,r)=>n+r.requests,0))],
        [t('打开推荐页面的回答','Answers with destination clicks'),number(insights.cost.clicked)],
        [t('已知用量估算（元）','Priced usage estimate (CNY)'),insights.cost.gross_cny.toFixed(4)],
        [t('无法估价的调用','Unpriced calls'),number(insights.cost.unpriced_calls)],
      ].map(([label,value])=><div key={label} data-site-surface="panel"><span>{label}</span><strong>{value}</strong></div>)}</div>
      <p>{t('评价来自主动反馈，不能代表所有用户。页面点击不等于训练完成。费用含聊天、在线/离线向量及联网搜索，按调用时保存的价目版本估算；搜索按供应商返回的意图次数估计，不等于账单计费次数。DeepSeek 使用高峰标价，未扣低谷优惠、免费额度或缓存折扣；未知模型或用量缺失不会算作零费用。','Ratings are voluntary and do not represent all users. A click does not prove training completion. Estimates include chat, online/offline embeddings and web search using saved price snapshots. Search uses reported intent counts, which are not billed request counts. DeepSeek uses peak rates before off-peak, free-tier or cache discounts. Unknown models or missing usage remain unpriced.')}
        {' '}<a href="https://help.aliyun.com/zh/model-studio/model-pricing" target="_blank" rel="noreferrer">{t('百炼官方价格','Official Bailian pricing')}</a>{' · '}<a href="https://api-docs.deepseek.com/zh-cn/quick_start/pricing/" target="_blank" rel="noreferrer">{t('DeepSeek 官方价格','Official DeepSeek pricing')}</a></p>
      <div className="admin-dashboard__grid"><section className="admin-dashboard__panel" data-site-surface="panel"><h4>{t('告警与恢复','Alerts and recovery')}</h4>
        {insights.alerts.length===0&&<p>{t('等待首次后台检查。','Awaiting the first background check.')}</p>}
        {insights.alerts.map(a=><p key={a.code} role={a.active?'alert':undefined}>{a.active?t('异常','Alert'):t('正常','Normal')} · {({error_rate:t('错误率','Error rate'),latency:t('回答耗时','Latency'),recording:t('记录写入','Recording'),cost:t('日费用提醒','Daily cost threshold'),unpriced:t('费用覆盖不完整','Incomplete pricing')} as Record<string,string>)[a.code]??a.code} · {timestamp(a.checked_at)}<br/><small style={wrap}>{Object.entries(a.details as Record<string,number|null>).map(([key,value])=>{const labels:Record<string,string>={p95:t('P95 耗时','P95 latency'),thresholdMs:t('耗时阈值','Latency threshold'),grossCny:t('已知用量费用（元）','Priced usage (CNY)'),thresholdCny:t('日提醒阈值（元）','Daily alert threshold (CNY)'),requests:t('请求数','Requests'),pending:t('待补记','Awaiting replay'),errors:t('失败数','Failures'),threshold:t('失败率阈值','Error-rate threshold')};return (labels[key]??key)+': '+(key==='p95'||key==='thresholdMs'?seconds(value):key==='threshold'?String(Number(value)*100)+'%':number(value));}).join(' · ')}</small></p>)}
        <p>{t('每分钟检查；15 分钟内至少 10 次完成请求，失败率达到 20% 或 P95 超过 30 秒时告警。写入异常和费用阈值另行监测，恢复也通知；复用管理员站内通知及已启用的邮件通知。','Checks run each minute. At least 10 settled requests in 15 minutes trigger alerts at 20% failures or P95 above 30 seconds. Recording and cost have separate checks. Alerts and recovery use admin site notifications and enabled email notifications.')}</p>
      </section><section className="admin-dashboard__panel" data-site-surface="panel"><h4>{t('检索与入口失败','Retrieval and admission failures')}</h4>
        {insights.retrievals.map((r,i)=><p key={i}>{({hybrid:t('混合检索','Hybrid'),database_lexical:t('数据库关键词','Database keywords'),local_lexical:t('本地关键词','Local keywords'),fallback:t('降级','Fallback'),web:t('联网搜索','Web search'),web_unavailable:t('联网未取得证据','No usable web evidence')} as Record<string,string>)[r.mode]??r.mode} · {({disabled_or_unconfigured:t('未启用向量检索','Vector search unavailable'),index_mismatch:t('索引版本不匹配','Index mismatch'),embedding_unavailable:t('向量服务不可用','Embedding unavailable'),retrieval_unavailable:t('检索服务不可用','Retrieval unavailable'),corpus_unavailable:t('资料索引不可用','Corpus unavailable'),not_configured:t('未配置联网服务','Web search not configured'),public_query_required:t('查询包含敏感信息','Query contains sensitive information'),provider_access:t('搜索服务权限不足','Search access denied'),provider_unavailable:t('搜索服务不可用','Search provider unavailable'),incomplete_response:t('搜索响应不完整','Incomplete search response'),no_relevant_evidence:t('未找到相关证据','No relevant evidence'),invalid_search_summary:t('搜索摘要格式异常','Invalid search summary'),missing_citations:t('搜索结果缺少引用','Missing search citations'),missing_search_sources:t('搜索结果缺少来源','Missing search sources'),insufficient_cited_evidence:t('有效引用不足','Insufficient cited evidence'),timeout:t('搜索超时','Search timed out')} as Record<string,string>)[r.reason??'']??r.reason??'—'} · {t('调用','Calls')} {r.calls} · {t('无结果','Empty')} {r.empty}</p>)}
        {!insights.retrievals.length&&<p>{t('尚无资料检索调用。','No knowledge retrieval calls yet.')}</p>}
        <p>{t('混合检索、降级和最终本地检索分步记录；无检索不等于失败，直接查询成绩或打开工具无需 RAG。召回命中不代表资料一定相关。','Hybrid retrieval and fallbacks are recorded separately. Direct data/tool questions may need no RAG. A retrieval hit does not prove relevance.')}</p>
        {insights.entries.map(r=><p key={r.code}>{r.code}: {r.requests}</p>)}
      </section></div>
      <details><summary>{t('长期日汇总与下载','Long-term daily totals and download')}</summary><p>{t('保留 2 年，不含问题、回答和用户标识。每日用户数不能相加当作跨日独立用户数。','Retained for 2 years without text or user identifiers. Daily distinct users are not additive across days.')}</p>
        <button type="button" className="admin-boot__refresh" onClick={()=>{const rows=[['day','requests','daily_users','success','errors','feedback','helpful','clicked','gross_cny','unpriced_calls'],...insights.daily.map(d=>[d.day,d.metrics.requests,d.metrics.users,d.metrics.success,d.metrics.errors,d.metrics.feedback,d.metrics.helpful,d.metrics.clicked,d.metrics.gross_cny,d.metrics.unpriced_calls])];const url=URL.createObjectURL(new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='assistant-daily.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>{t('下载日汇总 CSV','Download daily CSV')}</button>
        <DashboardChart label={t('长期每日提问','Long-term daily requests')} labels={insights.daily.map(d=>d.day)} series={[{name:t('提问','Requests'),type:'line',data:insights.daily.map(d=>d.metrics.requests)}]}/>
      </details>
      <details><summary>{t('最近管理员访问与复核审计','Recent admin access and review audit')}</summary>{insights.audit.map((a,i)=><p key={i} style={wrap}>{timestamp(a.at)} · {a.actor} · {a.action} · {a.record_id??'—'}</p>)}</details>
    </>}
    <h3>{t('逐条问答', 'Questions and answers')}</h3>
    <div className="admin-dashboard__toolbar">
      <SearchInput value={q} debounceMs={300} onChange={value => { setQ(value); setPage(1); setSelected(null); }} placeholder={t('搜索最近 30 天的问题或回答', 'Search questions or answers from the last 30 days')} ariaLabel={t('搜索问答', 'Search chats')} maxLength={100} />
      <label>{t('质量筛选','Quality')} <select className="admin-dashboard-select" value={feedback} onChange={e=>{setFeedback(e.target.value);setPage(1);setSelected(null);}}>{[['all',t('全部评价','All ratings')],['negative',t('没帮助','Not helpful')],['helpful',t('有帮助','Helpful')],['unreviewed',t('待复核差评','Negative ratings to review')]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      {conversation&&<p>{t('正在查看同一用户的完整会话','Viewing this user’s conversation')} <button type="button" className="admin-boot__refresh" onClick={()=>{setConversation(null);setPage(1);}}>{t('清除会话筛选','Clear conversation filter')}</button></p>}
      <label>{t('状态', 'Status')} <select className="admin-dashboard-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); setSelected(null); }}>{['all', ...statuses].map(s => <option key={s} value={s}>{labels[s]}</option>)}</select></label>
    </div>
    <p>{t('搜索和状态筛选只影响明细，上方统计始终覆盖所选天数。', 'Search and status filters affect the list only; summary metrics cover the full selected period.')}</p>
    {error && <p role="alert">{t('明细加载失败，请刷新重试。', 'Could not load records. Refresh to retry.')}</p>}
    {records && <><div className="admin-dashboard__table"><div className="sticky-scroll admin-dashboard__table-scroll"><table className="sticky-thead"><thead><tr>{[t('时间 (UTC+8)', 'Time (UTC+8)'),t('用户', 'User'),t('问题', 'Question'),t('状态', 'Status'),t('耗时', 'Latency')].map(v => <th key={v}>{v}</th>)}</tr></thead><tbody>{records.rows.map(row => <tr key={row.id}><th>{timestamp(row.started_at)}</th><td>{row.user_id ?? '—'}</td><td><button type="button" className="admin-boot__refresh" onClick={() => setSelected(row.id)}>{row.question || t('图片提问 / 正文已过期', 'Image question / expired text')}</button></td><td>{labels[row.status]}</td><td>{seconds(row.duration_ms)}</td></tr>)}</tbody></table></div></div>
      <div className="admin-dashboard__toolbar"><p>{t(`共 ${records.total} 条，第 ${page} 页`, `${records.total} records, page ${page}`)}</p><button type="button" className="admin-boot__refresh" disabled={page === 1 || loading} onClick={() => { setPage(n => n - 1); setSelected(null); }}>{t('上一页', 'Previous')}</button><button type="button" className="admin-boot__refresh" disabled={page * records.pageSize >= records.total || loading} onClick={() => { setPage(n => n + 1); setSelected(null); }}>{t('下一页', 'Next')}</button></div></>}
    {selected && <section className="admin-dashboard__panel" data-site-surface="panel"><div className="admin-dashboard__toolbar"><h3>{t('问答详情', 'Chat details')}</h3><button type="button" className="admin-boot__refresh" onClick={() => setSelected(null)}>{t('关闭详情', 'Close details')}</button></div>
      {detailError ? <p role="alert">{t('详情加载失败，请刷新重试。', 'Could not load details. Refresh to retry.')}</p> : !detail ? <p><LoadingIndicator>{t('正在加载…', 'Loading…')}</LoadingIndicator></p> : <>
        <p style={wrap}>{detail.id} · {detail.model} · {labels[detail.status]} · {seconds(detail.duration_ms)} · {detail.error_code}</p>
        {detail.conversation_id&&detail.user_id&&<button type="button" className="admin-boot__refresh" onClick={()=>{setConversation({id:detail.conversation_id!,user:detail.user_id!});setQ('');setStatus('all');setFeedback('all');setPage(1);}}>{t('查看此会话的所有提问与重试','View all questions and retries in this conversation')}</button>}
        <p style={wrap}>{t('上一轮','Parent')}: {detail.parent_id??'—'} · {t('重试来源','Retry of')}: {detail.retry_of??'—'}</p>
        <p>{t(`图片 ${detail.image_count} 张，上下文 ${detail.history_count} 条`, `${detail.image_count} images, ${detail.history_count} history messages`)}</p>
        {detail.content_expired ? <p>{t('正文已超过 30 天保存期限。', 'Content has passed its 30-day retention period.')}</p> : <>
          <h4>{t('用户问题', 'Question')}</h4><p style={wrap}>{detail.question || t('仅图片', 'Images only')}</p>
          <h4>{t('回答正文（未完成时为已输出片段）', 'Answer (partial if unfinished)')}</h4><p style={wrap}>{detail.answer || '—'}</p>
          {!!detail.response && <details><summary>{t('来源、页面入口与结果表', 'Sources, destinations and result tables')}</summary><pre style={wrap}>{JSON.stringify(detail.response, null, 2)}</pre></details>}
        </>}
        <p>{t('用户评价','User feedback')}: {detail.feedback?feedbackLabels[detail.feedback]:'—'} · {t('复核状态','Review')}: {reviewLabels[detail.review_status]}</p>
        {!detail.content_expired&&<form style={{display:'grid',gap:12}} onSubmit={e=>{e.preventDefault();setReviewBusy(true);setReviewError(false);void reviewAssistantRequest(detail.id,reviewStatus,reviewNote).then(()=>setRefresh(n=>n+1)).catch(()=>setReviewError(true)).finally(()=>setReviewBusy(false));}}>
          <label>{t('管理员复核','Admin review')} <select className="admin-dashboard-select" value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}>{Object.entries(reviewLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
          <label>{t('改进记录','Review note')} <textarea className="admin-dashboard-select" style={{display:'block',width:'100%'}} value={reviewNote} maxLength={500} onChange={e=>setReviewNote(e.target.value)} rows={2}/></label>{reviewNote&&<ClearButton onClick={()=>setReviewNote('')}/>}
          <button className="admin-boot__refresh" type="submit" disabled={reviewBusy}>{t('保存复核','Save review')}</button>{reviewError&&<p role="alert">{t('复核未保存，请重试。','Review was not saved. Please retry.')}</p>}
        </form>}
        <h4>{t('各阶段耗时', 'Stage timings')}</h4><p>{t('并行或嵌套阶段可能重叠，阶段耗时不可直接相加。', 'Parallel or nested stages may overlap; durations are not additive.')}</p>
        <div className="admin-dashboard__table"><div className="sticky-scroll admin-dashboard__table-scroll"><table className="sticky-thead"><thead><tr><th>{t('阶段', 'Stage')}</th><th>{t('调用次数', 'Calls')}</th><th>{t('耗时', 'Latency')}</th><th>{t('失败次数', 'Failures')}</th></tr></thead><tbody>{Object.entries(detail.metrics.stages ?? {}).map(([stage, value]) => <tr key={stage}><th>{({ model: t('模型回答', 'Model'), data: t('读取数据', 'Data'), page: t('读取页面', 'Pages'), tool: t('使用工具', 'Tools'), rerank:t('重排序','Reranking'), total: t('整体', 'Overall') } as Record<string, string>)[stage] ?? stage}</th><td>{value.calls}</td><td>{seconds(value.ms)}</td><td>{value.errors}</td></tr>)}</tbody></table></div></div>
        {modelEstimates.length>0&&<p>{t('模型费用估算（含缓存折扣，元）','Model estimate with cache discounts (CNY)')}: {modelEstimateMin.toFixed(4)}–{modelEstimateMax.toFixed(4)} · {modelEstimates.length}/{detail.metrics.models?.length ?? 0} {t('次调用有估价；不含工具费用，非实际账单。','calls priced; excludes tools and is not an invoice.')}</p>}
        <details><summary>{t('查看详细用量记录', 'Detailed usage records')}</summary><pre style={wrap}>{JSON.stringify(detail.metrics, null, 2)}</pre></details>
      </>}
    </section>}
  </section>;
}
