// Ported from huazhechen/cuber (MIT) — src/cuber/tweener.ts
export class Tween {
  begin: number;
  end: number;
  duration: number;
  callback: (v: number) => boolean | void;
  value: number;
  constructor(begin: number, end: number, duration: number, callback: (v: number) => boolean | void) {
    this.begin = begin;
    this.end = end;
    this.duration = duration;
    this.callback = callback;
    this.value = 0;
  }

  finish(): void {
    this.callback(this.end);
  }

  update(): boolean {
    this.value++;
    let elapsed = this.value / this.duration;
    elapsed = elapsed > 1 ? 1 : elapsed;
    elapsed = elapsed < 0 ? 0 : elapsed;
    elapsed = elapsed - 1;
    elapsed = 1 - elapsed * elapsed;
    const value = elapsed == 1 ? this.end : this.begin + (this.end - this.begin) * elapsed;
    return this.callback(value) === true;
  }
}

export class Tweener {
  tweens: Tween[];
  // 30 twist 序列每个 twist 一个 Tween, 不 pool 等于每 5s 30 次 new + 30 次 release,
  // 累积 GC pressure → 100+ms 偶发 stall 拖 min fps。Pool 直接消除。
  private pool: Tween[] = [];

  get length(): number {
    return this.tweens.length;
  }

  constructor() {
    this.tweens = [];
    this.loop();
  }

  loop(): void {
    requestAnimationFrame(this.loop.bind(this));
    this.update();
  }

  tween(begin: number, end: number, duration: number, update: (v: number) => boolean | void): Tween {
    let t = this.pool.pop();
    if (t) {
      t.begin = begin;
      t.end = end;
      t.duration = duration;
      t.callback = update;
      t.value = 0;
    } else {
      t = new Tween(begin, end, duration, update);
    }
    this.tweens.push(t);
    return t;
  }

  update(): boolean {
    if (this.tweens.length === 0) return false;
    let i = 0;
    let len = this.tweens.length;
    while (i < len) {
      if (this.tweens[i].update()) {
        const finished = this.tweens.splice(i, 1)[0];
        this.pool.push(finished);
        len--;
      } else {
        i++;
      }
    }
    return true;
  }

  finish(tween: Tween | undefined = undefined): void {
    if (tween) {
      for (let i = 0; i < this.tweens.length; i++) {
        if (this.tweens[i] == tween) {
          tween.finish();
          this.tweens.splice(i, 1);
          this.pool.push(tween);
          return;
        }
      }
    } else {
      const tweens = this.tweens.splice(0, this.tweens.length);
      for (const t of tweens) {
        t.finish();
        this.pool.push(t);
      }
    }
  }

  cancel(tween: Tween): void {
    for (let i = 0; i < this.tweens.length; i++) {
      if (this.tweens[i] == tween) {
        this.tweens.splice(i, 1);
        this.pool.push(tween);
        return;
      }
    }
  }
}

const tweener = new Tweener();
export default tweener;
