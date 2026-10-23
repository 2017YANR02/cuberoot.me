/** Finite catalog audit; no solvers, BFS or distance tables are loaded here.
 * Evidence: docs/puzzle-exact-candidate-inventory.md and the reproducible
 * scripts/audit-exact-puzzle-candidates.mts projection certificates.
 */
import exactData from '../app/[lang]/scramble/stats/_data/precomputed-exact-puzzles.json';
import { PG_PUZZLES } from '../app/[lang]/sim/pgCatalog';
import { SIM_FIXED_PUZZLE_OPTIONS } from '../app/[lang]/sim/puzzleOptions';
import { CSTIMER_EVENTS } from './cstimer-scramble';
import { SHAPE_MOD_EVENTS } from './shape-mod-scramble';

type Text = { zh: string; en: string };
export type PuzzleDistributionCoverageStatus = 'exact' | 'reported' | 'partial' | 'over-budget' | 'model-incomplete' | 'equivalent';
export interface PuzzleDistributionCoverageEntry {
  id: string;
  name: Text;
  icon: string;
  status: PuzzleDistributionCoverageStatus;
  scope: Text;
  reason: Text;
  href?: string;
  metric?: Text;
  godsNumber?: number;
  stateCount?: string;
}
type Result = Omit<PuzzleDistributionCoverageEntry, 'id' | 'name' | 'icon'>;
const text = (zh: string, en: string): Text => ({ zh, en });
const fullScope = text('实体完整状态；按各项目注明的计步和等价约定。', 'Complete physical puzzle states under the stated metric and equivalences.');
const stats = (event: string) => `/scramble/stats?event=${event}&src=all`;

export const PUZZLE_DISTRIBUTION_COVERAGE_SCOPE = text(
  '覆盖当前模拟器固定目录、PG/native 目录、自有小魔方求解器和已接入的 csTimer 实体项目。自定义切割及任意训练动作集不属于有限穷尽范围。直接枚举上限为五千万态、工作数组 128 MiB、进程树 512 MiB；已证明的同构与精确组合不受逐态上限限制。',
  'Covers the current fixed simulator, PG/native catalog, small-puzzle solvers and integrated csTimer puzzles. Arbitrary custom cuts and training move sets are outside this finite audit. Direct enumeration is limited to 50 million states, 128 MiB of working arrays and a 512 MiB process tree; proven isomorphisms and exact combinations do not require enumerating every state.',
);

// Each ID has saved generator permutations, exact projection group orders and
// colour/rotation quotient bounds. Single-orbit PDB sizes are never substituted
// for the full puzzle. Joint projections cover the smaller tetrahedral orbits.
const auditedLarge = new Set(`
  superz cube3dino dogic octahedron4 dinoskewb lattice hyperx latticex masterbrilic masterftov2
  quadx dinoocta fto5 fto6 eto radiocrystal cube3skewb heliskewb comboctahedron circoradiolarian
  icosababyface cube2heli cube3heli radiojewel radioweb catscradle radiocanon radiojam
  littlechop compycube masterskewb professorskewb masterpyraminx mastertetraminx
  professorpyraminx professortetraminx royalpyraminx royaltetraminx emperorpyraminx emperortetraminx
  masterfto christophersjewel octastar trajbersoctahedron pentultimate masterpentultimate
  elitepentultimate starminx starminx2 pyraminxcrystal chopasaurus bigchop radiochop icosamate
  astrominx astrominxbigchop redicosahedron redicosahedroncenters icosaminx eitansstar
  cube2dino cube2littlechop dinolittlechop cube2dinolittlechop megaminxchopasaurus starminxcombo gigaminx
`.trim().split(/\s+/));
const completed = new Set(['ivy', '223', 'sfl', 'skewb', 'tetraminx', 'jingpyraminx', 'pyramorphix',
  'pyramorphix-qtm', 'dino', 'dino-mirror', 'pyram-tips']);
