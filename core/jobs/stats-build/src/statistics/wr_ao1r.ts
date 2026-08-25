// NOTE: Ao1R——一场比赛恰好 1 轮时的 average
import { AoRounds } from '../core/ao_rounds.js';

export class WrAo1r extends AoRounds {
  constructor() {
    super();
    this.title = 'Ao1R';
    this.titleZh = 'Ao1R';
    this.note = 'Average of 1 Round: a person\'s average when they competed in exactly 1 round at a competition.';
    this.noteZh = '单轮平均：一场比赛中恰好只参加 1 轮时的平均成绩。';
  }
  roundCount() { return 1; }
}
