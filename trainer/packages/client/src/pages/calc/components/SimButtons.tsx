// NOTE: 模拟按钮 — Rand A / Rand B / Race ⚔️
// 从 app.js 提取，使用 KDE 采样批量填充成绩

import { useCalcStore } from '../stores/calc_store';
import { sampleKDE } from '../engine/wr_data';

export function SimButtons() {
  const state = useCalcStore();
  const sc = state.solveCount();

  // NOTE: 单选手随机填充
  const simPlayer = (p: number) => {
    const absIdx = state.seedOn + p;
    for (let t = 0; t < sc; t++) {
      const val = sampleKDE(state.event, p);
      if (val && val > 0) {
        state.updateTime(absIdx, t, val);
      }
    }
    state.saveToUrl();
  };

  // NOTE: 双方同时随机填充
  const simRace = () => {
    for (let p = 0; p < 2; p++) {
      if (!state.playerEnabled[p]) continue;
      const absIdx = state.seedOn + p;
      for (let t = 0; t < sc; t++) {
        const val = sampleKDE(state.event, p);
        if (val && val > 0) {
          state.updateTime(absIdx, t, val);
        }
      }
    }
    state.saveToUrl();
  };

  // NOTE: 清空当前 seed 对
  const clearAll = () => {
    for (let p = 0; p < 2; p++) {
      const absIdx = state.seedOn + p;
      for (let t = 0; t < sc; t++) {
        state.updateTime(absIdx, t, 0);
      }
    }
    state.saveToUrl();
  };

  return (
    <div className="controls">
      <button
        className="sim-btn sim-a"
        onClick={() => simPlayer(0)}
      >
        Rand A
      </button>
      {state.playerEnabled[1] && (
        <button
          className="sim-btn sim-b"
          onClick={() => simPlayer(1)}
        >
          Rand B
        </button>
      )}
      {state.playerEnabled[1] && (
        <button
          className="sim-btn sim-race"
          onClick={simRace}
        >
          ⚔️ Race
        </button>
      )}
      <button
        className="controls"
        style={{ background: '#999' }}
        onClick={clearAll}
      >
        Clear
      </button>
    </div>
  );
}

export default SimButtons;