const legacyExact: Record<string, { count: string; god: number; metric: Text }> = {
  '133': { count: '192', god: 8, metric: text('R/L/F/B 半转各一步。', 'Each R/L/F/B half turn counts as one move.') },
  gear: { count: '41,472', god: 6, metric: text('现有 33 招 FTM；一招可转同轴任意非零转量。', 'Existing 33-move FTM: any nonzero turn amount on one axis costs one move.') },
  cm2: { count: '165,888', god: 10, metric: text('一行或一列的非零转动计一步。', 'Any nonzero turn of one row or column costs one move.') },
  dmd: { count: '138,240', god: 10, metric: text('一次 ±120° 转动计一步。', 'Each ±120° turn counts as one move.') },
  '8p': { count: '181,440', god: 31, metric: text('相邻一块移入空格计一步。', 'Sliding one adjacent tile into the blank costs one move.') },
  bic: { count: '1,108,800', god: 28, metric: text('项目合法转动 FTM；受带块约束。', 'FTM over the project’s legal bandaged turns.') },
  pyraminx_duo: { count: '324', god: 4, metric: text('一次顶点 ±120° 转动计一步；无独立小尖。', 'Each ±120° vertex turn counts as one move; there are no independent tips.') },
};
const reasons: Record<string, Result> = {
  ufo: { status: 'model-incomplete', scope: text('项目自建三球模型完整闭包；实体对应关系待核验。', 'Complete closure of the project three-ball model; physical correspondence remains unverified.'),
    href: stats('ufo'), stateCount: '60,480', godsNumber: 10,
    reason: text('已精确求完本项目三球整体半转模型，但未证明它等同于 Netblock UFO（整转及重着色商 33,362,904 类）或 Rubik’s UFO（39,916,800 态）。独立回放仅验证项目模型，不构成实体等价证明。两种实体的公开完整表另列，不能覆盖或替代此模型。', 'The project’s three-ball half-turn model is fully enumerated, but equivalence to Netblock UFO (33,362,904 rotation/recoloring classes) or Rubik’s UFO (39,916,800 states) is unproved. Independent replay validates only the project model, not physical equivalence. Published distributions for both physical puzzles are separate and do not replace this model.') },
  'sfl-qtm-exact': { status: 'exact', scope: text('可单独转无角棱的 imitation Super Floppy；与已有 HTM 模型同域。', 'The imitation Super Floppy permits turns of an edge with no attached corners; the same domain as the existing HTM model.'),
    href: stats('sfl-qtm-exact'), stateCount: '3,041,280', godsNumber: 16,
    metric: text('四分之一转一步，半转两步。', 'Quarter turns cost one, half turns two.'),
    reason: text('Jaap 公开完整 QTM 计数；联合表的 HTM 边际与项目已有完整分布逐档一致。不混入有额外阻挡约束的官方 Super Floppy。', 'Jaap’s complete QTM counts; the joint table’s HTM marginal agrees bin by bin with the existing project histogram. The official Super Floppy with additional blocking constraints is a different model.') },
  'rubiks-ufo-ftm-exact': { status: 'exact', scope: text('Rubik’s UFO：两层各六个扇形块，固定一个参考块；不同于项目三球 UFO。', 'Rubik’s UFO: two layers of six segments, fixing one reference segment; distinct from the project three-ball UFO.'),
    href: stats('rubiks-ufo-ftm-exact'), stateCount: '39,916,800', godsNumber: 14,
    metric: text('任意非零层转或半体翻转各一步。', 'Any nonzero layer turn or half-puzzle flip costs one.'),
    reason: text('Jaap 完整联合表的面转边际；11! 态，仅复用公开计数，无项目模型预览、逐档独立见证或全态打乱。', 'The face-turn marginal of Jaap’s complete joint table, covering 11! states. Published counts only; no project-model preview, independent per-bin witnesses or all-state scrambles.') },
  'rubiks-ufo-stm-exact': { status: 'exact', scope: text('与 Rubik’s UFO 面转表相同的实体与固定参考块。', 'The same Rubik’s UFO puzzle and fixed reference segment as the face-turn table.'),
    href: stats('rubiks-ufo-stm-exact'), stateCount: '39,916,800', godsNumber: 16,
    metric: text('层转每 60° 计一步；半体翻转一步。', 'Each 60° layer turn costs one; each half-puzzle flip costs one.'),
    reason: text('Jaap 完整联合表的六分之一转边际；两度量计数独立展示，不套用现有 60,480 态模型。', 'The sixth-turn marginal of Jaap’s complete joint table. Metrics are presented separately and do not use the existing 60,480-state model.') },
  'netblock-ufo-ftm-exact': { status: 'exact', scope: text('Netblock 三球 UFO，忽略整转及统一颜色重标；计数单位为等价类。', 'Netblock three-ball UFO, identifying whole rotations and uniform color relabelings; counts are equivalence classes.'),
    href: stats('netblock-ufo-ftm-exact'), stateCount: '33,362,904', godsNumber: 15,
    metric: text('球半体或轮盘的任意非零合法转量计一步。', 'Any nonzero legal turn amount of a ball half or disc costs one move.'),
    reason: text('Jaap 完整联合表的 FTM 边际；对称轨道大小不等，不能用常数乘回固定配色分布。与项目 60,480 态模型不同，不复用其回放和求解器。', 'The FTM marginal of Jaap’s complete joint table. Symmetry orbits have unequal sizes, so fixed-color counts cannot be recovered by a constant multiplier. Distinct from the project’s 60,480-state model; its replay and solver are not reused.') },
  'netblock-ufo-qtm-exact': { status: 'exact', scope: text('与 Netblock UFO FTM 相同的整转及统一颜色重标商。', 'The same whole-rotation and uniform-recoloring quotient as Netblock UFO FTM.'),
    href: stats('netblock-ufo-qtm-exact'), stateCount: '33,362,904', godsNumber: 16,
    metric: text('同一原作者动作集，半转计两步。', 'The same author-defined move set, with half turns costing two moves.'),
    reason: text('Jaap 完整联合表的 QTM 边际；仅公开计数，不提供尚未独立验证的实体回放或全态打乱。', 'The QTM marginal of Jaap’s complete joint table. Published counts only; physical replay and all-state scrambles are not independently verified or supplied.') },
  '222': { status: 'exact', scope: fullScope, href: stats('222'), stateCount: '3,674,160',
    reason: text('已有整解 HTM/QTM 完整分布；固定一角只消除整体朝向。', 'Complete HTM/QTM solve distributions already exist; fixing one corner removes only whole rotations.'),
    metric: text('HTM / QTM；上帝之数分别为 11 / 14。', 'HTM / QTM; God’s numbers are 11 / 14.') },
  mirror2: { status: 'equivalent', scope: text('本项目二阶镜面几何；按形状还原，忽略整转。', 'The project’s Mirror 2×2 geometry; solve by shape, ignoring whole rotations.'),
    stateCount: '3,674,160', href: stats('222'),
    reason: text('八块尺寸互不相同，每块三轴长度也不同，全部角块及三种朝向均可辨；动作图与标准二阶同构，可直接复用 HTM/QTM 完整分布。',
      'All eight size triples differ and every piece has three distinct axis lengths. Pieces and all three corner twists remain visible, so the graph is isomorphic to the standard 2×2 and its HTM/QTM distributions transfer.') },
  clock: { status: 'exact', scope: text('14 个独立表盘；针位不作为目标状态。', 'Fourteen independent dials; pin settings are not solved-state targets.'),
    stateCount: '12^14', godsNumber: 12, href: stats('clock'),
    metric: text('一次将一组联动表盘转至任意钟点。', 'One move turns a linked set of dials by any nonzero amount.'),
    reason: text('已有独立公开证明及完整分布，项目数学页已收录；不再逐状态枚举。', 'An independent published proof and complete distribution are already presented on the mathematics page; no new state enumeration is needed.') },
  half: { status: 'exact', scope: text('三阶仅半转子群，固定中心。', 'The center-fixed 3×3 half-turn subgroup.'), href: stats('half'),
    reason: text('完整子群闭包已验证；不代表任意转动的三阶完整分布。', 'The complete subgroup closure is verified; this is not the unrestricted 3×3 distribution.') },
  lsemu: { status: 'exact', scope: text('三阶 U/M 子群，包含角块 AUF 和中心位置。', 'The 3×3 U/M subgroup, including corner AUF and center positions.'), href: stats('lsemu'),
    reason: text('完整子群闭包已验证；未删除中心或 AUF 状态。', 'The complete subgroup closure is verified without dropping centers or AUF states.') },
  'lsemu-qtm': { status: 'exact', scope: text('完整 U/M 子群的四分之一切片转度量；包含角 AUF 与中心位置。', 'Quarter-slice metric on the complete U/M group, including corner AUF and centre positions.'), href: stats('lsemu-qtm'),
    reason: text('全部184,320态与所有边已核验；U/M四分之一转计1、半转计2，上限23。', 'All 184,320 states and all edges verified; U/M quarter turns cost 1 and half turns cost 2, with maximum 23.') },
  'roux-eolr-ac': { status: 'exact', scope: text('全部LSE态到EOLR AC准备目标的距离。', 'Distances of all LSE states to the EOLR AC preparation goal.'), href: stats('roux-eolr-ac'),
    reason: text('192个物理目标；完全复原态需2步到目标。上限13，全部状态与独立目标条件核验通过。', '192 physical targets; identity is two moves from a target. Maximum 13, with full-state and independent goal checks.') },
  'roux-eolr-mc': { status: 'exact', scope: text('全部LSE态到EOLR MC准备目标的距离。', 'Distances of all LSE states to the EOLR MC preparation goal.'), href: stats('roux-eolr-mc'),
    reason: text('192个物理目标；完全复原态需3步到目标。上限13，全部状态与独立目标条件核验通过。', '192 physical targets; identity is three moves from a target. Maximum 13, with full-state and independent goal checks.') },
  'roux-eodm': { status: 'exact', scope: text('全部LSE态到EO+DM子目标的距离。', 'Distances of all LSE states to the EO+DM subgoal.'), href: stats('roux-eodm'),
    reason: text('48个目标：六棱定向、DF/DB棱及中心归位；上限13，未将该子目标误作整块还原。', '48 targets: six oriented edges, DF/DB edges and centres home. Maximum 13; this is a subgoal rather than a full solve.') },
  'htr-dr': { status: 'exact', scope: text('DR 子群内到 HTR 子群的距离；使用 DR 的十种合法转动。', 'Distances from the DR group to HTR, using the ten DR-preserving moves.'), href: stats('htr-dr'),
    reason: text('29,400 个等距陪集，每个代表 663,552 个物理态；物理态完整分布由各档乘此权重得到。上限 13，不是任意三阶状态的整解分布。', 'There are 29,400 equal-distance cosets, each representing 663,552 physical states. Multiplying each bin by that weight gives the complete physical-state distribution. Maximum 13; the domain is restricted to DR.') },
  'fr-htr': { status: 'exact', scope: text('HTR 子群内到固定 UD 轴 FR 子群的距离；只用六面半转。', 'Distances within HTR to the fixed-UD FR subgroup, using the six face half turns.'), href: stats('fr-htr'),
    reason: text('3,456 个等距陪集，每个代表 192 个物理态，覆盖全部 663,552 个 HTR 态；上限 11。下载包含每个陪集的代表。', 'There are 3,456 equal-distance cosets of 192 physical states, covering all 663,552 HTR states. Maximum 11. Downloads contain one representative per coset.') },
  mastermorphix: { status: 'model-incomplete', scope: text('真实可变形三阶金字塔。', 'The physical shape-changing Mastermorphix.'),
    reason: text('实体按三阶形变模型运动；现 PG 只有保形转动子群。该小群不能给出实体完整分布，实体空间也超过本轮预算。', 'The physical puzzle uses a 3×3 shape-mod mechanism. The current PG description covers only shape-preserving turns; its small group cannot certify the full puzzle, whose state space also exceeds this budget.') },
  masterpyramorphix: { status: 'model-incomplete', scope: text('当前 PG 切割模型与实体完整动作须分开。', 'The current PG cut model must be distinguished from a full physical mechanism.'),
    reason: text('现有 PG 群仅覆盖保形动作，仓库已将该家族排除于忠实完整模型；不能将小群直径当作实体上帝之数。', 'The PG group includes only shape-preserving moves, and the repository explicitly excludes this family as a faithful full model. Its diameter is not the physical puzzle’s God’s number.') },
  magic: { status: 'model-incomplete', scope: fullScope,
    reason: text('当前模拟器只建模一条折叠路线，没有覆盖任意绳态和所有合法折叠；路线长度不是完整上帝之数。', 'The simulator models one folding route, not arbitrary cord states and every legal fold. A route length is not a full God’s number.') },
  mmagic: { status: 'model-incomplete', scope: fullScope,
    reason: text('当前十二板模型只覆盖一条折叠路线，缺少全部绳态和合法动作模型。', 'The Master Magic model covers one folding route and lacks a complete cord-state and legal-move model.') },
  custom: { status: 'model-incomplete', scope: text('任意自定义切割。', 'Arbitrary custom cuts.'),
    reason: text('自定义参数产生无限多个模型，须逐个验证实体动作、颜色等价和状态上界；不纳入有限目录的穷尽结论。', 'Custom parameters generate infinitely many models. Each needs its own mechanism, color-equivalence and state bound checks; they are outside the finite catalog audit.') },
  bsq: { status: 'partial', scope: text('受限 Square-1 的完整合法状态。', 'All legal states of Bandaged Square-1.'),
    reason: text('已有 12,000,004 态保护中止记录，前沿仍在增长；399 个形状及小型陪集表不能替代完整分布。', 'An existing run stopped at its 12,000,004-state safety limit with a growing frontier. Its 399 shapes and small coset tables are not a full distribution.') },
  '233': { status: 'partial', scope: fullScope, href: stats('233-htm-exact'),
    reason: text('固定框架为 8!² 态；现已另接去四种轴向整转的 406,425,600 态公开完整 HTM/QTM 分布，分别为 18/19。两种状态域不混用，原固定框架样本保留；两个 40,320 表只是投影。', 'The fixed-frame model has 8!² states. Published complete HTM/QTM distributions for the 406,425,600-state quotient by four axial rotations are now available, with maxima 18/19. The domains remain separate and fixed-frame samples are preserved; the two 40,320-entry tables are only projections.') },
  '233-htm-exact': { status: 'exact', scope: text('中心朝向不可见，忽略绕 U/D 的四种整体朝向；HTM。', 'Invisible centre orientation; identify four whole rotations about U/D. HTM.'),
    href: stats('233-htm-exact'), godsNumber: 18, stateCount: '406,425,600',
    reason: text('Jaap 的完整计数与 HTM×QTM 联合表边际逐档一致；仅复用公开直方图，无全态打乱下载。', 'Jaap’s complete counts agree bin by bin with the HTM×QTM joint-table marginals. Published histogram only; no all-state scramble download.') },
  '233-qtm-exact': { status: 'exact', scope: text('与公开 HTM 相同的整转商；U/D 半转计两步，侧面必须做的半转仍计一步。', 'The same rotation quotient as published HTM; U/D half turns cost two, mandatory side-face half turns still cost one.'),
    href: stats('233-qtm-exact'), godsNumber: 19, stateCount: '406,425,600',
    reason: text('Jaap 的完整计数与 HTM×QTM 联合表边际逐档一致；不是将每个侧面半转也计为两步的三阶 QTM。', 'Jaap’s complete counts agree with the joint-table marginals. This is not the 3×3 QTM that charges two for every side-face half turn.') },
  'skewb-ultimate-exact': { status: 'exact', scope: text('八角及六个面块的朝向均可见；固定四角组，四轴各 ±120° 一步。', 'All eight corner and six face-piece orientations are visible. Fix one tetrad; either 120° turn on each of four axes costs one.'),
    href: stats('skewb-ultimate-exact'), godsNumber: 14, stateCount: '100,776,960',
    reason: text('Nguyen / Crépeau 经 Jaap 公开的完整表与 OEIS A079758 逐档一致；不能用普通 Skewb 的小空间代替。仅计数，无独立逐档回放样例。', 'The Nguyen / Crépeau table published by Jaap agrees bin by bin with OEIS A079758. Ordinary Skewb omits visible orientations and cannot substitute for this space. Counts only; no independently replayed per-bin witnesses.') },
  'bic-qtm-exact': { status: 'exact', scope: text('完整带块合法状态；四分之一转一步，半转两步。', 'Complete legal bandaged states; quarter turns cost one and half turns two.'),
    href: stats('bic-qtm-exact'), godsNumber: 35, stateCount: '1,108,800',
    reason: text('Jaap 的完整 QTM 表及联合表边际已核对，最深 5 态。现有 HTM 28 与全态下载另列；QTM 仅有公开计数。', 'Jaap’s complete QTM table and joint-table marginals agree, with five deepest states. Existing HTM 28 and its scramble corpus remain separate; QTM has published counts only.') },
  cm3: { status: 'partial', scope: fullScope, href: stats('cm3-neutral-qtm'),
    reason: text('固定配色完整模型有 165,112,971,264 态，超出本机枚举预算。已另接允许所有球统一到任意同一朝向的公开 QTM 完整表：6,879,707,136 个重着色等价类，最大 15；不能替代固定配色整解。', 'The fixed-color model has 165,112,971,264 states, beyond the local enumeration budget. A separate published QTM distribution allows all balls to share any common orientation: 6,879,707,136 recoloring classes, maximum 15. It does not replace the fixed-color solve.') },
  'cm2-neutral-htm': { status: 'exact', scope: text('四个球朝向相同即可，接受 24 个共同朝向；统一重着色取商，非框架整转。', 'The four balls may share any of 24 common orientations. Quotient by uniform recoloring, not frame rotations.'),
    href: stats('cm2-neutral-htm'), godsNumber: 8, stateCount: '6,912',
    metric: text('整行或整列任意非零转量计一步。', 'Any nonzero turn of one row or column costs one move.'),
    reason: text('Jaap 的 HTM×QTM 联合表边际完整计数；与本站固定配色 165,888 态分开，无新全态打乱资产。', 'Complete marginals of Jaap’s HTM×QTM table, separate from the site’s 165,888 fixed-color states. No new all-state scramble corpus.') },
  'cm2-neutral-qtm': { status: 'exact', scope: text('四球统一到任意同一朝向；24 种统一重着色等价。', 'All four balls share any common orientation; identify the 24 uniform recolorings.'),
    href: stats('cm2-neutral-qtm'), godsNumber: 9, stateCount: '6,912',
    metric: text('整行或整列四分之一转一步，半转两步。', 'A row or column quarter turn costs one, and a half turn two.'),
    reason: text('复用 Jaap 联合表的完整 QTM 边际；没有把旧固定配色样例冒充这一目标的最优解。', 'Reuses the complete QTM marginal of Jaap’s joint table. Fixed-color witnesses are not presented as optimal solutions to this different goal.') },
  'cm3-neutral-qtm': { status: 'exact', scope: text('九球统一到任意同一朝向；24 种统一重着色等价，非框架整转。', 'All nine balls share any common orientation; quotient by 24 uniform recolorings, not frame rotations.'),
    href: stats('cm3-neutral-qtm'), godsNumber: 15, stateCount: '6,879,707,136',
    metric: text('整行或整列四分之一转一步，半转两步。', 'A row or column quarter turn costs one, and a half turn two.'),
    reason: text('Stefan Pochmann 计算、Jaap 公开的完整 0–15 步表；逐档及总数核对，本机不重跑大空间，无逐档独立见证。', 'Complete depths 0–15 computed by Stefan Pochmann and published by Jaap. Bins and total are checked; the oversized graph is not rerun locally and independent per-bin witnesses are not supplied.') },
  '223-qtm-exact': { status: 'exact', scope: text('与已有 223 相同的可见状态与整转约定；更换计步。', 'The same visible states and rotation convention as existing 223, with a different metric.'),
    href: stats('223-qtm-exact'), godsNumber: 15, stateCount: '241,920',
    metric: text('U/D 四分之一转一步，半转两步；侧面必需的半转一步。', 'U/D quarter turns cost one and half turns two; mandatory side-face half turns cost one.'),
    reason: text('Jaap 联合表的 QTM 边际；HTM 边际同时与本机已计算分布核对。原 HTM 样例与下载不混入此计步。', 'QTM marginal of Jaap’s joint table, whose HTM marginal also matches the existing local result. HTM examples and downloads remain separate.') },
  'gear-single-exact': { status: 'exact', scope: text('普通 Gear Cube；齿轮底座无额外贴纸，固定一角消整转。', 'Standard Gear Cube without extra edge-base stickers; fix one corner to remove whole rotations.'),
    href: stats('gear-single-exact'), godsNumber: 12, stateCount: '41,472',
    metric: text('每次基础齿轮转动计一步；同轴多次转动逐次计步。', 'Each basic gear turn costs one; successive turns of the same axis count separately.'),
    reason: text('Jaap 的 single-turn 完整表；联合表的 multiple-turn 边际与本站已有 33 招分布一致。这不是普通三阶 QTM，也不适用于额外贴纸或齿轮魔粽。', 'Jaap’s complete single-turn table. Its multiple-turn marginal matches the site’s existing 33-move distribution. This is not 3×3 QTM and does not cover extra edge stickers or Gear MasterMorphix.') },
  '15p': { status: 'exact', scope: fullScope, godsNumber: 80, href: stats('15p-exact'), stateCount: '10,461,394,944,000',
    metric: text('单块滑动计一步。', 'One move slides one tile.'),
    reason: text('复用 Korf / Schultze 已发表的 0–80 步完整分布，最深 17 态；逐档核对及总数校验通过。没有重跑 16!/2 大空间，也没有完整状态打乱下载。原有样本另列。', 'Reuses Korf and Schultze’s published complete 0–80 distribution, with 17 states at depth 80, checked bin by bin and against the total. No new 16!/2-state search or full scramble corpus was generated. Existing samples remain separate.') },
  sq1: { status: 'partial', scope: text('按计步分别列明的 Square-1 结果。', 'Square-1 results distinguished by move metric.'), href: '/math/god?event=sq1',
    reason: text('数学页已有公开穷举的完整分布：只计切片为 13，面转口径为 31。WCA 12c4 同时转两层只计一步，是另一种度量；本轮未求出其完整分布，也不重跑超过预算的全空间。', 'The mathematics page already includes published exhaustive distributions: 13 in the twist metric and 31 in the face-turn metric. WCA 12c4 counts a simultaneous two-layer turn as one move and is a different metric; its complete distribution was not computed here, and the oversized space was not rerun.') },
  'sq1-twist': { status: 'exact', scope: text('只计切片，免费顶底层转动后的等价状态。', 'Twist metric, identifying positions related by free top and bottom layer turns.'),
    href: stats('sq1-twist'), godsNumber: 13, stateCount: '435,891,456,000',
    reason: text('复用 Masonjones / Jaap 的公开完整分布；可下载逐档计数，未导出全态打乱或各档独立回放样例。', 'Reuses the published Masonjones / Jaap complete distribution. Exact bin counts are downloadable; a full scramble corpus and independently replayed per-bin witnesses were not exported.') },
  'sq1-face': { status: 'exact', scope: text('单层转动或切片各一步；双层同时转动计两步。', 'Each single-layer turn or slice costs one move; turning both layers costs two.'),
    href: stats('sq1-face'), godsNumber: 31, stateCount: '11,958,666,854,400',
    reason: text('复用 Shuang Chen 的公开完整分布；这不是 WCA 12c4 计步。可下载逐档计数，未导出全态打乱或各档独立回放样例。', 'Reuses Shuang Chen’s published complete distribution, a different metric from WCA 12c4. Bin counts are downloadable; no full scramble corpus or independently replayed per-bin witnesses was exported.') },
  '333': { status: 'partial', scope: fullScope, href: '/math/god?event=333',
    metric: text('已知上帝之数：HTM 20，QTM 26。', 'Known God’s numbers: HTM 20, QTM 26.'),
    reason: text('已有上帝之数证明及站内数学说明；完整距离分布超过本轮计算预算。子群、阶段和抽样结果分别标明范围。', 'The known diameter proofs are covered on the mathematics page. A complete distance distribution exceeds this computation budget; subgroup, stage and sampled results retain their own scopes.') },
  rex: { status: 'model-incomplete', scope: fullScope,
    reason: text('已有置换模拟器和几何回归；严格带标签的群阶与实体同色、整转商仍须统一核验，不能直接比较不同口径的计数。尚无预算内完整统计坐标或最短距离分解。', 'A permutation simulator and geometric regression exist. The labeled group count still needs to be reconciled with physical color and rotation equivalences; counts with different conventions cannot be compared directly. No complete statistical coordinate or shortest-distance factorization within this budget is verified.') },
  sq4: { status: 'model-incomplete', scope: fullScope,
    reason: text('已有 40 扇区动作模拟器及正逆转回归；尚缺完成颜色、整转等价核验的全状态统计坐标和预算证书。动作可回放不等于已得到完整最短距离分布。', 'A 40-sector move simulator and inverse-move regression exist. A full statistical coordinate with verified color and rotation equivalences and a resource certificate is still missing. Replayable moves alone do not establish the complete shortest-distance distribution.') },
};

