import {applyScramble,toFaceletString} from '@cuberoot/shared/timer/reconstruct/state';

type Lang = 'en'|'zh';
const faceOrder='URFDLB';
const facesAfter=(word:string)=>toFaceletString(applyScramble(3,word)).match(/.{9}/g)!;

// Recognise an NxN puzzle size, but not arithmetic such as 9 × 6 stickers.
function differentPuzzle(q:string) {
  return [...q.matchAll(/\b(\d+)\s*[x×]\s*\1\b/gi)].some(match=>Number(match[1])!==3)
    || /supercube|picture cube|[二四五六七八九十]阶/i.test(q);
}

// Translation and all eight symmetries of the square identify a free polyomino.
function shapeKey(cells:number[]) {
  const forms:string[]=[];
  for (const transpose of [false,true]) for (const sx of [-1,1]) for (const sy of [-1,1]) {
    const points=cells.map(i=>[sx*(transpose?Math.floor(i/3):i%3),sy*(transpose?i%3:Math.floor(i/3))]);
    const x=Math.min(...points.map(p=>p[0])), y=Math.min(...points.map(p=>p[1]));
    forms.push(points.map(p=>(p[0]-x)*3+p[1]-y).sort().join(','));
  }
  return forms.sort()[0];
}

export function faceComponents(face:string) {
  const seen=new Set<number>(), components:{area:number;shape:string}[]=[];
  for (let i=0;i<9;i++) {
    if (seen.has(i)) continue;
    const group=[i];seen.add(i);
    for (const cell of group) for (const next of [cell-3,cell+3,cell-1,cell+1]) {
      if (next<0 || next>=9 || Math.abs(cell%3-next%3)+Math.abs(Math.floor(cell/3)-Math.floor(next/3))!==1
          || seen.has(next) || face[next]!==face[i]) continue;
      group.push(next);seen.add(next);
    }
    components.push({area:group.length,shape:shapeKey(group)});
  }
  return components;
}

function polyominoProof(q:string,lang:Lang) {
  if (/without|restricted to|only (?:using|turning)|one.sided|fixed polyomino|禁止|只用|单面多格/i.test(q)) return;
  const max=/distinct free polyomino|不同的自由多格骨牌/i.test(q) && /most|maximum|最多/i.test(q);
  const partition=/tetromino|四格骨牌/i.test(q) && /pentomino|五格骨牌/i.test(q) && /each face|every face|每面/i.test(q);
  if (!max && !partition) return;
  const word=max?"L2 D2 B2 D B2 R2 D R2 D' R2 B2":'R L U2 F2 R L';
  const faces=facesAfter(word), groups=faces.map(faceComponents);
  if (max ? new Set(groups.flat().map(g=>g.shape)).size!==12 : !groups.every(gs=>gs.map(g=>g.area).sort().join(',')==='4,5')) return;
  const en=lang==='en';
  const witness=(en?'From solved, apply ':'从复原态执行 ')+ '`'+word+'`. '+(en?'Faces in URFDLB order: ':'按 URFDLB 顺序的六面为 ')+faces.join(' / ')+'.';
  if (!max) return (en?'Yes. ':'可以。')+witness+(en?' On each face the two colours form connected regions of four and five stickers respectively (edge adjacency only).':'每面两种颜色分别连成四格和五格，计数只沿公共边。');
  const bound=en?'To bound distinct shapes, let n be the number of centres in components of at most three cells. There are four free shapes of sizes 1–3. At most 6−n larger components contain a centre. Off-centre components follow the eight-cell perimeter: at sizes 4–5 they give only L, U or V up to symmetry. Each size ≥6 leaves a small centre component on its face, so there are at most n of those. This bounds the total by 13. Equality would require all centred larger shapes to differ and an off-centre U. Each off-centre large component also leaves at most three stickers of its colour elsewhere, including its centre. Equality therefore pairs every small centre both with a large component on its face and with one of its colour. The U is medium, so the centres on its face and of its colour must both be in larger components. The U uses three edge stickers and two corners. In each case the only four cells available are the centre, one edge and two corners, which must form a T to connect. These are distinct centres with the same shape, ruling out 13.'
    :'设有 n 个中心位于不超过三格的色块中。面积 1–3 只有四种自由形；含中心的大于三格的色块最多 6−n 个。其余色块沿八格外圈相连，面积 4–5 只有 L、U、V 三种，面积至少 6 的每个都在同面留下小中心块，最多 n 个。合计上界 13。要取等，所有较大中心块都必须不同，且出现外圈 U。外圈大块也会给同色中心留下至多三格，因此取等时每个小中心既与同面大块配对，也与同色大块配对。U 不是大块，它所在面和它同色的两个中心块都至少有四格；U 用掉三个棱贴和两个角贴，各自只剩中心、一棱、两角，连起来均只能是 T。两个中心块重形，故不能达到 13。';
  return (en?'The maximum is 12. ':'最多 12 种。')+witness+' '+bound;
}

