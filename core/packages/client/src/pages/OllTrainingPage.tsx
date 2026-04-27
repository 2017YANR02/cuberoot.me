/**
 * OllTrainingPage — 从 bestsiteever/oll/scripts/timer.js 原版移植
 *
 * 计时器训练模式：
 * 1. 显示打乱序列（文字）
 * 2. 空格/触摸启停计时器
 * 3. 自动生成下一个打乱
 * 4. 按 case 分组的计时历史
 * 5. 支持加权随机和 Recap 两种队列模式
 */
import { useEffect, useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ollInfo from '@cuberoot/shared/data/oll.json';
import ollScrambles from '@cuberoot/shared/data/oll_scrambles.json';
import { useSessionStore } from '../stores/sessionStore';

// --- 类型定义 ---
interface OllCase {
  name: string;
  alg: string;
  alg2: string;
  group: string;
}

interface TimerResult {
  time: string;     // 显示文字 "1.23"
  ms: number;       // 毫秒
  caseNum: number;   // OLL 编号
  scramble: string;  // 打乱序列
}

const typedOllInfo = ollInfo as Record<string, OllCase>;
const typedOllScrambles = ollScrambles as Record<string, string[]>;

// --- 原版 inverse_scramble + applyRotationForAlgorithm ---
function inverseScramble(s: string): string {
  s = s.replace(/[[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  const arr = s.split(' ');
  let result = '';
  for (const it of arr) {
    if (it.length === 0) continue;
    if (it.endsWith('2')) result = it + ' ' + result;
    else if (it.endsWith("'")) result = it.slice(0, -1) + ' ' + result;
    else result = it + "' " + result;
  }
  return result.trim();
}

function applyRotation(alg: string, rot: string): string {
  let mapObj: Record<string, string> | null = null;
  if (rot === 'y') mapObj = { R: 'F', F: 'L', L: 'B', B: 'R' };
  if (rot === "y'") mapObj = { R: 'B', B: 'L', L: 'F', F: 'R' };
  if (rot === 'y2') mapObj = { R: 'L', L: 'R', B: 'F', F: 'B' };
  if (!mapObj) return alg;
  const re = new RegExp(Object.keys(mapObj).join('|'), 'g');
  return alg.replace(re, (m) => mapObj![m] || m);
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// NOTE: 加权随机选择（原版 randomWeightedElement）
function weightedRandom(items: number[], weights: number[]): number {
  const cw = weights.slice();
  for (let i = 1; i < cw.length; i++) cw[i] += cw[i - 1];
  const r = Math.random() * cw[cw.length - 1];
  for (let i = 0; i < cw.length; i++) {
    if (cw[i] > r) return items[i];
  }
  return items[items.length - 1];
}

// --- 格式化 ---
function msToDisplay(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '-';
  const cs = Math.floor((ms % 1000) / 10);
  const secs = Math.floor((ms / 1000) % 60);
  const mins = Math.floor((ms / (1000 * 60)) % 60);
  const pad2 = (n: number) => (n < 10 ? '0' + n : '' + n);
  if (mins > 0) return `${mins}:${pad2(secs)}.${pad2(cs)}`;
  return `${secs}.${pad2(cs)}`;
}

// --- 持久化 ---
const STORAGE_KEY = 'oll_times_array';
function loadTimes(): TimerResult[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveTimes(times: TimerResult[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
}

export function OllTrainingPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const queue = useSessionStore((s) => s.queue);

  // 从 queue 中提取选中的 case 编号
  const selectedCases = useRef<number[]>([]);
  const casesWeights = useRef<number[]>([]);
  // NOTE: recap 模式剩余 case 列表（空数组 = train 模式）
  const recapArray = useRef<number[]>([]);

  const [times, setTimes] = useState<TimerResult[]>(loadTimes);
  const [scramble, setScramble] = useState('');
  const [lastCase, setLastCase] = useState(0);
  const [lastScramble, setLastScramble] = useState('');

  // 计时器状态
  const [running, setRunning] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [displayMs, setDisplayMs] = useState(-1);
  const [timerColor, setTimerColor] = useState<'default' | 'green' | 'red'>('default');
  const startTimeRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const allowStartRef = useRef(false);

  // hint 弹窗
  const [hintCase, setHintCase] = useState<number | null>(null);

  // 初始化选中 case 列表
  useEffect(() => {
    // 从 queue 的 name 字段提取 OLL 编号（"OLL 1" → 1）
    const nums = [...new Set(
      queue.map((c) => {
        const m = c.name.match(/^OLL (\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      }).filter((n) => n > 0)
    )];
    selectedCases.current = nums.length > 0 ? nums : Array.from({ length: 57 }, (_, i) => i + 1);
    casesWeights.current = selectedCases.current.map(() => 1);
    generateScramble();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 持久化
  useEffect(() => { saveTimes(times); }, [times]);

  // 更新计时器显示
  useEffect(() => {
    if (running) {
      timerIntervalRef.current = setInterval(() => {
        setDisplayMs(Date.now() - startTimeRef.current);
      }, 10);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [running]);

  // --- 核心打乱生成（原版 generateScramble）---
  const generateScramble = useCallback(() => {
    const cases = selectedCases.current;
    if (cases.length === 0) {
      setScramble(isZh ? '请先选择 OLL case' : 'Select OLL cases first');
      allowStartRef.current = false;
      return;
    }

    let caseNum: number;
    if (recapArray.current.length > 0) {
      // Recap 模式
      const idx = Math.floor(Math.random() * recapArray.current.length);
      caseNum = recapArray.current[idx];
      recapArray.current.splice(idx, 1);
    } else {
      // Train 模式（加权随机）
      caseNum = weightedRandom(cases, casesWeights.current);
    }

    // 从预生成打乱中随机选一个，再随机 y 旋转
    const scrambles = typedOllScrambles[String(caseNum)] || [];
    const baseScramble = scrambles.length > 0
      ? inverseScramble(randomElement(scrambles))
      : inverseScramble(typedOllInfo[`OLL ${caseNum}`]?.alg || '');
    const rotation = randomElement(['', 'y', 'y2', "y'"]);
    const finalScramble = applyRotation(baseScramble, rotation);

    setLastScramble(finalScramble);
    setLastCase(caseNum);
    setScramble(finalScramble);
    allowStartRef.current = true;
  }, [isZh]);

  // --- 计时器控制（原版 timerSetReady/timerStart/timerStop）---
  const timerSetReady = useCallback(() => {
    setWaiting(false);
    setDisplayMs(0);
    setTimerColor('green');
  }, []);

  const timerStart = useCallback(() => {
    startTimeRef.current = Date.now();
    setRunning(true);
    setTimerColor('default');
  }, []);

  const timerStop = useCallback(() => {
    setWaiting(true);
    setRunning(false);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const elapsed = Date.now() - startTimeRef.current;
    setDisplayMs(elapsed);
    setTimerColor('red');

    // 记录成绩
    const result: TimerResult = {
      time: msToDisplay(elapsed),
      ms: elapsed,
      caseNum: lastCase,
      scramble: lastScramble,
    };
    setTimes((prev) => [...prev, result]);

    // 更新权重（原版逻辑：>5s 权重翻倍，<=5s 权重减半）
    const idx = selectedCases.current.indexOf(lastCase);
    if (idx !== -1) {
      if (elapsed > 5000) casesWeights.current[idx] *= 2;
      else casesWeights.current[idx] /= 2;
    }

    generateScramble();
  }, [lastCase, lastScramble, generateScramble]);

  const timerAfterStop = useCallback(() => {
    setTimerColor('default');
  }, []);

  // --- 键盘事件（原版 keydown/keyup）---
  const allowedRef = useRef(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') e.preventDefault();

      // Delete → 删除最后一条
      if (e.key === 'Delete' && !running) {
        if (e.shiftKey) handleClear();
        else handleRemoveLast();
        return;
      }

      if (!allowedRef.current || !allowStartRef.current) return;
      if (e.key !== 'Shift') allowedRef.current = false;

      if (running) {
        timerStop();
      } else if (e.key === ' ') {
        timerSetReady();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      allowedRef.current = true;
      if (!allowStartRef.current) return;
      if (!running && !waiting && e.key === ' ') {
        timerStart();
      } else {
        timerAfterStop();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [running, waiting, timerStop, timerSetReady, timerStart, timerAfterStop]);

  // --- 触摸事件 ---
  const handleTouchStart = useCallback(() => {
    if (running) timerStop();
    else timerSetReady();
  }, [running, timerStop, timerSetReady]);

  const handleTouchEnd = useCallback(() => {
    if (!allowStartRef.current) return;
    if (!running && !waiting) timerStart();
    else timerAfterStop();
  }, [running, waiting, timerStart, timerAfterStop]);

  // --- 统计操作 ---
  const handleRemoveLast = () => {
    setTimes((prev) => {
      if (prev.length === 0) return prev;
      if (confirm(isZh ? '删除最后一条记录？' : 'Delete the last record?')) return prev.slice(0, -1);
      return prev;
    });
  };

  const handleClear = () => {
    if (confirm(isZh ? '确定清空所有记录？' : 'Clear all records?')) {
      setTimes([]);
      casesWeights.current = selectedCases.current.map(() => 1);
    }
  };

  // --- 按 case 分组统计（原版 displayStats） ---
  const groupedResults = (() => {
    const byCase: Record<number, TimerResult[]> = {};
    for (const t of times) {
      if (!byCase[t.caseNum]) byCase[t.caseNum] = [];
      byCase[t.caseNum].push(t);
    }
    return Object.entries(byCase)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([cn, ts]) => {
        const avg = ts.reduce((s, t) => s + t.ms, 0) / ts.length;
        return { caseNum: parseInt(cn), times: ts, avg };
      });
  })();

  const timerText = displayMs < 0
    ? (isZh ? '触摸或按空格开始' : 'Tap or press Space to start')
    : msToDisplay(displayMs);
  const timerColorMap = { default: '#e0e0e0', green: '#008500', red: '#850000' };

  return (
    <div className="oll-training-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 顶部状态条 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <span style={{ color: '#adb5bd' }}>
          {selectedCases.current.length} cases |{' '}
          {recapArray.current.length > 0
            ? (isZh ? `Recap: ${recapArray.current.length} 剩余` : `Recap: ${recapArray.current.length} remaining`)
            : (isZh ? 'Train 模式' : 'Train mode')}
        </span>
      </div>

      {/* 主内容区 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧：打乱 + 计时器 */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            userSelect: 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* 打乱序列 */}
          <div style={{ fontSize: '1.2rem', color: '#adb5bd', textAlign: 'center', marginBottom: '2rem', lineHeight: 1.6 }}>
            {scramble || (isZh ? '加载中...' : 'Loading...')}
          </div>

          {/* 计时器 */}
          <div
            style={{
              fontSize: '4rem',
              fontWeight: 700,
              fontFamily: "'Courier New', monospace",
              color: timerColorMap[timerColor],
              cursor: 'pointer',
              transition: 'color 0.1s',
            }}
          >
            {timerText}
          </div>

          {/* 上一个 case 信息 */}
          {lastCase > 0 && !running && (
            <div style={{ marginTop: '1.5rem', color: '#6c757d', fontSize: '0.9rem', textAlign: 'center' }}>
              {isZh ? '上一个:' : 'Last:'}{' '}
              <span
                style={{ color: '#0d6efd', cursor: 'pointer' }}
                onClick={() => setHintCase(lastCase)}
              >
                OLL {lastCase} ({typedOllInfo[`OLL ${lastCase}`]?.name})
              </span>
            </div>
          )}
        </div>

        {/* 右侧：成绩面板 */}
        <div
          style={{
            width: '300px',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            overflowY: 'auto',
            padding: '0.75rem',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <strong>{isZh ? `${times.length} 次` : `${times.length} solves`}</strong>
            <a style={{ color: '#0d6efd', cursor: 'pointer' }} onClick={handleClear}>{isZh ? '清空' : 'Clear'}</a>
          </div>

          {groupedResults.map(({ caseNum, times: ts, avg }) => (
            <div key={caseNum} style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                <span
                  style={{ color: '#0d6efd', cursor: 'pointer' }}
                  onClick={() => setHintCase(caseNum)}
                >
                  {typedOllInfo[`OLL ${caseNum}`]?.name || `OLL ${caseNum}`}
                </span>
                : {msToDisplay(avg)}
              </div>
              <div style={{ color: '#adb5bd', lineHeight: 1.5 }}>
                {ts.map((t, i) => (
                  <span key={i}>
                    <span title={t.scramble}>{t.time}</span>
                    {i < ts.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hint 弹窗（原版 displayBox）*/}
      {hintCase !== null && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 999,
          }}
          onClick={() => setHintCase(null)}
        >
          <div
            style={{
              background: '#1e1e2e', borderRadius: '12px', padding: '2rem',
              display: 'flex', gap: '1.5rem', alignItems: 'flex-start',
              maxWidth: '500px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={`${import.meta.env.BASE_URL}oll_pic/${hintCase}.svg`}
              alt={`OLL ${hintCase}`}
              width={120}
              height={120}
            />
            <div>
              <h3 style={{ margin: '0 0 0.5rem' }}>
                #{hintCase} {typedOllInfo[`OLL ${hintCase}`]?.name}
              </h3>
              <p style={{ color: '#e0e0e0', margin: '0.25rem 0' }}>
                {typedOllInfo[`OLL ${hintCase}`]?.alg}
              </p>
              {typedOllInfo[`OLL ${hintCase}`]?.alg2 && (
                <p style={{ color: '#adb5bd', margin: '0.25rem 0' }}>
                  {typedOllInfo[`OLL ${hintCase}`]?.alg2}
                </p>
              )}
              <p style={{ color: '#6c757d', margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                Setup: {inverseScramble(typedOllInfo[`OLL ${hintCase}`]?.alg || '')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
