import { invertMoveString } from '@cuberoot/shared/alg-notation';

type Text = { zh: string; en: string };

export type Phase = { moves: string; title: Text; note: Text };
export type Demo = {
  title: Text;
  intro: Text;
  setup: string;
  phases: readonly Phase[];
  result?: Text;
};

export const ORIENTATION = "z2 y'";
export const SCHEME = 'ygrwbo';

export const FLIP = "R U R' F R' F' R";
export const PAIR = "2U' R U R' 2U";
export const LAST_TWO = "2U' " + FLIP + ' 2U';
export const OLL = "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2";
export const PLL = '2R2 U2 2R2 Uw2 2R2 Uw2 U2';
export const SINGLE_CENTER = "2R U 2R'";
export const CENTER_BAR = "2R U2 2R'";

export function inverse(alg: string) {
  return invertMoveString(alg).replaceAll("2'", '2');
}

export const whiteSetup = 'x2 ' + inverse(CENTER_BAR);
export const pairSetup = inverse(PAIR);
export const sameHeightSetup = pairSetup + ' ' + inverse(FLIP);
export const lastTwoSetup = inverse(LAST_TWO);
export const ollSetup = inverse(OLL);
export const pllSetup = inverse(PLL);
export const swappedCenters = "x Rw2 U2 D2 Rw2 R2 D2 U2 R2 x'";

export const notation: Demo = {
  title: { zh: '外层、内层、宽层', en: 'Outer, inner and wide turns' },
  intro: { zh: '先看字母确定哪一面，再看前后的记号。顺逆时针都从所写的那一面看', en: 'Read the face letter first. Judge clockwise and counterclockwise while looking straight at that face.' },
  setup: '',
  phases: [
    { moves: 'R', title: { zh: '外层', en: 'Outer layer' }, note: { zh: '只转最右边一层', en: 'Turn only the outermost right layer.' } },
    { moves: '2R', title: { zh: '内层', en: 'Inner slice' }, note: { zh: '只转从右数第二层。2U 同理，只转从上数第二层', en: 'Turn only the second layer from the right. Likewise, 2U is the second layer from the top.' } },
    { moves: 'Rw', title: { zh: '宽层', en: 'Wide turn' }, note: { zh: '右边两层一起转。Uw 是上面两层一起转', en: 'Turn both right layers together. Uw turns both top layers together.' } },
    { moves: "2R2 2U' x", title: { zh: '半转、逆转、转体', en: 'Half turns, primes and rotations' }, note: { zh: '2R2 的前一个 2 选层，后一个 2 表示 180°。撇号表示逆转。x 是整颗沿 R 的方向转', en: 'In 2R2, the first 2 selects the slice and the last 2 means 180°. A prime reverses the turn. x rotates the whole cube in the R direction.' } },
  ],
};

export const whiteCenter: Demo = {
  title: { zh: '拼第一个中心', en: 'Build the first center' },
  intro: { zh: '把两个相邻的白中心块当成一条 1×2 白条。图里的两条已经摆好，先看看怎样把它们合成一面', en: 'Two adjacent white center pieces make a 1×2 bar. The two bars here are ready to join. Watch how they come together on one face.' },
  setup: whiteSetup,
  phases: [
    { moves: '2R', title: { zh: '送上第二条', en: 'Bring the second bar up' }, note: { zh: '把要送上去的白条放在前面右列，让它沿右内层上去', en: 'Put the incoming white bar in the front center’s right column, then lift it with the right inner slice.' } },
    { moves: 'U2', title: { zh: '把白条让出内层', en: 'Move the bar out of the slice' }, note: { zh: '把刚送上去的白条转到左列，给右列腾位置', en: 'Move the bar you just lifted into the left column to free the right column.' } },
    { moves: "2R'", title: { zh: '回内层', en: 'Undo the slice' }, note: { zh: '原先的白条回到顶面，两条合成一个 2×2 中心', en: 'The original white bar returns to the top, joining the two bars into one 2×2 center.' } },
  ],
  result: { zh: '自己拼时，先挑一个白块较多的面朝上。用侧面的外层把白块转到右列，再用右内层送上去，和顶面的白块并排。若直接合不上，下一节的单块插入也适用', en: 'On your cube, start with a face that already has white center pieces. Turn a side to line up a white piece in the right column, then lift it next to one on top. The single-piece insertion in the next lesson works here too.' },
};