function resultFor(id: string): Result {
  if (reasons[id]) return reasons[id];
  if (completed.has(id)) return { status: 'exact', scope: fullScope, href: stats(id),
    reason: text('完整距离分布及有界最优样例已保存，逐档样例经过独立回放。', 'The complete distance histogram and bounded optimal witnesses are saved; examples at every depth were independently replayed.') };
  if (legacyExact[id]) {
    const item = legacyExact[id];
    return { status: 'exact', scope: fullScope, href: stats(id), stateCount: item.count, godsNumber: item.god, metric: item.metric,
      reason: text('已有完整枚举直方图；网站离线样例沿用该模型，不算新的数学结果。', 'A complete enumerated histogram already exists. Offline site witnesses reuse that model and are not a new mathematical result.') };
  }
  if (id === 'skewbdiamond') return { ...resultFor('dmd'), status: 'equivalent',
    reason: text('与已有钻石完整分布对应；复用同一实体结果。', 'This is the existing Diamond puzzle; reuse its complete distribution.') };
  if (id === 'pyraminx') return { ...resultFor('pyram-tips'), status: 'equivalent', href: stats('pyram-tips'),
    reason: text('含小尖的完整分布已由主体与四个独立尖角严格组合得到；仅主体与含小尖的计步分别列明。', 'The full distribution including tips is derived exactly from the core and four independent tips; core-only and including-tip metrics are kept distinct.') };
  if (auditedLarge.has(id)) return { status: 'over-budget', scope: fullScope,
    reason: id === 'dinoocta'
      ? text('完整六轨模型在去同色与最多 24 种整转后，可见状态下界仍超过 4.71×10²²；原 88,704,000 只是两轨投影下界。', 'After color and at most 24 rotation equivalences, the six-orbit model still has over 4.71×10²² visible states. The earlier 88,704,000 bound used only two orbits.')
      : text('可复核的群阶探针已证明：去除同色及整体朝向后，可见状态投影仍超过五千万；尚无使最短距离直接相加的已验证分解。', 'Reproducible group-order probes show a visible-state projection above 50 million even after color and rotation equivalences. No verified decomposition makes shortest distances directly additive.') };
  if (['teraminx', 'petaminx', 'examinx', 'zetaminx', 'yottaminx', 'megaminx', 'kilominx', 'giga', 'prcp'].includes(id)) {
    return { status: 'over-budget', scope: fullScope,
      reason: text('仅保留五魔系的可见角块投影就已超过预算；增加层数不会消除这部分状态。分阶段求解或去掉中心不等于完整距离分布。', 'The visible minx corner projection alone exceeds the budget, and adding layers does not remove it. Staged solving or dropping centers is not a complete distance distribution.') };
  }
  if (['sia113', 'sia123', 'sia222'].includes(id)) return { status: 'over-budget', scope: fullScope,
    reason: text('单个半边的棱投影已达 92,897,280 态；角块小表并非整块魔方。独立半边即使可组合，也须先得到过大的半边完整分布。', 'One half already has a 92,897,280-state edge projection. Small corner tables are not the whole puzzle; even independent halves need their oversized full factor distributions first.') };
  if (['334', '335', '336', '337'].includes(id)) return { status: 'over-budget', scope: fullScope,
    reason: text('现有实体坐标的状态量超过一千亿；同一转动同时影响多个轨道，不能将小型剪枝表卷积为整体分布。', 'The existing physical coordinates exceed one hundred billion states. Each turn affects several orbits, so small pruning tables cannot be convolved into the full distribution.') };
  if (['redi', 'redi_cube', 'redi-published'].includes(id)) return { status: 'reported', scope: fullScope,
    href: stats('redi-published'), stateCount: '1,571,364,748,800',
    reason: text('Shuang Chen 2017 原帖给出 0–19 步完整计数。作者另行暴搜核对 0–8 步，发帖时仍计划核验深层；未找到后续全图核验记录，因此标为作者报告。八角朝向不可省略，48 种对称只压缩计算，不再除总数。本机未重跑大空间。', 'Shuang Chen’s 2017 post reports complete counts for depths 0–19. The author separately brute-force checked depths 0–8 and planned deeper checks; no subsequent full verification record was found, so this remains an author report. Eight corner twists must be retained; 48 symmetries compress computation without dividing totals. The oversized space was not rerun locally.') };
  if (['heli', 'helicv', 'curvycopter', 'ctico'].includes(id)) return { status: 'over-budget', scope: fullScope,
    reason: text('现有合法非 jumbling 模型已超过 10¹⁹ 态；加入更多实体合法动作须另核模型，不能以小投影代替全空间。', 'The existing legal non-jumbling model already exceeds 10¹⁹ states. Further physical moves need a separate model audit; small projections do not replace the full space.') };
  if (['sq2', 'ssq1'].includes(id)) return { status: 'over-budget', scope: fullScope,
    reason: text('形状与块排列耦合，完整空间超过本轮预算；现有形状表、立方体形态表或随机样本不构成全空间分布。', 'Shape and piece permutations are coupled, and the full space exceeds this budget. Shape tables, cube-shape tables and random samples are not full distributions.') };
  if (id === 'mpyrso') return resultFor('masterpyraminx');
  if (id === 'fto') return { status: 'over-budget', scope: fullScope,
    reason: text('角、棱与多色中心共同组成大空间；现有分阶段求解器和随机样本没有覆盖全部最短距离。', 'Corners, edges and colored centers form a large joint space. Existing staged solvers and random samples do not cover all shortest distances.') };
  if (['nxn', '333', '444', '555', '666', '777', 'mirror', 'mirror_333', 'ghost', 'ghost_333', 'sphere', 'fisher_333', 'axis_333', 'windmill_333', 'void_333', 'crz3a'].includes(id)) return {
    status: 'partial', scope: fullScope,
    reason: text('三阶及更高阶的完整距离分布不在本轮可枚举范围；已知直径、外形同构、抽样或子阶段结果分别保留，不能混称整体分布。二阶另列。', 'Complete 3×3-and-larger distance distributions are outside this enumeration budget. Known diameters, shape isomorphisms, samples and substep results are kept distinct. The 2×2 is listed separately.'),
  };
  return { status: 'model-incomplete', scope: fullScope,
    reason: text('该目录项尚无经过完整状态、合法生成元与目标等价核验的精确分布；不从名称或单轨道大小推断可行。', 'This catalog entry has no exact distribution verified against complete states, legal generators and goal equivalences. Feasibility is not inferred from its name or one small orbit.') };
}

