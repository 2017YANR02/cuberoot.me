'use client';

/**
 * 对战里的智能魔方 —— 接线 + 界面。
 * ==========================================================================
 *
 * 判定逻辑全在 `useBattleCubes` / `battle_store`,这个文件只做两件事:
 *
 *   1. `BattleCubesProvider` —— 把四路连接(和「连接」弹窗)提到树顶,再用
 *      context 发下去。TimerArea 埋在布局深处,一层层传 props 会把三个布局
 *      分支各改一遍;而连接本身是**全局的**(一个人换设备不该重挂别人的 GATT),
 *      提到顶上是它本来的位置。
 *   2. 两块界面 —— 设置面板里的「智能魔方」组(选语义 + 逐人连接),和格子里
 *      那枚状态点。
 *
 * 界面上只说两件事:这个人连上了没有、现在轮到谁。别的都不显示 —— 电量、品牌、
 * 最近一手都在弹窗里,格子里再摆一遍就成了信息堆叠。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Bluetooth } from 'lucide-react';

import BluetoothModal from '../_components/BluetoothModal';
import type { BluetoothCubeHandle } from '../_lib/bluetooth';
import { installFakeCube } from '../_lib/bluetooth/fake_cube';
import { useBattleStore } from './engine/battle_store';
import { useBattleCubes } from './useBattleCubes';
import PillToggle from '@/components/PillToggle/PillToggle';
import { tr } from '@/i18n/tr';

interface BattleCubesCtx {
  handleFor: (playerId: number) => BluetoothCubeHandle | null;
  isLive: (playerId: number) => boolean;
  /** 打开这个人的连接弹窗。 */
  open: (playerId: number) => void;
}

const Ctx = createContext<BattleCubesCtx>({
  handleFor: () => null,
  isLive: () => false,
  open: () => {},
});

export function useBattleCubesCtx(): BattleCubesCtx {
  return useContext(Ctx);
}

