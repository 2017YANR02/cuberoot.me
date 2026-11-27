// Replay only unambiguous edits to user-supplied examples. Each slot retains
// its own history so reverting one result cannot erase a later addition.
type Guide = { href: string; text: string };

function ordinal(label: string): number {
  return /^\d+$/.test(label) ? Number(label) - 1 : '一二三四五六七八九'.indexOf(label);
}

function replay<T, R>(initial: T[], changes: string[], apply: (turn: string, rows: T[][]) => boolean,
  summarize: (current: T[]) => R) {
  const rows = initial.map(value => [value]);
  const snapshot = () => summarize(rows.map(row => row[row.length - 1]));
  let previous = snapshot();
  for (const turn of changes) {
    previous = snapshot();
    if (!apply(turn, rows)) return;
  }
  return JSON.stringify({ previous, current: snapshot() });
}

function round(n: number): number {
  return Number(n.toFixed(2));
}

function mean(values: number[]): number {
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function editTime(turn: string, rows: number[][]): boolean {
  const text = turn.split(/[。;；]/)[0];
  const swap = text.match(/第([\d一二三四五六七八九]+)把(?:和|与|先于)第([\d一二三四五六七八九]+)把/);
  if (swap && /交换|对调/.test(turn)) {
    const a = ordinal(swap[1]), b = ordinal(swap[2]);
    if (!rows[a] || !rows[b]) return false;
    [rows[a],rows[b]] = [rows[b],rows[a]];
    return true;
  }
  const appended = text.match(/(?:再接|追加|新增|加)(?:一把)?(\d+(?:\.\d+)?)秒/);
  if (appended && +appended[1] > 0) {
    rows.push([+appended[1]]);
    return true;
  }
  const slot = text.match(/(?:第([\d一二三四五六七八九]+)把|最后一把|末把)/);
  if (!slot) return false;
  const row = rows[slot[1] ? ordinal(slot[1]) : rows.length - 1];
  if (!row) return false;
  if (/撤销|撤回|还原/.test(text)) {
    if (row.length < 2) return false;
    row.pop();
    return true;
  }
  const edit = text.match(/(?:从(\d+(?:\.\d+)?)秒?)?(?:更正到|更正为|改成|改为|改到)(\d+(?:\.\d+)?)秒?/);
  if (!edit || +edit[2] <= 0 || (edit[1] && +edit[1] !== row.at(-1))) return false;
  row.push(+edit[2]);
  return true;
}

function successRate(setup: string, changes: string[], minimum: number) {
  const sequence = setup.match(/(?:依次[是为]|依次|分别[为是])((?:有效|DNF|DNS)(?:[、,](?:有效|DNF|DNS))+)/i);
  if (!sequence) return;
  return replay(sequence[1].toUpperCase().split(/[、,]/), changes, (turn, rows) => {
    const clause = turn.split(/[。;；]/)[0];
    const slots = [...clause.matchAll(/第([\d一二三四五六七八九]+)轮/g)].map(m => ordinal(m[1]));
    if (!slots.length || new Set(slots).size !== slots.length) return false;
    if (slots.length > 1 && !/第[\d一二三四五六七八九]+轮和第[\d一二三四五六七八九]+轮都/.test(clause)) return false;
    if (/撤销|撤回|还原|作废/.test(clause)) {
      if (slots.some(i => !rows[i] || rows[i].length < 2)) return false;
      slots.forEach(i => rows[i].pop());
      return true;
    }
    const newValue = clause.split(/改为|改成|更正为|判为|都判|其实/).at(-1)!;
    const status = /没开始|未开始|DNS/i.test(newValue) ? 'DNS'
      : /无效|失败|DNF/i.test(newValue) ? 'DNF' : /成功|有效/.test(newValue) ? '有效' : undefined;
    if (!status) return false;
    if (slots.length === 1 && slots[0] === rows.length && /新出|新增|追加/.test(clause)) {
      rows.push([status]);
      return true;
    }
    if (slots.some(i => !rows[i])) return false;
    slots.forEach(i => rows[i].push(status));
    return true;
  }, results => {
    const solved = results.filter(value => value === '有效').length;
    const attempted = results.filter(value => value !== 'DNS').length;
    return { results, solved, attempted, percent: attempted ? round(100 * solved / attempted) : null, minimum, eligible: attempted >= minimum };
  });
}

// These values are operands for the source reader, never a substitute for a
// different subquestion. Decline compound or hypothetical mutations.
export function guideSeriesOperands(turns: readonly string[], guide: Guide): string | undefined {
  const [setup, ...changes] = turns.map(t => t.normalize('NFKC').replace(/\s/g, ''));
  if (!setup || changes.some(t => /如果|假如|假设|不要|要不是|不是.{0,10}而是|(?:同时|另外|顺便|然后|并且|再把).{0,12}(?:改成|改到|更正为)|(?:改成|改为).{0,18}(?:改成|改为)/.test(t))) return;
  if (guide.href === '/wca/about/success-rate' && guide.text.includes('含 DNF 和 valid')) {
    const minimum = guide.text.match(/attempted\s*<\s*(\d+)\s*直接不输出/);
    if (minimum) return successRate(setup, changes, +minimum[1]);
  }
  const windows = guide.href === '/wca/about/average_of' && guide.text.includes('Mo3 不裁剪') && /Mo3/i.test(setup);
  const metrics = guide.href === '/wca/about/wr_metric' && guide.text.includes('mean(worst 3') &&
    /Mo5/i.test(setup) && /BPA/i.test(setup) && /WPA/i.test(setup);
  if (!windows && !metrics) return;
  if (metrics && changes.some(t => /(?:追加|新增|再接|加一把)/.test(t))) return;
  if (turns.some(t => /DNF|DNS|罚时|处罚|\+2|毫秒|分钟/i.test(t))) return;
  const sample = setup.match(/(\d+(?:\.\d+)?(?:[、,]\d+(?:\.\d+)?){2,})秒/);
  if (!sample) return;
  const values = sample[1].split(/[、,]/).map(Number);
  if (values.some(v => !Number.isFinite(v) || v <= 0) || (metrics && values.length !== 5)) return;
  return replay(values, changes, editTime, times => {
    if (windows) {
      const series = times.slice(2).map((_, i) => mean(times.slice(i, i + 3)));
      return { times, windows: series, latest: series.at(-1), best: Math.min(...series) };
    }
    if (times.length !== 5) return;
    const four = times.slice(0, 4).sort((a, b) => a - b);
    return { times, Mo5: mean(times), BPA: mean(four.slice(0, 3)), WPA: mean(four.slice(1)) };
  });
}
