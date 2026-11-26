import { puzzles } from 'cubing/puzzles';
import { getCube3 } from '@cuberoot/shared/recon/cube3';
import { EDGE_STICKERS } from '@cuberoot/shared/recon/sticker-tables';

const edges = EDGE_STICKERS.map(pair => pair.map(i => 'URFLBD'[i]).join(''));
const names: Record<string,string> = { up:'U', top:'U', down:'D', bottom:'D', front:'F', back:'B', left:'L', right:'R' };
const literal = /(?<![\w'])(?:[URFDLBMES](?:2|')?[ \t]*){3,}(?![\w'])/g;
const normal = (s:string) => s.replace(/[’′]/g,"'");
const inverse = (s:string) => s.split(' ').reverse().map(m => m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m+"'").join(' ');
type Lang = 'en'|'zh';

function edgeGoal(question:string) {
  if (!/(?:cycl|rotat|轮换|循环).{0,55}(?:edges?|棱|mini.?cubes?)|(?:edges?|棱).{0,55}(?:cycl|rotat|循环)/is.test(question)) return;
  const positions = question.replace(/\b(up|top|down|bottom|left|right|front|back)[ -](up|top|down|bottom|left|right|front|back)\b/gi,
    (_,a:string,b:string)=>names[a.toLowerCase()]+names[b.toLowerCase()]);
  const slots = [...new Set([...positions.matchAll(/\b([UDFBLR]{2})\b/g)].map(m => edges.findIndex(s=>s===m[1] || s===m[1][1]+m[1][0])).filter(i=>i>=0))];
  if (slots.length===3) return slots;
  if (slots.length || !/last.{0,12}(?:3|three) edges|[3三]条?顶棱/i.test(question) || !/last layer.{0,8}top|顶层/i.test(question)) return;
  const fixed = /(?:correctly positioned|solved|fixed|已复原).{0,22}(front|back|right|left|正面|后面|右面|左面)/i.exec(question);
  if (fixed) return [0,1,2,3].filter(i=>i!==({front:0,right:1,back:2,left:3,正面:0,右面:1,后面:2,左面:3}[fixed[1].toLowerCase()]));
}

function unchanged(p:readonly number[]) { return p.every((piece,i)=>piece===i); }

async function cycleEffect(word:string, slots:number[]) {
  const cube=await getCube3();
  const {EDGES,CORNERS,CENTERS}=cube.algToTransformation(word).transformationData;
  if (!unchanged(CENTERS.permutation) || !unchanged(CORNERS.permutation) || CORNERS.orientationDelta.some(Boolean)
    || EDGES.orientationDelta.some(Boolean) || !EDGES.permutation.every((piece,i)=>(piece!==i)===slots.includes(i))) return;
  const first=slots[0], second=EDGES.permutation.indexOf(first);
  return [first,second,EDGES.permutation.indexOf(second)].map(i=>edges[i]);
}

// Derive alternate grips by relabelling face turns, then simulate in the
// visitor's fixed frame. No puzzle search or pruning tables are needed.
function rotations() {
  const frames=['URFDLB'];
  for (const frame of frames) for (const indices of [[2,1,3,5,4,0],[0,5,1,3,2,4]]) {
    const next=indices.map(i=>frame[i]).join('');
    if (!frames.includes(next)) frames.push(next);
  }
  return frames;
}

export async function checkedMoveGoal(question:string,lang:Lang) {
  if (/\b(?:void|skewb|picture cube|square[- ]?1|megaminx)|异形|超魔方/i.test(question)) return;
  if (/\b(?:only (?:use|using)|without (?:using|turning)|shortest possible|prove minimal)|只能用|只用|限用|禁用|最少步/u.test(question.toLowerCase())) return;
  const supplied=normal(question);
  if (/2\s*[x×]\s*2|二阶/i.test(question) && /swap.{0,20}(?:opposite|diagonal) corners|对角.{0,6}(?:互换|交换)/i.test(question)
    && !/3\s*[x×]\s*3|三阶|without|except|除外/i.test(question)) {
    const word="F R U' R' U' R U R' F' R U R' U' R' F R F'";
    const cube=await puzzles['2x2x2'].kpuzzle();
    const {permutation,orientationDelta}=cube.algToTransformation(word).transformationData.CORNERS;
    if (permutation.every((piece,i)=>piece===(i===0?2:i===2?0:i)) && !orientationDelta.some(Boolean)) {
      const answer=lang==='en'?'Hold the affected face on top with the diagonal pair at UFR and UBL. This Y-perm swaps precisely those two corners on a 2×2 and preserves their orientations: \`'+word+'\`. A single corner swap is legal on a 2×2. If the corners are also twisted, the swap alone leaves those twists; the two twists must cancel modulo three. Which way do their U-colour stickers face?'
        :'把目标面朝上，使对角两块位于右前上和左后上。二阶上这条 Y-perm 仅交换这两块并保持朝向：\`'+word+'\`。二阶上单独对换两个角块合法。若两角还带扭向，交换后仍需处理，两者扭向之和必须为零（模三）。这两个角的顶色贴纸现在各朝哪一面？';
      return {answer,words:[word],pocket:true};
    }
  }
  const words=[...supplied.matchAll(literal)].map(m=>m[0].trim().replace(/\s/g,''));
  if (/name for|(?:algorithm|sequence).{0,30}(?:called|name)|公式.{0,12}(?:名称|叫什么)/i.test(question) && words.length===1
      && words[0]==="RUR'URU2R'" && !/(?:[245-9]x[245-9]|[二四五六七]阶)/i.test(question)) {
    const cube=await getCube3();
    const word="R U R' U R U2 R'";
    if (cube.defaultPattern().applyAlg(word).isIdentical(cube.defaultPattern().applyAlg(words[0].match(/[URFDLB](?:2|')?/g)!.join(' ')))) {
      return {answer:lang==='en'?'This sequence is Sune: `'+word+'`. It is used to orient last-layer corners.':'这条转序是 Sune（小鱼）：`'+word+'`，用于调整顶层角块朝向。', words:[word]};
    }
  }
  const slots=edgeGoal(question);
  if (!slots || (/[245-9]\s*[x×]\s*[245-9]|[二四五六七八九]阶/i.test(question) && !/same as the 3|降阶|已配棱/i.test(question))) return;
  const seeds=["R U' R U R U R U' R' U' R2","R L' U2 R' L F2"];
  for (const frame of rotations()) for (const seed of seeds) {
    const word=seed.replace(/[URFDLB]/g,c=>frame['URFDLB'.indexOf(c)]);
    if (/never.{0,18}back face|without.{0,15}back face|不转后面/i.test(question) && word.includes('B')) continue;
    const cycle=await cycleEffect(word,slots);
    if (!cycle) continue;
    const reverse=inverse(word);
    const opposite=await cycleEffect(reverse,slots);
    if (!opposite) continue;
    return {answer:lang==='en'
      ? 'Keep the cube in the stated frame. For '+cycle.join(' → ')+' → '+cycle[0]+', use `'+word+'`. For '+opposite.join(' → ')+' → '+opposite[0]+', use its inverse `'+reverse+'`. Both sequences preserve all corners, all other edges and every piece orientation on the ordinary or reduced 3×3.'
      :'固定所述朝向。'+cycle.join(' → ')+' → '+cycle[0]+' 用 `'+word+'`；反向 '+opposite.join(' → ')+' → '+opposite[0]+' 用逆序 `'+reverse+'`。两条转序均已验证保持其他棱、所有角块和各块朝向，适用于普通或已降阶的三阶状态。',words:[word,reverse],slots};
  }
}

export async function conflictsWithMoveGoal(answer:string, goal:NonNullable<Awaited<ReturnType<typeof checkedMoveGoal>>>) {
  if (goal.pocket) {
    if (/must be even|(?:single|isolated).{0,45}(?:impossible|not (?:a )?legal)|角置换.{0,8}必须为偶|单独.{0,8}不可能/i.test(answer)) return true;
    const cube=await puzzles['2x2x2'].kpuzzle();
    const target=cube.algToTransformation(goal.words[0]);
    for (const match of normal(answer).matchAll(literal)) {
      if (/^[UD][FRBL][FRBL]$/.test(match[0].trim())) continue;
      const word=match[0].trim().match(/[URFDLBMES](?:2|')?/g)!.join(' ');
      try { if (!cube.algToTransformation(word).isIdentical(target)) return true; } catch { return true; }
    }
    return false;
  }
  if (!goal.slots) return /(?:no (?:standard|established|universally)|not (?:the |a )?(?:standard |canonical )?sune|不是.{0,4}小鱼|没有.{0,6}(?:名称|名字))/i.test(answer);
  for (const match of normal(answer).matchAll(literal)) {
    const word=match[0].trim().match(/[URFDLBMES](?:2|')?/g)!.join(' ');
    if (!goal.words.includes(word) && !await cycleEffect(word,goal.slots)) return true;
  }
  return false;
}
