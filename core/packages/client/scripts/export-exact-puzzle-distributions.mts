/** Export bounded, verified exact distributions for the existing statistics UI.
 * Reports are local computation evidence; only small histograms and witnesses
 * enter the source artifact. This command never builds a distance table.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KPuzzle } from 'cubing/kpuzzle';
import { Move } from 'cubing/alg';
import { ExperimentalPGNotation, getPuzzleGeometryByDesc } from 'cubing/puzzle-geometry';
import { puzzles } from 'cubing/puzzles';
import { pyramorphixVisibleCoordinate } from './pyramorphix-exact-distribution.mts';
import { validateDinoWitness } from './dino-exact-distribution.mts';
import { legacyReplay as legacyReplays } from './legacy-exact-offline.mts';
import { validateRouxWitness, type RouxDistributionEvent } from './roux-goal-exact-distributions.mts';
import { validateFmcSubgoalWitness, type FmcDistributionEvent } from './fmc-goal-exact-distributions.mts';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog';

type Bilingual = { en: string; zh: string };
type Example = { depth: number; scramble: string; solution: string };
interface Distribution {
  total: number;
  goalCount?: number;
  godsNumber: number;
  histogram: number[];
  quotient?: boolean;
  physicalStatesPerCoordinate?: number;
  physicalStateCount?: number;
  physicalHistogram?: number[];
  examples: Example[];
  metric: Bilingual;
  scope: Bilingual;
  examplesPerDepthLimit: number;
  deepestExamplesComplete: boolean;
  provenance: { generatedAt: string; reportSha256: string };
}
type Artifact = { schemaVersion: 1; puzzles: Record<string, Distribution> };
const output = fileURLToPath(new URL('../app/[lang]/scramble/stats/_data/precomputed-exact-puzzles.json', import.meta.url));
const descriptions: Record<string, { metric: Bilingual; scope: Bilingual }> = {
  'htr-dr': {
    metric: { en: 'Only U/U2/U′/D/D2/D′/L2/R2/F2/B2; each listed move costs 1 HTM.', zh: '仅允许 U/U2/U′/D/D2/D′/L2/R2/F2/B2，每招计一步 HTM。' },
    scope: { en: 'Fixed-UD DR → HTR: all 29,400 target cosets, each containing 663,552 physical states (19,508,428,800 in total). Downloads contain every coset representative. This is a conditional stage, not a full 3×3 solution.', zh: '固定 UD 轴的 DR → HTR：完整 29,400 个目标陪集，每个包含 663,552 个物理状态，共 19,508,428,800 个。下载包含全部陪集代表；这是条件子阶段，并非三阶整解。' },
  },
  'fr-htr': {
    metric: { en: 'Only U2/D2/L2/R2/F2/B2; each half turn costs 1.', zh: '仅允许 U2/D2/L2/R2/F2/B2，每次半转计一步。' },
    scope: { en: 'HTR → fixed-UD FR, target subgroup ⟨L2,R2,F2,B2⟩: all 3,456 cosets, each containing 192 physical states (663,552 in total). Downloads contain every coset representative. This is a conditional stage, not a full 3×3 solution.', zh: 'HTR → 固定 UD 轴的 FR，目标子群为 ⟨L2,R2,F2,B2⟩：完整 3,456 个陪集，每个包含 192 个物理状态，共 663,552 个。下载包含全部陪集代表；这是条件子阶段，并非三阶整解。' },
  },
  bic: {
    metric: { en: 'Each legal face turn of 90°, 180° or 270° counts as one move.', zh: '每次合法的 90°、180°、270° 面转均计一步。' },
    scope: { en: 'Complete bandaged Bicube space; reused the existing compact exact distance table and checked the bandage rule during independent witness replay.', zh: 'Bicube 联体魔方完整可达空间；复用既有紧凑精确距离表，独立样例回放逐招检查联体限制。' },
  },
  pyraminx_duo: {
    metric: { en: 'Each U/L/R/B ±120° corner turn counts as one move.', zh: 'U/L/R/B 每次 ±120° 角转计一步。' },
    scope: { en: 'Pyraminx Duo: four corner twists and the coupled four-centre permutation; centre logos ignored.', zh: 'Pyraminx Duo：四角朝向和与之耦合的四面心排列，忽略面心 logo 朝向。' },
  },
  '133': {
    metric: { en: 'Each R/L/F/B half turn counts as one move.', zh: 'R/L/F/B 每次 180° 转动计一步。' },
    scope: { en: 'Complete 1×3×3 Floppy space, four-piece permutation with coupled face flips.', zh: '1×3×3 Floppy 完整状态空间，四块排列与面翻转奇偶耦合。' },
  },
  '8p': {
    metric: { en: 'Each single adjacent-tile slide counts as one move.', zh: '每次滑动一块相邻数字计一步。' },
    scope: { en: 'Complete reachable 3×3 sliding-puzzle space; blank starts at bottom right.', zh: '3×3 八数码完整可达状态空间；复原空格位于右下角。' },
  },
  gear: {
    metric: { en: 'Any nonidentity power of a U/R/F gear turn counts as one move (33 tokens).', zh: 'U/R/F 齿轮转动的任意非零转幅均计一步，共 33 招。' },
    scope: { en: 'Complete Gear Cube state space in the existing csTimer convention.', zh: '既有 csTimer 记号下的齿轮魔方完整状态空间。' },
  },
  ufo: {
    metric: { en: 'A/B/C flips or any U wheel power count as one move (8 tokens).', zh: 'A/B/C 翻转或任意 U 轮盘转幅均计一步，共 8 招。' },
    scope: { en: 'Complete state space of the project three-ball UFO model, with 24 octants distinguished in a fixed disc frame. Correspondence with either physical Netblock UFO or Rubik’s UFO remains unverified; these counts establish only the project model.', zh: '项目三球 UFO 模型的完整状态空间：固定轮盘框架，区分 24 个八分块。尚未核验其与实体 Netblock UFO 或 Rubik’s UFO 的对应关系；这些计数仅证明项目模型。' },
  },
  cm2: {
    metric: { en: 'A row/column quarter or half turn counts as one move.', zh: '行或列的 90°、180°、270° 转动均计一步。' },
    scope: { en: 'Complete Cmetrick Mini space: four cube orientations with the coupling parity constraint.', zh: 'Cmetrick Mini 完整空间：四球立方朝向及联动奇偶约束。' },
  },
  dmd: {
    metric: { en: 'Each ±120° turn of one of the four generator faces counts as one move.', zh: '四个生成面中任意一次 ±120° 转动计一步。' },
    scope: { en: 'Complete Diamond octahedron space in the established 32-sticker model.', zh: '既有 32 贴纸模型下钻石八面体的完整状态空间。' },
  },
  'lsemu-qtm': {
    metric: { en: 'Quarter-slice metric: U/U′/M/M′ cost 1; U2/M2 cost 2.', zh: '四分之一切片转度量：U/U′/M/M′ 计一步，U2/M2 计两步。' },
    scope: { en: 'Complete restricted U/M group with corner AUF and centre positions. This is not outer-face QTM of the full 3×3.', zh: '包含角 AUF 和中心位置的完整 U/M 子群；并非任意转动三阶的外层 QTM。' },
  },
  'roux-eolr-ac': {
    metric: { en: 'Each U/U2/U′/M/M2/M′ token costs 1.', zh: 'U/U2/U′/M/M2/M′ 每招计一步。' },
    scope: { en: 'All 184,320 LSE states, distance to the Roux trainer AC setup goals. Eight projected targets have 192 physical completions. Fully solved identity is not a target.', zh: '全部 184,320 个 LSE 状态到训练器 AC 准备目标的最短距离；8 个投影目标对应 192 个物理状态，完全复原态不属于目标。' },
  },
  'roux-eolr-mc': {
    metric: { en: 'Each U/U2/U′/M/M2/M′ token costs 1.', zh: 'U/U2/U′/M/M2/M′ 每招计一步。' },
    scope: { en: 'All 184,320 LSE states, distance to the Roux trainer MC setup goals. Eight projected targets have 192 physical completions. Fully solved identity is not a target.', zh: '全部 184,320 个 LSE 状态到训练器 MC 准备目标的最短距离；8 个投影目标对应 192 个物理状态，完全复原态不属于目标。' },
  },
  'roux-eodm': {
    metric: { en: 'Each U/U2/U′/M/M2/M′ token costs 1.', zh: 'U/U2/U′/M/M2/M′ 每招计一步。' },
    scope: { en: 'All LSE states, distance to six oriented edges, DF/DB edges and centres home. U-edge permutation and corner AUF ignored; 48 goal states.', zh: '全部 LSE 状态到六棱定向、DF/DB 两棱归位及中心归位的最短距离；忽略顶层四棱排列和角 AUF，共 48 个目标状态。' },
  },
  'pyram-tips': {
    metric: { en: 'Each ±120° main-vertex or small-tip turn counts as one move.', zh: '主体或小尖角的每次 ±120° 转动均计一步。' },
    scope: { en: 'Complete Pyraminx including all four tips in a fixed vertex frame. Exact product of the tipless core and four independent tips; tips are counted separately.', zh: '固定顶点框架下包含四个小尖角的完整金字塔。由无尖主体和四个独立小尖精确组合，小尖转动单独计步。' },
  },
  half: {
    metric: { en: 'Only U2/R2/F2/D2/L2/B2; each half turn counts as one move.', zh: '仅允许 U2/R2/F2/D2/L2/B2，每次半转计一步。' },
    scope: { en: 'Complete reachable half-turn subgroup of the 3×3 with centers fixed; this is not the unrestricted 3×3 distribution.', zh: '固定中心参照的三阶仅半转子群完整分布，非任意转动的三阶完整分布。' },
  },
  lsemu: {
    metric: { en: 'Only U/U2/U′/M/M2/M′; each token counts as one move.', zh: '仅允许 U/U2/U′/M/M2/M′，每招计一步。' },
    scope: { en: 'Complete U/M subgroup, including corner AUF and center positions; center logo twists are ignored. This is not the unrestricted 3×3 distribution.', zh: '完整 U/M 子群，包含顶层角 AUF 和中心位置，忽略中心 logo 朝向；非任意转动的三阶完整分布。' },
  },
  dino: {
    metric: { en: 'Each ±120° turn at any of the eight corners counts as one move.', zh: '八个角中任意一次 ±120° 转动计一步。' },
    scope: { en: 'Six-colour Dino, modulo 12 legal whole rotations. Only the original colour arrangement is a solved goal.', zh: '六色恐龙魔方，去掉 12 个等价整体朝向；仅原始配色顺序视为还原。' },
  },
  'dino-mirror': {
    metric: { en: 'Each ±120° turn at any of the eight corners counts as one move.', zh: '八个角中任意一次 ±120° 转动计一步。' },
    scope: { en: 'Same six-colour Dino states; either original or mirror colour arrangement is accepted. The two solved goals form the zero-move bin.', zh: '与六色恐龙魔方相同状态空间；原始配色或镜像配色均算还原，因此 0 步档有两个目标状态。' },
  },
  ivy: {
    metric: { en: 'Each ±120° corner turn counts as one move; csTimer R/L/D/B notation.', zh: '每次 ±120° 角转计一步；使用 csTimer R/L/D/B 记号。' },
    scope: { en: 'Complete Ivy Cube state space, with whole-puzzle rotations ignored.', zh: '枫叶魔方完整状态空间，整体旋转不计。' },
  },
  '223': {
    metric: { en: 'U/D quarter and half turns, R2 and F2 each count as one move.', zh: 'U/D 的 90°、180°、270° 转动及 R2、F2 均计一步。' },
    scope: { en: 'Complete 2×2×3 state space with the middle-layer reference fixed.', zh: '固定中层参照的 2×2×3 完整状态空间。' },
  },
  sfl: {
    metric: { en: 'R/L/U/D quarter and half turns each count as one move.', zh: 'R/L/U/D 的 90°、180°、270° 转动均计一步。' },
    scope: { en: 'Complete shape-changing Super Floppy state space in the fixed edge reference.', zh: '固定棱块参照的完整可变形 Super Floppy 状态空间。' },
  },
  skewb: {
    metric: { en: 'Each ±120° WCA corner turn counts as one move.', zh: '每次 WCA 记号的 ±120° 角转计一步。' },
    scope: { en: 'Complete Skewb state space, with whole-puzzle rotations ignored.', zh: '斜转完整状态空间，整体旋转不计。' },
  },
  pyramorphix: {
    metric: { en: 'HTM: quarter and half turns each count as one move.', zh: 'HTM：90°、180°、270° 面转均计一步。' },
    scope: { en: 'Full shape-changing Pyramorphix; DBL corner fixed, invisible twists of the four flat pieces ignored. U/R/F use 2×2 corner coordinates.', zh: '完整可变形二阶金字塔；固定 DBL 真角，忽略四个单色平块不可见的扭转。U/R/F 使用二阶角块坐标记号。' },
  },
  'pyramorphix-qtm': {
    metric: { en: 'QTM: quarter turns count as one move; half turns count as two.', zh: 'QTM：90°、270° 面转计一步，180° 计两步。' },
    scope: { en: 'Full shape-changing Pyramorphix; DBL corner fixed, invisible twists of the four flat pieces ignored. U/R/F use 2×2 corner coordinates.', zh: '完整可变形二阶金字塔；固定 DBL 真角，忽略四个单色平块不可见的扭转。U/R/F 使用二阶角块坐标记号。' },
  },
  tetraminx: {
    metric: { en: 'Each ±120° vertex turn counts as one move.', zh: '每次 ±120° 顶点转动计一步。' },
    scope: { en: 'Complete tipless puzzle in a fixed vertex frame; whole rotations are ignored.', zh: '固定顶点框架下的完整截顶金字塔，不含小尖角，整体旋转不计。' },
  },
  jingpyraminx: {
    metric: { en: 'Each ±120° face turn counts as one move.', zh: '每次 ±120° 面转动计一步。' },
    scope: { en: 'Complete puzzle with its four face centers fixed as the reference frame.', zh: '以四个固定面中心为参照的完整晶氏金字塔。' },
  },
};

async function validateArtifact(artifact: Artifact): Promise<number> {
  assert.equal(artifact.schemaVersion, 1);
  assert(artifact.puzzles && Object.keys(artifact.puzzles).length > 0, 'No exact distributions');
  let checkedExamples = 0;
  for (const [event, data] of Object.entries(artifact.puzzles)) {
    const catalog = PG_PUZZLES.find(puzzle => puzzle.id === event);
    const legacyReplay = (legacyReplays as Partial<Record<string, (alg: string) => unknown>>)[event];
    const isRoux = ['lsemu-qtm', 'roux-eolr-ac', 'roux-eolr-mc', 'roux-eodm'].includes(event);
    const isFmc = event === 'htr-dr' || event === 'fr-htr';
    const isPyramorphix = event === 'pyramorphix' || event === 'pyramorphix-qtm';
    const isDino = event === 'dino' || event === 'dino-mirror';
    const isRestricted333 = event === 'half' || event === 'lsemu';
    const isPyraminxTips = event === 'pyram-tips';
    assert(catalog || event === 'skewb' || isPyramorphix || isDino || isRestricted333 || isPyraminxTips || legacyReplay || isRoux || isFmc, `${event}: missing canonical puzzle model`);
    assert(Number.isSafeInteger(data.total) && data.total > 0);
    assert(Number.isSafeInteger(data.godsNumber) && data.godsNumber >= 0);
    assert.equal(data.histogram.length, data.godsNumber + 1);
    assert.equal(data.goalCount ?? 1, event === 'dino-mirror' ? 2 : event.startsWith('roux-eolr-') ? 192 : event === 'roux-eodm' ? 48 : 1);
    assert.equal(data.histogram[0], data.goalCount ?? 1);
    assert(data.histogram.at(-1)! > 0);
    assert(data.histogram.every(count => Number.isSafeInteger(count) && count >= 0));
    assert.equal(data.histogram.reduce((sum, count) => sum + count, 0), data.total);
    if (isFmc) {
      assert.equal(data.quotient, true);
      assert.equal(data.total, event === 'htr-dr' ? 29400 : 3456);
      assert.equal(data.godsNumber, event === 'htr-dr' ? 13 : 11);
      assert.equal(data.physicalStatesPerCoordinate, event === 'htr-dr' ? 663552 : 192);
      assert.equal(data.physicalStateCount, data.total * data.physicalStatesPerCoordinate!);
      assert.deepEqual(data.physicalHistogram, data.histogram.map(count => count * data.physicalStatesPerCoordinate!));
    }
    if (isPyraminxTips) {
      const expected = new Array<number>(artifact.puzzles.tetraminx.histogram.length + 4).fill(0);
      artifact.puzzles.tetraminx.histogram.forEach((count, depth) => [1, 8, 24, 32, 16]
        .forEach((tipCount, tipDepth) => { expected[depth + tipDepth] += count * tipCount; }));
      assert.equal(data.total, 75582720);
      assert.deepEqual(data.histogram, expected, 'Pyraminx tip distribution is not the exact product');
    }
    assert(data.metric.en && data.metric.zh && data.scope.en && data.scope.zh);
    assert.match(data.provenance.reportSha256, /^[a-f0-9]{64}$/);
    assert(Number.isFinite(Date.parse(data.provenance.generatedAt)));
    let puzzle: KPuzzle | undefined;
    if (legacyReplay || isDino || isRoux || isFmc) { /* Independent replay needs only bounded target subgroups. */ }
    else if (event === 'skewb') puzzle = await puzzles.skewb.kpuzzle();
    else if (isPyramorphix) puzzle = await puzzles['2x2x2'].kpuzzle();
    else if (isRestricted333) puzzle = await puzzles['3x3x3'].kpuzzle();
    else if (isPyraminxTips) puzzle = await puzzles.pyraminx.kpuzzle();
    else {
      const geometry = getPuzzleGeometryByDesc(catalog!.def, { allMoves: true, orientCenters: false, addRotations: false });
      puzzle = new KPuzzle(geometry.getKPuzzleDefinition(true), {
        experimentalPGNotation: new ExperimentalPGNotation(geometry, geometry.getOrbitsDef(true)),
      });
    }
    const solved = puzzle?.defaultPattern();
    const covered = new Set<number>();
    const seen = new Set<string>();
    const tokenCount = (alg: string) => alg.trim().split(/\s+/).filter(Boolean).length;
    const visible333 = (pattern: ReturnType<KPuzzle['defaultPattern']>) => JSON.stringify({
      CORNERS: pattern.patternData.CORNERS, EDGES: pattern.patternData.EDGES,
      CENTERS: pattern.patternData.CENTERS.pieces,
    });
    for (const sample of data.examples) {
      assert(Number.isSafeInteger(sample.depth) && data.histogram[sample.depth] > 0);
      if (isRoux) { /* A source scramble starts at identity, not at a training goal. */ }
      else if (event === 'dino-mirror') assert(tokenCount(sample.scramble) >= sample.depth);
      else assert.equal(tokenCount(sample.scramble), sample.depth);
      assert.equal(tokenCount(sample.solution), sample.depth);
      if (isRestricted333) assert(`${sample.scramble} ${sample.solution}`.trim().split(/\s+/).filter(Boolean)
        .every(token => event === 'half' ? /^[URFDLB]2$/.test(token) : /^[UM](?:2|')?$/.test(token)), 'Witness left its restricted move alphabet');
      if (isPyraminxTips) assert(`${sample.scramble} ${sample.solution}`.trim().split(/\s+/).filter(Boolean)
        .every(token => /^[ULRBulrb]'?$/.test(token)), 'Pyraminx witness uses a different move metric');
      let key: string;
      if (isFmc) {
        key = (await validateFmcSubgoalWitness(event as FmcDistributionEvent, sample.scramble, sample.solution, sample.depth)).canonicalStateKey;
      } else if (isRoux) {
        key = (await validateRouxWitness(event as RouxDistributionEvent, sample.scramble, sample.solution, sample.depth)).canonicalStateKey;
      } else if (isDino) {
        key = validateDinoWitness(sample.scramble, sample.solution,
          event === 'dino-mirror' ? 'either' : 'original-colour-order').canonicalStateKey;
      } else if (legacyReplay) {
        assert.deepEqual(legacyReplay(`${sample.scramble} ${sample.solution}`), legacyReplay(''), `${event}: witness does not solve`);
        key = JSON.stringify(legacyReplay(sample.scramble));
      } else {
        const pattern = solved!.applyAlg(sample.scramble);
        const restored = pattern.applyAlg(sample.solution);
        assert(isPyramorphix ? pyramorphixVisibleCoordinate(restored) === 0 : isRestricted333
          ? visible333(restored) === visible333(solved!) : restored.isIdentical(solved!), `${event}/${sample.depth}: witness does not solve`);
        key = isPyramorphix ? String(pyramorphixVisibleCoordinate(pattern)) : isRestricted333 ? visible333(pattern) : JSON.stringify(pattern.patternData);
      }
      assert(!seen.has(key), `${event}: duplicate witness state`);
      seen.add(key);
      covered.add(sample.depth);
      checkedExamples++;
    }
    assert.deepEqual([...covered].sort((a, b) => a - b), data.histogram.flatMap((count, depth) => count ? [depth] : []));
    if (data.deepestExamplesComplete) {
      assert.equal(data.examples.filter(sample => sample.depth === data.godsNumber).length, data.histogram[data.godsNumber]);
    }
  }
  return checkedExamples;
}

const args = process.argv.slice(2), reports: string[] = [];
let write = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--report') { assert(args[i + 1] && !args[i + 1].startsWith('--')); reports.push(resolve(args[++i])); }
  else if (args[i] === '--write') write = true;
  else assert.equal(args[i], '--check', `Unknown argument: ${args[i]}`);
}
assert(!write || reports.length > 0, '--write requires at least one completed report');
const artifact: Artifact = existsSync(output) ? JSON.parse(readFileSync(output, 'utf8')) : { schemaVersion: 1, puzzles: {} };
for (const reportPath of reports) {
  const bytes = readFileSync(reportPath);
  const report = JSON.parse(bytes.toString('utf8'));
  report.event = report.puzzleEvent ?? report.event;
  const description = descriptions[report.event];
  assert(description, `${report.event}: metric and full-puzzle scope must be reviewed before export`);
  assert.equal(report.completed, true);
  const existingExpected: Record<string, number> = { ivy: 29160, '223': 241920, sfl: 3041280, skewb: 3149280,
    pyraminx_duo: 324, '133': 192, gear: 41472, ufo: 60480, cm2: 165888, dmd: 138240, '8p': 181440, bic: 1108800 };
  assert(report.event === 'pyram-tips' ? report.verification?.completeViaDirectProduct === true
    && report.verification?.generatorSeparationChecks >= 16
    && report.verification?.coreReportSha256 === artifact.puzzles.tetraminx.provenance.reportSha256
    : report.event in existingExpected ? report.total === existingExpected[report.event]
    && report.verification?.fullSpaceEnumerated && report.verification?.historicalHistogramMatched
    && report.verification?.independentlyReplayedExamples === report.examples.length
    : ['lsemu-qtm', 'roux-eolr-ac', 'roux-eolr-mc', 'roux-eodm'].includes(report.event)
      ? report.total === 184320 && report.verification?.closed && report.verification?.allPhysicalGoalPredicatesChecked === 184320
        && report.verification?.independentTransitionChecks >= 3072 && report.verification?.allEdgesDistanceDifferenceAtMostOne
        && report.verification?.allNonGoalStatesHaveDescendingEdge
    : report.event === 'htr-dr' || report.event === 'fr-htr'
      ? report.total === (report.event === 'htr-dr' ? 29400 : 3456)
        && report.quotient === true
        && report.physicalStatesPerCoordinate === (report.event === 'htr-dr' ? 663552 : 192)
        && report.physicalStateCount === report.total * report.physicalStatesPerCoordinate
        && report.verification?.closed && report.verification?.allEdgesDistanceDifferenceAtMostOne
        && report.verification?.allNonGoalStatesHaveDescendingEdge
        && report.verification?.directedEdgesChecked === report.total * (report.event === 'htr-dr' ? 10 : 6)
        && report.verification?.independentPhysicalTransitionsChecked === report.verification.directedEdgesChecked
        && report.verification?.distinctIndependentPhysicalCosets === report.total
        && report.verification?.independentlyReplayedExamples === report.examples.length
        && report.verification?.referenceGodNumber === (report.event === 'htr-dr' ? 13 : 11)
        && report.native?.complete === true
    : report.verification?.closed && (report.event === 'half' || report.event === 'lsemu'
      ? report.verification?.referenceHistogramAvailable === false && report.verification?.independentTransitionChecks >= 3072
        && report.total === (report.event === 'half' ? 663552 : 184320)
      : report.verification?.referenceHistogramMatches)
    && report.verification?.allEdgesDistanceDifferenceAtMostOne
    && report.verification?.allNonRootStatesHaveDescendingEdge, 'Full-state proof checks are required');
  if (report.event === 'htr-dr' || report.event === 'fr-htr') {
    for (const field of ['binarySha256', 'sourceTreeSha256', 'adapterSha256', 'tableSha256'])
      assert.match(report.native[field], /^[a-f0-9]{64}$/, `Missing native provenance: ${field}`);
    assert.deepEqual(report.physicalHistogram, report.histogram.map((count: number) => count * report.physicalStatesPerCoordinate));
  }
  const catalog = PG_PUZZLES.find(puzzle => puzzle.id === report.event);
  const geometry = ['tetraminx', 'jingpyraminx'].includes(report.event)
    ? getPuzzleGeometryByDesc(catalog!.def, { allMoves: true, orientCenters: false, addRotations: false }) : null;
  const internal = geometry ? new KPuzzle(geometry.getKPuzzleDefinition(true)) : null;
  const external = geometry ? new KPuzzle(geometry.getKPuzzleDefinition(true), {
    experimentalPGNotation: new ExperimentalPGNotation(geometry, geometry.getOrbitsDef(true)),
  }) : null;
  const externalAlg = (alg: string): string => {
    if (!geometry || !internal || !external) return alg;
    const converted = alg.trim().split(/\s+/).filter(Boolean).map(token => {
      const move = geometry.notationMapper.notationToExternal(new Move(token));
      assert(move, `Unmapped internal move: ${token}`);
      return move.toString();
    }).join(' ');
    assert.deepEqual(external.algToTransformation(converted).transformationData,
      internal.algToTransformation(alg).transformationData, 'Notation conversion changed the state');
    return converted;
  };
  const examples = report.examples.map((sample: { depth?: number; distance?: number; scramble: string; solution: string }) => ({
    depth: sample.depth ?? sample.distance!, scramble: externalAlg(sample.scramble), solution: externalAlg(sample.solution),
  }));
  artifact.puzzles[report.event] = {
    total: report.total, goalCount: report.goalCount ?? 1, godsNumber: report.godsNumber, histogram: report.histogram,
    ...(report.quotient === true ? { quotient: true, physicalStatesPerCoordinate: report.physicalStatesPerCoordinate,
      physicalStateCount: report.physicalStateCount, physicalHistogram: report.physicalHistogram } : {}),
    examples, ...description,
    examplesPerDepthLimit: report.examplesPerDepthLimit ?? report.examplesLimitPerDepth ?? 1,
    deepestExamplesComplete: report.deepestExamplesComplete ?? false,
    provenance: { generatedAt: report.generatedAt, reportSha256: createHash('sha256').update(bytes).digest('hex') },
  };
  if (report.event === 'dino') {
    const mirror = report.mirrorAccepted;
    assert.equal(mirror.goalCount, 2);
    assert.equal(mirror.godsNumber, 10);
    artifact.puzzles['dino-mirror'] = {
      total: report.total, goalCount: 2, godsNumber: mirror.godsNumber, histogram: mirror.histogram,
      examples: mirror.examples.map((sample: { distance: number; scramble: string; solution: string }) => ({
        depth: sample.distance, scramble: sample.scramble, solution: sample.solution,
      })), ...descriptions['dino-mirror'],
      examplesPerDepthLimit: mirror.examplesLimitPerDepth,
      deepestExamplesComplete: mirror.deepestExamplesComplete,
      provenance: artifact.puzzles.dino.provenance,
    };
  }
}
artifact.puzzles = Object.fromEntries(Object.entries(artifact.puzzles).sort(([a], [b]) => a.localeCompare(b)));
const checkedExamples = await validateArtifact(artifact);
if (write) {
  mkdirSync(dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(artifact, null, 2) + '\n', { flush: true });
  renameSync(temporary, output);
}
console.log(`${write ? 'Exported' : 'Verified'} ${Object.keys(artifact.puzzles).length} exact distributions; ${checkedExamples} independently replayed witnesses.`);