export const oppositeCenter: Demo = {
  title: { zh: '把相对中心拼好', en: 'Build the opposite center' },
  intro: { zh: '白色中心朝下，黄色目标面在上。顶面缺一块时，用三步把侧面的黄块送上去，白色中心会随回切恢复', en: 'Hold white down and the yellow target face up. When the top is one piece short, use these three moves to insert a yellow piece from a side and restore white.' },
  setup: inverse(SINGLE_CENTER),
  phases: [
    { moves: '2R', title: { zh: '先送到顶面', en: 'Lift the donor' }, note: { zh: '前面中心的右下格放黄块。顶面中心的左后格放待换走的块', en: 'Put the yellow piece at the front center’s lower right. Put the piece to remove at the upper center’s back left.' } },
    { moves: 'U', title: { zh: '把目标块转开', en: 'Turn the top' }, note: { zh: '新黄块离开右内层，待换走的块进入右内层', en: 'The new yellow piece leaves the right inner slice and the unwanted piece enters it.' } },
    { moves: "2R'", title: { zh: '回切保护白色', en: 'Undo the slice to restore white' }, note: { zh: '检查顶面四块同色，底面白色也完整', en: 'Check that all four yellow center pieces are together and the white center has returned.' } },
  ],
  result: { zh: '先找黄块最多的侧面。能拼成条就用上一节的 U2 合条，剩下的逐块插入。侧面的黄块可用转体带到前面', en: 'Start with a side that has several yellow pieces. Join bars with U2 when you can, then fill missing spots one at a time. Regrip to bring the donor side to the front.' },
};

export const sideCenters: Demo = {
  title: { zh: '拼两个相邻侧中心', en: 'Build two adjacent side centers' },
  intro: { zh: '示范配色为白下、黄上、红前、绿右。先以黄红绿角为准确认红绿的顺序，再拼红、绿，留下相邻的橙、蓝', en: 'The example uses white down, yellow up, red front and green right. Use the yellow–red–green corner to check the order, then build red and green, leaving orange and blue adjacent.' },
  setup: 'x y ' + inverse(SINGLE_CENTER),
  phases: [
    { moves: SINGLE_CENTER, title: { zh: '顶面缺几块，就补几块', en: 'Fill the missing spots one at a time' }, note: { zh: '把正在拼的面转到上面，将给块的未完成面转到前面。沿用上一节的三步，保护其余四个中心', en: 'Hold the target face up and the unfinished donor face in front. Reuse the three-move insertion to preserve the other four centers.' } },
  ],
  result: { zh: '要找的块若在目标面的正对面，先用同样方法把它换到另一个未完成的相邻面，再转到前面送上去', en: 'If a donor sits opposite the target, use the same insertion to move it onto an unfinished adjacent face first. Then bring that face to the front and insert it.' },
};

export const lastCenters: Demo = {
  title: { zh: '收完最后两个中心', en: 'Finish the last two centers' },
  intro: { zh: '两面未完成时，把它们拿成上面和前面，其余四面都可以保住', en: 'When two unfinished centers remain, hold them on the top and front. The other four can stay intact.' },
  setup: inverse("F 2R U 2R'"),
  phases: [
    { moves: 'F', title: { zh: '找要送上去的颜色', en: 'Find the incoming color' }, note: { zh: '把前面的黄块放到中心右下格，顶面的错色块已经在左后格', en: 'Move the yellow piece to the lower-right spot on the front center. The unwanted top piece is already at back left.' } },
    { moves: SINGLE_CENTER, title: { zh: '换一块，检查两面', en: 'Exchange one piece and check both faces' }, note: { zh: '一块黄上去，一块红下来，两面一起完成', en: 'One yellow piece goes up and one red piece comes down, completing both centers.' } },
  ],
  result: { zh: '如果两块错色挨着，把它们转到顶面左列，前面的补色条放右列，用 2R U2 2R′ 一次换一条。对角或其他摆法可继续逐块换', en: 'When two wrong colors share a bar, place them in the top center’s left column and the incoming bar in the front center’s right column. Use 2R U2 2R′ to exchange the bars, or keep filling one spot at a time.' },
};

export const pairEdges: Demo = {
  title: { zh: '合棱、移走、回切', en: 'Join, save, restore' },
  intro: { zh: '用外层把同一组的两翼摆到左前上格、右前下格。两翼各有两种颜色，合上后前面的贴纸也要同色', en: 'Use outer turns to bring matching wings to the upper front-left and lower front-right slots. Both colors should line up when the wings meet.' },
  setup: pairSetup,
  phases: [
    { moves: "2U'", title: { zh: '合棱', en: 'Join' }, note: { zh: '上内层向右切，左前上翼靠到右前下翼旁。中心会暂时拆开', en: 'Slice the upper inner layer to the right. The two wings meet at front-right and the centers temporarily split.' } },
    { moves: "R U R'", title: { zh: '移走', en: 'Save' }, note: { zh: '把右前的新棱送到顶前。提前在顶后放一条未配好的棱，让它下来代替', en: 'Move the new front-right pair to the top front. Have an unpaired edge at top back so it comes down to take its place.' } },
    { moves: '2U', title: { zh: '回切', en: 'Restore' }, note: { zh: '把上内层转回去。中心恢复，刚配好的棱留在顶层', en: 'Undo the slice. The centers return and the new pair stays in the top layer.' } },
  ],
  result: { zh: '反过来的斜对角也可以镜像做：2U / L\' U\' L / 2U\'。若顶层没有空位，先用外层把另一条未配好的棱带上去', en: 'For the opposite diagonal, mirror the sequence: 2U / L\' U\' L / 2U\'. If every top edge is paired, bring another unpaired edge up with outer turns first.' },
};

