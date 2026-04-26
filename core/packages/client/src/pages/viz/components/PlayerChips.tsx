// NOTE: 选手标签条 — 彩色 chip + 点击切换主选手 + ✕ 移除
// 1:1 翻译自 viz.js updatePlayerChips()

import { useVizStore } from '../stores/viz_store';
import { playerHSL } from '../engine/data_fetch';
import { Flag } from '../../../utils/flag';
import { personFlagIso2 } from '../../../utils/country_flags';

export default function PlayerChips() {
  const players = useVizStore(s => s.players);
  const activePlayerIdx = useVizStore(s => s.activePlayerIdx);
  const setActivePlayer = useVizStore(s => s.setActivePlayer);
  const removePlayer = useVizStore(s => s.removePlayer);
  const rebuildAllChannels = useVizStore(s => s.rebuildAllChannels);

  if (players.length === 0) return null;

  return (
    <div className="player-chips" id="playerChips">
      {players.map((p, i) => {
        const isActive = i === activePlayerIdx;
        const iso2 = personFlagIso2(p.wcaId);
        return (
          <span
            key={p.wcaId}
            className={`player-chip${isActive ? ' active' : ''}`}
            style={{
              borderColor: playerHSL(i, 0.6),
              background: playerHSL(i, isActive ? 0.2 : 0.1),
            }}
            onClick={(e) => {
              // 点击 ✕ 按钮不触发切换
              if ((e.target as HTMLElement).classList.contains('chip-remove')) return;
              setActivePlayer(i);
              rebuildAllChannels();
            }}
          >
            {iso2 && <Flag iso2={iso2} className="player-chip-flag" />}
            {p.nameZh || p.name}
            <span
              className="chip-remove"
              onClick={(e) => {
                e.stopPropagation();
                removePlayer(i);
              }}
            >
              ✕
            </span>
          </span>
        );
      })}
    </div>
  );
}
