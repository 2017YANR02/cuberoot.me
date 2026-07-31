'use client';

/**
 * 假魔方调试面板 —— dev 专用,生产构建里整个不存在。
 *
 * `_lib/bluetooth/fake_cube.ts` 立起来的那颗假 GAN v4 一直只有控制台入口
 * (`window.__cuberootFakeCube.apply("R U")`)。能用,但每验一件事都要背命令、切
 * 窗口、再切回来看魔方转没转 —— 而要看的东西恰恰在页面上。所以搬到页面里来。
 *
 * 它不是「另一套模拟」:每个按钮就是那个控制台 API 的一次调用,走的还是同一条
 * 蓝牙路径(加密帧、MAC 派生密钥、丢包重传)。控制台入口照旧留着,两者随便混用。
 *
 * ## 为什么「连接」要顺手 arm
 *
 * 假魔方必须先 `arm()` 才会出现在蓝牙搜索里,这是它和真硬件唯一的差别,而不是
 * 一个需要用户理解的概念。所以这里一个按钮做完两件事。断开时不自动 disarm ——
 * 重连是最常做的动作。
 *
 * ## 断开着也能拧
 *
 * 「连上时魔方已经是乱的」那条路(见 `anchor.ts`)只有先拧后连才走得到,所以转动
 * 那几个按钮在没连接时照样可用 —— 假魔方是一颗放在桌上的魔方,连不连是另一回事。
 *
 * ## 姿态
 *
 * 假魔方不发姿态帧,3D 那颗的朝向走的是 `window.__cuberootFakeQuat`(见
 * `orientation.ts` 的 `DevQuatSource`),绕开蓝牙层。这里三档只是给那个全局变量
 * 写值:关 / 一个固定的斜姿态 / 绕竖轴匀速自转。
 */

import { useEffect, useState, type JSX } from 'react';

import BoolToggle from '@/components/BoolToggle';
import { tr } from '@/i18n/tr';
import './dev_fake_cube.css';

/** 「随机打乱」拧几手。够把每个面都动到,又短到能一眼看完。 */
const SCRAMBLE_LEN = 20;
const FACES = 'URFDLB';
const SUFFIX = ['', "'", '2'];

type Pose = 'off' | 'fixed' | 'spin';

/** 一个固定的斜姿态:绕 y 转 90°。看得出来「有姿态」,又不至于晕。 */
const FIXED_POSE = { w: Math.SQRT1_2, x: 0, y: Math.SQRT1_2, z: 0 };

function randomScramble(): string {
  const out: string[] = [];
  let last = -1;
  for (let i = 0; i < SCRAMBLE_LEN; i++) {
    let f = 0;
    do { f = Math.floor(Math.random() * 6); } while (f === last);
    last = f;
    out.push(FACES[f] + SUFFIX[Math.floor(Math.random() * 3)]);
  }
  return out.join(' ');
}

export interface DevFakeCubePanelProps {
  /** 蓝牙那头现在连着没有 —— 状态行和按钮文案跟着它走。 */
  connected: boolean;
  /** 连上的设备名,没连就 null。 */
  deviceName: string | null;
  /** 打开选择器 + 连接(就是 `useBluetoothCube` 的 `connect`)。 */
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  /** 当前打乱,给「按打乱拧」用。 */
  scramble: string;
}