export const flipEdge: Demo = {
  title: { zh: '同高时，先翻右前', en: 'Flip front-right when the wings are level' },
  intro: { zh: '找出左前和右前的目标翼。两翼在同一高度时，先翻右前整槽，让它们到不同高度', en: 'Find the matching front-left and front-right wings. When they are at the same height, flip the entire front-right slot to put them at different heights.' },
  setup: sameHeightSetup,
  phases: [
    { moves: FLIP, title: { zh: '翻右前棱位', en: 'Flip front-right' }, note: { zh: '右前两翼上下互换，已经完成的中心和配好的棱会保持完整', en: 'The two front-right wings switch heights. Finished centers and existing pairs stay intact.' } },
    ...pairEdges.phases,
  ],
};

export const lastEdges: Demo = {
  title: { zh: '最后两棱一起配', en: 'Pair the last two edges together' },
  intro: { zh: '只剩两个未配好的棱位时，把它们放到左前、右前。摆到上面两翼是一组、下面两翼是另一组。如有需要，先翻右前调整', en: 'Put the two remaining unpaired slots at front-left and front-right. Match the two upper wings to each other and the two lower wings to each other. Flip front-right first if needed.' },
  setup: lastTwoSetup,
  phases: [
    { moves: "2U'", title: { zh: '切过去', en: 'Slice' }, note: { zh: '向右切上内层，暂时打散中心', en: 'Slice the upper inner layer right to temporarily open the centers.' } },
    { moves: FLIP, title: { zh: '翻右前', en: 'Flip front-right' }, note: { zh: '沿用刚学的翻棱动作，交换右前的上下翼', en: 'Use the same flip as before to exchange the upper and lower wings in the front-right slot.' } },
    { moves: '2U', title: { zh: '回切验收', en: 'Restore and check' }, note: { zh: '中心恢复，左前和右前同时配好。沿整颗魔方确认十二条都成对', en: 'Both front slots pair up as the centers return. Check all twelve edges around the cube.' } },
  ],
};

export const ollParity: Demo = {
  title: { zh: '翻棱特殊情况（OLL）', en: 'Edge-flip parity (OLL)' },
  intro: { zh: '数顶层有几条棱的顶色朝上，按整条棱算。0、2、4 条走三阶步骤；1、3 条时，把一条顶色朝侧面的棱放到顶前', en: 'Count paired edges with the top color facing up. With 0, 2 or 4, use your 3×3 method. With 1 or 3, put an edge with the top color facing sideways at top front.' },
  setup: ollSetup,
  phases: [
    { moves: "Rw2 B2 U2 Lw U2", title: { zh: '从顶前未翻好的棱起手', en: 'Start with the misoriented edge at top front' }, note: { zh: 'Rw、Lw 都带两层，开头的 Rw2 转 180°', en: 'Rw and Lw both turn two layers. Start with a 180° Rw2.' } },
    { moves: "Rw' U2 Rw U2", title: { zh: '两次右宽层', en: 'Two right wide turns' }, note: { zh: '每次右宽层之后都接 U2', en: 'Each right wide turn is followed by U2.' } },
    { moves: "F2 Rw F2 Lw' B2 Rw2", title: { zh: '恢复降阶结构', en: 'Restore the reduced cube' }, note: { zh: '中心和配棱会恢复。重新数顶色朝上的棱，再继续三阶的顶层步骤', en: 'The centers and pairs return. Count the top-facing edges again, then continue your usual 3×3 last layer.' } },
  ],
};

