'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowUpRight, Check, Pause, Play, RotateCcw, Square } from 'lucide-react';
import Link from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import BackHome from '@/components/BackHome';
import { ClientLoadStatus } from '@/components/StartupStatus';
import { useT } from '@/hooks/useT';
import { useAuthUser } from '@/lib/auth-store';
import { isAdminWcaId } from '@cuberoot/shared/admin';
import { CUBE_AGENT_MODELS, CUBE_AGENT_PRICE_URL, type CubeAgentRun, type CubeAgentOverview } from '@cuberoot/shared/cube-agents';
import { getCubeAgentOverview, startCubeAgentRun } from '@/lib/cube-agents-api';
import { REFERENCE_URL, replayDuration, teamVisuallySolved } from './_replay';
import './agents.css';

const ReplayCanvas = dynamic(() => import('./ReplayCanvas'), {
  ssr: false,
  loading: () => <div className="agents-loading"><ClientLoadStatus /></div>,
});

export default function AgentReplayPage() {
  const t = useT();
  const user = useAuthUser();
  const isAdmin = Boolean(user?.isAdmin || isAdminWcaId(user?.wcaId));
  const board = useRef<HTMLDivElement>(null);
  const elapsed = useRef(0);
  const runRef = useRef<CubeAgentRun | null>(null);
  const controller = useRef<AbortController | null>(null);
  const received = useRef({ time: 0, at: 0 });
  const [run, setRun] = useState<CubeAgentRun | null>(null);
  const [overview, setOverview] = useState<CubeAgentOverview | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState('');
  const [generation, setGeneration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [difficulty, setDifficulty] = useState(3);
  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback(() => { setError(true); setPlaying(false); setReady(false); }, []);
  const duration = replayDuration(run);
  const observing = run?.status === 'running' && !running;
  const models = run ? run.teams.map(team => ({ id: team.model, name: team.name })) : CUBE_AGENT_MODELS;

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await getCubeAgentOverview(abort.signal);
        if (abort.signal.aborted) return;
        setOverview(data);
        if (data.latest && !controller.current) {
          runRef.current = data.latest; setRun(data.latest);
          elapsed.current = data.latest.status === 'running' ? data.latest.elapsedMs / 1000 : 0;
          setSeconds(elapsed.current);
          setPlaying(data.latest.status !== 'running' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        }
        if (data.busy) timer = setTimeout(refresh, 2000);
      } catch { if (!abort.signal.aborted) setNotice('unavailable'); }
    };
    void refresh();
    return () => { clearTimeout(timer); abort.abort(); controller.current?.abort(); };
  }, []);

  useEffect(() => {
    if ((!playing && !running) || !ready) return;
    let previous = 0;
    let lastUpdate = 0;
    let frame = 0;
    const tick = (now: number) => {
      const limit = replayDuration(runRef.current);
      if (running) elapsed.current = received.current.time + (now - received.current.at) / 1000;
      else if (document.hidden) previous = 0;
      else {
        if (previous) elapsed.current = Math.min(limit, elapsed.current + (now - previous) / 1000 * speed);
        previous = now;
      }
      if (now - lastUpdate >= 32) { setSeconds(elapsed.current); lastUpdate = now; }
      if (!running && elapsed.current >= limit) { setPlaying(false); setSeconds(limit); return; }
      frame = requestAnimationFrame(tick);
    };
    const visibility = () => { previous = 0; };
    document.addEventListener('visibilitychange', visibility);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', visibility); };
  }, [playing, running, ready, speed]);

  const seek = (time: number) => { elapsed.current = time; setSeconds(time); };
  const restart = () => { seek(0); setPlaying(true); };
  const start = async () => {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setNotice(''); setRunning(true); setPlaying(false); seek(0);
    received.current = { time: 0, at: performance.now() };
    runRef.current = null; setRun(null);
    try {
      await startCubeAgentRun(difficulty, abort.signal, value => {
        runRef.current = value; setRun(value);
        received.current = { time: value.elapsedMs / 1000, at: performance.now() };
        seek(value.elapsedMs / 1000);
      });
      setPlaying(true);
    } catch (failure) {
      setNotice(abort.signal.aborted ? 'stopped' : failure instanceof Error ? failure.message : 'run_failed');
      // A broken/cancelled stream cannot claim complete billing or completion.
      const interrupted = runRef.current as CubeAgentRun | null;
      if (interrupted?.status === 'running') {
        const partial = structuredClone(interrupted);
        partial.status = 'stopped'; partial.elapsedMs = elapsed.current * 1000;
        for (const team of partial.teams) {
          if (team.status === 'planning' || team.status === 'running') team.status = 'stopped';
          team.usageComplete = false;
          for (const agent of team.agents) if (agent.status === 'thinking' || agent.status === 'waiting') agent.status = 'stopped';
        }
        runRef.current = partial; setRun(partial);
      }
    } finally { controller.current = null; setRunning(false); }
  };
  const status = (value?: string) => ({
    planning: t('分配策略', 'Planning'), running: t('并行探索', 'Exploring'), solved: t('已验证还原', 'Verified solved'),
    exhausted: t('本轮未还原', 'Not solved'), stopped: t('已停止', 'Stopped'), error: t('调用失败', 'Call failed'),
    thinking: t('思考中', 'Thinking'), waiting: t('等待开始', 'Ready'),
  }[value ?? 'waiting'] ?? t('等待开始', 'Ready'));
  const providerError = (value: string) => ({
    provider_access_denied: t('当前 API Key 无权调用此模型', 'The current API key cannot access this model'),
    provider_rate_limited: t('服务商限制了调用频率', 'The provider rate limit was reached'),
    provider_error: t('模型服务返回错误', 'The model service returned an error'),
  }[value]);
  const message = ({
    unavailable: t('服务尚未就绪，请稍后刷新。', 'The service is not ready. Please refresh later.'),
    busy: t('已有实验正在运行，请稍后再试。', 'An experiment is already running. Please try later.'),
    daily_limit: t('今天的实验额度已用完。', 'Today’s experiment limit has been reached.'),
    admin_required: t('请使用管理员账号启动实验。', 'An administrator account is required to start a run.'),
    stopped: t('已停止请求；未返回的调用可能仍产生费用。', 'Requests stopped; calls without a response may still incur charges.'),
  } as Record<string, string>)[notice] ?? t('连接中断或模型调用失败，已保留收到的结果。', 'The connection or model call failed. Received results are preserved.');

  return (
    <main className="agents-page">
      <header className="agents-topbar"><BackHome prefetch={false} /><HeaderToggles /></header>
      <div className="agents-heading">
        <span className="agents-eyebrow">CUBEROOT · {t('AI 实验室', 'AI LAB')}</span>
        <h1>{t('一起，解开魔方。', 'A puzzle. A team. A solution.')}</h1>
        <p>{t('两款国产模型，同一个二阶魔方。各派四个代理，看看谁先找到答案。', 'Two Qwen models. The same 2×2 cube. Four agents on each team, searching for a solution.')}</p>
      </div>
      <div className="agents-run-controls">
        {isAdmin ? <>
          <label>{t('打乱长度', 'Scramble length')} <select value={difficulty} disabled={running} onChange={event => setDifficulty(Number(event.target.value))}>
            {[2, 3, 5, 8].map(value => <option key={value} value={value}>{value} {t('步', 'moves')}</option>)}
          </select></label>
          {running
            ? <button type="button" onClick={() => controller.current?.abort()}><Square size={14} />{t('停止实验', 'Stop run')}</button>
            : <button type="button" onClick={start} disabled={!overview?.available || overview.busy || !ready}><Play size={14} />{t('开始真实对比', 'Start real comparison')}</button>}
          <span>{t('最多 120 秒，每个代理最多尝试 6 次。', 'Up to 120 seconds, six attempts per agent.')}</span>
        </> : <span>{t('管理员启动新实验；所有人都可以查看实测结果、重播转动。', 'Administrators start new experiments. Everyone can inspect results and replay moves.')}</span>}
      </div>
      {notice && <p className="agents-notice" role="status">{message}</p>}
      <section className="agents-showcase" aria-label={t('AI 解魔方真实对比', 'Real AI cube comparison')}>
        <div className="agents-board-title">
          <span>{t('四路并行 · 同题对比', 'FOUR AGENTS · ONE PUZZLE')}</span>
          <span className="agents-replay-label">{running || observing ? t('实时运行', 'LIVE RUN') : run ? t('真实记录回放', 'RECORDED RUN') : t('等待首次实验', 'AWAITING FIRST RUN')}</span>
        </div>
        <div className="agents-board" ref={board}>
          {models.map((model, teamIndex) => {
            const team = run?.teams[teamIndex];
            const complete = teamVisuallySolved(run, teamIndex, seconds);
            const time = team?.solvedMs ?? team?.finishedMs ?? (run ? seconds * 1000 : 0);
            return (
              <article key={teamIndex} className={`agents-team${complete ? ' is-solved' : ''}`} data-site-surface="panel">
                <div className="agents-team-heading"><h2>{model.name}</h2>
                  <span className="agents-team-status">{team?.status === 'solved' && <Check size={13} />}{status(team?.status)}</span>
                </div>
                <div className="agents-stage" role="img" aria-label={`${model.name}: ${status(team?.status)}`}>
                  {[0, 1, 2, 3].map(agent => <div key={agent} className={`agents-cube-slot${complete ? agent === team?.winner ? ' is-winner' : ' is-hidden' : ''}`}>
                    <div className="agents-viewport" data-agent-viewport />
                    <span className="agents-agent-label" title={status(team?.agents[agent].status)}>{t('代理', 'AGENT')} {agent + 1}</span>
                  </div>)}
                </div>
                <div className="agents-metrics">
                  <div><span>{t('实测耗时', 'MEASURED TIME')}</span><strong>{run ? (time / 1000).toFixed(1) : '—'}<small>s</small></strong></div>
                  <div><span>{t('估算费用', 'EST. COST')}</span><strong className="agents-cost">{team && (team.usageComplete || team.estimatedCny > 0)
                    ? `${team.usageComplete ? '' : '≥'}¥${team.estimatedCny.toFixed(4)}` : '—'}</strong></div>
                </div>
                <div className="agents-details">
                  <span><b>{team?.positions ?? '—'}</b> {t('个状态', 'states')}</span>
                  <span><b>{team?.toolCalls ?? '—'}</b> {t('次验证', 'tests')}</span>
                  <span><b>{team ? team.inputTokens + team.outputTokens : '—'}</b> tokens</span>
                </div>
                {team && !team.usageComplete && <div className="agents-usage-warning">{t('用量不完整，费用仅含已收到的用量', 'Incomplete usage; cost includes received usage only')}</div>}
                {team?.error && <div className="agents-usage-warning">{providerError(team.error)}</div>}
              </article>
            );
          })}
          {!error && <ReplayCanvas key={generation} board={board} elapsed={elapsed} run={runRef} onReady={onReady} onError={onError} />}
          {error && <div className="agents-loading" role="alert"><p>{t('3D 画面加载失败，请重试。', 'The 3D scene could not load. Please retry.')}</p>
            <button type="button" onClick={() => { setError(false); setGeneration(value => value + 1); }}>{t('重试', 'Retry')}</button></div>}
        </div>
        <div className="agents-controls">
          <button type="button" className="agents-play" onClick={() => seconds >= duration ? restart() : setPlaying(value => !value)} disabled={!ready || !run || running || observing} aria-label={playing ? t('暂停', 'Pause') : t('播放', 'Play')}>
            {playing ? <Pause size={17} /> : <Play size={17} />}
          </button>
          <button type="button" onClick={restart} disabled={!ready || !run || running || observing} aria-label={t('重新播放', 'Replay')}><RotateCcw size={17} /></button>
          <input type="range" min={0} max={running || observing ? Math.max(120, seconds) : duration} step={0.01} value={seconds} disabled={!ready || !run || running || observing}
            aria-label={t('回放进度', 'Replay progress')} onChange={event => { setPlaying(false); seek(Number(event.target.value)); }} />
          <span className="agents-time">{seconds.toFixed(1)}s</span>
          <select aria-label={t('播放速度', 'Playback speed')} value={speed} disabled={running} onChange={event => setSpeed(Number(event.target.value))}>
            <option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option>
          </select>
        </div>
      </section>
      <div className="agents-caption">
        <p>{t('数值为本轮实测结果，回放只重播转动。模型只看到角块状态与转动规则，不会得到打乱序列或内置求解器的答案。费用按 API 返回的 tokens 和人民币原价估算，包含协调者与四个代理，未扣缓存折扣或免费额度；实际账单以服务商为准。单轮结果不代表整体模型能力。', 'Metrics show this run’s measured results; replay replays moves only. Models receive corner states and move rules, never the scramble or a solver answer. CNY estimates use returned tokens and list prices for the coordinator and four agents, before cache discounts or free credits; provider billing is authoritative. One run does not establish overall model quality.')}</p>
        <a href={REFERENCE_URL} target="_blank" rel="noopener noreferrer">{t('视觉参考', 'Visual reference')}<ArrowUpRight size={14} /></a>
      </div>
      {run && <details className="agents-log"><summary>{t('查看本轮记录', 'Inspect this run')}</summary>
        <p>{t('打乱', 'Scramble')}: <code>{run.scramble}</code> · {run.startedAt}</p>
        {run.teams.map(team => <div key={team.model}><h3>{team.name}</h3>
          <p>{team.model} · {team.modelCalls} {t('次模型调用', 'model calls')} · {team.inputTokens} {t('输入', 'input')} / {team.outputTokens} {t('输出', 'output')} tokens</p>
          {team.agents.map((agent, index) => <div key={index}><b>{t('代理', 'Agent')} {index + 1}: {status(agent.status)}</b>
            <ol>{agent.trials.map((trial, i) => <li key={i}><time>{(trial.atMs / 1000).toFixed(2)}s</time> <code>{trial.moves || '∅'}</code> · {trial.solved ? t('验证通过', 'Verified solved') : t(`${trial.correct}/8 角块归位`, `${trial.correct}/8 corners solved`)}</li>)}</ol>
          </div>)}
        </div>)}
        <a href={CUBE_AGENT_PRICE_URL} target="_blank" rel="noopener noreferrer">{t('官方价格依据', 'Official price reference')}</a>
      </details>}
      <Link href="/sim?puzzle=2" className="agents-try" prefetch={false}>{t('亲手转一转二阶魔方', 'Try the 2×2 yourself')}<ArrowUpRight size={16} /></Link>
    </main>
  );
}