export default function DevFakeCubePanel(props: DevFakeCubePanelProps): JSX.Element | null {
  const { connected, deviceName, onConnect, onDisconnect, scramble } = props;
  const [open, setOpen] = useState(false);
  const [alg, setAlg] = useState("R U R' U'");
  const [pose, setPose] = useState<Pose>('off');
  const [err, setErr] = useState<string | null>(null);
  // 贴纸串每次操作后重读一次。没必要跟着每一帧走 —— 它是给人核对用的。
  const [facelets, setFacelets] = useState<string | null>(null);

  useEffect(() => {
    if (pose === 'off') { window.__cuberootFakeQuat = null; return; }
    if (pose === 'fixed') { window.__cuberootFakeQuat = FIXED_POSE; return; }
    // 自转:半圈 / 2s,和 orientation.ts 头注里那段范例同一条。
    window.__cuberootFakeQuat = (t: number) => {
      const a = (t / 2000) * Math.PI;
      return { w: Math.cos(a / 2), x: 0, y: Math.sin(a / 2), z: 0 };
    };
  }, [pose]);

  const api = () => window.__cuberootFakeCube ?? null;

  /** 每个动作都可能抛(比如公式里有假魔方不认的记号)—— 就地报出来,别静默。 */
  const run = (fn: () => void) => {
    const f = api();
    if (!f) { setErr(tr({ zh: '假魔方没装上', en: 'fake cube not installed' })); return; }
    try {
      fn();
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setFacelets(api()?.state() ?? null);
  };

  if (!open) {
    return (
      <button type="button" className="devcube-pill" onClick={() => { setOpen(true); setFacelets(api()?.state() ?? null); }}>
        {tr({ zh: '假魔方', en: 'Fake cube' })}
      </button>
    );
  }

  return (
    <div className="devcube">
      <div className="devcube-head">
        <span className="devcube-title">{tr({ zh: '假魔方', en: 'Fake cube' })}</span>
        <span className="devcube-status">
          {connected
            ? (deviceName ?? tr({ zh: '已连接', en: 'connected' }))
            : tr({ zh: '未连接', en: 'not connected' })}
        </span>
        <button type="button" className="devcube-close" onClick={() => setOpen(false)}>
          {tr({ zh: '收起', en: 'Hide' })}
        </button>
      </div>

      <div className="devcube-row">
        {connected ? (
          <button type="button" className="devcube-btn" onClick={onDisconnect}>{tr({ zh: '断开', en: 'Disconnect' })}</button>
        ) : (
          <button
            type="button"
            className="devcube-btn"
            onClick={() => { api()?.arm(); void onConnect(); }}
          >
            {tr({ zh: '连上假魔方', en: 'Connect fake cube' })}
          </button>
        )}
        <BoolToggle
          value={pose !== 'off'}
          onChange={(v) => setPose(v ? 'fixed' : 'off')}
          label={tr({ zh: '姿态', en: 'Pose' })}
        />
        {pose !== 'off' && (
          <button
            type="button"
            aria-pressed={pose === 'spin'}
            className={`devcube-btn${pose === 'spin' ? ' is-on' : ''}`}
            onClick={() => setPose(pose === 'spin' ? 'fixed' : 'spin')}
          >
            {tr({ zh: '自转', en: 'Spin' })}
          </button>
        )}
      </div>

      <div className="devcube-row">
        <input
          className="devcube-alg"
          value={alg}
          onChange={(e) => setAlg(e.target.value)}
          spellCheck={false}
          aria-label={tr({ zh: '要拧的公式', en: 'Moves to apply' })}
        />
        <button type="button" className="devcube-btn" onClick={() => run(() => api()!.apply(alg))}>
          {tr({ zh: '拧', en: 'Turn' })}
        </button>
      </div>

      <div className="devcube-row">
        <button type="button" className="devcube-btn" onClick={() => run(() => api()!.apply(scramble))}>
          {tr({ zh: '按打乱拧', en: 'Apply scramble' })}
        </button>
        <button type="button" className="devcube-btn" onClick={() => run(() => api()!.apply(randomScramble()))}>
          {tr({ zh: '随机打乱', en: 'Randomise' })}
        </button>
        <button type="button" className="devcube-btn" onClick={() => run(() => api()!.solve())}>
          {tr({ zh: '还原', en: 'Solve' })}
        </button>
        <button type="button" className="devcube-btn" onClick={() => run(() => api()!.dropNext(2))}>
          {tr({ zh: '丢 2 个包', en: 'Drop 2' })}
        </button>
      </div>

      {/* 没连接时先拧就是「连上时已经是乱的」那条路,值得直说 —— 不然没人会想到
          按钮的顺序本身是被测的东西。 */}
      {!connected && (
        <p className="devcube-hint">
          {tr({
            zh: '先拧乱再连,走的是「连上时魔方已经是乱的」那条路。',
            en: 'Turn it first, then connect — that is the connected-while-scrambled path.',
          })}
        </p>
      )}

      {err && <p className="devcube-err">{err}</p>}
      {facelets && <p className="devcube-facelets">{facelets}</p>}
    </div>
  );
}