const catalog = new Map<string, { id: string; name: Text; icon: string }>();
for (const puzzle of PG_PUZZLES) catalog.set(puzzle.id, { id: puzzle.id, name: text(puzzle.zh, puzzle.en), icon: puzzle.icon });
for (const puzzle of SIM_FIXED_PUZZLE_OPTIONS) catalog.set(puzzle.value, { id: puzzle.value, name: text(puzzle.labelZh, puzzle.labelEn), icon: puzzle.iconClass });
for (const puzzle of CSTIMER_EVENTS) catalog.set(puzzle.id, { id: puzzle.id, name: text(puzzle.zh, puzzle.en), icon: puzzle.iconClass });
for (const puzzle of SHAPE_MOD_EVENTS) if (!catalog.has(puzzle.id)) catalog.set(puzzle.id, { id: puzzle.id, name: text(puzzle.zh, puzzle.en), icon: puzzle.iconClass });
for (const [id, zh, en, icon] of [
  ['222', '二阶', '2×2', 'event-222'], ['333', '三阶', '3×3', 'event-333'],
  ['444', '四阶', '4×4', 'event-444'], ['555', '五阶', '5×5', 'event-555'],
  ['666', '六阶', '6×6', 'event-666'], ['777', '七阶', '7×7', 'event-777'],
  ['half', '三阶（仅半转）', '3×3 (half turns only)', 'event-333'],
  ['lsemu', '三阶（仅 U、M）', '3×3 (U, M only)', 'event-333'],
  ['lsemu-qtm', '三阶 U/M（QSTM）', '3×3 U/M (QSTM)', 'event-333'],
  ['roux-eolr-ac', '桥式 EOLR AC', 'Roux EOLR AC', 'event-333'],
  ['roux-eolr-mc', '桥式 EOLR MC', 'Roux EOLR MC', 'event-333'],
  ['roux-eodm', '桥式 EOdM', 'Roux EOdM', 'event-333'],
  ['htr-dr', 'DR → HTR', 'DR → HTR', 'event-333'],
  ['fr-htr', 'HTR → FR（固定 UD）', 'HTR → FR (fixed UD)', 'event-333'],
  ['sq1-twist', 'SQ1（切片计步）', 'SQ1 (twist metric)', 'event-sq1'],
  ['sq1-face', 'SQ1（面转计步）', 'SQ1 (face-turn metric)', 'event-sq1'],
  ['233-htm-exact', '233（整转等价 · HTM）', '233 (rotation quotient · HTM)', 'puzzle-233'],
  ['233-qtm-exact', '233（整转等价 · QTM）', '233 (rotation quotient · QTM)', 'puzzle-233'],
  ['skewb-ultimate-exact', '终极斜转', 'Skewb Ultimate', 'puzzle-skewb-ultimate'],
  ['bic-qtm-exact', 'Bicube（QTM）', 'Bicube (QTM)', 'puzzle-bic'],
  ['redi-published', '热帝（作者报告）', 'Redi (author report)', 'unofficial-redi'],
  ['cm2-neutral-htm', 'Cmetrick Mini（任意同向 · HTM）', 'Cmetrick Mini (any common orientation · HTM)', 'unofficial-cmetrick_mini'],
  ['cm2-neutral-qtm', 'Cmetrick Mini（任意同向 · QTM）', 'Cmetrick Mini (any common orientation · QTM)', 'unofficial-cmetrick_mini'],
  ['cm3-neutral-qtm', 'Cmetrick（任意同向 · QTM）', 'Cmetrick (any common orientation · QTM)', 'puzzle-cm3'],
  ['223-qtm-exact', '223（QTM）', '223 (QTM)', 'puzzle-223'],
  ['gear-single-exact', '齿轮（基础转计步）', 'Gear Cube (single-turn metric)', 'puzzle-gear'],
  ['sfl-qtm-exact', '超薄花型（QTM）', 'Super Floppy (QTM)', 'puzzle-sfl'],
  ['rubiks-ufo-ftm-exact', 'Rubik’s UFO（面转）', 'Rubik’s UFO (face-turn metric)', 'puzzle-rubiks-ufo'],
  ['rubiks-ufo-stm-exact', 'Rubik’s UFO（六分之一转）', 'Rubik’s UFO (sixth-turn metric)', 'puzzle-rubiks-ufo'],
  ['netblock-ufo-ftm-exact', 'Netblock UFO（FTM）', 'Netblock UFO (FTM)', 'unofficial-ufo'],
  ['netblock-ufo-qtm-exact', 'Netblock UFO（QTM）', 'Netblock UFO (QTM)', 'unofficial-ufo'],
  ['ufo', '项目 UFO 模型', 'Project UFO model', 'unofficial-ufo'],
  ['dino-mirror', '恐龙（接受镜像配色）', 'Dino (mirror colors accepted)', 'unofficial-dino'],
  ['pyram-tips', '金字塔（含小尖）', 'Pyraminx (including tips)', 'event-pyram'],
  ['pyramorphix-qtm', '二阶金字塔 QTM', 'Pyramorphix QTM', 'unofficial-pyramorphix'],
]) catalog.set(id, { id, name: text(zh, en), icon });

export const PUZZLE_DISTRIBUTION_COVERAGE: readonly PuzzleDistributionCoverageEntry[] =
  [...catalog.values()].map(puzzle => {
    const result = resultFor(puzzle.id);
    const exact = (exactData.puzzles as Record<string, { total: number; godsNumber: number; physicalStateCount?: number }>)[puzzle.id];
    return { ...puzzle, ...result, ...(exact ? {
      stateCount: (exact.physicalStateCount ?? exact.total).toLocaleString('en-US'), godsNumber: exact.godsNumber, href: stats(puzzle.id) } : {}) };
  });
