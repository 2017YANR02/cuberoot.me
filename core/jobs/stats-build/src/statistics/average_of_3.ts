// NOTE: Mo3——连续 3 次官方还原的算术均值；保留 ao3 查询键。
import { AverageOfX } from '../core/average_of_x.js';
export class AverageOf3 extends AverageOfX {
  constructor() {
    super(3);
    this.title = 'Mean of 3';
    this.note += ' All three attempts count; any DNF or DNS makes the mean DNF.';
    this.noteZh += ' 三次成绩全部计入；任一次 DNF 或 DNS 则均值为 DNF。';
  }
}
