'use client';

/**
 * ScrambleSourcePanel — 计时器「打乱来源」常驻面板。
 *
 * 2026-07-10 从设置弹层(齿轮)里整块移出来:随机 / WCA 真题(按日期范围+难度 /
 * 指定比赛)+ 最优打乱 + 自动打卡。现在常驻主界面,和「解法提示」同处右栏
 * (见 _shell/shell.css 的 .shell-rail):桌面收成右侧竖栏,手机落在打乱图下方,
 * 可随时收起 / 展开(默认收起,状态记进 localStorage)。所有项目可见。
 *
 * 布局复用 .solver-panel 那套 class,和「解法提示」一致;.scramble-src-panel 标记
 * 只用于给内部 .settings-row* 原语补 data-timer-theme=light 的浅色取色。
 */

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { updateSettings, useSettings } from '../_lib/settings';
import type { EventId } from '../_lib/types';
import WcaSourceConfig from '@/components/WcaSourceConfig';
import { tr } from '@/i18n/tr';

const LS_KEY = 'timer.scrambleSource.panelOpen';

interface Props {
  event: EventId;
  isZh: boolean;
}

export default function ScrambleSourcePanel({ event, isZh }: Props) {
  const s = useSettings();
  const [open, setOpen] = useState(false);

  // 读 localStorage 记住的展开态(SSR 初值恒 false,挂载后再同步,避免 hydration mismatch)。
  useEffect(() => {
    try {
      if (localStorage.getItem(LS_KEY) === '1') setOpen(true);
    } catch { /* ignore */ }
  }, []);

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try { localStorage.setItem(LS_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  };

  const title = tr({ zh: '打乱来源', en: 'Scramble source' });

  return (
    <aside className="solver-panel scramble-src-panel surface-chrome" data-open={open} data-no-timer>
      <button
        type="button"
        className="solver-panel-head"
        onClick={(e) => { toggle(); e.currentTarget.blur(); }}
        aria-expanded={open}
      >
        <span className="solver-panel-title">{title}</span>
        <ChevronRight size={14} className="solver-panel-chevron" />
      </button>
      {open && (
        <div className="solver-panel-body">
          <div className="settings-row">
            <span className="settings-row-label">{tr({ zh: '来源', en: 'Source' })}</span>
            <span className="settings-row-control">
              <select
                className="settings-row-control-select"
                value={s.scrambleSource}
                onChange={(e) => updateSettings({ scrambleSource: e.target.value as 'random' | 'wca' })}
              >
                <option value="wca">{tr({ zh: 'WCA 真题', en: 'WCA real' })}</option>
                <option value="random">{tr({ zh: '随机生成', en: 'Random' })}</option>
              </select>
            </span>
          </div>
          {s.scrambleSource === 'wca' && (
            <WcaSourceConfig isZh={isZh} event={event} settings={s} updateSettings={updateSettings} />
          )}
        </div>
      )}
    </aside>
  );
}
