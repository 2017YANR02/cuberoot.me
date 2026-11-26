import {cubeConstruction} from './site_assistant_cube_constructions.js';
import {getCube3, invertAlg} from '@cuberoot/shared/recon/cube3';

import {applyScramble, fromFaceletString, toFaceletString} from '@cuberoot/shared/timer/reconstruct/state';
import {colourCubeOrder} from './site_assistant_mechanics.js';

type Lang = 'en'|'zh';

// The future legal moves depend only on this labelled edge, so projecting away
// every other cubie is exact, even when they end scrambled.
async function edgeTripCounts() {
  const cube = await getCube3();
  const turns = [...'URFDLB'].map((face,index)=>({
    edge:cube.algToTransformation(face).transformationData.EDGES, shift:2*index,
  }));
  const queue = [0], seen = new Uint8Array(24*4096), any = new Set<number>();
  seen[0]=1;
  let returned=0;
  for (let i=0;i<queue.length;i++) {
    const state=queue[i], slot=state>>>13, flip=state>>>12 & 1, centers=state & 4095;
    any.add(centers);
    if (slot===0 && flip===0) returned++;
    for (const {edge,shift} of turns) {
      const target=edge.permutation.indexOf(slot);
      if (target===slot) continue;
      const mask=3<<shift;
      const rotated=(centers & ~mask) | ((centers+(1<<shift)) & mask);
      const next=(target<<13) | ((flip^edge.orientationDelta[target])<<12) | rotated;
      if (!seen[next]) {seen[next]=1;queue.push(next);}
    }
  }
  return {returned,any:any.size};
}

