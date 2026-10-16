import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computed, ObservedSpeed, renderDashboard, renderCompletion, fitLine, TerminalDashboard, type DashboardProgress } from './double-zbll-dashboard.mjs';

const p: DashboardProgress = {
  total: 7555446, verified: 355891, activeCompleted: 6600, activeTotal: 16384, activeBatch: 0,
  stage: '求解中', status: 'running', updatedAt: '2026-10-12T04:23:00Z', computeSeconds: 309,
  currentRssGiB: 28.7, peakRssGiB: 29, availableGiB: 41, currentSwapouts: 0, baselineSwapouts: 0,
  memoryPressure: 1, diskGiB: 165,
  solverThreads: 16,
  histogram: [0,0,0,0,0,0,0,0,0,0,3,55,392,1973,10103,43133,136635,152361,11235,1], meanHtm: 16.291,
};
test('completion remains printable outside the alternate screen and rejects unfinished work', () => {
  const done = renderCompletion({ ...p, status: 'complete', verified: p.total }, '/saved/results');
  assert.match(done, /7,555,446 \/ 7,555,446（100%）/);
  assert.match(done, /计算已结束/); assert.match(done, /\/saved\/results/);
  assert.ok(!done.includes('\x1b'));
  assert.throws(() => renderCompletion(p, '/saved/results'));
});
test('Opt10 title and verified reservation show anonymous memory without double subtraction', () => {
  const text=renderDashboard({...p,solverEngine:'opt10',availableGiB:9,currentRssGiB:29,reservedRssGiB:0.5},{now:Date.parse(p.updatedAt)});
  assert.match(text,/Rust Opt10/);assert.match(text,/8\.5 GiB/);assert.doesNotMatch(text,/-20\.0/);
});
test('live counts include unfinished batch, without double counting during validation', () => {
  assert.equal(computed(p), 362491);
  assert.equal(computed({ ...p, verified: p.verified + 512, activeVerified: 512, stage: '逐条验证并保存本批' }), 362491);
  assert.equal(computed({ ...p, status: 'stopped', stage: '已停止' }), 362491);
  assert.equal(computed({ ...p, stage: '核验已有断点' }), 355891);
});
test('ETA uses observed work, never imported historical rows; stale data suspends it', () => {
  const speed = new ObservedSpeed();
  assert.equal(speed.update(p), null);
  assert.equal(speed.update({ ...p, activeCompleted: 6800, updatedAt: '2026-10-12T04:23:10Z' }), 20);
  const view = renderDashboard(p, { now: Date.parse(p.updatedAt), rate: 20 });
  assert.match(view, /4 天 3 小时 55 分钟/);
  assert.match(view, /362,491/);
  assert.match(view, /待核验 6,600/);
  assert.match(view, /16 线程/);
  assert.equal(view.split('\n').filter(row => /^\d\d 步/.test(row)).length, 10);
  assert.match(renderDashboard(p, { now: Date.parse(p.updatedAt) + 20000, rate: 20 }), /暂停估算/);
  const waiting = renderDashboard({ ...p, status: 'waiting-memory', stage: '等待内存 33.7 / 34 GiB · 自动续算' }, { columns: 80, rows: 24 });
  assert.match(waiting, /等待内存，达标后自动续算/);
  assert.doesNotMatch(waiting, /计算停止/);
});
test('ANSI and CJK columns stay within narrow terminal width', () => {
  assert.equal(fitLine('\x1b[36m内存 12\x1b[0m', 4), '\x1b[36m内存\x1b[0m');
  for (const columns of [48, 60, 80]) {
    const text = renderDashboard(p, { now: Date.parse(p.updatedAt), columns, color: true });
    for (const line of text.replace(/\x1b\[[\d;]*m/g, '').split('\n')) {
      const width = [...line].reduce((n, c) => n + (c.codePointAt(0)! >= 0x2e80 && c.codePointAt(0)! <= 0xffef ? 2 : 1), 0);
      assert.ok(width <= columns - 2);
    }
  }
  const compact = renderDashboard(p, { now: Date.parse(p.updatedAt), columns: 80, rows: 24 });
  assert.ok(compact.trimEnd().split('\n').length <= 23);
  assert.match(compact, /10 步.*15 步/);
  assert.match(compact, /14 步.*19 步/);
});
test('finished-pair result is distinct from the provisional whole-site average', () => {
  const text=renderDashboard({...p, pairs:{finishedPairs:2,meanBefore:17,meanAfter:15,
    latest:{top:'U 1',bottom:'U 2',before:17,best:15,states:64}}},
    {now:Date.parse(p.updatedAt),columns:80,rows:24});
  assert.match(text,/已定稿\s+2 对.*17.000 → 15.000/);
  assert.match(text,/最近完成 U 1 × U 2.*17 → 15 步/);
  assert.ok(text.trimEnd().split('\n').length<=24);
});
test('selected HTM, QTM and generator count stay together in a compact viewport', () => {
  const text=renderDashboard({...p, pairs:{finishedPairs:2,meanBefore:17,meanAfter:15,
    latest:{top:'U 1',bottom:'U 2',before:17,best:15,qtm:20,generators:5,states:64}}},
    {now:Date.parse(p.updatedAt),columns:80,rows:24});
  assert.match(text,/最近完成 U 1 × U 2.*原 17 HTM/);
  assert.match(text,/所选解\s+HTM 15\s+·\s+QTM 20\s+·\s+Generators 5/);
  assert.ok(text.trimEnd().split('\n').length<=24);
  assert.match(text,/刷新/);assert.match(text,/Control-C/);
});
test('full-height repeated frames and resize never scroll; exit restores the terminal once', () => {
  const chunks:string[]=[], output={isTTY:true,columns:80,rows:24,write:(s:string)=>chunks.push(s)};
  const screen=new TerminalDashboard(output);
  const frame=Array.from({length:40},(_,i)=>`行 ${i} `+'宽'.repeat(100)).join('\n')+'\n';
  for(const [columns,rows] of [[80,24],[80,24],[40,12],[20,3],[100,40]]) {
    output.columns=columns;output.rows=rows;screen.render(frame);
    const emitted=chunks.at(-1)!;
    assert.equal(/[\r\n]/.test(emitted),false,'no linefeed may scroll the viewport');
    const positions=[...emitted.matchAll(/\x1b\[(\d+);1H\x1b\[2K([^\x1b]*)/g)];
    assert.equal(positions.length,Math.min(40,rows));
    for(const [,row,text] of positions) {
      assert.ok(+row<=rows);
      const cells=[...text].reduce((n,c)=>n+(c.codePointAt(0)!>=0x2e80&&c.codePointAt(0)!<=0xffef?2:1),0);
      assert.ok(cells<columns,'no autowrap at the right edge');
    }
  }
  assert.equal(chunks.join('').match(/\x1b\[\?1049h/g)?.length,1);
  screen.close();screen.close();
  assert.equal(chunks.at(-1),'\x1b[0m\x1b[?25h\x1b[?1049l');
  assert.equal(chunks.join('').match(/\x1b\[\?1049l/g)?.length,1);
});
