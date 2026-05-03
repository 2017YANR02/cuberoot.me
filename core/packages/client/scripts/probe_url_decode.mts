import { decodeUrlAlg } from '../src/utils/cubedb_url.ts';
import { cleanForPlayer } from '../src/utils/recon_alg_utils.ts';
import { Alg } from 'cubing/alg';

const algParam = "x2_%2F%2F_insp%0AD-U2-_L_U%C2%B7_L_F-%C2%B7_D-_%2F%2F_W_P_%28BR%29%0Ar_R-_U-_r-_R_%2F%2F_xcross%0Ad_L-_U-_L_%2F%2F_GO%0AR_U_R-_L_U_L-_%2F%2F_RG%0AU_r_U-_r-_U_r_U_r-_%2F%2F_OB%2FZBLS_%282.302%29%0AU_R_U2-_R-_U-_R_U-_R-_L-...U2_L_U_L-_U_L_U-%E2%80%8B_%2F%2F_ZBLL-U_%281.101%29";

const urlDecoded = decodeURIComponent(algParam);
console.log('After URL decode:');
console.log(urlDecoded);

const ourDecoded = decodeUrlAlg(urlDecoded);
console.log('\nAfter our decodeUrlAlg:');
console.log(ourDecoded);

const cleaned = cleanForPlayer(ourDecoded);
console.log('\nAfter cleanForPlayer (passed to TwistyPlayer):');
console.log(cleaned);

console.log('\nCodepoints of cleaned:');
console.log([...cleaned].slice(-30).map(c => c.codePointAt(0).toString(16)).join(' '));

console.log('\nTry parsing as Alg:');
try {
  const a = new Alg(cleaned);
  console.log('  Parsed OK,', [...a.experimentalLeafMoves()].length, 'moves');
} catch (e) {
  console.log('  PARSE ERROR:', (e as Error).message);
}
