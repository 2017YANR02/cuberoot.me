// NOTE: Ao3R——一场比赛恰好 3 轮时各轮 average 的均值
import { AoRounds } from '../core/ao_rounds.js';

export class WrAo3r extends AoRounds {
  constructor() {
    super();
    this.title = 'Ao3R';
    this.titleZh = 'Ao3R';
    this.note = 'Average of 3 Rounds: mean of averages when a person competed in exactly 3 rounds at a competition.';
    this.noteZh = '三轮平均：一场比赛中恰好参加 3 轮时各轮平均的均值。';
  }
  roundCount() { return 3; }
}