export function halfTurnConstruction(q:string,lang:Lang) {
  if (differentPuzzle(q) || /shortest|minimum number of moves|optimal solution|without|except|at most|only (?:use |using )?[URFDLB]\b|最短|禁用|最多/i.test(q)) return;
  if (!/only (?:double.moves|half.turns)|只用(?:半转|双转)/i.test(q) || !/H.perm|H 置换|H置换/i.test(q)) return;
  const setup=/\b(?:apply|use) the move sequence\s+([MU'2\s]+)(?=\s*\()/i.exec(q)?.[1]?.trim();
  if (!setup || !/^M2(?:\s+[UM]2?)+$/.test(setup)) return;
  const word='R2 U2 R2 U2 R2 F2 R2 U2 F2 U2 R2 F2';
  if (facesAfter(setup).every(f=>new Set(f).size===1) || !facesAfter(setup+' '+word).every(f=>new Set(f).size===1)) return;
  return (lang==='en'?'Yes. From the stated setup ':'可以。从题给局面 ')+'`'+setup+'`'+(lang==='en'?' apply ':' 执行 ')+'`'+word+'`.'+
    (lang==='en'?' Every move is an outer-face half turn. Applying the setup and this solution in order restores all 54 stickers to six uniform faces.':' 每一步均为外层半转。将初始转序和解法依次执行后，54 枚贴纸全部回到六面纯色。');
}

function assemblyProbability(q:string,en:boolean) {
  if (!/probability|概率/i.test(q) || !/blindfold|random|随机|蒙眼/i.test(q)) return;
  const stickers=/(?:54 stickers|54\s*[枚张]?贴纸)/i.test(q) && /9 (?:pieces |stickers )?per colou?r|每色\s*9/i.test(q);
  if (stickers) {
    const factorial=(n:number)=>{
      let result=1n;
      for (let i=2;i<=n;i++) result*=BigInt(i);
      return result;
    };
    const assignments=factorial(54)/factorial(9)**6n;
    const reachable=factorial(12)*factorial(8)*2n**11n*3n**7n/2n;
    const probability=(schemes:bigint)=>(Number(schemes*reachable)/Number(assignments)).toExponential(4);
    return en?'Assume every assignment of nine stickers of each colour is equally likely. There are 54!/(9!)⁶ assignments. For a fixed assignment of six centre colours, 12!·8!·2¹¹·3⁷/2 states are reachable (edge flips, corner twists and matching permutation parity). If any six-colour solved scheme is allowed, multiply by 6!, giving probability ≈ '+probability(720n)+'. If you require one conventional colour scheme up to rotation, replace 6! by 24; for six prescribed face colours use 1 (probability ≈ '+probability(1n)+').'
    :'假设每色九枚贴纸的分配等可能，共有 54!/(9!)⁶ 种。固定六个中心颜色时，由棱翻、角扭和排列奇偶约束可达 12!·8!·2¹¹·3⁷/2 种。若任意六色配置都算复原，乘以 6!，概率约为 '+probability(720n)+'；若要求指定配色但允许整体转动则改乘 24，若六面颜色均指定则乘 1，概率约为 '+probability(1n)+'。';
  }
  if (!/(?:disassembled|detachable|reassembl|拆散|散件|拆卸)/i.test(q) || !/corners?|角块/i.test(q) || !/edges?|棱块/i.test(q)) return;
  const detached=/detachable cent(?:er|re)s|(?:centers?|centres?) (?:are |can be )?(?:detached|removable)|中心(?:可拆|也随机)/i.test(q);
  if (!detached && !/fixed cent(?:er|re)s|中心固定/i.test(q)) return;
  const base=en?'With uniformly and independently assembled pieces, edge flips sum to zero mod 2, corner twists sum to zero mod 3, and edge/corner permutation parity must match. These three independent conditions give 1/12 for compatible centres.':'假设散件均匀随机安装，棱翻总和须为偶数，角扭之和须为 0（模 3），且角棱排列奇偶相同。三个独立条件给出中心配置相容时的概率 1/12。';
  return base+(detached?(en?' The original corner colours fix the handed colour scheme. Only 24 of 6! centre arrangements are its spatial rotations, so the overall probability is (24/720)/12 = 1/360 (about 0.278%).':' 角块配色确定了原配色的手性。可拆中心的 6! 种排列中只有 24 种是其整体旋转，总概率为 (24/720)/12 = 1/360，约 0.278%。'):'');
}

export function cubeConstruction(q:string,lang:Lang) {
  if (!/rubik|3\s*[x×]\s*3|三阶|魔方/i.test(q) || differentPuzzle(q)) return;
  if (/ghost cube/i.test(q) && /two corners|swap.{0,28}corners|两角|交换角块/i.test(q) && /diagonal|对角/i.test(q)) {
    return lang==='en'?'On a normally assembled Ghost Cube, the edge and corner permutations have the same parity. A lone diagonal corner swap cannot be solved by turns with every other piece fixed. Several pieces have very similar outlines: check the triangular corner pair and the similar corner–edge–corner groups. Feel along each seam and align every surface flush. A second misplaced pair can make the apparent two-corner swap legal. Photographs of all six faces would distinguish the possibilities on your particular cube.'
      :'若 Ghost Cube 安装正常，角与棱的排列奇偶性相同；其余块全对时，仅一对对角角块互换无法通过转动解决。先摸接缝是否平齐，检查形状相近的三角形角块，以及相似的角–棱–角组合。另一对放错会改变判断；需要六面照片才能定位具体块。';
  }
  const year=/why do (?:rubik.s cube fans|cubers) (?:love|like) (?:the year )?(\d{4})[?？]/i.exec(q);
  if (year) {
    const target=Number(year[1]);
    for (let start=2;start**3<target;start++) {
      const terms:number[]=[];let sum=0;
      for (let n=start;sum<target;n++) {terms.push(n);sum+=n**3;}
      if (sum===target && terms.length>=2) {
        const identity=terms.map(n=>n+'³').join(' + ')+' = '+target;
        return lang==='en'?'One cubing pun is that the year is a sum of consecutive perfect cubes: '+identity+'.':'一种解释是年份恰好等于一串连续整数的立方和：'+identity+'。';
      }
    }
  }
  if (/polyomino|tetromino|pentomino|格骨牌/i.test(q)) return polyominoProof(q,lang);
  return assemblyProbability(q,lang==='en') ?? surfaceConstruction(q,lang==='en') ?? halfTurnConstruction(q,lang);
}

// Coordinates use x right, y up, z front. Orient rows as in a URFDLB
// facelet string; shared vertices detect contacts across face boundaries too.
const frames=[
  [[0,1,0],[1,0,0],[0,0,1]], [[1,0,0],[0,0,-1],[0,-1,0]],
  [[0,0,1],[1,0,0],[0,-1,0]], [[0,-1,0],[1,0,0],[0,0,-1]],
  [[-1,0,0],[0,0,1],[0,-1,0]], [[0,0,-1],[-1,0,0],[0,-1,0]],
];
function stickerVertices(index:number) {
  const [normal,right,down]=frames[Math.floor(index/9)];
  const col=index%3,row=Math.floor(index%9/3);
  return [0,1,2,3].map(k=>normal.map((n,i)=>3*n+(2*(col+k%2)-3)*right[i]+(2*(row+Math.floor(k/2))-3)*down[i]).join(','));
}

function surfaceConstruction(q:string,en:boolean) {
  const path=/closed (?:path|loop)|闭合(?:路径|回路)/i.test(q) && /54/.test(q) && /exactly once|恰好一次/i.test(q);
  const colouring=/minimum number of colou?rs|最少.*颜色/i.test(q) && /neighbo[u]?rs|相邻/i.test(q) && /7 other|对角|corner.to.corner|share a vertex/i.test(q);
  if (!path && !colouring) return;
  const vertices=Array.from({length:54},(_,i)=>stickerVertices(i));
  const shared=(a:number,b:number)=>vertices[a].filter(v=>vertices[b].includes(v)).length;
  if (path) {
    const rows=['125478963','325698741','321478569','325698741','963214587','965874123'];
    const cycle=rows.flatMap((row,f)=>[...row].map(n=>9*f+Number(n)-1));
    if (new Set(cycle).size!==54 || cycle.some((a,i)=>shared(a,cycle[(i+1)%54])!==2)) return;
    const route=rows.map((r,i)=>faceOrder[i]+' '+r).join(' → ');
    return (en?'Yes. Number each face 1–9 in row order as viewed from outside, with F facing you, U above, and the top row of U next to B (the top row of D next to F). Visit ':'可以。由外看各面，逐行编号 1–9。F 朝前，U 在上，U 面第一行靠 B，D 面第一行靠 F。依次经过 ')+route+
      (en?', then return to U1. Every face list is a permutation of 1–9. Every consecutive pair, including the last and first, shares an edge. Connect their centres through the midpoint of that edge to avoid every grid vertex.':'，最后回到 U1。每面九格各一次；相邻两格包括首尾均有公共边。连接格心时经过公共边中点即可避开所有格点。');
  }
  const layout=['121343121','242313242','434121434','121343121','242313242','434121434'];
  const colours=layout.join('');
  if (vertices.some((_,i)=>vertices.some((__,j)=>i<j && colours[i]===colours[j] && shared(i,j)>0))) return;
  return (en?'Four colours are necessary and sufficient when corner contact counts. The four cells of any 2×2 block meet at one grid point, so all four colours must differ. For a construction, read each face row by row in URFDLB orientation (U top next to B, D top next to F): ':'把共顶点也算相邻时，最少四种颜色。任一 2×2 方块的四格共用顶点，必须互异。一种构造按 URFDLB 顺序逐行读取（U 面首行靠 B，D 面首行靠 F）为 ')+layout.join(' / ')+
    (en?'. Digits denote colours. Checking every pair of cells with a shared vertex verifies the pattern across folds as well as within faces.':'。数字表示颜色。已核对所有具有公共顶点的格对，包括跨面相邻的格子。');
}