export const pllParity: Demo = {
  title: { zh: '换棱特殊情况（PLL）', en: 'Edge-swap parity (PLL)' },
  intro: { zh: '顶色翻好后，若用层先法，先把四角放对，再看侧色。只剩两条棱互换就用本节。相对两条错棱摆到顶前、顶后', en: 'Once the top is oriented, layer-by-layer solvers can finish positioning the four corners first. If just two edges are swapped, use this lesson. For opposite edges, hold them at top front and top back.' },
  setup: pllSetup,
  phases: [
    { moves: '2R2 U2 2R2', title: { zh: '内层、顶面、内层', en: 'Inner, top, inner' }, note: { zh: '2R2 只转右内层两次，U2 只转最外的顶层', en: '2R2 turns only the right inner slice by 180°. U2 turns only the outermost top layer.' } },
    { moves: 'Uw2 2R2 Uw2 U2', title: { zh: '宽层收尾', en: 'Finish with wide turns' }, note: { zh: 'Uw2 带顶上两层；最后的 U2 把顶面转回。相对两棱完成交换', en: 'Uw2 turns both top layers. The final U2 realigns the top so the two opposite edges are exchanged.' } },
  ],
  result: { zh: '若错的是相邻棱，也做一次这条公式，随后用原来的三阶方法收尾。若用 CFOP，遇到三阶没有的 PLL 盘面也可以先做一次，再重新识别', en: 'For an adjacent swap, do the sequence once, then finish with your usual 3×3 method. CFOP solvers can also apply it once to an impossible PLL case and then recognize the resulting PLL.' },
};

const fullPhases: Phase[] = [
  { moves: "x2 2R U2 2R' F 2R U 2R' x2", title: { zh: '白色中心', en: 'White center' }, note: { zh: '把白色目标面转上来，先合条，再补一块，完成后白下', en: 'Put the white target face up. Join bars, fill one spot, then return white to the bottom.' } },
  { moves: "2R U2 2R' F' U 2R U 2R'", title: { zh: '黄色中心', en: 'Yellow center' }, note: { zh: '同样先合条再补一块，回切后复查底面', en: 'Join a bar and fill one spot again. Recheck the bottom after restoring the slice.' } },
  { moves: "x y' 2R U2 2R' U' F 2R U 2R' y x' y x y 2R U2 2R' U' F 2R U 2R' y' x' y'", title: { zh: '红、绿中心', en: 'Red and green centers' }, note: { zh: '分别把红、绿目标面转到顶上，确认只是动到顶面和给块的侧面', en: 'Bring each target face to the top. Notice that each insertion affects only the target and donor centers.' } },
  { moves: "y2 x y 2R U2 2R' U' F 2R U 2R' y' x' y2", title: { zh: '橙、蓝中心', en: 'Orange and blue centers' }, note: { zh: '把最后两面拿成顶、前，先合条，再补最后一块。此时六个中心都完成', en: 'Hold the last two centers at top and front. Join a bar, then fill the last spot. All six centers are now complete.' } },
  { moves: "y2 " + PAIR + " y2 y " + PAIR + " y' y " + PAIR + " y' y' " + PAIR + " y y R' " + PAIR + " R y' " + PAIR,
    title: { zh: '逐条配棱', en: 'Pair edges one at a time' }, note: { zh: '已有四条成对。每轮换工作面或用外层摆位，再做同一组「合棱、移走、回切」，配到十条', en: 'Four edges are already paired. Regrip or use outer turns to set up each working slot, then repeat join, save, restore until ten are paired.' } },
  { moves: LAST_TWO, title: { zh: '最后两棱', en: 'Last two edges' }, note: { zh: '切上内层、翻右前、回切，完成十二条配棱', en: 'Slice, flip front-right and restore. All twelve edges are now paired.' } },
  { moves: "F2 U R U' R' U' F' U F", title: { zh: '接回三阶层先法', en: 'Use your 3×3 method' }, note: { zh: '用 F2 放好最后一条白十字棱，再用熟悉的外层动作插入中层棱', en: 'Use F2 to place the last white cross edge, then insert the middle-layer edge with familiar outer turns.' } },
  { moves: OLL, title: { zh: '处理翻棱', en: 'Fix edge-flip parity' }, note: { zh: '三条顶色朝上，把缺的一条对着自己。做完以后顶色已齐，重新检查侧色', en: 'Three edges show yellow on top. Hold the remaining edge at top front. When yellow is complete, recheck the sides.' } },
  { moves: PLL, title: { zh: '处理换棱并复原', en: 'Fix edge-swap parity and finish' }, note: { zh: '四个角对了，只剩顶前、顶后两棱互换。做完后六面复原', en: 'All four corners are in place. Only the top-front and top-back edges need to exchange. Finish and check all six faces.' } },
];

export const fullSolve: Demo = {
  title: { zh: '完整跟拧', en: 'Full walkthrough' },
  intro: { zh: '从一颗六色混合的四阶开始。点右侧阶段可以从该段看起，也可以在每次暂停后先自己判断下一步', en: 'Start with mixed centers. Select a stage to jump to it, or pause at the checkpoints and decide what you would do next.' },
  setup: inverse(fullPhases.map(phase => phase.moves).join(' ')),
  phases: fullPhases,
};

export const centersDoneSetup = inverse(fullPhases.slice(4).map(phase => phase.moves).join(' '));
export const edgesDoneSetup = inverse(fullPhases.slice(6).map(phase => phase.moves).join(' '));
