// NOTE: Ao4R——一场比赛恰好 4 轮时各轮 average 的均值
// 与 Ruby _stats_build/statistics/wr_ao4r.rb 1:1 对应
import { AoRounds } from '../core/ao_rounds.js';

export class WrAo4r extends AoRounds {
  constructor() {
    super();
    this.title = 'Ao4R (Average of 4 Rounds)';
    this.titleZh = 'Ao4R（四轮平均）';
    this.note = 'Average of 4 Rounds: mean of averages when a person competed in exactly 4 rounds at a competition.';
    this.noteZh = '四轮平均：一场比赛中恰好参加 4 轮时各轮平均的均值。';
  }
  roundCount() { return 4; }
}
