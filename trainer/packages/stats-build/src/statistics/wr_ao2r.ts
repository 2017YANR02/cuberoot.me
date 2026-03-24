// NOTE: Ao2R——一场比赛恰好 2 轮时各轮 average 的均值
// 与 Ruby _stats_build/statistics/wr_ao2r.rb 1:1 对应
import { AoRounds } from '../core/ao_rounds.js';

export class WrAo2r extends AoRounds {
  constructor() {
    super();
    this.title = 'Ao2R (Average of 2 Rounds)';
    this.titleZh = 'Ao2R（两轮平均）';
    this.note = 'Average of 2 Rounds: mean of averages when a person competed in exactly 2 rounds at a competition.';
    this.noteZh = '两轮平均：一场比赛中恰好参加 2 轮时各轮平均的均值。';
  }
  roundCount() { return 2; }
}
