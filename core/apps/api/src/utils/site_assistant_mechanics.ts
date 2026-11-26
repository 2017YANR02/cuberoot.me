import { getCube3, mirrorAlg } from '@cuberoot/shared/recon/cube3';
import { applyScramble, toFaceletString } from '@cuberoot/shared/timer/reconstruct/state';

type Lang = 'en' | 'zh';

// On an ordinary colour cube the center logos have no orientation. The
// transformation order counts those orientations; reduce it on the visible state.
export async function colourCubeOrder(algorithm: string) {
  const cube = await getCube3();
  const solved = cube.defaultPattern();
  const move = cube.algToTransformation(algorithm);
  let order = move.repetitionOrder();
  let factorization = order;
  for (let prime = 2; prime <= factorization; prime++) {
    while (factorization % prime === 0) {
      factorization /= prime;
      if (order % prime === 0 && solved.applyTransformation(move.selfMultiply(order / prime)).isIdentical(solved)) order /= prime;
    }
  }
  return order;
}

function suppliedFaceTurns(question: string) {
  // Only unambiguous, contiguous face moves. Never compute an order for a
  // fragment of a commutator, grouped expression, or mathematical formula.
  if (/[\[\]{}^]/.test(question)) return [];
  const tokens = question.replace(/[’′]/g,"'").match(/(?<![\w'(])(?:[URFDLB](?:2|')?)(?:(?:[ \t]+|(?=[URFDLB]))[URFDLB](?:2|')?)+(?![\w')])/g) ?? [];
  return [...new Set(tokens.filter(value => value.length<=80).map(value=>value.match(/[URFDLB](?:2|')?/g)!.join(' ')))].slice(0,3);
}

function patternWitness(question: string, lang: Lang) {
  const diagonal = /diagonal|对角|斜向/i.test(question) && /nearby|touch|adjacen|相邻|接触/i.test(question);
  const flower = /A\s+B\s+A\s+C\s+D\s+C\s+A\s+B\s+A/i.test(question);
  if (!diagonal && !flower) return;
  const algorithm = 'E M2 S';
  const faces = toFaceletString(applyScramble(3,algorithm)).match(/.{9}/g);
  if (faces?.length!==6) return;
  if (diagonal && !faces.every(face=>[...face].every((color,i)=>[...face].every((other,j)=>
    i===j || color!==other || Math.abs(i%3-j%3)>1 || Math.abs(Math.floor(i/3)-Math.floor(j/3))>1)))) return;
  if (flower && !faces.every(face=>new Set(face).size===4 && [2,6,8].every(i=>face[i]===face[0]) && face[1]===face[7] && face[3]===face[5])) return;
  const checked = [];
  if (diagonal) checked.push(lang==='en'?'no same-colour stickers touch horizontally, vertically or diagonally within a face':'每面横、竖、斜相邻的格子均不同色');
  if (flower) checked.push(lang==='en'?'each face has the four-colour layout ABA / CDC / ABA':'六个面分别符合四色布局 ABA / CDC / ABA');
  return lang==='en'?'From solved, `'+algorithm+'` produces a reachable state. Checking the nine stickers on each of the six faces confirms that '+checked.join(' and ')+'.'
    :'从复原态做 `'+algorithm+'`。状态引擎逐面检查九格，得到'+checked.join('，并且')+'。';
}

// Track corner permutations and the direction allowed on the *next* move.
// Keep the two starting directions separate until counting visible positions.
async function alternatingCornerCount() {
  const cube=await getCube3();
  const moves=['',"'"].map(suffix=>[...'URFDLB'].map(face=>
    cube.algToTransformation(face+suffix).transformationData.CORNERS.permutation));
  const queue=['001234567','101234567'];
  const seen=new Set(queue);
  for (let i=0; i<queue.length; i++) {
    const [direction,...corners]=queue[i];
    for (const permutation of moves[Number(direction)]) {
      const next=String(1-Number(direction))+permutation.map(j=>corners[j]).join('');
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return new Set(queue.map(key=>key.slice(1))).size;
}

const jPerm = "R U R' F' R U R' U' R' F R2 U' R' U'";

function movedCount(permutation: readonly number[]) {
  return permutation.filter((piece,index)=>piece!==index).length;
}

async function checkedJPermExplanation(lang: Lang) {
  const cube=await getCube3();
  const {EDGES,CORNERS}=cube.algToTransformation(jPerm).transformationData;
  if (movedCount(EDGES.permutation)!==2 || movedCount(CORNERS.permutation)!==2
      || EDGES.orientationDelta.some(Boolean) || CORNERS.orientationDelta.some(Boolean)) return;
  return lang==='en'
    ? 'A J-perm exchanges two corners and two edges. A commutator has even permutation sign on each orbit, so commutators alone cannot produce either single swap. Apply a U quarter-turn to the J-perm: combining a four-cycle with an adjacent swap leaves a three-cycle on each orbit. Construct those even cycles with commutators and undo the extra U turn. One exact fixed-frame example is `'+jPerm+'`; the state check gives precisely two displaced corners and two displaced edges, with orientations preserved.'
    : 'J-perm 同时交换两角和两棱。交换子在角、棱各轨道上都是偶置换，不能单独得到一次对换。给 J-perm 补一个 U 转，四循环与相邻对换相合，在两个轨道上各留下一个三循环。可以用交换子构造这两个三循环，再撤销补入的 U 转。固定朝向下的一个实例是 `'+jPerm+'`，验算只有两角、两棱互换，朝向均保持。';
}

// Match an explicit claim about the complete literal sequence. A setup,
// quoted attempt, or fragment of a grouped algorithm is not that claim.
export async function invalidJPermClaim(answer:string) {
  const moves="([URFDLB](?:2|')?(?:\\s+[URFDLB](?:2|')?){2,59})";
  const markers="[*`]{0,2}";
  const label='(?:J[ab]?[- ]?perm|J[ab]?公式)';
  const tagged=new RegExp('(?:'+label+'(?: (?:algorithm|sequence))?\\s*(?:is|=|:|：|为|是)\\s*'+markers+moves+markers+'(?=\\s*(?:[.!。！;；]|$))|(?<![\\w(])'+markers+moves+markers+'\\s+(?:form for (?:one|a)|is (?:one|a)) '+label+')','gi');
  const cube=await getCube3();
  for(const claim of answer.replace(/[′’]/g,"'").matchAll(tagged)) {
    const word=claim[1] ?? claim[2];
    if (!/^(?:[URFDLB](?:2|')?\s*)+$/.test(word)) continue;
    const result=cube.defaultPattern().applyAlg(word);
    const reference=[jPerm,mirrorAlg(jPerm,'M')];
    let matched=false;
    for(const top of ['', 'x','x2',"x'",'z',"z'"]) {
      for(const front of ['','y','y2',"y'"]) {
        const rotation=cube.algToTransformation((top+' '+front).trim());
        for(const alg of reference) {
          const target=rotation.applyTransformation(cube.algToTransformation(alg)).applyTransformation(rotation.invert());
          if(result.isIdentical(cube.defaultPattern().applyTransformation(target))) matched=true;
        }
      }
      if(matched) break;
    }
    if(!matched)return true;
  }
  return false;
}

async function markedCentreCount(lang: Lang) {
  const cube=await getCube3();
  // A half-turn on one centre and opposite quarter-turns on adjacent
  // centres generate every even-sum assignment, by cube symmetry.
  for(const [word,expected] of [["(R L U2 R' L' U)2",'2'],["(U F')63",'1,3']]) {
    const {CORNERS,EDGES,CENTERS}=cube.algToTransformation(word).transformationData;
    if ([CORNERS,EDGES].some(orbit=>movedCount(orbit.permutation) || orbit.orientationDelta.some(Boolean))
        || movedCount(CENTERS.permutation) || CENTERS.orientationDelta.filter(Boolean).sort().join(',')!==expected) return;
  }
  return lang==='en'?'With the ordinary six colours solved in a fixed frame, a marked 3×3 has 2,048 possible centre-arrow arrangements. Edges and corners have fixed orientations. Each face quarter-turn toggles both corner permutation parity and total centre-twist parity, so a solved corner permutation requires an even total number of centre quarter-turns. That gives 4⁶/2 possibilities. All are reachable: `(R L U2 R′ L′ U)2` turns one centre 180°, and `(U F′)63` turns two adjacent centres in opposite directions by 90°, preserving every edge and corner. Reorienting these moves lets you transfer quarter-turns between neighbours and remove any remaining even twist.'
    :'固定观察朝向、六面颜色复原时，带方向标记的标准三阶共有 2,048 种中心箭头排列。棱和角的朝向已定。每次单面四分之一转同时改变角置换和中心总扭量的奇偶性，因此角块归位时中心总扭量必须为偶数，只剩 4⁶/2 种。验算 `(R L U2 R′ L′ U)2` 可只转一个中心 180°，`(U F′)63` 可把两个相邻中心反向各转 90°，都保持全部棱角。换面使用这两种构造即可实现每一种偶数总扭量。';
}

// Return an actual collision in the projection onto U, F and R. Both
// witnesses start at solved in the same frame and have the same colour scheme.
function pocketProjectionProof(lang: Lang) {
  const a = applyScramble(2, 'U F2 L D');
  const b = applyScramble(2, 'R U F2 L');
  const visible = ['U', 'F', 'R'] as const;
  if (!visible.every(face => a[face].join('') === b[face].join('')) || a.D.join('') === b.D.join('')) return;
  const view = visible.map(face => face + '=' + a[face].join('')).join(', ');
  return lang === 'en'
    ? 'No. From the same solved 2×2, apply `U F2 L D` to one copy and `R U F2 L` to another. Keeping the same viewing frame, both show '+view+' in row order, but their bottom faces read '+a.D.join('')+' and '+b.D.join('')+'. Even knowing the exact colour scheme cannot distinguish them. Seven corners are at least partly visible. In the special case of three monochrome adjacent faces, their shared corner fixes the frame, the three two-sticker corners are forced, and each visible single colour then fits only one remaining cubie. The last corner and its twist are forced.'
    : '一般不能。取两个配色、朝向相同的已复原二阶，分别做 `U F2 L D` 和 `R U F2 L`。保持观察方向，按行读取上、前、右面，两者都是 '+view+'，底面却分别是 '+a.D.join('')+' 和 '+b.D.join('')+'。即使知道完整配色也无法区分。八个角有七个至少部分可见。若三个相邻面各自同色，共用角确定参考方向，三个露出两贴纸的角随之确定，三个只露一色的角各自只剩一种块可放；最后一角及扭向也被确定。';
}

async function pieceSwapProof(lang: Lang) {
  const cube = await getCube3();
  for (const face of 'URFDLB') {
    const {CORNERS, EDGES} = cube.algToTransformation(face).transformationData;
    if (movedCount(CORNERS.permutation)!==4 || movedCount(EDGES.permutation)!==4) return;
  }
  const {SkewbStateWCA} = await import('@cuberoot/shared/skewb-pyramid-svg');
  for (const move of 'RLUB') {
    const state = new SkewbStateWCA();
    state.image = state.image.map((row,f)=>row.map((_,i)=>5*f+i));
    const start = state.image.flat().join(',');
    state.applyMove(move);
    if (state.image.flat().join(',')===start) return;
    state.applyMove(move);
    state.applyMove(move);
    if (state.image.flat().join(',')!==start) return;
  }
  return lang === 'en'
    ? 'No, assuming an ordinary fixed-centre 3×3 and a standard Skewb. On the 3×3 each face quarter-turn is a four-cycle of corners and a four-cycle of edges. Their permutation signs therefore always agree. Swapping just two corners or just two edges changes only one sign. The fixed centres cannot be interchanged by face turns either. On the Skewb each basic turn has order three: its third power restores every labelled sticker. Its permutation on corners and its permutation on centres must each be even, since an odd permutation cubed would still be odd. Any sequence preserves both signs, whereas a single transposition is odd. This obstruction holds regardless of how the swapped pieces are oriented.'
    : '在标准固定中心的三阶与标准斜转魔方上都做不到。三阶每次面转 90° 都在角块和棱块上各产生一个四循环，因此角、棱排列的奇偶性始终相同。单独互换两个角或两条棱只改变其中一个奇偶性。固定中心也不能用面转互换。斜转魔方的基本转动连续做三次会让每张带编号的贴纸复位，所以角块排列和中心排列各自都是偶置换：奇置换的三次方仍为奇置换，不可能复位。任意合法转序都保持这两个奇偶性，单独互换两块却是奇置换，改变被交换块的朝向也无法消除这一障碍。';
}

function projectionSubject(question:string) {
  return /2\s*[x×]\s*2|pocket cube|二阶/i.test(question)
    && /(?:three|3) (?:adjacent )?(?:sides|faces)|三(?:个)?(?:相邻)?面/i.test(question)
    && /determin|reconstruct|infer|deduc|tell|推断|确定|重建/i.test(question);
}
function swapSubject(question:string) {
  return /skewb|斜转/i.test(question) && /cube|三阶/i.test(question)
    && /swap|interchange|transpos|互换|交换/i.test(question) && /two|pair|两/i.test(question)
    && /only|without changing|otherwise|just|single transposition|仅|只|其余不变/i.test(question)
    && !/[245-9]\s*[x×]\s*\d|[二四五六七八九]阶|supercube|pyraminx|megaminx/i.test(question);
}

// p[slot] is the HOME label of its occupant. A half-turn relabelling
// acts on values (left composition), so it preserves the membership mask
// and remains equivalent after any future common sequence of slot moves.
async function tetradCoordinateProof(lang: Lang) {
  const cube = await getCube3();
  const identity = Array.from({length:8}, (_,i)=>i);
  const generators = [...'URFDLB'].map(f=>cube.algToTransformation(f+'2').transformationData.CORNERS.permutation);
  const group = new Map([[identity.join(''),identity]]);
  for (const p of group.values()) for (const g of generators) {
    const product = p.map(label=>g[label]);
    group.set(product.join(''),product);
  }
  const orbit = new Set([...group.values()].map(h=>h[0]));
  if (group.size!==96 || orbit.size!==4) return;
  return lang==='en'
    ? 'Use the corner permutation, with p[slot] equal to the home label of its occupant. Fix an ordering of the eight slots. The two tetrads are {UFR, UBL, DFL, DBR} and its complement, not the top and bottom layers. Record the membership mask and permutation parity as you already do.\n\nPrecompute H once: start with the identity permutation of eight corners and close under the six face half-turn permutations. This gives '+group.size+' distinct permutations. For a state p compute key(p) = lexicographically smallest tuple (h[p[0]], …, h[p[7]]) over h in H. Relabel the occupants; do not apply h to the slot indices. Two states with the same key differ by a half-turn relabelling, so any common continuation brings both or neither into H on corners.\n\nFor each fixed mask and parity, enumerate the 4! × 4! assignments within the two tetrads, keep the 288 of that parity, and collect their distinct keys. Each orbit contains 96 assignments (only the identity fixes a labelled tuple), so there are three keys. Sort them and store the index 0, 1 or 2; map the solved key to 0 in its bucket if desired. At run time this is a table lookup alongside your edge slices, mask and parity. No search through full cube states or physical corner-twist sum is needed.'
    : '用角块排列 p 表示状态，p[槽位] 是占据该槽位的角块原编号。固定八个槽位的顺序。两个角四元组分别为 {UFR, UBL, DFL, DBR} 及其补集。保留已有的四元组归属掩码和排列奇偶性。\n\n离线从恒等排列出发，对六种面转 180° 的角排列做乘法闭包，得到 '+group.size+' 个排列 H。对每个 p，取所有 h∈H 下 (h[p[0]], …, h[p[7]]) 的字典序最小值作为键。h 作用于块编号。同键状态差一个半转群中的重标号；执行同一后续转序，两者的角排列会同时进入或同时无法进入 H。\n\n固定掩码，枚举两个四元组内部的 4! × 4! 种填法，按奇偶各有 288 种。每个键对应 96 种填法，因为只有恒等重标号能保持八个不同编号全部不变。每种奇偶恰好有三个键，排序后编号 0、1、2 即可。若希望复原值为零，可在复原态所在桶内把它的键排在首位。在线查询时，将编号与已有的棱切片、掩码及奇偶坐标一起使用，无须广搜完整魔方状态。';
}

// Unknown initial bit, one observer and no identity information on a signal.
// A participant may signal twice. Without one of them, the observer can see
// at most two signals from each remaining participant plus one initial bit.
function counterProtocol(question:string) {
  const population=question.match(/\b(\d{1,4}) (?:perfectly intelligent )?prisoners\b/i);
  if (!population || !/at random|randomly/i.test(question) || !/every day|each day|repeatedly/i.test(question)
    || !/all.{0,30}(?:entered|visited)/is.test(question) || !/cube/i.test(question)
    || !/solve it|solve the cube/i.test(question) || !/marker|tally|write/i.test(question)
    || !/plan|protocol|strategy/i.test(question)) return;
  const count=Number(population[1]);
  if (count<2) return;
  return {count,threshold:2*(count-1)};
}

function signalingProof(count:number,threshold:number,lang:Lang) {
  return lang==='en'
    ? 'Agree on one counter. Use solved as OFF and any unsolved cube as ON. The initial cube may be in either state. Each of the other '+(count-1)+' prisoners keeps a private tally in their own cell. On EVERY visit, if the cube is OFF and their tally is below two, make one face turn and add one to their tally on returning to the cell. Otherwise leave the cube alone; a blocked visit does not consume a signal. The counter alone clears ON, by letting the robot solve the cube, and records one point in their cell for each such reset. On seeing point '+threshold+', the counter can declare immediately.\n\nIf even one of the others had never visited, at most '+(threshold-2)+' genuine signals plus one initially ON cube could have been counted. That is less than '+threshold+', so the declaration is always safe. With independent uniform daily selection each prisoner returns infinitely often with probability one. Each outstanding signal eventually gets a turn on an OFF cube, the counter eventually clears it, and the threshold is reached with probability one. No marker leaves a cell.'
    : '约定一名计数员，把复原态当作关、任意未复原态当作开，初态任意。其余 '+(count-1)+' 人分别在自己的牢房里记已发送次数。每次进房，若信号关且自己发过不足两次，就转一面打开信号，回牢房记一次。其余情况不动，遇到已开也保留以后发送的机会。只有计数员清除信号：见开就让机器人复原，记一分。累计到 '+threshold+' 分即可当场宣布。\n\n若还有一人从未进入，真实信号至多 '+(threshold-2)+' 个，加上初态可能多出的一分也不足 '+threshold+'。因此不会误报。每天独立均匀抽人时，每人以概率一反复入房，每个尚待发送的信号最终都有机会发送并被清除，所以也以概率一达到阈值。记号笔始终留在各自牢房。';
}

// A checked explanation can stand alone for these single-purpose questions.
export async function closedMechanicalQuestion(question:string, lang:Lang) {
  const clean=question.trim().replace(/[?.？。]+$/u,'');
  if (/^(?:can (?:i|you|we) (?:uniquely |always )?(?:determine|reconstruct) (?:the |a )?(?:full |entire )?(?:state|configuration) of (?:a |the )?(?:2[x×]2(?:[x×]2)?|pocket cube)(?: cube)? (?:from|by (?:seeing|viewing)) (?:just |only )?three adjacent faces|只看二阶魔方的?三个相邻面[，, ]*能(?:否|不能)唯一确定(?:完整)?状态(?:吗)?)$/i.test(clean)) return pocketProjectionProof(lang);
  if (/^(?:can (?:i|you|we) swap (?:just|only) two (?:corners|pieces|centres|centers) (?:on|of) (?:a |the )?(?:3[x×]3|cube) and (?:a |the )?skewb(?: by (?:legal |face )?turns)?|三阶和斜转魔方能(?:否|不能)只交换两个(?:角块|中心块)(?:吗)?)$/i.test(clean)) return pieceSwapProof(lang);
}

// Reject affirmative, concrete claims contradicted by the validated model.
// Mixed requests can keep independent sections through the normal repair path.
export function contradictsMechanicsProof(question:string, answer:string) {
  if (counterProtocol(question) && /on (?:his |their )?first[- ]ever (?:entry|visit)/i.test(answer)
      && /on (?:every|all) later visits?[^.]{0,65}(?:nothing|never)/i.test(answer)) return true;
  if (/tetrad twist|四元组扭转/i.test(question)) {
    // Every corner in one tetrad differs from every other one in TWO axes.
    // Compare explicit four-corner sets independent of label or piece order.
    const descriptions=answer.split(/\n\s*\n/u).filter(part=>/tetrads?|四元组/i.test(part)
      && !/wrong|incorrect|misconception|rather than|not (?:a tetrad|the tetrads|the sets)|错误|并非/i.test(part));
    const groups=descriptions.join('\n').matchAll(/\b([UDFBRL]{3}(?:,\s*[UDFBRL]{3}){3})\b/g);
    for (const [list] of groups) {
      const labels=list.split(/,\s*/);
      if (!labels.every(s=>/[UD]/.test(s) && /[FB]/.test(s) && /[RL]/.test(s))) continue;
      const diagonals=labels.slice(1).every(s=>[...s].filter(face=>labels[0].includes(face)).length===1);
      if (!diagonals) return true;
    }
  }
  if (projectionSubject(question) && /(?:the |all |permute |permuting )(?:three|3) (?:completely |wholly )?hidden corner(?:s| cubies)|三个(?:完全)?隐藏角/i.test(answer)) return true;
  if (swapSubject(question)) {
    const sections=answer.split(/\n\s*\n/);
    return sections.some(s=>/skewb|斜转/i.test(s) && /(?:rotates?|cycles?|permutes?|moves?) (?:four|4) (?:corners? and (?:four|4) )?cent(?:res|ers)|(?:four|4)[- ]cycle of (?:skewb )?cent(?:res|ers)|四个中心.{0,4}循环/i.test(s));
  }
  return false;
}

// A commutator with the upper layer twists the adjacent front corners.
async function adjacentCornerWitness(question:string, lang:Lang) {
  if (!/(?:top[- ]front[- ]right|UFR|URF)(?: corner)? (?:clockwise|顺时针)/i.test(question)
      || !/(?:top[- ]front[- ]left|UFL|ULF)(?: corner)? (?:anti[- ]?clockwise|counter[- ]?clockwise|逆时针)/i.test(question)
      || !/without rearranging|everything else|other pieces|其余块/i.test(question)
      || /[24-9]\s*[x×]\s*\d|[二四五六七八九]阶/i.test(question)) return;
  // Florian F's corner commutator, https://puzzling.stackexchange.com/a/117520
  const word="R' D R F D F' U' F D' F' R' D' R U";
  const cube=await getCube3();
  const {CORNERS,EDGES}=cube.algToTransformation(word).transformationData;
  const faces=applyScramble(3,word);
  if (movedCount(CORNERS.permutation) || movedCount(EDGES.permutation) || EDGES.orientationDelta.some(Boolean)
      || CORNERS.orientationDelta.filter(Boolean).length!==2 || faces.R[0]!=='U' || faces.L[2]!=='U') return;
  const turns=word.split(' ').length;
  return lang==='en'
    ? 'For the specified adjacent UFR and UFL corners, `'+word+'` uses '+turns+' quarter-turns (also '+turns+' face turns). Looking at each corner from outside, UFR twists clockwise and UFL anticlockwise: their U stickers land on R and L respectively. The state check fixes every piece position, every edge orientation and the other six corner orientations. This is a verified upper bound; I have not established a shorter word or proved the minimum for this pair.'
    : '对于指定的相邻 UFR、UFL 两角，`'+word+'` 共 '+turns+' 个四分之一转，面转计数也是 '+turns+'。从各角外侧观察，UFR 顺扭、UFL 逆扭，它们的上贴纸分别转到右、左面。状态验证确认所有块位置、全部棱向和另六个角向不变。这给出可行上界，更短转序和全局最短步数尚未核实。';
}

// This supplies a separately checkable result, not blanket approval of the
// rest of a request (e.g. shortest, optimal, named practitioners or a source).
export async function communityMechanicsEvidence(question: string, lang: Lang): Promise<string|undefined> {
  const twist=await adjacentCornerWitness(question,lang);
  if (twist) return twist;
  const signaling=counterProtocol(question);
  if (signaling) return signalingProof(signaling.count,signaling.threshold,lang);
  if (/tetrad twist|四元组扭转/i.test(question) && /phase|stage|thistle|阶段/i.test(question)
      && /coordinat|calculat|compute|table|express|计算|坐标|查表/i.test(question)) return tetradCoordinateProof(lang);
  if (projectionSubject(question)) return pocketProjectionProof(lang);
  if (swapSubject(question)) return pieceSwapProof(lang);
  if (/\bJ[ab]?[- ]?perm|J[ab]?公式/i.test(question) && /logic|commutat|how.{0,40}works?|原理|交换子/i.test(question)) return checkedJPermExplanation(lang);
  if (/standard|ordinary|3\s*[x×]\s*3|标准三阶/i.test(question) && /arrows?|方向标记|箭头/i.test(question)
      && /cent(?:er|re)|中心/i.test(question) && /how many|distinct|多少种|多少个/i.test(question)
      && !/axis cube|mirror cube|二阶|四阶|[24-9]\s*[x×]\s*[24-9]/i.test(question)) return markedCentreCount(lang);
  if (/\bZZ\b/i.test(question) && /EOLine|EOCross/i.test(question) && /F2L/i.test(question)
      && /term for|name for|call it|what.{0,18}called|叫什么|名称/i.test(question)) {
    return lang==='en'?'EOLine orients all edges and solves DF and DB. To use ordinary CFOP-style pair insertion after EOLine, first finish the other two cross edges. If you complete all four cross edges during EO, the opening is called EOCross. With EOLine alone, “ZZ with CFOP-style F2L” describes the steps without implying EOCross.'
      :'EOLine 会定向所有棱并还原 DF、DB 两条底棱。接普通 CFOP 插槽前还需补齐另外两条底棱。若在定向时完成全部四条底棱，起手叫 EOCross。只做 EOLine 时，可以称作“ZZ 起手接 CFOP 式 F2L”。';
  }
  if (/n\s*[*×x]\s*n|任意阶/i.test(question) && /general|universal|regardless of n|通用|任意/i.test(question)) {
    const cube=await getCube3();
    const corners=(alg:string)=>cube.algToTransformation(alg).transformationData.CORNERS.permutation;
    const r=corners('R'), u=corners('U'), commutator=corners("R U R' U'");
    const outside=commutator.filter((piece,i)=>piece!==i && (r[i]===i || u[i]===i)).length;
    if (!outside) return;
    return lang==='en'?'For n greater than three, solve the centres in the correct colour arrangement, pair the wing orbits into complete edges, then solve the reduced 3×3. Handle last-edge pairing cases and, on even cubes, reduced OLL or PLL parity as needed. A 2×2 needs only the corners, a 3×3 uses an ordinary solve, and a 1×1 is already solved up to rotation. A commutator need not act only in the intersection: on a 3×3, checking `R U R′ U′` finds '+outside+' displaced corner positions outside the intersection of the R and U layers.'
      :'大于三阶时先按正确配色还原中心，再分轨道配齐各条组合棱，最后按三阶还原。配棱末尾可能有特殊情况，偶数阶降阶后还可能需要处理 OLL 或 PLL 特殊情况。二阶只需处理角块，三阶用常规解法，一阶允许整体转体时已经还原。交换子的作用范围可能超出两个操作的交集：三阶执行 `R U R′ U′` 后，交集外有 '+outside+' 个角位发生置换。';
  }
  if (!/cube|rubik|魔方|三阶|3\s*[x×]\s*3/i.test(question)) return;
  if (/\b(?:void|supercube|picture cube|pyraminx|megaminx|skewb|square[- ]?1)\b|(?:[245-9]|1\d)\s*[x×]\s*\d|[二四五六七八九]阶|空心|异形|中心.{0,3}朝向/i.test(question)) return;
  if (/alternat|交替/i.test(question) && /clockwise|顺时针/i.test(question)
    && /counter[- ]?clockwise|anti[- ]?clockwise|逆时针/i.test(question)
    && /quarter[- ]turn|12 standard moves|四分之一转|90\s*[°度]/i.test(question)) {
    const count=await alternatingCornerCount();
    return lang==='en'?'Not every ordinary 3×3 state is reachable with alternating clockwise and anticlockwise quarter turns. With either direction allowed first, a breadth-first enumeration of (corner permutation, next direction) reaches '+count+' distinct corner permutations out of 40,320 in a fixed frame. Start with solved corners and either next direction, apply each of the six turns in that direction, then switch direction. Missing corner permutations prove impossibility; testing a specific full state also requires its edge and orientation coordinates.'
      :'只交替使用顺、逆时针四分之一转时，不能到达普通三阶的全部状态。固定空间朝向，从两种起始方向分别出发，对“角块排列、下一步方向”逐层枚举，得到 '+count+' 种角排列，少于全部 40,320 种。每步尝试该方向的六种面转再切换方向。角排列已能证明不可全达；判断具体完整状态还须考虑棱和朝向。';
  }
  const pattern = patternWitness(question,lang);
  if (pattern) return pattern;
  if (/(?:three|3) (?:adjacent )?(?:sides|faces)|三(?:个)?(?:相邻)?面/i.test(question)
    && /hidden|visible|view|see|可见|看到|观察/i.test(question)
    && /reconstruct|determin|calculate|know|solvab|cannot be solved|确定|推断|能否还原/i.test(question)) {
    if (/reassembl|重新组装/i.test(question) && /cannot be solved|unsolvab|判.{0,5}无解/i.test(question)) {
      return lang==='en'?'Three visible adjacent faces cannot prove this intact, reassembled 3×3 unsolvable. A hidden corner can compensate total twist, a hidden edge can compensate total flip, and exchanging two hidden edges can correct permutation parity. The same view therefore admits a solvable completion.'
        :'在完整块、固定中心的三阶上，仅看三个相邻面不能断定重新组装的魔方无解。隐藏角可补角扭、隐藏棱可补翻转、互换两条隐藏棱可补置换奇偶，因此可见状态至少有一种可解补全。';
    }
    return lang==='en'?'Three adjacent faces do not determine the full state of an ordinary 3×3. With U, F and R visible, flipping the hidden DB and DL edges together preserves those faces and all three solvability constraints. The two legal states look identical from that angle.'
      :'只看标准三阶的三个相邻面无法唯一确定完整状态。例如从上、前、右看，同时翻转隐藏的底后棱与底左棱，三个可见面都不变，角扭、翻棱和置换奇偶约束也都满足。';
  }
  const repetition = /(?:many|[a-z]|some number of) times|repeat|repetition|iterat|over and over|cycle (?:length|of)|(?:longest|shortest) cycle|重复|反复|循环|周期/i.test(question);
  if (!repetition || !/moves?|algorithms?|sequence|turns?|转序|转法|公式|转动/i.test(question)) return;
  const algorithms=suppliedFaceTurns(question);
  // A requested cycle length is useful only with a witness at that order.
  const desired = question.match(/(?:cycle length|order|period) (?:of )?(\d{1,4})\b|(?:周期为|循环长度为)\s*(\d{1,4})/i);
  if (desired) {
    const target=Number(desired[1] ?? desired[2]);
    if (/whole[- ]cube|turning the cube upside down|whole (?:puzzle|cube) rotations?|整体转动|整块转体/i.test(question)
      && !/no (?:whole[- ]cube )?rotations|without (?:whole[- ]cube )?rotations|仅面转|禁止转体/i.test(question)) {
      // Inspect rigid symmetries separately; center colors change places in a
      // fixed spatial frame, while every face remains monochromatic.
      for (const motion of ['x','x2','x y']) {
        if (await colourCubeOrder(motion)!==target) continue;
        const label=motion==='x y' ? (lang==='en'?'a 120° rotation about a body diagonal':'绕体对角线整体转 120°') : '`'+motion+'`';
        return lang==='en'?'If rigid cube rotations are allowed, '+label+' is one physical motion. Its first return in a fixed spatial frame is after '+target+' repetitions (notation: `'+motion+'`).'
          :'允许整体转动时，'+label+'是一个连续动作；按固定空间朝向比较，首次回到起点需要 '+target+' 次（记号 `'+motion+'`）。';
      }
    }
    // Explore short two-face words in order of face-turn length. Consecutive
    // turns of the same face can always be combined into one.
    let frontier = [''];
    for (let depth=0; depth<4 && target>0 && target<=1260; depth++) {
      frontier = frontier.flatMap(prefix => ['', "'", '2'].map(suffix => (prefix+' '+(depth%2?'U':'R')+suffix).trim()));
      for (const candidate of frontier) {
        if (await colourCubeOrder(candidate)!==target) continue;
        return lang==='en'
          ? 'From solved, the face turns `'+candidate+'` first return after '+target+' complete repetitions. This is a verified example; searching these short two-face words does not prove global minimality.'
          : '从复原态做面转 `'+candidate+'`，首次回到起点需要完整重复 '+target+' 次。这是已验证的构造，搜索短的双面转序不能证明全局最短。';
      }
    }
  }
  if (/longest cycle|maximum (?:order|period)|最大.{0,4}(?:周期|阶)|最长.{0,4}循环/i.test(question)) algorithms.push("R U2 D' B D'");
  const counts = await Promise.all([...new Set(algorithms)].map(async alg=>'`'+alg+'` → '+await colourCubeOrder(alg)));
  const proof = lang==='en'
    ? 'Repeating a fixed sequence returns an ordinary cube to its starting position. The sequence is a permutation of finitely many states: if two iterates coincide, undo the earlier iterate to get a positive power equal to the identity. A scrambled start returns to that start; it need not pass through solved.'
    : '固定转序是有限状态上的置换，因此重复执行最终会回到起点：两次迭代状态相同时，撤销较早那次之前的共同转动，就得到一次正整数幂的恒等变换。从打乱态出发，回到的是该打乱态，途中未必经过复原态。';
  if (/any (?:valid )?scrambled|every (?:possible )?(?:starting )?(?:state|scramble)|任意打乱/i.test(question) && /iterat|repeat|periodic|重复|反复/i.test(question)) {
    const bound=lang==='en'?'For an ordinary 3×3, even allowing a stop in the middle, repeating an L-move word visits at most 1260L states, since the maximum element order is 1260. Compare this with 43,252,003,274,489,856,000 legal states.':'即使允许在转序中途停下，长度 L 的固定转序也最多访问 1260L 个状态（三阶群元素的最大阶为 1260），而标准三阶有 43,252,003,274,489,856,000 个合法状态。';
    return proof+' '+bound;
  }
  if (!counts.length) return proof;
  return (lang==='en'?'First return to the starting state (number of complete repetitions): ':'完整转序首次回到起点的重复次数为 ')+counts.join(', ')+'. '+proof;
}

// Prove the lower bound once using the same turn convention as the witness.
// The deepest level examined contains 12^3 short words.
let pocketQuarterTurnProof: boolean | undefined;
function shortestFourColourPattern() {
  const satisfies = (word:string) => Object.values(applyScramble(2,word)).every(face=>new Set(face).size===4);
  if (pocketQuarterTurnProof !== undefined) return pocketQuarterTurnProof;
  const quarterTurns = ['R','L','U','D','F','B'].flatMap(face=>[face,face+"'"]);
  let words = [''];
  for (let depth=0; depth<4; depth++) {
    if (words.some(satisfies)) {
      pocketQuarterTurnProof=false;
      return false;
    }
    if (depth<3) words=words.flatMap(prefix=>quarterTurns.map(move=>(prefix+' '+move).trim()));
  }
  pocketQuarterTurnProof=satisfies('L D2 B');
  return pocketQuarterTurnProof;
}

// Closed questions only. Each title, question or background sentence must be
// accounted for; a further request or a different move metric needs composition.
export function directCommunityProof(question:string, lang:Lang):string|undefined {
  const clauses=question.replace(/[’′]/g,"'").split(/[?？!！。\n]+|\.\s+|\.$/u)
    .map(part=>part.trim()).filter(Boolean);
  if (!clauses.length) return;
  const size2=/2\s*[x×]\s*2|二阶/i;
  const solved=/\bsolved\b|复原态|已还原|已复原/i;
  const quarters=/1\/4 turns?|quarter[- ]turns?|四分之一转|90\s*[°度]/i;
  const fourColours=/no face (?:will )?(?:have|has) two (?:tiles|stickers) of the same colou?r|four (?:different|distinct) colou?rs (?:on|per) (?:each |every )?face|每个?面.{0,6}(?:四种不同颜色|四色|颜色不重复)/i;
  if (size2.test(question) && solved.test(question) && quarters.test(question) && fourColours.test(question)
      && clauses.every(c=>/^(?:mix (?:a |the )?2x2 rubik's cube|\(?I do not have this puzzle's solution\.?\)?)$/i.test(c)
        || (/^(?:what is the (?:minimum|fewest)|how many|从|已复原|二阶)/i.test(c) && fourColours.test(c) && /(?:same colou?r|per face|each face|every face|四色|颜色不重复|四种不同颜色)$/i.test(c)
          && !/\band\b|only|except|without|using|must use|but|then|keep|preserv|restricted|clockwise|限制|只能|只能用|禁止|并且|另外|同时|以及|只用|[;；]/i.test(c)))) {
    if (!shortestFourColourPattern()) return;
    return lang==='en'
      ? 'The minimum is four quarter-turns. From solved, do `L D2 B`: the half-turn counts as two. The state check finds four different colours on each of the six faces. Exhausting all words of length zero through three over the twelve quarter-turns finds no qualifying state.'
      : '最少四个四分之一转。从复原态做 `L D2 B`，其中 D2 计两步。状态引擎逐面验证六面各有四种颜色，并枚举了十二种单面四分之一转组成的所有零至三步转序，均无解。';
  }
  const observation=/stickers?|facelets?|贴纸|色块/i;
  if (observation.test(question) && /scrambled position|position of everything|确定.{0,10}状态|重建.{0,10}状态/i.test(question)
      && clauses.every(c=>/^this is for a robotics solver using a real cube$/i.test(c)
        || (/^(?:minimum number|how many|最少|至少)/i.test(c) && observation.test(c)
          && !/\b(?:and|also|then|restricted|only|camera angles?|monochrome|unusual|unknown colou?r scheme)\b|2x2|[24-9]\s*[x×]|picture|supercube|illegal|disassembl|\band\b|using only|single (?:face|view)|[二四五六七]阶|拆|单面|[;；]/i.test(c)))) {
    return lang==='en'
      ? 'For a legal, standard 3×3 with a known colour scheme and centre frame, 36 individual sticker readings suffice. Read two stickers in a fixed clockwise order on each of seven corners: the ordered colour pair identifies the corner and its twist. The remaining corner is forced by elimination and the total-twist rule. Read both stickers of eleven edges; the remaining edge and its flip follow by elimination and the even-flip rule. If the centre frame is unknown, read two adjacent centres first (38 readings). With a known frame, at least 26 readings are necessary: 25 six-colour observations cannot distinguish all 43,252,003,274,489,856,000 states. These bounds do not establish the exact optimum.'
      : '对于配色与中心朝向已知的合法标准三阶，读 36 张贴纸一定够。对七个角各按固定环向读两色，有序色对确定角块及扭向；最后一角由排除法和角扭总和确定。十一条棱各读两色，最后一棱由排除法及翻棱偶性确定。若中心朝向未知，先多读两个相邻中心，共 38 张。已知中心时至少要读 26 张，因为六色观测的 25 次结果不足以区分全部 43,252,003,274,489,856,000 个状态。这给出了上下界，精确最小值仍未证明。';
  }
}

// Keep sufficiently specified stand-alone questions entirely local. A second
// clause (e.g. a proof, a link or a requested move metric) goes to composition.
// Mathematical examples such as F(U,R) name arguments to an order
// function. They are not an attempt to execute parenthesized cube notation.
export async function functionOrderExamples(question:string,lang:Lang) {
  if (!/order|repetitions?|how many times|周期|重复/i.test(question) ||
      !/sequence|algorithm|转序/i.test(question) || !/function|函数|算法/i.test(question) ||
      /supercube|marked cent|图案中心|[24-9]\s*[x×]|shortest|最短/i.test(question)) return;
  const examples=[...question.replace(/[’′]/g,"'").matchAll(/\b[A-Za-z]\(\s*([URFDLB]['2]?(?:\s*,\s*[URFDLB]['2]?){1,19})\s*\)/g)]
    .map(match=>match[1].replace(/\s*,\s*/g,' '));
  const words=[...new Set(examples)];
  if (!words.length || words.length>8) return;
  const cube=await getCube3();
  const descriptions=[];
  for (const word of words) {
    const transform=cube.algToTransformation(word).transformationData;
    const cycles:number[]=[];
    for (const [orbit,mod] of [['CORNERS',3],['EDGES',2]] as const) {
      const {permutation,orientationDelta}=transform[orbit];
      const seen=new Set<number>();
      for (let i=0;i<permutation.length;i++) {
        if (seen.has(i)) continue;
        let j=i,twist=0,length=0;
        do { seen.add(j);twist+=orientationDelta[j];length++;j=permutation[j]; } while(j!==i);
        const period=length*(twist%mod===0?1:mod);
        if (period>1) cycles.push(period);
      }
    }
    const order=await colourCubeOrder(word);
    descriptions.push('`'+word+'` → lcm('+cycles.join(', ')+') = '+order+(lang==='en'?' repetitions, ':' 次，')+order*word.split(' ').length+(lang==='en'?' face turns.':' 步面转。'));
  }
  const method=lang==='en'?'For an ordinary 3×3, label the 48 moving facelets, apply the input sequence once, decompose the resulting permutation into cycles and return the least common multiple of their lengths (1 for the identity). This includes twists and flips. Equivalently, each corner or edge cycle contributes its length times the order of its net orientation change. The independently checked cycle contributions are below. There is no general relation to powers of four: composing quarter turns need not give an order divisible by four.':'普通三阶可给 48 张活动贴纸编号，执行一次输入转序，分解所得置换的循环并求循环长度的最小公倍数，恒等转序为 1。这样已包含扭角和翻棱。按块计算时，每条循环的长度要乘上净朝向变化的周期。它与四的幂没有普遍关系，四分之一转的组合不一定有四的倍数周期。';
  return [method,...descriptions].join('\n\n');
}

export async function directOrderAnswer(question: string, lang: Lang) {
  const normalized = question.trim().replace(/[′’]/g,"'");
  const english = /^(?:on (?:a |the )?(?:standard )?3[x×]3(?: cube)?,?\s*)?(?:what(?:'s| is) the (?:order|period|cycle length) of|how many (?:times|repetitions) (?:do I (?:repeat|apply)|does it take (?:to repeat|for)))\s+`?([URFDLB2' ]{1,80}?)`?(?:\s+(?:on (?:a |the )?(?:standard )?(?:3[x×]3(?: cube)?|rubik's cube)|to (?:return to (?:the )?(?:start|solved)|restore the cube)))?[?.!]*$/i;
  const chinese = /^(?:标准)?(?:三阶魔方|三阶)上?[，, ]*\s*`?([URFDLB2' ]{1,80}?)`?\s*(?:的周期(?:是多少)?|重复多少次(?:回到起点|复原))[？?。]*$/;
  const match = english.exec(normalized) ?? chinese.exec(normalized);
  if (!match || !/^(?:[URFDLB](?:2|')?\s*)+$/.test(match[1])) return;
  const alg=match[1].match(/[URFDLB](?:2|')?/g)!.join(' ');
  const order=await colourCubeOrder(alg);
  return lang==='en'?'The period of `'+alg+'` is '+order+' on a standard colour 3×3. This is the first positive repetition count that restores the starting state.'
    :'在标准六色三阶上，`'+alg+'` 的周期是 '+order+'，即首次回到起点的完整重复次数。';
}

// Check affirmative, explicitly delimited period claims. Text without an
// identifiable sequence and a single asserted period stays with the composer.
export async function conflictingCubePeriod(answer: string) {
  const normalized=answer.replace(/[′’]/g,"'");
  const claims=normalized.matchAll(/(?:^|[\n.!?。]\s*|\n\s*[-*]\s+)`?([URFDLB](?:2|')?(?:\s*[URFDLB](?:2|')?){0,39})`?\s*(?:has (?:an? )?(?:order|period)(?: of)?|的周期(?:为|是))\s*(\d{1,5})\b/g);
  for (const match of Array.from(claims).slice(0,8)) {
    const alg=match[1].match(/[URFDLB](?:2|')?/g)!.join(' ');
    if (await colourCubeOrder(alg)!==Number(match[2])) return true;
  }
  return false;
}

// Generated examples can be checked even when the visitor supplied no algorithm.
// Only interpret literal outer-face turns and the explicit, solved-start colour goal.
export function checksPocketColourWitness(question:string) {
  return /2\s*[x×]\s*2|二阶/i.test(question)
    && /\bsolved\b|复原态|已还原|已复原/i.test(question)
    && /four (?:distinct |different )?colou?rs|no (?:face|side).{0,60}(?:same|repeated) colou?r|每个?面.{0,12}(?:四色|不同颜色|颜色不重复)/i.test(question);
}
export function invalidPocketColourWitness(answer:string,lang:Lang) {
  for (const paragraph of answer.split(/\n+/u)) {
    if (/counterexample|does not|doesn't|fails|不能|未达到|反例/i.test(paragraph)) continue;
    const claims=paragraph.matchAll(/(?:[Ff]rom solved,? (?:do |apply |use )?|(?:[Oo]ne (?:construction|solution)|[Tt]ry|[Uu]se|[Aa]pply|[Dd]o|i\.e\.|解法|从复原态做|执行)\s*[:：]?\s*)(?:[*`]{0,2})([URFDLB](?:2|['′’])?(?:\s*[URFDLB](?:2|['′’])?){1,39})(?:[*`]{0,2})(?=\s*(?:[.。!！]|$))/g);
    for (const match of claims) {
      const word=match[1].replace(/[′’]/g,"'").match(/[URFDLB](?:2|')?/g)!.join(' ');
      const faces=Object.values(applyScramble(2,word));
      if (faces.every(face=>new Set(face).size===4)) continue;
      return lang==='en'?'Checking `'+word+'` from solved leaves repeated colours on at least one face. This sequence does not achieve four colours on every face.'
        :'从复原态验证 `'+word+'` 后，至少有一面仍有重色，因此该转序未达到六面各有四种颜色的目标。';
    }
  }
}

// A single generator and its inverse span only its cyclic subgroup. Compute
// its size from the supplied word rather than relying on a named algorithm.
export function generalSolveCommutator(question:string) {
  if (question.length>360 || !/solv|复原|还原/i.test(question) ||
      !/only|solely|只用|仅用/i.test(question) || !/commutator|交换子/i.test(question) ||
      /rotat|conjugat|multiple|换面|共轭|[24-9]\s*[x×]|this (?:scramble|state|position)|given (?:scramble|state)|from (?:the )?solved|starting (?:state|from)|打乱为|给定局面|从复原态/i.test(question)) return;
  if (!/solv(?:e|ing)\s+(?:an? |any |every |the |all |arbitrary |legal |standard |scrambled )*(?:3\s*[x×]\s*3|cube|rubik)|(?:还原|复原).{0,10}(?:任意|三阶|魔方)/i.test(question)) return;
  const groups=[...question.replace(/，/g,',').matchAll(/\[([^\[\]]*)\]/g)];
  if (/\b(?:if|unless|except|also|my scramble|already solved|particular (?:state|position))\b|如果|除非|已经复原|另外|同时/i.test(question)) return;
  if (groups.length!==1 || !/^[URFDLB'’′2\s]+,[URFDLB'’′2\s]+$/.test(groups[0][1])) return;
  const alg=groups[0][0].replace(/[′’]/g,"'");
  const operands=alg.slice(1,-1).split(',').map(word=>word.trim());
  if (!operands.every(word=>/^(?:[URFDLB]['2]?\s*){1,10}$/.test(word))) return;
  return alg;
}

export async function singleCommutatorSolve(alg:string,lang:Lang) {
  const order=await colourCubeOrder(alg);
  return lang==='en'?'No. With the faces held fixed, repeating '+alg+' (including its inverse) reaches only its cyclic subgroup. Its checked order on a standard 3×3 is '+order+', so only '+(order===1?'one state is':order+' states are')+' reachable from solved. Each commutator has even corner permutation: the signs of its factors and inverses cancel. A single quarter turn gives a legal state with odd corner permutation, which these repetitions cannot solve.':'不能。固定参照系，重复 '+alg+' 或其逆只能遍历一个循环子群。三阶状态引擎算出的周期为 '+order+'，从复原态只能到达 '+order+' 个状态。交换子的角排列为偶置换，而单面四分之一转就能产生合法的奇角排列局面。';
}

export function threeFaceBlindSolve(question:string,lang:Lang) {
  if (question.length>950 || !/blind|盲拧/i.test(question) ||
      !/unmodified|solvable|legal|3\s*[x×]\s*3|合法|三阶/i.test(question) ||
      /(?:[24-9]|\d{2,})\s*[x×]|[二四五六七八九十]阶|pocket|supercube|additional (?:photo|view)|多张照片/i.test(question)) return;
  const named=/\b([URFLDB])\s*(?:[,，、/]|和)\s*([URFLDB])\s*(?:[,，、]\s*(?:and\s+)?|and\s+|\/|和)\s*([URFLDB])\b/.exec(question);
  if (named && !/(?:see|seen|visible|view|looking|observ|shown|看|观察|见)/i.test(question)) return;
  if (/number of (?:possible |hidden )?states|how many (?:states|positions)|known scramble|only (?:the )?last layer|给定打乱|局面数|多少种/i.test(question)) return;
  if (named && new Set(question.match(/\b[URFLDB]\b/g)).size===3 && new Set(named.slice(1)).size===3) {
    const visible=named.slice(1);
    const hidden=['DB','DL','BL','DR','BR','DF','FL','FR','UB','UL','UR','UF']
      .filter(edge=>[...edge].every(face=>!visible.includes(face)));
    const pair=hidden.slice(0,2);
    return lang==='en'
      ? 'No. With '+visible.join(', ')+' visible on an otherwise unknown legal 3×3, the hidden edges are '+hidden.join(', ')+'. From any compatible state, flip the two edges at '+pair.join(' and ')+'. All visible stickers stay identical. Two flips preserve edge-flip parity without changing any permutation or corner, so both states are reachable. A blind solution is invertible and cannot solve both.'
      : '不能。对其余信息未知的合法三阶，观察 '+visible.join('、')+' 面时，完全隐藏的棱是 '+hidden.join('、')+'。把其中 '+pair.join('、')+' 两条棱同时翻向，可见贴纸完全相同。偶数条棱翻向仍然合法，排列和角块也不变。同一盲拧转序可逆，无法同时解开这两种局面。';
  }
  if (named || !/three (?:mutually )?adjacent (?:sides|faces)|三个相邻面|三个互相相邻的面/i.test(question)) return;
  return lang==='en'?'No initial view of three adjacent faces uniquely determines an otherwise unknown legal 3×3. Call the visible faces U, F and R. The DB, DL and BL edge positions are entirely hidden. From any compatible state, flip the two edges at DB and DL. Two flips preserve even edge-flip parity; all permutations and corners are unchanged, so the second state is also reachable by legal turns and looks identical on every visible sticker. Any fixed blind solution is invertible and can solve at most one of those two states. Even three apparently solved faces leave this ambiguity. Further information would have to distinguish the hidden states.':'只观察三个相邻面，无法唯一确定未知合法三阶。把可见面记作 U、F、R，DB、DL、BL 三条棱完全不可见。从任何符合观察的局面把 DB 和 DL 两条棱同时翻向，棱翻转数仍为偶数，排列和角块都不变，因此另一个局面也能经过合法转动得到，三个可见面完全一样。同一盲拧转序可逆，不可能同时解开这两个局面。';
}