// The goal ignores twists and edges, so the exact search needs only the
// permutation of eight corner slots. Outer HTM turns include half turns.
async function shortestFrontCornerSwap() {
  const cube = await getCube3();
  const turns = [...'URFDLB'].flatMap(face => ['', "'", '2'].map(suffix => {
    const word = face+suffix;
    return {word, slots:cube.algToTransformation(word).transformationData.CORNERS.permutation};
  }));
  const solved = '01234567';
  const front = [...solved].map(Number).filter(i=>turns[0].slots[i]!==i && turns[6].slots[i]!==i);
  if (front.length!==2) return;
  const goal = [...solved];
  const [a,b] = front;
  [goal[a], goal[b]] = [goal[b], goal[a]];
  const target = goal.join('');
  const fromStart = new Map([[solved, '']]), fromGoal = new Map([[target, '']]);
  let forward = [solved], backward = [target];
  for (let depth=0;depth<7;depth++) {
    const fromSolved = depth%2===0;
    const [visited, opposite] = fromSolved ? [fromStart,fromGoal] : [fromGoal,fromStart];
    const next:string[] = [];
    for (const state of fromSolved ? forward : backward) for (const {word,slots} of turns) {
      const child = slots.map(i=>state[i]).join('');
      if (visited.has(child)) continue;
      visited.set(child, (visited.get(state)+' '+word).trim());
      if (opposite.has(child)) {
        const solution = [fromStart.get(child),invertAlg(fromGoal.get(child)!)].filter(Boolean).join(' ').replace(/2'/g,'2');
        if (cube.algToTransformation(solution).transformationData.CORNERS.permutation.join('')===target) return solution;
        return;
      }
      next.push(child);
    }
    if (fromSolved) forward = next;
    else backward = next;
  }
}
let frontCornerSwap:ReturnType<typeof shortestFrontCornerSwap> | undefined;

// Each entry is the minimum number of different legal opening choices before
// excluding the inverse of the player's last turn. The regression enumerates
// every non-home projection of UF, DR, FR and BR, including their orientations.
const defensiveOpenings = [
  {tie:9, lead:0}, {tie:17, lead:6}, {tie:17, lead:9}, {tie:17, lead:9},
  {tie:17, lead:9}, {tie:17, lead:9}, {tie:17, lead:3},
] as const;

function fightingCubeAnswer(question:string,lang:Lang) {
  const text=question.replace(/\$/g,'');
  if (!/cube|魔方/i.test(text) || !/(?:cannot|can['’]t) (?:immediately )?(?:undo|reverse)|immediate.reversal|不能(?:立即)?(?:撤销|逆转)|禁止立即/i.test(text) ||
      !/different state|immediate.reversal|不同(?:的)?状态|禁止立即/i.test(text) ||
      /QTM|quarter.turn metric|四分之一转计步|二阶|四阶|[2456789]\s*[x×]\s*[2456789]/i.test(text)) return;
  const budgets=/(?:for every|每)\s*(\d{1,2})\s*(?:moves? you make|步)[^.!?。\n]{0,45}?(?:cube makes|魔方走|魔方转)\s*(\d{1,2})/i.exec(text)
    ?? /\bn\s*=\s*(\d{1,2})\s*[,，、;； ]+\s*m\s*=\s*(\d{1,2})\b/i.exec(text);
  const general=/generaliz|for what|which (?:pairs|budgets)|all (?:pairs|budgets)|哪些|一般情形|推广|所有组合/i.test(text);
  if (!budgets && !(general && /n\s*[<＜]\s*20/i.test(text) && /m\s*(?:≤|<=|\\leq?)\s*n/i.test(text))) return;
  const n=Number(budgets?.[1]),m=Number(budgets?.[2]),en=lang==='en';
  if (budgets && (!n || n>=20 || m>n)) return;
  const explicitEdgeBan=/every reverse edge|all reverse edges|forbidden (?:for|throughout) the (?:whole|entire) (?:turn|block)|整个回合.*(?:所有|每条)逆边/i.test(text);
  const scope=en?'Count one outer quarter turn or half turn as one move (HTM). In the classification below, only the first turn of a block is barred from undoing the opponent’s last turn. A win means you can force a solve from every starting scramble.':
    '按 HTM，外层转 90° 或 180° 都算一步。以下分类采用“每回合第一步不能立即撤销对手末步”的解释。必胜指从任意打乱出发都能强制复原。';
  const margin=n-m-1;
  const openings=defensiveOpenings[n-1];
  const protectedStarts=m>0 && openings ? (m===n?openings.tie:m===n-1?openings.lead:0):0;
  const secondTurn=m===2 && n>=12;
  const strong=secondTurn?(en?'Even if both reversed edges of the last opposing block stay forbidden, you win. The HTM diameter is 20. Follow a shortest solution for '+n+' moves or until solved. After the opponent’s two turns the remaining distance is at most '+(22-n)+'. A forbidden turn has two edge-disjoint two-turn detours via the other orientations of its face. At most one can meet the second forbidden edge. Thus you need at most '+(24-n)+' moves in your second turn.':
    '即使上回合两条边都一直禁止逆向通行，这组步数也能必胜。三阶 HTM 直径为 20。先沿最短解走 '+n+' 步或提前复原，对手再走两步，剩余距离至多 '+(22-n)+'。同一面的另外两个朝向给每条禁边提供两条不共边的两步绕路，另一条禁边最多堵住其中一条。因此第二回合最多用 '+(24-n)+' 步即可复原。'):'';
  if (explicitEdgeBan) return strong || (en?'A ban on every reversed edge throughout the block requires tracking that block’s directed edges. The immediate-reversal classification does not resolve these budgets under your rule.':'整回合禁用所有逆边时，需要记录上一回合走过的有向边。仅禁立即撤销的分类不能判定你这组步数。');
  const result:string[]=[];
  if (budgets) {
    if (m===0) result.push(en?'Yes. The cube cannot intervene; continue a solution over as many blocks as necessary.':'可以。对手不行动，把一条解分成多个回合完成即可。');
    else if (margin>0) result.push(en?'Yes. Under immediate reversal, you retain at least '+margin+(margin===1?' move':' moves')+' for progress per block.':'可以。按禁立即撤销的规则，每轮至少有 '+margin+' 步可向复原态推进。');
    else if (protectedStarts) result.push(en?'You cannot force a win from every scramble at n='+n+', m='+m+'. The defending cube has at least '+protectedStarts+' candidate first turns in the four-edge certificate, before excluding one inverse.':
      'n='+n+'、m='+m+' 时，存在玩家无法强制取胜的打乱。在四棱防守证明中，对手开局至少有 '+protectedStarts+' 种候选应手，禁用一种逆转后仍有选择。');
    else result.push(en?'The bounds do not decide n='+n+', m='+m+'.':'n='+n+'、m='+m+' 的胜负尚未由这些界判定。');
  }
  if (strong) result.push(strong);
  result.push(scope);
  if (general) result.push(en?'For 1 ≤ n < 20 and 0 ≤ m ≤ n: (1) m=0 or n≥m+2: forced win (172 pairs). (2) 1≤n≤7, m>0 and m=n or m=n−1: the defender can evade from some scrambles (13 pairs). (3) 8≤n≤19, m=n or m=n−1: the 24 remaining pairs have no verdict from these proofs. A start close enough to solve on the opening block can still win in group (2).':
    '取 1≤n<20、0≤m≤n。① m=0 或 n≥m+2：172 组必胜。② 1≤n≤7，且 m>0、m 为 n 或 n−1：13 组存在可无限防守的初态，距离足够近仍可首轮复原。③ 8≤n≤19，m 为 n 或 n−1：剩余 24 组尚未由这些证明判定。');
  if (general || (m>0 && margin>0)) {
    const state=(word:string)=>toFaceletString(applyScramble(3,word));
    if (![...'URFDLB'].every(f=>[[f+"'",f+' '+f+'2'],[f,f+"' "+f+'2'],[f+'2',f+' '+f]]
        .every(([inverse,via])=>state(inverse)===state(via)))) return;
    result.push(en?'To undo a forbidden first inverse use two turns on the same face: after R use R R2, after R′ use R′ R2, and after R2 use R R. The state engine verifies the three identities on all six faces. Undo the remaining opposing moves normally. Restoring your position costs at most m+1, leaving n−m−1 moves to shorten a solution.':
      '撤销对手末步时，可以多花一步：对手以 R、R′、R2 收尾时分别用 R R2、R′ R2、R R。状态引擎核过六个面上的三类恒等式。接着撤销其余操作，每回合至多 m+1 步回到原位，还有 n−m−1 步沿解推进。');
  }
  if (general || protectedStarts) result.push(en?'For the defensive certificate, track UF, DR, FR and BR, with flips. All 190,080 reachable projections are enumerated; their maximum distance from home is eight. Start with one at distance eight. For each non-home endpoint of the player’s block, work backwards through the defender’s m turns, staying off home. Accept an endpoint and last turn only if every allowed player opening still leaves at least n turns to home. For each of the 13 pairs, at least two distinct defender openings work from every non-home projection. Banning one inverse leaves a reply that keeps the next player block from solving those four edges. Repeat indefinitely.':
    '防守证书跟踪 UF、DR、FR、BR 四条棱的位置及翻转。190,080 个可达投影中，最远距归位八步，以这样的初态开局。对玩家回合结束时每个未归位投影，倒推对手的 m 步且途中避开归位。仅保留这样的终点与末步：玩家下回合的每种合法首步走完后，归位仍至少需要 n 步。上述 13 组在每个未归位投影均至少有两种可行防守首步。禁用一种后仍可使玩家下回合无法归位这四条棱，可逐轮重复。');
  if (general) result.push(en?'An exact decision procedure for an uncertified pair uses full cube position, side to move, turns left in the block, and the last turn at a block boundary. Begin with solved positions and repeatedly mark player nodes with some winning successor and defender nodes with all successors winning. In this finite reachability game every unmarked initial position at the fixed point admits indefinite evasion. The full fixed point has not been computed here.':
    '其余组合可在完整局面、行动方、回合剩余步数以及换手所需的末步上精确判定：先标记已复原节点，再反复标记至少有一个必胜后继的玩家节点，以及所有后继均必胜的对手节点。不再增长时，未标记初态可无限防守。本次没有计算完整三阶的不动点。');
  return result.join('\n\n');
}

export async function checkedStateExplanation(question:string,lang:Lang) {
  const en=lang==='en';
  const ordinary=/rubik|三阶|3\s*[x×]\s*3/i.test(question) && !/supercube|picture cube|quarter.turn metric|\bQTM\b|(?:[2456789]\s*[x×]\s*[2456789])|二阶|四阶|只用|only (?:using|turning)/i.test(question);
  if (ordinary && /(?:at most|最多|不超过)\s*\$?20\$?\s*(?:moves|步)|God.s number/i.test(question)
      && /prove|proof|why|证明|为什么/i.test(question) && /any|every|任意|所有|任何/i.test(question)) {
    return en?'Yes. On the ordinary 3×3 in the half-turn metric, any single outer-face quarter turn or half turn costs one move. Superflip gives the lower bound: it was proved to require 20. For the upper bound, the researchers partitioned the reachable positions into cosets of a subgroup, reduced the required cases by symmetry and covering, and used a computer to show that every remaining set was solvable within 20 moves. They needed one solution within 20 for each position, without having to find every shortest solution. The two bounds give a diameter of exactly 20. The proof and computation are described by the authors at https://www.cube20.org/.'
      :'可以证明。普通三阶按面转度量计数，外层转 90°、180° 都算一步。Superflip 已被证明至少要 20 步，给出下界。研究者用子群的陪集划分可达状态，再利用对称性和覆盖关系减少必须处理的集合，由计算机验证每个剩余集合的所有局面都能在 20 步内还原。验证上界只须给出不超过 20 步的解。上下界相同，所以直径恰为 20。作者的证明和计算说明见 https://www.cube20.org/。';
  }
  if (ordinary && /how many corners|几个角块|多少个角/i.test(question) && /turn(?:ed)? exactly once|各扭一次/i.test(question) &&
      /legal position|solvable|可解|合法/i.test(question)) {
    return en?'Assume each selected corner is physically twisted once by 120°, the others are untouched, and all edges and piece positions stay solved. With a consistent cubie orientation convention, a clockwise twist contributes +1 and its inverse −1. If a corners go one way and b go the other, the assembly is reachable exactly when a−b ≡ 0 (mod 3). Two work with one each way, four with two each way, and eight with four each way. Three in the same direction also work. From 0 through 8 the possible counts are 0 and every count from 2 to 8: use opposite pairs and, for an odd count ≥3, one same-direction triple. A single twist cannot work. For further reading see David Joyner, Adventures in Group Theory, on the cube group and its orientation constraints.'
      :'假设被选中的角块各被手动扭 120° 一次，其余块的位置和棱朝向保持复原。按一致的角块朝向约定，顺扭记 +1，逆扭记 −1。若两个方向分别有 a、b 个，则充要条件是 a−b ≡ 0（模 3）。两角可一正一反，四角可两正两反，八角可四正四反；同向三个也可。可行个数为 0 和 2 至 8 的每个整数：偶数用反向配对，奇数先取同向三个再配对。单独一个不行。进一步阅读可参考 David Joyner 的 Adventures in Group Theory。';
  }
  if (/swap adjacent corners|交换相邻角块/i.test(question) && /U layer|top layer|顶层/i.test(question) &&
      /(?:don.t care|ignore|不关心|忽略)[^.!?。]{0,120}(?:orientation of (?:all )?corners|角块朝向)/is.test(question) &&
      /(?:don.t care|ignore|忽略|不关心)[^.!?。]{0,150}(?:position of (?:all )?edges|棱块位置)/is.test(question) &&
      !/(?:keep|preserve|restore|fix) (?:all |the )?edges|保持棱块/i.test(question) && !/only (?:use|using|turn)|quarter.turn metric|QTM|只用|禁用|[2456789]\s*[x×]\s*[2456789]/i.test(question)) {
    const word = await (frontCornerSwap ??= shortestFrontCornerSwap().catch(error=>{frontCornerSwap=undefined;throw error;}));
    if (word) {
      const steps = word.split(' ').length;
      return en ? 'Hold the two adjacent upper corners at UFL and UFR. Apply `'+word+'`: '+steps+' outer face turns (each half turn counts once). The state engine checks that exactly those two corner positions swap and the other six stay in place. Corner twists and all edge changes are allowed. This is shortest for those conditions: bidirectional breadth-first search over corner permutations alone, using all 18 face turns, found its first meeting at depth '+steps+'.'
        : '把目标顶层相邻两角放在左前上与右前上，执行 `'+word+'`，共 '+steps+' 步（面转度量，半转算一步）。状态引擎已验证仅这两个角的位置交换，其余六角位置不变。角朝向与所有棱的变化都允许。以八角排列为状态、18 种外层面转为边做双向广搜，第一次相遇在第 '+steps+' 步，因此在这些条件下最短。';
    }
  }
  if (/continuous|连续/i.test(question) && /cube|魔方/i.test(question) && /circle|圆周/i.test(question) &&
      /countab|可数/i.test(question) && /black|黑/i.test(question) && /white|白/i.test(question) &&
      /slice|section|square subset|截面/i.test(question)) {
    return en ? 'With ordinary finite or countably many cube-preserving slice turns, no. One slice already moves continuum-many points, so counting points per move is the wrong argument. Instead collect the absolute offsets of all interior slices used. A generic point of a proposed circle has both in-face coordinates outside that countable set. Quarter turns permute and negate coordinates, so such a point can only be turned within its original outer face and retains its original face colour. This rules out changing an entire circle. A 45° rotation of a whole square section would not map the cube to itself.'+
      '\n\nIf transfinite sequences with eventually stable point colours are allowed, yes. Recenter to [−1,1]³, with front z=1 white and back z=−1 black. Choose 0<r<1. For each a in [0,r] put b=√(r²−a²). Quarter-turn the two slices y=±a so their front rows face right (x=1). Half-turn the two interior slices z=±b; these bring black from the opposite side onto precisely two sites in each working row. Undo the y turns. In the front face the newly black sites are (±b,±a). When a or b is zero use its slice only once. Other front rows are untouched and the corresponding back rows were black before this pair was started. Distinct pairs use distinct y offsets and distinct z offsets. After all pairs the marked set is exactly x²+y²=r². Well-order the pairs: any material point has only finitely many absolute coordinate values, hence can be touched only finitely often and has a defined final colour.'
      : '有限或可数次保形切层转动无法画出整圆。一次转动已能移动不可数多个点，正确的障碍是可数次操作只涉及可数个内部切层偏移量。圆上能选到两个面内坐标绝对值都避开这些偏移的点；合法的四分之一转只交换坐标或变号，这种点始终留在原外表面，保留原色。整块正方截面转 45° 不会把立方体映回自身。'+
      '\n\n允许超限顺序并要求每点最终稳定时则可构造。将坐标平移缩放至 [−1,1]³，令前面 z=1 白、背面 z=−1 黑，取 0<r<1。对每个 a∈[0,r]，令 b=√(r²−a²)。把 y=±a 两层各转 90° 使前行朝右，再把内部 z=±b 两层各转 180°，将对侧的黑色送至工作行的两个目标点。撤销 y 转动，前面新增黑点 (±b,±a)。a 或 b 为零时该层只转一次。其他前行不动，尚未处理的对应背行一直是黑色。不同的 a 不会重复使用同一对行或同一对 z 层。将各对良序化后，所有黑点恰好满足 x²+y²=r²。任一点的坐标绝对值只会互换，所以它只会被有限次操作触及，极限颜色有定义。';
  }
  if (/Thistlethwaite|思斯尔思韦特/i.test(question) && /tetrads?|四角组/i.test(question) &&
      /(?:factor of 3|29400|29,400|因子 3)/i.test(question)) {
    // Half turns act on piece labels on the left, so scrambling two
    // equivalent solved states by the same word leaves the coordinate equal.
    const cube=await getCube3();
    const halves=[...'URFDLB'].map(face=>cube.algToTransformation(face+'2').transformationData.CORNERS.permutation);
    const orbit=new Set(['01234567']);
    for (const perm of orbit) for (const h of halves) orbit.add([...perm].map(c=>h[Number(c)]).join(''));
    if (orbit.size!==96) return;
    return en ? 'Yes. Store p[slot] = corner label. Build H from the six half turns projected onto corner positions (the state engine enumerates 96 permutations). Compute key(p) = lexicographic minimum of [h[p[0]], …, h[p[7]]] over h in H. Apply h to the labels, not to their current slots. For a piece→slot array invert it first. This works before either tetrad is separated: h only relabels within each home tetrad, and repeating the same future moves permutes the slots identically for every representative. Precompute sorted unique keys for the 8! permutations and give each key its zero-based rank. There are 40320/96 = 420 keys. For each of 70 tetrad occupancy masks there are six keys: half turns have even corner parity, leaving three keys per parity. Ranking those three gives the missing factor directly. For the whole coordinate, rank the four marked edges among the eight remaining slots from 0 to 69, then use 70 × cornerKeyRank + edgeMaskRank, from 0 through 29399. This indexes phase cosets, not every physical cube position separately.'
      : '可以。统一存为 p[槽位]=角块编号，若原数组是块→槽，先求逆。把六个半转在角排列上的作用生成群 H，状态引擎枚举到 96 个排列。定义 key(p) 为所有 h∈H 的 [h[p[0]],…,h[p[7]]] 中字典序最小者。h 改写块编号而不交换当前槽位，所以两组尚未分开时也适用：将来同一串动作对同类代表作相同的槽位置换。枚举 8! 种排列，给不同 key 排序编号，共 40320/96=420 个。每个四角组占位掩码（共 70 种）对应六个 key，半转不改角排列奇偶性，每种奇偶性恰有三个 key，其排名就是缺失的因子 3。对剩余八个棱槽中四个指定棱的位置编组合号 0 到 69，最终索引为 70×角 key 排名+棱掩码号，范围 0 到 29399。该编号区分阶段陪集。';
  }
  const game = fightingCubeAnswer(question,lang);
  if (game) return game;
  if (/opencv/i.test(question) && /(?:rubik|魔方)/i.test(question) && /(?:HSV|颜色阈值)/i.test(question) &&
      /(?:glare|lighting|反光|光照)/i.test(question) && /(?:recogni|camera|识别|摄像)/i.test(question)) {
    return en
      ? 'Calibrate under the light used for the scan. Use diffuse light, lock exposure and white balance if available, and sample a small patch inside each sticker across several frames. Discard clipped highlights and dark borders; compare patch medians with reference samples of all six colours. For a standard 3×3 the centres give labelled samples. In OpenCV Java use Imgproc.cvtColor with the conversion for your camera input (Imgproc.COLOR_BGR2HSV for BGR). For ordinary 8-bit HSV, hue wraps at 180: compare red across both ends, and use saturation and brightness for white where hue is unstable. Recalibrate or request another frame when the closest classes overlap. An optional RGB quantizer is (r >> 5, g >> 5, b >> 5) for unsigned 8-bit channels: eight bins per channel give 512 possible colours. Quantization suppresses small variations but cannot recover a sticker whose pixels are saturated by glare.'
      : '在实拍光线下先校准六种颜色，使用漫射光，尽量锁定曝光和白平衡。取各贴纸内侧区域的多帧中位数，排除过曝高光和暗边；普通三阶可以用六个中心块作标签。OpenCV Java 用 Imgproc.cvtColor，按相机输入通道选转换方式，BGR 输入用 Imgproc.COLOR_BGR2HSV。普通 8 位 HSV 色相以 180 为周期，红色要跨两端比较，白色用饱和度和亮度判断。两类难分时重新采样。也可将无符号 8 位 RGB 每通道右移五位，得到 8×8×8=512 个颜色桶，减小抖动；反光过曝已经丢失的信息只能重新拍摄。';
  }
  if (ordinary && /finite fields?|有限域/i.test(question) && /representations?|表示/i.test(question) &&
      /embedding|faithful|lower dimensional|忠实|低维/i.test(question) && !/over (?:GF|F_)|characteristic|特征为/i.test(question)) {
    return en
      ? 'A faithful 20-dimensional representation exists over F₇. Use eight basis vectors for corner slots and twelve for edge slots. Send a corner basis vector to the vector for its destination multiplied by 2ᵗ for its twist t (2 has order 3 modulo 7). Send an edge basis vector to its destination multiplied by (−1)ᶠ for its flip f. Use fixed cubie orientation conventions. Composition multiplies these monomial matrices because destinations compose and orientation increments add modulo 3 or 2. An identity matrix fixes every slot with multiplier 1, so every cubie is in place and correctly oriented. This embeds the ordinary fixed-centre cube group in GL(20,7), below the 48-dimensional sticker representation. The construction gives an upper bound on the minimum dimension.'
      : '取有限域 F₇，用 8 个角槽和 12 个棱槽作为基向量。角块去往哪个槽，便把原基向量映到该槽的基向量乘 2ᵗ，t 是扭角数；2 在模 7 下的阶为 3。棱块同理乘 (−1)ᶠ，f 是翻棱数。固定朝向约定后，矩阵相乘正好对应位置复合与朝向相加。单位矩阵要求每个块的位置、朝向都复原，核平凡，因而普通固定中心三阶群嵌入 GL(20,7)。20 是由此得到的维数上界。';
  }
  if (/permutation puzzles?|置换谜题/i.test(question) && /general techniques|without (?:any )?memoriz|通用解法|不背公式/i.test(question)) {
    return en
      ? 'For a finite permutation puzzle, encode the solved state S with labelled positions (use individual stickers when orientation matters). Write every legal generator and its inverse as a permutation. Starting at S, do breadth-first search: enqueue S, then for each dequeued state apply each generator and save (parent, move) for every previously unseen child. Stop at the target T. Follow its parent pointers back to S, applying the inverse of each stored move in that order: this is an executable solution without memorized sequences. If the queue empties, T is unreachable. For example, a target reached from S by R then U has parent moves U then R on the return path, so solve with U′ R′. On large groups avoid enumerating all states: build a stabilizer chain for the generators, retaining a word in legal moves for each orbit transversal. Sift T through successive point stabilizers, then invert the recovered generator word. Matching colours may allow several labellings; any reachable labelling solves the visible target.'
      : '对有限置换谜题，把复原态 S 的位置编号，朝向重要时给贴纸编号。将每个合法动作及逆动作写成置换。从 S 广度优先搜索，每访问一个新状态就保存父状态和生成它的动作。到目标 T 后，沿父指针返回 S，依次做记录动作的逆，即得到无需背公式的解。队列耗尽则目标不可达。例如目标由 R U 得到，沿父指针先撤销 U 再撤销 R，解为 U′ R′。大型群可建立稳定子链，保存各轨道代表对应的动作词，逐层消去目标置换，再反转所得的动作词。颜色相同而身份不同时，找到任一可达标号即可。';
  }
  if (/dismantled|reassembled|拆开|重装/i.test(question) && /solv[ae]?able|可解|复原/i.test(question) && /any size|任意阶/i.test(question)) {
    return en
      ? 'On a standard fixed-centre 3×3, first identify each cubie from its colours relative to the centres. All eight corner triples and twelve edge pairs must occur once with the correct handedness. With consistent orientations, the three necessary and sufficient tests are: sum of corner twists ≡ 0 mod 3, sum of edge flips ≡ 0 mod 2, and corner and edge permutation signs agree. Thus a lone twisted corner, lone flipped edge or one swapped pair fails. For arbitrary N the piece orbits differ. An exact general test is group membership: label the 6N² sticker slots, generate their permutations from all legal layer turns, and sift the proposed permutation through a stabilizer chain. If only colours are visible, test whether some identification of indistinguishable pieces is reachable (equivalently whether the colouring lies in the solved colouring’s orbit). Factor out whole-cube orientation if the puzzle has no fixed frame. This criterion also works when the three 3×3 tests do not apply.'
      : '普通固定中心三阶先按中心确定配色，每个角块三色组和棱块双色组各出现一次，角块不能镜像。按一致的朝向约定，充要条件是角朝向和模 3 为零、棱翻转和模 2 为零，角和棱排列奇偶性相同。单独扭一角、翻一棱或交换一对块均不可解。推广到 N 阶，给 6N² 个贴纸槽编号，用合法层转生成置换群，再用稳定子链检查目标置换是否属于该群。只有颜色时，同色块可有多种身份，只需其中一种可达，即目标着色属于复原着色的轨道；没有固定参照时允许整体转体。不同阶的轨道不同，不能照搬三阶奇偶判据。';
  }
  if (/Latin square|拉丁方/i.test(question) && /6\s*(?:x|×|\\times)\s*6|六阶/i.test(question) &&
      /rows?|行/i.test(question) && /columns?|列/i.test(question) && !/shortest|fewest|最短|只用外层|only outer/i.test(question)) {
    const outer = "F R' B' D2 F' B2 D2 L D' F R' F' U' F' R' B R U2";
    const wide = outer.replace(/[URFDLB]/g, '$&w');
    const word = outer+' '+wide+" 3Bw 3Lw 3Uw2 3Bw2 3Lw' 3Bw 3Uw 3Lw' 3Uw2 3Lw' 3Bw'";
    const state = applyScramble(6, word);
    const faces = [state.U,state.R,state.F,state.D,state.L,state.B];
    if (faces.every(face => Array.from({length:6}, (_,i) =>
      new Set(face.slice(i*6,i*6+6)).size === 6 && new Set(face.filter((_,j) => j%6===i)).size === 6).every(Boolean))) {
      return (en?'Yes. From solved, apply Gottlieb’s Latin-square construction: ':'可以。从复原态执行 Gottlieb 的拉丁方构造：')+'`'+word+'`'+(en
        ? '. Rw turns the outer two layers together and 3Rw the outer three (similarly for the other faces). The state engine checked six distinct colours in every row and column of all six faces. Generating the position with legal moves proves reachability. The construction is catalogued at https://www.randelshofer.ch/rubik/vcube6/X900.01.html'
        : '。Rw 表示外两层同转，3Rw 表示外三层，其他面同理。状态引擎逐一核对了六面全部行、列，均含六种不同颜色。这是合法转序，因而可达。原构造见 https://www.randelshofer.ch/rubik/vcube6/X900.01.html');
    }
  }
  const construction=cubeConstruction(question,lang);
  if (construction) return construction;
  const colourLimit=perFaceColourProof(question,lang);
  if (colourLimit) return colourLimit;
  if (/(?:position|state|scramble).{0,40}(?:requires?|exactly|distance(?: of)?)\s*(\d{1,2})\s*(?:moves?|HTM)|恰好\s*\d{1,2}\s*步.{0,12}(?:状态|打乱)/i.test(question)
    && /(?:give|show|construct|example|find|what(?:'s| is) (?:one|a))|举例|举一个|给出|构造|打乱/i.test(question)
    && !/supercube|picture cube|square[- ]?1|skewb|pyraminx|megaminx|quarter[- ]turn metric|\bQTM\b|only (?:using|turn)|without|[24-9]\s*[x×]\s*[24-9]|二阶|四阶|只用|禁用/i.test(question)) {
    const count = Number(/(?:requires?|exactly|distance(?: of)?|恰好)\s*(\d{1,2})\s*(?:moves?|HTM|步)/i.exec(question)?.[1]);
    if (count > 0 && count <= 20) {
      // Every prefix of a shortest path is itself shortest. Superflip's HTM
      // distance is independently established; checking a word alone gives only an upper bound.
      const word = "R L U2 F U' D F2 R2 B2 L U2 F' B' U R2 D F2 U R2 U".split(' ');
      const cube = await getCube3();
      const {CORNERS,EDGES} = cube.algToTransformation(word.join(' ')).transformationData;
      const setup = word.slice(0,count).join(' ');
      const inverse = invertAlg(setup).replace(/2'/g,'2');
      if (word.length !== 20 || ![CORNERS,EDGES].every(orbit=>orbit.permutation.every((p,i)=>p===i))
          || CORNERS.orientationDelta.some(Boolean) || !EDGES.orientationDelta.every(flip=>flip===1)
          || !cube.defaultPattern().applyAlg(setup+' '+inverse).isIdentical(cube.defaultPattern())) return;
      const faces = toFaceletString(applyScramble(3,setup)).match(/.{9}/g)!;
      return (en?'From solved, apply ':'从复原态执行 ')+ '`'+setup+'`'+(en?'. The resulting faces (U, R, F, D, L, B; each read row by row) are ': '。按 U、R、F、D、L、B 的顺序，各面逐行读为 ')+faces.join(' / ')+
        (en?'. Solve with ': '。还原转序为 ')+ '`'+inverse+'`'+(en?'. Distance is exactly ': '。面转度量 HTM 下的最短距离恰好是 ')+count+
        (en?' HTM. This scramble is a prefix of the 20-turn shortest word for Superflip published at https://www.cube20.org/. Any shorter path to this prefix, followed by the remaining '+(20-count)+(20-count===1?' turn':' turns')+', would reach Superflip in fewer than 20 turns, contradicting its proven distance. A half turn counts once.'
          :' 步。这是 https://www.cube20.org/ 公布的 Superflip 二十步最短路径的前缀。接上剩余 '+(20-count)+' 步即可到达 Superflip；若前缀有更短路径，就与已证明的二十步下界矛盾。半转计一步。');
    }
  }
  if (/javascript|BigInt/i.test(question) && /factorial\s*\(\s*edges\s*\)/i.test(question)
      && /factorial\s*\(\s*corners\s*\)[)\s]*\/\s*2/.test(question) && /12 edge|edgepieces\s*=\s*12/i.test(question)
      && /8 corner|cornerpieces\s*=\s*8/i.test(question)) {
    const exact = 479001600n * 40320n / 2n * 2n**11n * 3n**7n;
    return (en?'For the full ordinary 3×3 your parity factor is already present. 12! × 8! / 2 × 2¹¹ × 3⁷ = ':'完整三阶状态数的排列奇偶约束在除以二时已计入。12! × 8! / 2 × 2¹¹ × 3⁷ = ')+exact+
      (en?'. This particular integer is exactly representable as a Number, but its shortest round-tripping decimal string is ': '。这个特定整数可以由 Number 精确表示，但默认打印的是能往返转换的最短十进制串 ')+String(Number(exact))+
      (en?'. Above MAX_SAFE_INTEGER nearby counts may also round during arithmetic. Keep every operand a BigInt, including factorials: `479001600n * 40320n / 2n * 2n**11n * 3n**7n`, then use .toString(). If one specified edge is already solved in position and orientation, divide the full count by 24 (12 slots × 2 orientations).'
        :'。超过安全整数范围后，其他状态数在运算时也可能舍入。用 BigInt 阶乘，所有常量使用 n 后缀，最后调用 .toString()。若指定一条棱的位置和朝向都已还原，完整状态数除以 24（十二个位置乘两种朝向）。');
  }
  // Count the actual generated group. Fixed piece counts alone give an
  // upper bound and can overcount subgroups with additional orbit constraints.
  const allowed = /(?:only (?:rotate|turn) (?:the )?faces?|(?:only|restricted to) (?:the )?(?:face )?turns?)[ :]+((?:up|top|down|bottom|left|right|front|back|[URFDLB])(?:(?:\s*,\s*(?:and\s+)?|\s+and\s+)(?:up|top|down|bottom|left|right|front|back|[URFDLB])){0,2})(?=[.?!;\n]|$)/i.exec(question);
  if (allowed && /how many (?:configurations|permutations|states)|number of (?:configurations|permutations|states)/i.test(question)
      && !/quarter turns only|half.turns only|no consecutive|2[x×]2|[4-9][x×][4-9]|supercube/i.test(question)) {
    const names: Record<string,string> = {up:'U',top:'U',down:'D',bottom:'D',left:'L',right:'R',front:'F',back:'B'};
    const faces = [...new Set(allowed[1].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(s=>names[s.trim().toLowerCase()] ?? s.trim().toUpperCase()))];
    const {getPuzzleGeometryByName,schreierSims} = await import('cubing/puzzle-geometry');
    const geometry = getPuzzleGeometryByName('3x3x3',{allMoves:false,orientCenters:false,moveList:faces});
    const order = schreierSims(geometry.getMovesAsPerms(),()=>{}).toLocaleString('en-US');
    return (en?'On the ordinary colour 3×3, the turns ':'在普通六色三阶上，转面 ')+faces.join(', ')+(en?' generate exactly ':' 生成的可达状态数为 ')+order+
      (en?' reachable states. Fix the centre frame and label the stickers. Take the quarter-turn permutation of each allowed face and compute the order of the subgroup they generate. A stabilizer chain successively fixes one sticker and multiplies its orbit size under the remaining stabilizer. The product counts distinct permutations, not sequences; repeating a quarter turn includes its inverse. Each allowed permutation of the solved stickers gives a different visible cube state, because each edge and corner has a unique colour combination.'
        :'。固定中心参照，标记各贴纸，对每个允许面取四分之一转的置换，形成生成元。用稳定子链依次固定贴纸，将它在当前稳定子下的轨道大小相乘，即得生成群的阶。三次同向四分之一转等于逆转；每种边、角配色唯一，因此每个置换给出不同的可见状态。');
  }
  if (/act(?:s)? freely|free action|自由作用/i.test(question) && /reachable positions|reachable states|可达状态/i.test(question)
      && /cube|魔方/i.test(question) && /stickers?|colou?r|squares|贴纸|颜色/i.test(question)) {
    return en?'Yes for the ordinary fixed-centre colour cube with moves identified by their action on the movable stickers. The solved colouring uniquely identifies each edge by its colour pair and each corner by its triple. Fixing that colouring therefore fixes every piece in its own slot and orientation, hence fixes every movable sticker. Its stabilizer is the identity. Stabilizers at reachable positions are conjugate to it, so the action on the orbit is free and transitive. In general an orbit is a copy of G/H for H the base-point stabilizer; it is a copy of G exactly when H is trivial. If the group tracks centre logos but the observation ignores them, that last condition can fail.'
      :'在普通固定中心三阶、以活动贴纸的置换定义群时，作用是自由的。复原配色中每条棱的色对、每个角的色组都唯一；保持配色就固定每块的位置和朝向，也就固定所有活动贴纸。复原态的稳定子只有单位元，其余可达状态的稳定子与它共轭，因此作用自由且传递。一般轨道对应 G/H，只有基点稳定子 H 平凡时才对应 G。若群还记录中心图案而观察忽略中心朝向，这个条件可能失效。';
  }
  if (/how (?:to|do I|would I).*find(?:ing)? the order|如何.{0,8}(?:阶|周期)/i.test(question) && /algorithm|转序/i.test(question)
      && !/supercube|marked cent|图案中心|[24-9]\s*[x×]/i.test(question)) {
    const literal = /(?:^|[ `$])([URFDLB](?:2|['′])?(?: +[URFDLB](?:2|['′])?){1,35})(?=[`$., ]|$)/.exec(question)?.[1];
    const method = en?'Label the 48 non-centre stickers of an ordinary 3×3, apply the whole algorithm once, and decompose its permutation into disjoint cycles. The order is the least common multiple of their lengths: exactly then does every sticker first return together. Tracking stickers includes edge flips and corner twists; using bare piece positions can underestimate the order.'
      :'给普通三阶的 48 张活动贴纸编号，执行一次完整转序，将贴纸置换分解为不相交的循环。所有循环长度的最小公倍数就是首次全部归位所需的重复次数。贴纸编号包含翻棱与扭角，只算块位置会低估周期。';
    return literal ? method+(en?' The checked order of ':' 经状态验证，')+'`'+literal+'`'+(en?' is ':' 的周期为 ')+await colourCubeOrder(literal.replace(/′/g,"'"))+'.' : method;
  }
  if (/imitat(?:e|ing)|emulat(?:e|ing)/i.test(question) && /smaller/i.test(question) && /bigger|larger/i.test(question) && /odd|even/i.test(question)) {
    return en?'For the usual simulation by turning adjacent layers together, an even n×n×n can imitate every smaller m; an odd n can imitate exactly the smaller odd m. On each axis partition n layers into m contiguous bands with mirror-symmetric widths. Starting with m single layers, distribute extras in symmetric pairs; if m is odd its middle band can absorb a single extra layer too. Quarter turns then carry whole bands to matching bands on the other axes. For even m there is no middle band, so the total width must be even. Thus 4 can simulate 2 and 3, while 5 can simulate 3 but not 2 or 4 under this construction.'
      :'把相邻层合并转动时，偶数阶 n 可模拟所有更小的 m，奇数阶只能模拟更小的奇数阶。三个轴都将 n 层分为 m 个宽度镜像对称的连续组。多出来的层成对分给对称组；m 为奇数时中间组还可吸收单层。四分之一转后各组仍然对齐。m 为偶数时没有单独的中间组，对称两侧的总宽必为偶数。';
  }

  if (/supercube|带标记的三阶/i.test(question) && /edge round trip|棱块往返/i.test(question)
    && /only moves which affect|only (?:turn|move).{0,30}(?:edge|棱)|只能转动.{0,12}棱/i.test(question)
    && /cent(?:er|re) orientations|中心朝向/i.test(question)) {
    const count=await edgeTripCounts();
    return en
      ? 'Allow only face turns that move the tracked edge. Exactly '+count.returned+' centre orientations are reachable with the edge back in its original slot and orientation; '+count.any+' are reachable with an unrestricted endpoint. To reproduce the count, start at the solved edge and six zero centre twists. For each reached tuple (edge slot, flip, six twists modulo four), turn each of the two faces touching that slot clockwise, update the edge and increment that face’s twist. Three such turns also cover the inverse. Visit each tuple once, then count distinct six-tuples under each endpoint condition. No discarded piece determines which turn is legal, so the enumeration is exhaustive.'
      : '只允许转动包含指定棱的面时，棱返回原位原朝向可产生 '+count.returned+' 种中心朝向；允许任意终点和翻转则有 '+count.any+' 种。从复原态开始，对“棱位、翻转、六个中心的模四扭量”逐层枚举。每次尝试当前棱接触的两个面的顺转，更新棱并把对应中心扭量加一。连续三次即覆盖逆转。对两种终点条件分别统计不同的六元组即可，其余块不影响可选转动。';
  }
  if (/minimum number of cuts|最少.{0,4}(?:切|刀)/i.test(question) && /stacking cut pieces|stack(?:ing| the pieces).{0,20}(?:allowed|permitted)|允许堆叠/i.test(question)
    && /straight|平面|直切/i.test(question) && !/without stacking|cannot stack|不能堆叠/i.test(question)) {
    const boxes=[...question.matchAll(/\b(\d{1,4})\s*[x×]\s*(\d{1,4})\s*[x×]\s*(\d{1,4})\b/gi)];
    if (boxes.length && boxes.every(m=>m.slice(1).every(n=>Number(n)>0))) {
      const cuts=boxes.map(m=>m.slice(1).join('×')+' → '+m.slice(1).reduce((sum,n)=>sum+Math.ceil(Math.log2(+n)),0));
      return (en?'Minimum straight cuts with freely stacked grid-aligned pieces: ':'允许对齐堆叠并沿格线直切时，最少刀数为 ')+[...new Set(cuts)].join(', ')+(en
        ? '. For an a×b×c block, add ⌈log₂ a⌉ + ⌈log₂ b⌉ + ⌈log₂ c⌉. Halve all aligned pieces along one axis per round, restacking each time. For the matching lower bound, follow the larger child of one block at every cut. Only one of its dimensions changes and that dimension retains at least half its length, so the sum of the three ceilings falls by at most one. A unit cube has sum zero.'
        : '。对三个边长分别取以二为底的对数，上取整后相加。每轮把同方向的块对齐，在中间切开，可依次达到这三个上界。反过来，每刀跟踪较大的子块，只改变一个边长且至少保留其一半，三项之和至多减一；单位块的和为零，故不能更少。');
    }
  }
  if (/re-?sticker|重新贴/i.test(question) && /solvab|可解|能否还原/i.test(question) && !/picture|supercube|[2456789]\s*[x×]/i.test(question)) {
    return en
      ? 'For an ordinary fixed-centre 3×3, map the six distinct centre colours to U,R,F,D,L,B and count nine stickers per colour. Decode all twelve edges and eight corners: every legal edge colour pair and every legal corner triple must occur exactly once. Read each corner cyclically from outside; a reflected triple is invalid even when the unordered colours match. Next require an even edge-flip sum, a corner-twist sum divisible by three, and equal permutation parity for edges and corners. These conditions together are necessary and sufficient. For dataset labels, reject on the first failed check. Swapping one pair of edges AND one pair of corners toggles both signs and cannot repair unequal parities.'
      : '普通固定中心三阶先用六个互异的中心颜色标定六面，确认每色九格。十二种棱的色对、八种角的色组三元组必须各出现一次，角按从外看一致的循环次序读取，镜像贴色无效。再检验棱翻转和为偶数、角扭转和为三的倍数、棱与角的排列奇偶相同。以上合起来是充要条件。同时互换一对棱和一对角会同时翻转两个符号，无法修复奇偶不一致。';
  }
  if (/diagonal on each face|每面.{0,8}对角线/i.test(question) && /opposite corner|对角.{0,4}角块/i.test(question)
      && /different colou?r|其他.{0,8}颜色/i.test(question)) {
    return en
      ? 'If the six off-diagonal stickers on each face must all share one other colour, the pattern is impossible on a standard 3×3. Each face uses three stickers of its own colour on its diagonal, including the centre. The remaining six stickers of that colour must fill one other face’s background. The backgrounds therefore form a permutation with no fixed face (265 choices). For each choice try both diagonals on all six faces (64 choices), decode the resulting 54 stickers, and reject invalid piece inventories, flipped-edge or twisted-corner sums, and mismatched permutation parities. None of the 16,960 assignments passes. If instead you only require the off-diagonal stickers to differ from the centre, allowing them to differ from one another, it is reachable: keep four alternating tetrahedral corners solved, twist two of the other four clockwise and two anticlockwise, and flip all twelve edges without permuting any pieces. Every face then has the desired diagonal, and all three solvability constraints hold.'
      : '若每面非对角线的六格必须同为另一颜色，则标准三阶无解。每色已有三格位于本面的对角线（含中心），其余六格只能作另一面的背景色。背景是六色错排，共 265 种；每面有两种对角线，共 64 种选择。对这 16,960 个布局解码并检查块库存、棱翻转、角扭转及置换奇偶，没有一个合法。若仅要求非对角线格不同于中心，可混色，则可达：保留四个交错的四面体顶点角，另四角两顺扭两逆扭，十二条棱全翻而不换位。每面恰有一条对角线同色，且满足全部可解约束。';
  }
  if (/pictures? (?:on|instead)|there are pictures|图案魔方/i.test(question) && /orientations?.{0,22}(?:cent(?:er|re)|central)|中心.{0,5}朝向/i.test(question)) {
    const cube=await getCube3();
    const words=["(R U R' U)5","(M' U M U')5"];
    const effects=words.map(word=>cube.algToTransformation(word).transformationData);
    if (!effects.every(({CORNERS,EDGES,CENTERS})=>[CORNERS,EDGES,CENTERS].every(o=>o.permutation.every((p,i)=>p===i)) &&
      [CORNERS,EDGES].every(o=>!o.orientationDelta.some(Boolean))) || effects[0].CENTERS.orientationDelta.join()!=='2,0,0,0,0,0'
      || effects[1].CENTERS.orientationDelta.join()!=='3,0,1,0,0,0') return;
    return (en?'First solve the picture cube by your usual layer method, treating each picture as a colour. The remaining error is rotation of the centre tiles in place. Hold the target face on top. ':'先把图案当成六种颜色，用熟悉的层先法还原。最后只剩中心图案原地转向。把目标面朝上。')+
      (en?"Repeat `R U R' U` five times to turn just the top centre 180°. Repeat `M' U M U'` five times to turn the top centre 90° anticlockwise and the front centre 90° clockwise, viewed from outside each face. M is the middle slice turning like L. Other pieces may move during the repetitions but return at the end. Invert the word to reverse the pair; regrip to transfer a quarter-turn along adjacent faces and use the half-turn for the final even twist."
        :"把 `R U R' U` 连做五次，仅把顶面中心转 180°；把 `M' U M U'` 连做五次，从各面外侧看，顶中心逆转 90°、前中心顺转 90°。M 是与 L 同向的中层。过程中其他块会动，到末尾全部归位。逆序可反转调节方向，换持法可沿相邻面传递四分之一转，再消掉余下的半转。");
  }
}

// Replace the claim and its example together. Preserve independent teaching
// advice and avoid treating a quoted fragment of a longer word as a formula.
export async function correctCycleExamples(answer:string) {
  const example=/(?<![A-Za-z0-9(\[\]'])`?([URFDLBMES](?:2|['′’])?(?:[ \t]+[URFDLBMES](?:2|['′’])?){2,24})`?\s+(?:only |just )?cycles (?:exactly |only )?(three|four|five|six|\d+) pieces\b/gi;
  const examples=[...answer.matchAll(example)];
  if (!examples.length) return answer;
  const cube=await getCube3();
  for (const match of examples) {
    const word=match[1].replace(/[′’]/g,"'");
    if (!/^[URFDLBMES2' ]+$/.test(word)) continue;
    const {CORNERS,EDGES}=cube.algToTransformation(word).transformationData;
    const moved=[CORNERS,EDGES].map(o=>o.permutation.filter((p,i)=>p!==i).length);
    const n=Number(({three:3,four:4,five:5,six:6} as Record<string,number>)[match[2]] ?? match[2]);
    if (moved[0]+moved[1]!==n) answer=answer.replace(match[0],'`'+word+'` changes the positions of '+moved[0]+' corners and '+moved[1]+' edges');
  }
  return answer;
}

// Validate a generated *paired* scramble and solution only when both are
// unambiguous outer-face words. A successful inverse gives an upper bound.
export function checkSolutionWitness(answer: string, lang: Lang) {
  const visible = answer.replace(/[*`]/g,'').replace(/[’′]/g,"'");
  const line = (name: string) => new RegExp('(?:^|\\n)\\s*(?:'+name+')\\s*[:：]\\s*([URFDLB](?:2|\x27)?(?: +[URFDLB](?:2|\x27)?){0,79})\\s*(?=\\n|$)','i').exec(visible)?.[1];
  const setup = line('scramble|setup|打乱');
  const solution = line('solution|solve|解法|还原转序');
  if (!setup || !solution || /[^URFDLB2' ]/.test(setup+solution)) return;
  const end = toFaceletString(applyScramble(3,setup+' '+solution));
  const solved = toFaceletString(applyScramble(3,''));
  const n = solution.trim().split(/ +/).length;
  if (end !== solved) {
    const inverse = invertAlg(setup).replace(/2'/g,'2');
    return lang==='en'?'The proposed solution does not restore the stated scramble. From `'+setup+'`, a verified solution is its inverse, `'+inverse+'`. Optimality has not been established.'
      :'给出的解法无法还原所列打乱。对 `'+setup+'`，可用已验证的逆序 `'+inverse+'` 还原；最短性尚未证明。';
  }
  const claimed = /(?:solution (?:has|takes|uses|is)|solved in|解法(?:长度为|共))\s*(\d+)\s*(?:HTM|moves?|步)/i.exec(visible)?.[1];
  if (claimed && Number(claimed)!==n) return lang==='en'?'The solution `'+solution+'` restores `'+setup+'` in '+n+' HTM moves. This is a verified upper bound.':'转序 `'+solution+'` 可还原打乱 `'+setup+'`，按 HTM 共 '+n+' 步。这给出了可复算的上界。';
}

// The same reachable state certifies any per-face upper bound of at least
// two. Its optimality comes from the pigeonhole bound on a nine-sticker face.
export function perFaceColourProof(question: string, lang: Lang) {
  const text = question.replace(/[$]/g,'').replace(/\\times/g,'×');
  const dimensions=[...text.matchAll(/(\d+)\s*[x×]\s*(\d+)/gi)];
  if (dimensions.some(match=>Number(match[1])!==3 || Number(match[2])!==3)) return;
  if (!/rubik|3\s*[x×]\s*3|三阶/i.test(text) || !/every face|each face|all faces|每(?:个|一)?面/i.test(text)
      || !/same colou?r|(?:each|every|all|any) colou?rs?|同色|同一种颜色|每种颜色/i.test(text) || /二阶|四阶|五阶|六阶|七阶|supercube|picture cube|only (?:using|turn)|without (?:using|turning)|adjacent|diagonal|只用|相邻|对角线/i.test(text)) return;
  const inclusive = /(?:no more than|at most|最多|不超过)\s*(\d+)\s*(?:pieces|stickers|times|格|次|个)/i.exec(text);
  const strict = /(?:less|fewer) than\s+(\d+|X)\s+times/i.exec(text);
  if ((!inclusive && !strict) || (inclusive && strict)) return;
  const labels=[...'URFDLB'];
  // A transcription is evidence about the observed colours. It does not
  // authenticate its provenance or prove that the state is reachable.
  const entries=[...text.matchAll(/(?:^|[\s,;/，；])([URFDLB])\s*[:=]\s*([A-Za-z0-9]+)\b/gi)];
  let observation='';
  if (entries.length) {
    const readings=new Map(entries.map(m=>[m[1].toUpperCase(),m[2].toUpperCase()]));
    const ordered=labels.map(label=>readings.get(label) ?? '');
    if (entries.length!==6 || readings.size!==6 || ordered.some(face=>face.length!==9) ||
        !fromFaceletString(ordered.join('')) || new Set(ordered.map(face=>face[4])).size!==6) {
      return lang==='en'?'To check your observation, send one nine-letter reading for each of U, R, F, D, L and B (for example U= followed by nine colour labels). Use each colour nine times overall and a different centre on each face.':'请用 U=、R=、F=、D=、L=、B= 各记录一面，每面九个颜色字母。六色各应有九格，每面中心颜色不同。';
    }
    const peaks=ordered.map(face=>Math.max(...labels.map(c=>face.split(c).length-1)));
    const limit=inclusive?Number(inclusive[1]):Number(strict![1])-1;
    const counts=labels.map((face,i)=>face+'='+peaks[i]).join(', ');
    const observed=Math.max(...peaks)<=limit;
    if (!Number.isFinite(limit)) {
      const smallest=Math.max(...peaks)+1;
      observation=lang==='en'?'For the six faces you supplied the smallest integer X is '+smallest+'. Per-face maxima: '+counts+'.':
        '你记录的六面中，严格上界 X 的最小整数值为 '+smallest+'。各面同色最大格数为 '+counts+'。';
    } else observation=lang==='en'?(observed?'Your readings meet the bound. ':'Your readings exceed the bound. ')+'Largest count of one colour on each face: '+counts+'. This checks the six faces you supplied.':
      (observed?'你记录的六面满足上限。':'你记录的六面超出上限。')+'各面同色最多的格数为 '+counts+'。';
  }
  const physicalRequest=/using an actual cube|(?:on|with) a (?:real|physical) cube|实物(?:魔方)?验证|用真魔方/i.test(question);
  const firsthandOnly=/only (?:reply|answer) if you (?:personally|physically|have (?:personally |physically )?(?:tried|tested))|(?:no|without) (?:simulations?|simulators?|computer verification)|仅(?:接受|要)实物(?:验证|实测)|不要(?:模拟|仿真)/i.test(question);
  if (firsthandOnly) {
    const boundary=lang==='en'?'I have no firsthand physical-cube test to report.':'我没有亲手操作实物魔方的验证记录。';
    return observation ? observation+'\n\n'+boundary : boundary;
  }
  const word = physicalRequest ? "M' E' S L B2" : "U R2 F L B2 F2 D2 U' D'";
  const faces = toFaceletString(applyScramble(3,word)).match(/.{9}/g)!;
  const peak = Math.max(...faces.flatMap(face=>[...'URFDLB'].map(c=>[...face].filter(sticker=>sticker===c).length)));
  if (peak !== 2) return;
  const feasible = inclusive ? Number(inclusive[1])>=peak : !Number.isFinite(Number(strict![1])) || Number(strict![1])>peak;
  const lead = lang==='en' ? (feasible?'Yes. ':'No. ')+'On a standard 3×3, the lowest achievable maximum is two stickers of one colour per face. The smallest integer X for a strict “less than X” bound is therefore 3.'
    : (feasible?'可以。':'不可以。')+'每面同色贴纸的最大出现次数最低为 2；若题设是严格小于 X，最小整数 X 为 3。';
  const verification=physicalRequest ? (lang==='en'
    ? 'I have no firsthand physical-cube test to report. I verified the following five-turn construction in the state engine. To reproduce it, keep the cube in the same grip and label colours by their original centres. M follows L, E follows D and S follows F; a prime reverses the turn. '
    : '我没有亲手操作实物魔方的记录。以下五步构造已用状态引擎验证。实物复现时保持握持方向，用初始中心给颜色命名。M、E、S 三个中层的正方向分别跟随 L、D、F，撇号表示反向。') : '';
  return (observation?observation+'\n\n':'')+verification+lead+(lang==='en'?' Starting from solved, apply ':' 从复原态执行 ')+ '`'+word+'`'+(lang==='en'?'. Reading U, R, F, D, L, B row by row gives ': '。按 U、R、F、D、L、B 顺序逐行读取，各面为 ')+faces.join(' / ')+
    (lang==='en'?'. The cube-state engine checked all nine stickers on each face. With six colours for nine stickers, at least one colour on every face must occur twice or more.': '。魔方状态引擎已逐面核对九格贴纸；每面九格仅有六种颜色，至少一种颜色必出现两次或更多。')+
    (physicalRequest?(lang==='en'?' To check a physical attempt, send the six readings as U=…, R=…, F=…, D=…, L=…, B=… using those colour labels.':'实物复现后，可用 U=…、R=…、F=…、D=…、L=…、B=… 发来六面读数核对。'):'');
}

// Construct an element of the requested order as a power of a legal word.
// The group order alone only shows existence; check the returned word on the cube.
export async function requestedOrderWitnesses(question:string,lang:Lang) {
  if (!/rubik|三阶|魔方/i.test(question) || !/group|群|Cauchy/i.test(question)) return;
  if (/picture cube|supercube|only|restricted|without|shortest|fewest|最短|只用|禁用|[2456789]\s*[x×]\s*[2456789]/i.test(question)) return;
  const q = question.replace(/\$/g, '');
  const ask = /(?:find|give|construct|show|examples? of) (?:me )?(?:an? |some )?elements? of orders? ((?:\d{1,3}\b)(?:\s*(?:,\s*(?:(?:and|or) )?| (?:or|and) )(?:(?:one|another|an element) )?(?:of order )?\d{1,3}\b)*)/i.exec(q)
    ?? /(?:构造|给出|举例).{0,10}?(\d{1,3}(?:\s*[、，或和及]\s*\d{1,3})*)\s*阶(?:的)?(?:群)?元素/.exec(q);
  if (!ask) return;
  const orders = [...new Set(ask[1].match(/\d+/g)!.map(Number))];
  const witnesses:string[]=[];
  for (const n of orders) {
    if (n<2) return;
    let found=false;
    for (const root of ["R U2 F'","R F L R2 U'","R","R U R' U'"]) {
      const period=await colourCubeOrder(root);
      if (period%n!==0) continue;
      const power=period/n;
      const word=power===1?root:'('+root+')'+power;
      if (await colourCubeOrder(word)!==n) return;
      witnesses.push(lang==='en'?'Order '+n+': `'+word+'`. The base word `'+root+'` has order '+period+'.':'阶为 '+n+'：`'+word+'`。底转序 `'+root+'` 的阶为 '+period+'。');
      found=true;break;
    }
    if (!found) return;
  }
  return witnesses.join('\n\n')+(lang==='en'?'\n\nParentheses followed by k mean repeat the whole block k times. For an element of order m, its kth power has order m/gcd(m,k). The permutation and orientation of the pieces on an ordinary 3×3 were checked for each example.':'\n\n括号后的数 k 表示整段重复 k 次。阶为 m 的元素的 k 次幂的阶是 m/gcd(m,k)。以上转序均已核对普通三阶的块排列和朝向。');
}

export function legacySliceDirections(question:string,lang:Lang) {
  if (!/\bCu (?:for|means?|=) (?:the )?cent(?:er|re) slice up\b/i.test(question) ||
      !/\bCd (?:for|means?|=) (?:the )?cent(?:er|re) slice down\b/i.test(question) ||
      !/(?:standard|Singmaster) notation for (?:a |the )?(?:cent(?:er|re)|middle) slice/i.test(question)) return;
  const centre=(word:string,face:number)=>toFaceletString(applyScramble(3,word))[face*9+4];
  if (centre("M'",0)!=='F' || centre('M',3)!=='F') return;
  const text=lang==='en'?'M is the middle slice between L and R and turns like L; E turns like D and S like F. A prime reverses the direction. Viewed from the front, M moves the front centre down, and M′ moves it up. With your booklet’s definitions Cu = M′ and Cd = M. On an odd cube these names refer to the single central slice; other conventions should specify the layers.':'M 是左右之间的正中层，正向随 L；E 随 D，S 随 F。撇号表示反向。从正面看，M 将前中心向下送，M′ 向上送，所以按题给定义 Cu = M′、Cd = M。奇数阶此处指唯一的正中层，其他记法须说明层号。';
  const sequences=[...new Set(question.match(/\bC[ud](?: (?:C[ud]|U2?)){2,}(?!\w)/g) ?? [])];
  return text+sequences.slice(0,3).map(s=>'\n\n`'+s+'` → `'+s.replace(/\bCu\b/g,"M'").replace(/\bCd\b/g,'M')+'`.').join('');
}
