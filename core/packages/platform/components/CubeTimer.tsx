"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RotateCw, Trash2, Plus, Ban, Save } from "lucide-react";
import { scramble, SCRAMBLE_EVENTS } from "@/lib/cube/scramble";
import {
  saveSolveAction,
  setPenaltyAction,
  deleteSolveAction,
} from "@/app/actions/timer";
import type { CubeEventId, SolvePenalty } from "@/db/schema";

// 一条成绩(本地 session + 服务端历史共用此形状)。
// id 为 "local:xxx" 表示未登录暂存(localStorage),否则是服务端行 id。
type Solve = {
  id: string;
  event: CubeEventId;
  timeMs: number;
  scramble: string;
  penalty: SolvePenalty;
  createdAt: number; // 秒
};

const LS_KEY = "cube_timer_solves_v1";

// ── 纯函数:有效时间 / ao 计算(与 lib/db/timer.ts 同规则,客户端版) ──
function effectiveMs(timeMs: number, penalty: SolvePenalty): number {
  if (penalty === "dnf") return Infinity;
  if (penalty === "plus2") return timeMs + 2000;
  return timeMs;
}

function averageOf(effs: number[]): number {
  const n = effs.length;
  if (n < 3) return Infinity;
  const dnf = effs.filter((v) => !Number.isFinite(v)).length;
  if (dnf > 1) return Infinity;
  const sorted = [...effs].sort((a, b) => a - b);
  const middle = sorted.slice(1, n - 1);
  return Math.round(middle.reduce((a, b) => a + b, 0) / middle.length);
}

// solves: 最新在前
function rollingAverage(solves: Solve[], n: number): number | null {
  if (solves.length < n) return null;
  return averageOf(solves.slice(0, n).map((s) => effectiveMs(s.timeMs, s.penalty)));
}

function fmt(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (!Number.isFinite(ms)) return "DNF";
  const totalCs = Math.round(ms / 10); // 百分秒
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  if (min > 0) return `${min}:${pad2(sec)}.${pad2(cs)}`;
  return `${sec}.${pad2(cs)}`;
}

// 单次成绩的展示(含 penalty 标记)
function fmtSolve(s: Solve): string {
  if (s.penalty === "dnf") return "DNF";
  const eff = effectiveMs(s.timeMs, s.penalty);
  return fmt(eff) + (s.penalty === "plus2" ? "+" : "");
}

type TimerPhase = "idle" | "holding" | "ready" | "running";