export function BattleCubesProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const cubeMode = useBattleStore(s => s.cubeMode);
  // 弹窗开在哪个**槽位**上(不是玩家):shared 语义下所有人都指向第 0 路,
  // 用玩家编号存会在换持有者时把弹窗指到一路没连的连接上。
  const [openSlot, setOpenSlot] = useState<number | null>(null);

  // 手动输 MAC:沿用 Solo 那套「挂起的 promise」—— hook 需要 MAC 时挂住连接流程,
  // 弹窗把用户输的值 resolve 回去。四路共用一个,因为弹窗一次只开一个。
  const [macPrompt, setMacPrompt] = useState<{ deviceName: string; isWrongKey?: boolean } | null>(null);
  const macResolverRef = useRef<((m: string | null) => void) | null>(null);
  const requestMac = useCallback(
    (slot: number, deviceName: string, isWrongKey?: boolean) => new Promise<string | null>((resolve) => {
      macResolverRef.current = resolve;
      setOpenSlot(slot);              // 问 MAC 的一定是这一路,把弹窗拽过来
      setMacPrompt({ deviceName, isWrongKey });
    }),
    [],
  );
  const resolveMac = useCallback((mac: string | null) => {
    macResolverRef.current?.(mac);
    macResolverRef.current = null;
    setMacPrompt(null);
  }, []);

  const cubes = useBattleCubes({ onNeedMac: requestMac });

  // 假魔方(仅 dev):`__cuberootFakeCube.scramble()` 要知道「现在该拧哪条打乱」。
  // 对战里每人一条,所以喂持有者那条 —— own 语义下持有者恒为 0,正是 P1 的那条。
  useEffect(() => {
    installFakeCube(() => {
      const s = useBattleStore.getState();
      return s.scrambles[s.cubeHolder] ?? '';
    });
  }, []);

  const open = useCallback((playerId: number) => {
    setOpenSlot(cubeMode === 'shared' ? 0 : playerId);
  }, [cubeMode]);

  const value = useMemo<BattleCubesCtx>(() => ({
    handleFor: cubes.handleFor,
    isLive: cubes.isLive,
    open,
  }), [cubes.handleFor, cubes.isLive, open]);

  const openHandle = openSlot === null ? null : cubes.handles[openSlot];

  return (
    <Ctx.Provider value={value}>
      {children}
      {openHandle && (
        <BluetoothModal
          isZh={i18n.language.startsWith('zh')}
          cube={openHandle}
          onClose={() => { resolveMac(null); setOpenSlot(null); }}
          onConnect={() => openHandle.connect()}
          macPrompt={macPrompt}
          onSubmitMac={resolveMac}
          onCancelMac={() => resolveMac(null)}
        />
      )}
    </Ctx.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  设置面板里的「智能魔方」组                                          */
/* ------------------------------------------------------------------ */

/**
 * 语义开关 + 逐人连接。
 *
 * 语义只有两个选项,而且要左右对比着读(「每人一颗」/「一颗轮流」),所以用
 * PillToggle 而不是下拉。轮流那一侧不再列四行连接 —— 只有一颗魔方,列四行是
 * 假的;换成一行连接 + 一行「现在轮到谁」。
 */
export function BattleCubeSettingsGroup() {
  const cubeMode = useBattleStore(s => s.cubeMode);
  const setCubeMode = useBattleStore(s => s.setCubeMode);
  const cubeHolder = useBattleStore(s => s.cubeHolder);
  const setCubeHolder = useBattleStore(s => s.setCubeHolder);
  const playerCount = useBattleStore(s => s.playerCount);

  const shared = cubeMode === 'shared';

  return (
    <div className="settings-group">
      <div className="settings-label">{tr({ zh: '智能魔方', en: 'Smart cube' })}</div>

      <div className="setting-item">
        <span>{tr({ zh: '几颗魔方', en: 'How many cubes' })}</span>
        <PillToggle
          value={shared}
          onChange={(v) => setCubeMode(v ? 'shared' : 'own')}
          offLabel={tr({ zh: '每人一颗', en: 'One each' })}
          onLabel={tr({ zh: '一颗轮流', en: 'Pass around' })}
          ariaLabel={tr({ zh: '智能魔方语义', en: 'Smart cube mode' })}
        />
      </div>

      {shared ? (
        <>
          <div className="setting-item">
            <span>{tr({ zh: '这颗魔方', en: 'The cube' })}</span>
            <CubeConnectButton playerId={cubeHolder} />
          </div>
          <div className="setting-item">
            <span>{tr({ zh: '轮到', en: 'Now up' })}</span>
            <div className="bc-holder-row">
              {Array.from({ length: playerCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`bc-holder-btn${i === cubeHolder ? ' is-holder' : ''}`}
                  onClick={() => setCubeHolder(i)}
                >
                  {`P${i + 1}`}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        Array.from({ length: playerCount }, (_, i) => (
          <div className="setting-item" key={i}>
            <span>{`P${i + 1}`}</span>
            <CubeConnectButton playerId={i} />
          </div>
        ))
      )}

      <div className="bc-hint">
        {shared
          ? tr({
              zh: '拧到打乱即预备,第一下转动起表,还原停表;这一位停表后自动传给下一位。',
              en: 'Match the scramble to arm, first turn starts, solved stops — then it passes to the next player.',
            })
          : tr({
              zh: '拧到打乱即预备,第一下转动起表,还原停表。没连魔方的人照常用按键。',
              en: 'Match the scramble to arm, first turn starts, solved stops. Players without a cube keep using keys.',
            })}
      </div>
    </div>
  );
}

function CubeConnectButton({ playerId }: { playerId: number }) {
  const { handleFor, open } = useBattleCubesCtx();
  const handle = handleFor(playerId);
  const connected = !!handle?.status.connected;
  return (
    <button
      type="button"
      className={`bc-connect-btn${connected ? ' is-live' : ''}`}
      onClick={() => open(playerId)}
    >
      <Bluetooth size={13} />
      {connected
        ? (handle?.status.deviceName || tr({ zh: '已连接', en: 'Connected' }))
        : tr({ zh: '连接', en: 'Connect' })}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  格子里那枚状态点                                                    */
/* ------------------------------------------------------------------ */

/**
 * 只在「这个人真的在用魔方」时出现:own 语义下 = 他那一路连着;shared 语义下
 * = 魔方在他手里。没在用的人什么都不显示 —— 一个用按键的人不需要看见蓝牙图标。
 */
export function BattleCubeDot({ playerId }: { playerId: number }) {
  const { isLive } = useBattleCubesCtx();
  const cubeMode = useBattleStore(s => s.cubeMode);
  const cubeHolder = useBattleStore(s => s.cubeHolder);
  const live = isLive(playerId);
  if (!live) return null;
  const holding = cubeMode !== 'shared' || cubeHolder === playerId;
  return (
    <span className={`bc-dot${holding ? ' is-holding' : ''}`} aria-hidden>
      <Bluetooth size={12} />
    </span>
  );
}
