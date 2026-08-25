// NOTE: WCA 成绩值格式化工具
// 处理：普通项目（厘秒→时钟格式）、333fm（步数）、333mbf/333mbo（多盲编解码）

// NOTE: 特殊成绩值常量
const DNF_VALUE = -1;
const DNS_VALUE = -2;
const SKIPPED_VALUE = 0;

export class SolveTime {
  readonly wca_value: number;      // 原始 WCA 成绩值
  readonly eventId: string;
  readonly field: 'single' | 'average' | null;

  // NOTE: 根据项目类型解码后的值
  private timeCentiseconds: number | null = null;
  private moveCount: number | null = null;
  private _solved: number | null = null;
  private _attempted: number | null = null;

  constructor(eventId: string | null, field: 'single' | 'average' | null, wcaValue: number) {
    this.eventId = eventId ?? '';
    this.field = field;
    this.wca_value = wcaValue;
    this.decode(wcaValue);
  }

  // NOTE: 根据项目类型解码原始值
  private decode(wcaValue: number): void {
    if (this.eventId === '333fm') {
      // NOTE: 平均值乘以了 100 存储，单次就是步数本身
      this.moveCount = this.field === 'average' ? wcaValue / 100.0 : wcaValue;
    } else if (['333mbf', '333mbo'].includes(this.eventId)) {
      let mbValue = wcaValue;
      const old = Math.floor(mbValue / 1_000_000_000) !== 0;

      if (old) {
        const timeSeconds = mbValue % 100_000;
        mbValue = Math.floor(mbValue / 100_000);
        this._attempted = mbValue % 100;
        mbValue = Math.floor(mbValue / 100);
        this._solved = 99 - (mbValue % 100);
        this.timeCentiseconds = timeSeconds === 99_999 ? null : timeSeconds * 100;
      } else {
        const missed = mbValue % 100;
        mbValue = Math.floor(mbValue / 100);
        const timeSeconds = mbValue % 100_000;
        mbValue = Math.floor(mbValue / 100_000);
        const difference = 99 - (mbValue % 100);
        this._solved = difference + missed;
        this._attempted = this._solved + missed;
        this.timeCentiseconds = timeSeconds === 99_999 ? null : timeSeconds * 100;
      }
    } else {
      this.timeCentiseconds = wcaValue;
    }
  }

  get solved(): number { return this._solved ?? 0; }
  get attempted(): number { return this._attempted ?? 0; }
  get missed(): number { return this.attempted - this.solved; }
  get points(): number { return this.solved - this.missed; }

  isDnf(): boolean { return this.wca_value === DNF_VALUE; }
  isDns(): boolean { return this.wca_value === DNS_VALUE; }
  isDn(): boolean { return this.isDnf() || this.isDns(); }
  isSkipped(): boolean { return this.wca_value === SKIPPED_VALUE; }

  // NOTE: 成绩是否有效（非 DNF/DNS/跳过）
  isComplete(): boolean { return !this.isDn() && !this.isSkipped(); }

  // NOTE: 用于排序
  // 排序优先级：跳过 > DNS > DNF > 正常值
  toOrdurable(): [number, number, number, number] {
    return [
      this.isSkipped() ? 1 : 0,
      this.isDns() ? 1 : 0,
      this.isDnf() ? 1 : 0,
      this.wca_value,
    ];
  }

  // NOTE: 比较两个 SolveTime（用于 sort）
  compareTo(other: SolveTime): number {
    const a = this.toOrdurable();
    const b = other.toOrdurable();
    for (let i = 0; i < 4; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
  }

  // NOTE: 厘秒 → 时钟格式字符串（如 "1:23.45"）
  static centisecondsToClockFormat(cs: number): string {
    const hours = Math.floor(cs / 360_000);
    const minutes = Math.floor((cs % 360_000) / 6000);
    const seconds = Math.floor((cs % 6000) / 100);
    const centis = cs % 100;

    const formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
    // NOTE: 去除前导零和冒号
    let result = formatted.replace(/^[0:]*/, '');
    if (result.startsWith('.')) result = '0' + result;
    return result;
  }

  // NOTE: 格式化为人类可读字符串
  clockFormat(): string {
    if (this.isDns()) return 'DNS';
    if (this.isDnf()) return 'DNF';
    if (this.isSkipped()) return '';

    if (this.eventId === '333fm') {
      // NOTE: 平均保留 2 位小数，单次取整
      return this.field === 'average'
        ? this.moveCount!.toFixed(2)
        : Math.round(this.moveCount!).toString();
    }

    if (['333mbf', '333mbo'].includes(this.eventId)) {
      // NOTE: 构建时间字符串
      let timeStr: string;
      if (this.timeCentiseconds === null) {
        timeStr = '?:??:??';
      } else {
        let timeSec = Math.floor(this.timeCentiseconds / 100);
        if (timeSec < 60) {
          timeStr = `0:${timeSec}`;
        } else {
          timeStr = '';
          while (timeSec >= 60) {
            timeStr = `:${String(timeSec % 60).padStart(2, '0')}${timeStr}`;
            timeSec = Math.floor(timeSec / 60);
          }
          timeStr = `${timeSec}${timeStr}`;
        }
      }
      return `${this._solved}/${this._attempted} ${timeStr}`;
    }

    return SolveTime.centisecondsToClockFormat(this.timeCentiseconds!);
  }

  // NOTE: 简便工厂——将 multibld attempt 值转为 points
  static multibldAttemptToPoints(attemptResult: number): number {
    return new SolveTime('333mbf', 'single', attemptResult).points;
  }

  // NOTE: DNF 哨兵对象——用于 AverageOfX 等基类中的 sentinel 比较
  static readonly DNF_INSTANCE = new SolveTime(null, null, DNF_VALUE);
}