export function CubeTimer({
  loggedIn,
  initialEvent = "333",
  serverSolves = [],
}: {
  loggedIn: boolean;
  initialEvent?: CubeEventId;
  serverSolves?: Solve[];
}) {
  const [event, setEvent] = useState<CubeEventId>(initialEvent);
  const [curScramble, setCurScramble] = useState<string>("");
  // 本 session 新增的成绩(未登录:localStorage;已登录:也镜像一份做即时反馈)
  const [localSolves, setLocalSolves] = useState<Solve[]>([]);
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [displayMs, setDisplayMs] = useState(0);
  const [saving, setSaving] = useState(false);

  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 首次挂载:出一个打乱 + 读 localStorage(未登录暂存)。
  useEffect(() => {
    setCurScramble(scramble(initialEvent));
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Solve[];
        if (Array.isArray(parsed)) setLocalSolves(parsed);
      }
    } catch {
      // 忽略坏数据
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换项目:重出打乱(只针对该 event 的成绩显示在统计里)。
  const changeEvent = useCallback((e: CubeEventId) => {
    setEvent(e);
    setCurScramble(scramble(e));
    setDisplayMs(0);
    setPhase("idle");
  }, []);

  const newScramble = useCallback(() => {
    setCurScramble(scramble(event));
  }, [event]);

  const persistLocal = useCallback((next: Solve[]) => {
    setLocalSolves(next);
    try {
      // 未登录才长期暂存;登录后这份只是本 session 即时反馈,也存着无妨
      localStorage.setItem(LS_KEY, JSON.stringify(next.slice(0, 300)));
    } catch {
      // 配额满等,忽略
    }
  }, []);

  // 合并 server + local(本 event),去重(server id 优先),最新在前。
  const merged: Solve[] = useMemo(() => {
    const map = new Map<string, Solve>();
    for (const s of serverSolves) if (s.event === event) map.set(s.id, s);
    for (const s of localSolves) if (s.event === event) map.set(s.id, s);
    return [...map.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [serverSolves, localSolves, event]);

  const stats = useMemo(() => {
    const finite = merged
      .map((s) => effectiveMs(s.timeMs, s.penalty))
      .filter((v) => Number.isFinite(v));
    return {
      count: merged.length,
      best: finite.length ? Math.min(...finite) : null,
      mean: finite.length
        ? Math.round(finite.reduce((a, b) => a + b, 0) / finite.length)
        : null,
      ao5: rollingAverage(merged, 5),
      ao12: rollingAverage(merged, 12),
    };
  }, [merged]);

  // ── 计时核心 ──
  const tick = useCallback(() => {
    setDisplayMs(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTimer = useCallback(async () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const ms = performance.now() - startRef.current;
    setDisplayMs(ms);
    setPhase("idle");

    const now = Math.floor(Date.now() / 1000);
    const localId = "local:" + now + ":" + Math.random().toString(36).slice(2, 8);
    const solve: Solve = {
      id: localId,
      event,
      timeMs: Math.round(ms),
      scramble: curScramble,
      penalty: "none",
      createdAt: now,
    };
    // 先即时入本地表(乐观)
    const nextLocal = [solve, ...localSolves];
    persistLocal(nextLocal);
    // 出下一个打乱
    setCurScramble(scramble(event));

    // 已登录则存档,拿到 server id 后替换本地条目的 id
    if (loggedIn) {
      setSaving(true);
      const res = await saveSolveAction({
        event,
        timeMs: solve.timeMs,
        scramble: solve.scramble,
        penalty: "none",
      });
      setSaving(false);
      if (res.ok) {
        persistLocal(
          nextLocal.map((s) =>
            s.id === localId ? { ...s, id: res.id } : s,
          ),
        );
      }
    }
  }, [event, curScramble, localSolves, persistLocal, loggedIn]);

  const startTimer = useCallback(() => {
    startRef.current = performance.now();
    setPhase("running");
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // ── 键盘(桌面):按住空格蓄力,松开开始;运行中任意键停 ──
  useEffect(() => {
    const isEditable = (el: EventTarget | null) => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (phase === "running") {
        e.preventDefault();
        void stopTimer();
        return;
      }
      if (e.code === "Space" && phase === "idle") {
        e.preventDefault();
        setPhase("holding");
        // 蓄力 350ms 变"就绪"色
        holdTimerRef.current = setTimeout(() => setPhase("ready"), 350);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.code !== "Space") return;
      e.preventDefault();
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (phase === "ready") {
        startTimer();
      } else if (phase === "holding") {
        // 没蓄够力,回到 idle
        setPhase("idle");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, startTimer, stopTimer]);

  // ── 触摸(移动):长按蓄力,松开开始;运行中点击停 ──
  const onTouchStart = useCallback(() => {
    if (phase === "running") {
      void stopTimer();
      return;
    }
    if (phase === "idle") {
      setPhase("holding");
      holdTimerRef.current = setTimeout(() => setPhase("ready"), 350);
    }
  }, [phase, stopTimer]);

  const onTouchEnd = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (phase === "ready") startTimer();
    else if (phase === "holding") setPhase("idle");
  }, [phase, startTimer]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  // ── 成绩操作 ──
  const applyPenalty = useCallback(
    async (s: Solve, penalty: SolvePenalty) => {
      const next: SolvePenalty = s.penalty === penalty ? "none" : penalty;
      persistLocal(
        localSolves.map((x) => (x.id === s.id ? { ...x, penalty: next } : x)),
      );
      if (loggedIn && !s.id.startsWith("local:")) {
        await setPenaltyAction(s.id, next);
      }
    },
    [localSolves, persistLocal, loggedIn],
  );

  const removeSolve = useCallback(
    async (s: Solve) => {
      persistLocal(localSolves.filter((x) => x.id !== s.id));
      if (loggedIn && !s.id.startsWith("local:")) {
        await deleteSolveAction(s.id);
      }
    },
    [localSolves, persistLocal, loggedIn],
  );

  // 计时盘的配色 / 文案随 phase 变
  const padColor =
    phase === "ready"
      ? "text-[#10B65A]"
      : phase === "holding"
        ? "text-[#FF6A00]"
        : "text-ink";
  const hint =
    phase === "running"
      ? "按空格 / 点击 停止"
      : phase === "ready"
        ? "松开开始"
        : phase === "holding"
          ? "继续按住蓄力…"
          : "按住空格蓄力，松开开始（手机长按）";

  const showMs =
    phase === "holding" || phase === "ready" ? 0 : displayMs;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      {/* 主区:打乱 + 计时盘 */}
      <div>
        {/* event 选择 + 换打乱 */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="text-[13px] text-ink-3">项目</label>
          <select
            value={event}
            onChange={(e) => changeEvent(e.target.value as CubeEventId)}
            className="rounded-[10px] border border-line bg-white px-3 py-1.5 text-[14px] text-ink outline-none focus:border-brand"
          >
            {SCRAMBLE_EVENTS.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={newScramble}
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-line px-3 py-1.5 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand"
          >
            <RotateCw size={14} /> 换打乱
          </button>
        </div>

        {/* 当前打乱(等宽) */}
        <div className="mb-5 rounded-[14px] border border-line bg-bg-soft px-4 py-3">
          <div className="mb-1 text-[12px] text-ink-3">打乱公式</div>
          <div className="font-alg text-[15px] leading-relaxed tracking-wide text-ink break-words sm:text-[17px]">
            {curScramble || "…"}
          </div>
        </div>

        {/* 计时盘 */}
        <div
          role="button"
          tabIndex={0}
          aria-label="计时区"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="select-none rounded-[14px] border border-line bg-white py-14 text-center transition-colors hover:border-brand/40 sm:py-20"
          style={{ touchAction: "none" }}
        >
          <div
            className={
              "font-alg text-[64px] font-semibold leading-none tabular-nums sm:text-[88px] " +
              padColor
            }
          >
            {fmt(showMs)}
          </div>
          <div className="mt-4 text-[13px] text-ink-3">{hint}</div>
          {saving ? (
            <div className="mt-2 inline-flex items-center gap-1 text-[12px] text-brand">
              <Save size={12} /> 保存中…
            </div>
          ) : null}
        </div>

        {!loggedIn ? (
          <p className="mt-3 text-[13px] text-ink-3">
            成绩已暂存在本机。
            <a
              href="/login?next=/timer"
              className="ml-1 font-medium text-brand hover:underline"
            >
              登录后永久保存成绩
            </a>
          </p>
        ) : null}
      </div>

      {/* 侧栏:统计 + 历史 */}
      <div className="grid gap-5">
        {/* 统计卡 */}
        <div className="rounded-[14px] border border-line p-4">
          <div className="mb-3 text-[13px] font-medium text-ink-2">本项统计</div>
          <dl className="grid grid-cols-2 gap-3">
            <Stat label="次数" value={String(stats.count)} />
            <Stat label="最好" value={fmt(stats.best)} />
            <Stat label="ao5" value={fmt(stats.ao5)} />
            <Stat label="ao12" value={fmt(stats.ao12)} />
            <Stat label="平均" value={fmt(stats.mean)} />
          </dl>
        </div>

        {/* 历史 */}
        <div className="rounded-[14px] border border-line p-4">
          <div className="mb-3 text-[13px] font-medium text-ink-2">
            历史成绩
          </div>
          {merged.length === 0 ? (
            <p className="text-[13px] text-ink-3">还没有成绩,先还原一次吧。</p>
          ) : (
            <ul className="grid gap-1.5">
              {merged.slice(0, 30).map((s, i) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 hover:bg-bg-soft"
                >
                  <span className="w-7 shrink-0 text-[12px] text-ink-3">
                    {merged.length - i}.
                  </span>
                  <span className="font-alg flex-1 text-[15px] tabular-nums text-ink">
                    {fmtSolve(s)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <IconBtn
                      active={s.penalty === "plus2"}
                      title="+2 罚时"
                      onClick={() => applyPenalty(s, "plus2")}
                    >
                      <Plus size={13} />
                    </IconBtn>
                    <IconBtn
                      active={s.penalty === "dnf"}
                      title="标记 DNF(不计)"
                      onClick={() => applyPenalty(s, "dnf")}
                    >
                      <Ban size={13} />
                    </IconBtn>
                    <IconBtn title="删除这次成绩" onClick={() => removeSolve(s)}>
                      <Trash2 size={13} />
                    </IconBtn>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="font-alg text-[18px] font-semibold tabular-nums text-ink">
        {value}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={
        "inline-flex h-6 w-6 items-center justify-center rounded-[6px] border transition-colors " +
        (active
          ? "border-brand/40 bg-brand-soft text-brand"
          : "border-line text-ink-3 hover:border-brand/40 hover:text-brand")
      }
    >
      {children}
    </button>
  );
}
