import { buildCommentSuggestions } from '../src/utils/popup_suggest.ts';
import { patternFromAlg, countMoves } from '../src/utils/cube3.ts';

const scramble = "B R U' B2 R' B' R' U' R2 F2 R' U F2 R F R D'";
const insp = "x2";
const xxcrossMoves = "r2' D' U' L U D2 R";

const prevAlg = `${scramble} ${insp}`;
const currAlg = `${scramble} ${insp} ${xxcrossMoves}`;

const prev = await patternFromAlg(prevAlg);
const curr = await patternFromAlg(currAlg);

const entries = await buildCommentSuggestions({
  prevPattern: prev,
  currPattern: curr,
  lineMovesText: xxcrossMoves,
  moveCount: countMoves(xxcrossMoves),
});

console.log('Suggestions:');
for (const e of entries) console.log(`  ${e}`);
