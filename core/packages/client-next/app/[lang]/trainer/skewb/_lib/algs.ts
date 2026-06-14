// Skewb L2L alg database.
// Transcribed verbatim from SkewbSkills `skewbskillsscripts.js` lines 448-578.
// Source: https://annikastein.github.io/SkewbPage/SkewbSkills/skskweb.html
// Each source entry was [setupScramble, caseId, "comma,separated,solutions"];
// solutions = solutionsString.split(",").map(s => s.trim()).
// Setups and solutions are preserved character-for-character (incl. apostrophes
// and the lowercase r/l/f/b tokens). Annotations like "(Cancel)" / "Use Advanced"
// are kept verbatim.

export interface SkewbAlgCase {
  id: string;
  setup: string;
  solutions: string[];
}

export type SkewbGroup = 'pi' | 'peanut' | 'l';

export interface SkewbCategory {
  key: string;
  en: string;
  zh: string;
  group: SkewbGroup;
  cases: SkewbAlgCase[];
}

const mk = (setup: string, id: string, solutions: string): SkewbAlgCase => ({
  id,
  setup,
  solutions: solutions.split(',').map((s) => s.trim()),
});

const scrpiswirl: SkewbAlgCase[] = [
  mk("r' R' r R' r z' r z r R'", "1a", "H y S y' H y H,H y H y' S y H,x r' R r' R' B' r' B' r B,y' x r' R r R' z' R r' R r z R r' R' r',y x R b' r' R' r z B' r B,y x r' R r' R' r' R r R z R r R' b',R r' z' r' z r' R r' R r"),
  mk("r R r R' z R r' R' r z2 R' r' R' r", "1b", "y' S y' H y S y' S,y' S y' S y S y' H,y2 x r' B R r R' B r' B',x r' R r R r' R' r z' r' R r R' B',y x r' R r R z2 r' R r R' z' R r' R' r',y2 x R r R' r' R r R z' r' R' r B,b' r l r l' r b' l',y2 x R r' R r R r' R' r' z' r' R' r B"),
  mk("R r' b' r' R r' R r", "2a", "y2 S y' S y H y' S,y2 H y' S y S y' S,y2 x r B R' B' r R r R' r' R r,y' x b' r' R r R' z' R r' R' r R r R',y2 x b' r' R r R r' R' r z r B r' B',y' x r' B' r z r' R r b R',z' r' R' r R' r b r R',z' r' R' r R' r z' r R f'"),
  mk("r' B R r R' z R b' R'", "2b", "y H y' H y S y' H,y S y' H y H y' H,x R b R' z' R r' R' B' r,x z R' r' R' r z R r R' r z' r' R r R',y2 x B' r' R r R z R r R' r' R' r R',y x B R r' R' r' R r R' r' B' r B"),
  mk("R' B R' B' r' R r z R r R'", "1c", "S y S y' S y H,S y H y' S y H,y' x R r' R' z' r' R' r B R/R2' B' R,x y2 r' R r R b' r R' b',y x R r' R r R' B R' B' r' R' r R,y' x r B' b' r' B' r B b"),
  mk("R r' R r z R r' R' z' r' R' r", "1d", "y' H y' H y H y' S,y' H y' S y H y' H,x r' R r z R r R' z' r' R' r R',y x R' r' R' r z R r' R' r' R r R',y x' R r' R' r' B R' r B"),
  mk("r' R r R b' r R' b'", "2c", "y2 S y' H y H y' H,y2 H y' H y S y' H,x r' R r' R' z' r' R r B R B',y2 x R' r' B' r B R r B',y2 b R r' b R' r' R' r"),
  mk("R r R' z R B r' R' r'", "2d", "y H y S y' S y S,y S y S y' H y S,y' x R r' R r B R' B' r' R' r,x b r B r' B' z' r' R' b,y2 z B' b' R r' b r B r',x2 y B' r' R B' r R r R'"),
];

const scrpiwat: SkewbAlgCase[] = [
  mk("B' R' r R' B' r' R' r'", "3a", "y' S y2 H y' S y' S,x r2' R r B R r' R B,y' x R B R' B' R' r' R r R r' R' r,y x r' R r R' r' R' r R B R B' R',B' r' l r' l' B' r' b'"),
  mk("R' r' R r R B R' B' R' B R B'", "3b", "y2 S y2 H y H y S,x B' R' B' r' R' B R' r',y x R' r' R r R B R' B' R' B R B',y2 x R r R' r' R' z' r' R r z R r',y x B R' B' R B R B' R' r' R' r R,y2 x R r' R r' R r R B R' B' r,r' R' B' r' R' r z2 R' r'"),
  mk("r R' r B r' z r R' r' R' r", "4a", "y S z S y2 S,x r' R' r B R' B' R' r' R r R',y2 x r2'/r R' r B r' z r R' r' R' r"),
  mk("R r' R' r' R B' r z R r' R", "4b", "y2 H z' S y2 S,y x r' R r R B' r' R' r B R',y' x R2'/R B' r' R r B R' r' R' r,x B R B' r' R r R B R' B' R,y' x R r' R' r R r' R r B R' B' R'"),
  mk("R' r B' r' R r' z R r' R r", "3c", "y S y2 H y' H y' S,y S y S y H y2 S,x r' R' r R' z' r2'/r R' r B r' R,y' x R r' R' r R' r' R r z r R r' R',y x B R B' R' r' R' r R r' R r R',y' x R' r R r' R' r R' r' z R r' R'"),
  mk("r' R' r B' R' z R r' R' r R r'", "3d", "y2 S y2 H y S y S,H y' H y' S y2 H,x r' R r R' r R r' R' z' R' r' R r,x r R' r' R r R' z' R B r' R r,y' x r' R' r R z R r R' r' R r' R' r"),
  mk("R' r R' r' B R B' r R r'", "4c", "y H z S y2 S,y' x R r' R r z R r' R' r R r R',y2 x r' R r R B R' B' R' r' R' r R,x R r' R' r' R r R' z' r' R' r R'"),
  mk("r' R r R r' R' r B R B' R", "4d", "y2 S z' S y2 S,y x R r' R ' r' z' r' R r R z R r R' r',y' x r' R r R r' R' r B R B' R,y x R' B R' B' r' R r R' r' R' r"),
];

const scrpix: SkewbAlgCase[] = [
  mk("R' r R' r' z' r' R' r z R' r", "5a", "y2 S y S S S,x' S y2 S z2 x' H,x z' r' R z' r' R r z r R r' R,x R' r' R r R z B R' B' R r',x z' r' R' r B r' R r z R r' R r"),
  mk("R r' R r z2 R r' R' r b", "5b", "y H y' S S S,z y' S y2 S x z2 S,y x b' r' R r R' z2 r' R' r R',y2 x R r' B R' B' R' r' R r',r R' r B x r' l r l' r"),
  mk("R r R' r z2 r' R r z r R r", "6a", "y H y2 x' S y2 S,y x R r' R r z2 R r' R' r b,y x R r' R r z B R' B' R r/r2',x r2' R' r z r R r R' b r'"),
  mk("B R r' R' r z2 R r R' r", "6b", "y2 S z2 x' S y2 S,y' x R' r R' r' z' r' R' r z R' r,y2 x r' R r' R' z2 r' R r R' B'"),
  mk("b R r' R' r z y l r' R r", "5c", "y2 H y S S S,x' S y2 S z2 x' S,y' x r' R r' R' r' R r R' z' R r' R r,x r' R' r R' z2 r' R r R' b',y' x R r R' r R r' R' r z' r' R r,x b' R r' R r R' b' R' r' R' r"),
  mk("B' r' R r z r' R' z R r' R'", "5d", "y S y' S S S,z y' S y2 S y2 x' H,x r' R' r R' r' R r R' B R' B',x z R r R' z' R r z' r' R' r B,x R r' R r R r' R' r z r' R r' R',y' x B r' R r' R' r B r R r R'"),
  mk("R r R' r z2 R r' R' r B", "6c", "y S y2 z' S y2 S,y' x B' r' R r R' z2 r' R r' R',x r' R r R' z' R' r' R r R B R' B',y2 x B R B' R r' R' r R r' R r"),
  mk("r' R' r z r' R' B R B' r'", "6d", "y2 H z2 x' S y2 S,y x r B R' B' R r z' r' R r,x z R r' R' r R B R' B' R' r' R r,x z r R' B r z' r2' R r B' R',y2 r' R' r z r' R r R' r2/r' R r' R'"),
];

const scrpihu: SkewbAlgCase[] = [
  mk("r B' r' R r R' r f'", "7a", "y S S z2 x' S y2 S,y' x B r' R r' R' r B r'"),
  mk("R' b R r' R' r R' b", "7b", "y S S z' S y2 S,y2 x r' z R r' R r z r' B' r,y x b' R r' R r R' b' R"),
  mk("B r' R r' R' r B r'", "7c", "y' S S y2 z' S y2 S,y' x r B' r' R r R' r B'"),
  mk("l' B b' r B r' R' r", "7d", "S S z S y2 S,y2 x B' r z R r' R' r z' B' r,y z' r' R r B' r' b B' l"),
  mk("r R' r b' B' R r' R", "8a", "S y' S y' S,x R' r R' B b r' R r',y2 x r' R r B R' B' R' r' R' r R'"),
  mk("r' R r' B R B' r' R", "8b", "S y' H y' S,x R' r B R' B' r2' R' r,y x r' B R B' z' r' R r B',y' x B R' B r' R' r B R',y' x r' R r R z' r' R' r B r' R r"),
  mk("R' r R' B b r' R r'", "8c", "S y H y S,H y H y H,x r/r2' R' r b' B' R r' R,y2 x R r' R' z' r' R r R z R r R' r"),
  mk("r' B R B' z' r' R r B'", "8d", "S y S y S,H y S y H,y x R/ R2' B' r' R r z R' r R',x B r' R' r z B R' B' r,y2 x r' R r'/r2 B R B' r' R"),
];

const scrpivu: SkewbAlgCase[] = [
  mk("R r' R r B' R' B r' R' r", "9a", "y2 S S y' S y2 S,y' S y2 S y S S,y' x B' r' R r R B' R' r' R' r B',y' x R r R' r B r' z' r' R r R' b,y' r' R r B' R B r' R' r R',r' l r l' r' R' F r' R r,y x R r' R r z r' R r R' z' R r' R' r R"),
  mk("B' r' R r z B R B' r'", "9b", "y S S y' S y2 S,S y2 S y' S S,y' x B r' R r z R r' R' r R' r',x z r B R' B' z' r' R' r B,y2 x r' B R' B' r' R r R' r R,y2 x B' r' R r z B R B' r',x z' r' R r z R' r B r' R B,x R' r' R r' R' r x' r B r' R"),
  mk("R B R r' R' B'", "10a", "S y2 H,x z r B r B' r' B',y' z' B R r R' B' R'"),
  mk("b' r' R' r y r B", "10b", "y2 H y2 S,x B' r' B' r B r,x B' r' y' r' R r b"),
];

const scrpio: SkewbAlgCase[] = [
  mk("r' R' r z R r' R' r R r R'", "11a", "y2 H y' S y2 S,y' x R r' R' r' R r R' z' r' R r"),
  mk("R r R' z' r' R r R' r' R' r", "11b", "y S y S y2 S,x r' R r R r' R' r z R r' R'"),
  mk("R r' R' r' R r R' z' r' R r", "12a", "y2 S y2 S y S,y S y' x' S y2 S,y' x r' R' r z R r' R' r R r R',y' x r' R' r B' R z R r R' r' R,y2 x R r' R' r b r' R r R' z' R r' R'"),
  mk("r' R r R r' R' r B R' B'", "12b", "y S y2 S y' H,y2 H y x S y2 S,y x B R B' r' R r R' r' R' r,y2 x R r' z r R r R' z2 r' R r"),
  mk("B' R' r B' r' R r'", "11c", "y2 S y' S y2 S (Cancel),y x r/r2' R' r B r' R B"),
  mk("r R B' r z R r' R", "11d", "y H y S y2 S,y H y H y2 H (Cancel),y2 x R' r R' z' r' B R' r'"),
  mk("r R' r B r' R B", "12c", "y2 S y2 S y H,y H z' y' S y2 S,x B' R' r B' r' R r'"),
  mk("R' r R' z' r' B R' r'", "12d", "y S y2 S y S,y2 S x z' S y2 S,x r R B' r B R' B"),
];

const scrpizconj: SkewbAlgCase[] = [
  mk("B' r' R' r B r' R r", "13a", "H x' z S y2 S,y x r' R' r' R' z' r' R r R B',y x r' R' r B' r' R r B"),
  mk("r B R B' r' B R' B'", "13b", "y' S x' z S y2 S,y' x B R B' r B R' B' r',y' r B r' R r B' r' R'"),
  mk("B R B' r B R' B' r'", "13c", "H x' z S y2 S,x r B R B' r' B R' B'"),
  mk("r' R' r B' r' R r B", "13d", "y' S x' z S y2 S,x B' r' R' r B r' R r"),
  mk("r' R r R' z R r' R' r z' R r' R' r", "14a", "y' S y' S y H (Cancel),y' H y' S y S,x R' r' R' r R r' R' r R r' R r,x z R' r' R r B' r' R' r B R,y x r R r R' r' R r' R' r R r' R',y x r' R' z' r' R r z R r R r R' r,y' z R r R' r' R r R r' R' r R' r'"),
  mk("r' R r R' z r' R r R' z' R r' R' r", "14b", "y S y' H y H  (Cancel),y H y' H y S,y x R' B' r' R r B r' R' r R,y2 x B R' B' r' R r R' z' R r' R' r B"),
  mk("R r' R' r z' r' R r R' z r' R r R'", "14c", "y' H y H y' S (Cancel),y' S y H y' H,y2 x r R r R' r' R' r R r R' r' R r,y2 x R' r' R r' R' r R r' R r R' r,y z r' R' r R r' R' r' R r R' r R "),
  mk("R r' R' r z' R r' R' r z r' R r R'", "14d", "y H y S y' S (Cancel),y S y S y' H,y' x R r R' B R B' R r2' R r,x R r R' r R r' R' r R r' R' r',y2 x r z r R' B r' R' r' z' r,y x R r' R r R r B R B' r' R',y' z R' r' R r' R' r R r R' r' R r"),
];

const scrpi3s: SkewbAlgCase[] = [
  mk("r R' r' z' r' R' r z r R' r' R' r", "15a", "S S z S S S,x r' R r R r' z' r' R r z r R r',x R r' R' r' R B R' B' R' r' R,y2 x R r R' B' R r' R' r R r R' B'"),
  mk("r' R r R r' z' r' R r z r R r'", "15b", "z' S S z' S S S,x r R' r' z' r' R' r z r R' r' R' r,x R' r' R r z r b r' R r R' z' R r' R,y2 x b' r' R r R r' R' r b' r' R r,y2 x r B r' B' r' R r R' r B r' B'"),
];

const scrpihz: SkewbAlgCase[] = [
  mk("R' r' R' r' B R' B' r'", "16", "y' S y2 S y2 S,y S y2 S y2 H,x r B R B' r2' R r R,y2 x R' r' R' r'/r2 B R' B' r',y x B' r' R' r B'/B2 R' B' R',y' x R/R2' B R B/ B2' r' R r B"),
  mk("r' R' r z r R r' R' z' r' R r", "17a", "y S y' H y H y' S y H,y2 x r' R' r R B R' B' r' R r,x r' R' r B R B' R' r' R r"),
  mk("R r R' z' r' R' r R z R r' R'", "17b", "y S y H y' H y S y' H,y2 x R r R' r' z' r' R r z R r' R',y x R r2' R' r B r' R r' R' r B,x R r R' z' r' R' r R z R r' R',x r' R r R' z' r' R r' R' z' r' R r R,y' x r R r R' z R r' R' r b r' R r R',y x R r' R' r b' r' R r R' z' R r' R' r'"),
];

const scrpswirl: SkewbAlgCase[] = [
  mk("r R r R' z R r' R' r b", "18a", "H y H y' H y H (Cancel),S y' H x z S y2 S,y2 H y H x S y2 S (Cancel),y x b' r' R r R' z' R r' R' r',y' x R' r' R' r z' r' R r R' B'"),
  mk("b' r' R r R' z' R r' R' r'", "18b", "y' S y' S y S y' S (Cancel),y' H y S x' z S y2 S,y S y' S z' S y2 S (Cancel),x r/r2' R r R' z R r' R' r b,y2 x B R r' R' r z r' R r R"),
  mk("R r' R r B' r' R r B", "18c", "y2 S y' H y S y' H,S y' H x z S y2 S,y2 H y H x S y2 S (Cancel),x R r' R r z R r' R' r',y2 x B' R r' R' r' z' r' R' r b,y x B' r' R' r B r' R' r R'"),
  mk("R' r' R' r z R r R' r", "18d", "y H y S y' H y S,y' H y S z S y2 S,y S y' S x' z S y2 S (Cancel),x z r' R r' R' z' r' R r R,y x b r' R r z r R r R' B'"),
  mk("r' R' r R' z' R r' R' r B'", "18e", "S y S y' S y S (Cancel),y2 S y S z S y2 S,H y' S x z S y2 S,y' x B r' R r R' z R r' R r,y' x R r' R r R' z' R r' R' r B'"),
  mk("R r' R r R' z' R r' R' r B'", "18f", "y' H y' H y H y' H (Cancel),y H y' H z' S y2 S,y' S y H x' z S y2 S,y2 x B r' R r R' z R r' R' r R',x r' R' r R' z' R r' R' r B'"),
  mk("r' R r' R' z' r' R r R", "18g", "y2 H y' S y H y' S,H y' S z' S y2 S,y2 S y' S x' z S y2 S,x R' r' R' r z R r R' r,y x r' R' r' R' z' r' R r B' R,x B R r' R' r' z' r' R' r b'"),
  mk("R r' R r z R r' R' r'", "18h", "y S y H y' S y H,y H y' H x' z S y2 S,y' S y H z S y2 S,x z r R r R' z' r' R' r R',y2 x R r' R r' R' z' r' R r R B',y' x b' r' R r z r R r R' B"),
];

const scrpwat: SkewbAlgCase[] = [
  mk("r R r R' z R r' R' r' z' r R'", "19a", "y' H y S z' S y2 S,y2 S y2 S y' H y' H,S y S y S y2 S,y' x r/r2' R r R' B R' B' R' r R',x z' R r' z r2' R r R' z' R r' R' r'"),
  mk("r' R r' z' r' R' r z r' R r R", "19b", "S y' H z S y2 S,y S y2 S y S y S,y' H y' H y' S y2 S,y2 x r' R r z R r R' z R r' R' r b,y2 x b' r' R r R' z' R r' R' z' r' R' r,x R' r' R' r z' r' R r z r R' r"),
  mk("R r B R B' r' R", "19c", "y S y' S z S y2 S,y2 S y2 S y S y H,S y' H y' S y2 S,x r2' R r R' z' r' R r,y' x r' R' r B R' B' R',x r R r R' z y R' r R,x R' r B R' B' r' R'"),
  mk("B R B' r' R r R", "19d", "y2 H y' H z' S y2 S,y S y2 S y' H y' S,y' H y S y S y2 S,x R r R' z' r' R r R,y' x R' r' R' r B R' B',y x r' R' z' r' R' r B R',y' r R' z' r' R r B R"),
  mk("r R' B' l r' y r R r'", "19e", "y' S y H z' S y2 S,y2 S y2 S y' S y' S (Cancel),H y H y S y2 S,y x B' R r R' r' R r R' B' r,y2 x b r' R' r z2 r' R r b',y2 B l' B' l r' y r R r',y r R' r' y' r l' B R r',y r R' r' y' r l' B l B'"),
  mk("R' r R z B' b r' R' r", "19f", "H y' S z S y2 S,y S y2 S y H y H (Cancel),S y' S y' S y2 S,y r' R r b' B z' R' r' R,x z' B' R r R' z2 R r' R' B,y2 B' r B r' l y r' R' r"),
  mk("r' R r' R' r' z' r' R' r R", "19g", "y H y' H z S y2 S,y2 S y2 S y H y S,H y S y' S y2 S,x z R' r' R r z r R r R' r,x r' R r' R' r' z' r' R' r R  "),
  mk("R r' R r R z R r R' r'", "19h", "y2 S y S z' S y2 S,y S y2 S y' S y' H,S y H y S y2 S,x r R r' R' z' R' r' R' r R',y' x R r' R r R z R r R' r' "),
];

const scrpx: SkewbAlgCase[] = [
  mk("R r' R' r z' R r' R' r", "20a", "y S y' S (Cancel)"),
  mk("r' B r' R r R' r' B", "20b", "S y S"),
  mk("r' R r R' z r' R r R'", "20c", "y2 H y H (Cancel)"),
  mk("B' r R r' R' r B' r", "20d", "y' H y' H,y r' B r' R r R' r2 B"),
  mk("r' R' r z' r' R r R' B", "20e", "S y' H,y2 x B' R r' R' r z r' R r"),
  mk("B' R r' R' r z r' R r", "20f", "y S y H,y' x r' R' r z' r' R r R' B "),
  mk("B' r' R r R' z R r' R' r R", "20g", "y' H y S,x y b r' R r R' z' R r' R',y x R' r' R r R' z' R r' R' r B"),
  mk("b r' R r R' z' R r' R'", "20h", "y2 H y' S,x R r R' z R r' R' r b',x B' r' R r R' z R r' R' r R"),
];

const scrphu: SkewbAlgCase[] = [
  mk("r' l r R r' l' r R'", "21a", "y H y H y S (Cancel),Use Advanced,y x b' r' R r R z' r' B' r B r',y' x R r' R' z' r' R r z r R r' R' r' R r R'"),
  mk("r R' B R r' y' r' R' r", "21b", "y H y' S y' S (Cancel),y' x R r R' z R r' R' r z' r2' R r R',x z R r R r' R' r' z' r' R r B',y2 x B r' R r R z R r R' B R' B'"),
  mk("r R' r' B' r R r' B", "21c", "y2 S y' S y' H (Cancel),Use Advanced,x B' r R' r' B r R r',x B' r' B r B' z r' R' r z' r',x r' R z R r' z' r' R' r' R' r R' B"),
  mk("B' r R' r' B r R r'", "21d", "y2 S y H y H (Cancel),x r' R' r' R r R B R' B' r,x r' R' r z' r' R r R' z R' r' R' r,y x b' R r' R' r' z' r' R' r z' r' R r,y2 x r R' r' B' r R r' B"),
  mk("R r' z' r' R r z r R r' R", "21e", "y' S y' H y' H,y x R' r R' r' z' r' R' r z r R',y2 x R r R' B R B' r' R r R r',y2 x R r R' r' R' z' r' R' r B R"),
  mk("R r R' r' R' z' r' R' r z R r", "21f", "y' S y S y H,y' x R r' z' r' R r z r R r' R,x r' R' z' r' R r z R r R r' R'"),
  mk("R r' R' z R r y r R' B R", "21g", "H y S y S,x R' B' R r' y' r' R' z' R r R',x R' r' R' r B R' B' R r' R' r,y2 x r/r2' R' r z r R r R' r' z' r"),
  mk("r R' r z r R r R' r' z' r", "21h", "H y' H y' S,x r' R B R' B' R' r' R r',y2 x r' R r R' r' R' z' r' R' r B R'"),
];

const scrpvu: SkewbAlgCase[] = [
  mk("r' R r R' z' R r R' r'", "22a", "x2 r R r' R' z R r' R' r,x r R' r' R r R B R' B' r',x z2 r B R B' R' r' R' r R r'"),
  mk("R r' R' r z r' R' r R", "22b", "y' R' r' R r z' r' R r R',x B' R B R' B' R' r' R r B,x z2 B' r' R' r R B R B' R' B"),
  mk("r R' r' z' r' R' r z r R", "22c", "y' x R' r' z' r' R r z r R r',y r' R' r R z' R r' R' r,y x r R' r' z r' R' r z r R"),
  mk("R' r R z R r R' z' R' r'", "22d", "x r R z R r' R' z' R' r' R,y r R r' R' x r' R r R',z2 R r R' r' z r' R r R'"),
];

const scrpo: SkewbAlgCase[] = [
  mk("r' R' r R z R r R' r'", "23a", "y2 H y' H y2 S,x z r R r' R' z' R' r' R r"),
  mk("R r R' r' z' r' R' r R", "23b", "y S y S y2 H,x R' r' R r z r R r' R',y2 x B r R' r' B' r R r'"),
  mk("r R r' R' z' R' r' R r", "23c", "y H y H y2 S (Cancel),x r' R' r R z R r R' r'"),
  mk("R' r' R r z r R r' R'", "23d", "y2 S y' S y2 H (Cancel),x z R r R' r' z' r' R' r R"),
  mk("r R B R B' R' r' R'", "23e", "S y H y2 S,y' R r R B R' B' R' r',x z2 r R r R' r' R' z' r' R' r B"),
  mk("R r R B R' B' R' r'", "23f", "y' H y' S y2 H,y x B' r' R r R' z/z3' R' r' R r R,y x R B' r' B' r B r B R' B',y r R B R B' R' r' R',x2 r' R' z' R' r' R r z r R"),
  mk("R' r' R' r l r' R r", "23g", "H y S y2 H,y2 x b r' R r R' z' R r2'/r R' r,y' z' r' R' r l' r' R r R,y x r B' r' R r R' r z r' R' r"),
  mk("r' R' r z r' R' r R r", "23h", "y' S y' H y2 S,y r' R' r' R r z' r' R r,y x r' R r' R' z R r' R' r b'"),
];

const scrpzconj: SkewbAlgCase[] = [
  mk("r' R' r z r' R r' R' r R r' R'", "24a", "y' S y' H y S,x z R r R' r' R r R' r z' r' R r"),
  mk("R r R' z' R r' R r R' r' R r", "24b", "H y S y' H,x r' R' r R r' R' r R' z R r' R',x R B R' B' r' R' r R r' R' r R,y x B r' R r' R' r B z' r' R' r,y' x R' r' R' r' z' r' R' r R r' R' r B',x z2 R r R' r' R r R' z' R r' R' r R'"),
  mk("R r R' r' R r R' z' R r' R r", "24c", "y' H y' S y H,x r' R' r R' z R r' R' r R r' R',x r' B R' B' R B R' B' R' r' R' r',x z2 r/r2' R r z B r' B' z' r' R' r' z' r "),
  mk("r' R' r R r' R' r z r' R r' R'", "24d", "S y H y' S,y' x R r' R r R' z R r' R' r R r' R',y x R r R' r z' r' R r R' r' R r,x B r' R r R' r' R r z r R r.R"),
  mk("R r' R' r z R r' R' r z' R r' R' r", "25a", "y2 S y' S y S,y' x r' R' r' z' r' R' r R r' R' r B,y2 x r R r R' r' R r R' z' R r' R' r R,x z' r B r' R' r B r' R r' B'"),
  mk("R r' R' r z' R r' R' r z R r' R' r", "25b", "y' S y S y' S,y2 r B R' B' R B R' B' R' r' R' "),
  mk("r' R r R' z' r' R r R' z r' R r R'", "25c", "y H y H y' H,y' x b' R r R' r' R r R' r z' r' R r'"),
  mk("r' R r R' z r' R r R' z' r' R r R'", "25d", "H y' H y H,y2 x B' r' R r R' r' R r z r R r,x z r' R r R' z' b' r' R r R' z' R r' R' r'"),
];

const scrp3s: SkewbAlgCase[] = [
  mk("r' R r R' r' R r R' z R r' R' r", "26a", "S y' S S (Cancel),S y H H"),
  mk("R r' R' r z' R r' R' r R r' R' r", "26b", "y2 S S y' S (Cancel),S y' H H,x r R r' R' r B R' B' R' r' R',x B r' R r R z R r R' r' R r R"),
  mk("r' R r R' r' R r R' z r' R r R'", "26c", "y' H y H H (Cancel),y2 S S y H"),
  mk("r' R r R' z r' R r R' r' R r R'", "26d", "y2 H y S S,y H H y H (Cancel),x z' r' B R' B' R' r' R' r R r' R' r'"),
];

const scrphzpure: SkewbAlgCase[] = [
  mk("r' R r R' z B R r' R' r B'", "27", "y' S S y' S S (Cancel),y2 S S y S S,y2 B r' R r R' B' z' R r' R' r,y2 x r' R' z' r B r' R r y' r' R' r,x z' B' r' R r R' B' z2 R r' R' r b',y' x r' R F' r' R r y2 z' r' R r R',y x B r' R' r B r' R r f' R B' R',x z r B R' B' R z2 B r' R r R' B"),
  mk("R r' R' r z r' R' r x R r R'", "28", "r' R' r z Sledge z' Hedge R,S y' S S y' S y2 S (Cancel),x z' r' R' r z r' R r R' r z' r' R' r R,x z R' r' R r R' z R r' R' r z' r' R r,x z r' R r x R r' R z R r' R' r,x R r' R' x' r' R r z' r' R r R',x z r R' r' R r R' z' R r' R r B,y2 x r B R B' R r' R r R' r' R"),
  mk("r R r' R' z' r' R' r z r' R r' R'", "29a", "r' R' r Hedge z' Hedge B,y' S y' S y' H,y x r' R' r R r' R' r' z' r' R' r B,y x r R r' R' z' r' R' r z r' R r' R',x z' B' r' R r R z R r R' r' R r,x z2 R r R' r' R r R z R r R' b',x r' R' r R' B R' B' r' R' r R,x z R r R' r z' r' R r z R r R' r',x z2 R' r' R r B R B' R r' R r"),
  mk("B L' r B' l' r' y r' R' r", "29b", "y S y' H y S y' H y H (Cancel),x R r' R r' R' z' r' R r B' R,y' r' R r y' r l B r' l B',y z' r' R' r y z' r' R r b r' R' r"),
];

const scrl4c: SkewbAlgCase[] = [
  mk("r' R' r y x' R r y R r' R'", "30a", "Setup to triple sledge (Cancel),y2 x R r R' B' r' B' r B,y2 x r B r' z' b' r' R' r b,y2 x B' r' B r B R r' R',y' x R' r' R' r b z r B r' z' b' R,y' x R' r' B' r B R r R' B' "),
  mk("r' R' r z B r B r' B'", "30b", "Setup to triple sledge (Cancel),x z' r' R' r b z r B r' z' b',x B' r B r' B' z' r' R' r b',y x B r' B' z' r' R' r b R,y' x R r R' r' R r R' r2 R r R' r',x B r B' r' B' z' r' R r,y2 x r R' B' r' B' r B R,x z' r' B' r B R r R' B' "),
  mk("r' R r z B r B' r' z' b'", "31", "S S S,y2 x b' r' R' r b z r B r',y2 x b z r B r' B' z' r' R' r,x z2 B R r R' B' r' B' r,x z2 B' r' B' r B R r R',y' x R' B' r' B' r B R r,y x r B R r R' B' r' B' "),
  mk("b' r' R r R' z2 r' R r", "UPerm", "y' x S y2 S,y x b' r' R r R' z2 r' R r,y x' r' R' r z2 R r' R' r b"),
  mk("r' l r' l' B' l' B l r'", "32", "y R L' U' L U L R L' R,y x r' B r' B' z' r' R' r z B r',y x r/r2' B' r B R r R' B' r,y x R2' B' r' B' r B R r R,x r' B' r' B' r B R r R r,y r l' B' l B l r l' r,z r2' R' r b z r B r' z' b' r"),
  mk("B' r R' B x R r' R r'", "33", "S y2 H y2 S,r2'/r R' r R' b' r2'/r B' r,r/r2' R' r R' x' B' R r' B,r R' r R' y L' l L' l,x r' R r R' B' r' B' r B r,x R r' B' r B R r R' B' R'"),
  mk("R' r' R' r z2 R r' R' r b'", "34a", "Setup to U Perm,x b r' R r R' z2 r' R r R"),
  mk("r' R r' R' r z2 R r' R' r B", "34b", "Setup to U perm,x B' r' R r R' z2 r' R r R' r,y x R' r' R' r z2 R r' R' r b'"),
];

const scrl5c: SkewbAlgCase[] = [
  mk("R' b R r' R' r R' b R r' R' r", "35a", "y' S y2 S x z' S y2 S,y' x r' R r R' r R y' r' R r B' r,y' x b R r' b r R' b' r R' r',y x r' R r R' b' R r' R r R' b' R"),
  mk("r' R B R' r B R' z b' r R'", "35b", "S y2 S z' y' S y2 S,y2 x R r' R' r B r' R r' R' r B r',x r B' r' R r R' r B' r' R r R',y x B' r' R r R' r R y' r' R r B' r',x z R r' b z' R B' r' R B' R' r "),
  mk("R' r B' r' R r R' r B' r' R r", "36a", "S y2 S y S y2 S,H y2 H y H y2 H (Cancel),y' x r' R' r B r' R r' R' r B r' R,y x R' r B r' R r' R' r B r' R r',y x r' R r R' r B' r' R r R' r B'"),
  mk("r B' r' R r R' r z2 r' R r' R' r", "36b", "y' S y2 S y' S y2 S (Cancel),S y2 S x' z S y2 S,y' x B r' R r' R' r B r' R r' R' r,x B' r' R' r B r' R r z' r' R r R',y' x B r' R r R' r R y' r' R r B',y2 x r' R r R' r z2 r' R r' R' r B r'"),
  mk("R' r R B' r B R' B r' R r", "37a", "H y H y' S y S (Cancel),S y S y' H y H (Cancel),x B' r' R r R' r B' r' R r R' r,y' x r' R' r B r' R r z' r' R r R' z' r',y2 x R r' R r R' z' r2' R' r B r' R"),
  mk("r' B R r R' B r' z r' R' r", "37b", "y' S y' H y H y' S (Cancel),y' H y' H y S y' S (Cancel),x r B r' R r' R' r B r' R r' R',y2 x r' R r' R' r B r' R r' R' r B,x r' R r z' r B' R r' R' B' r"),
];

export const CATEGORIES: SkewbCategory[] = [
  { key: 'piswirl', en: 'Pi + Swirl Perm', zh: 'Pi + Swirl Perm', group: 'pi', cases: scrpiswirl },
  { key: 'pswirl', en: 'Peanut + Swirl Perm', zh: 'Peanut + Swirl Perm', group: 'peanut', cases: scrpswirl },
  { key: 'l4c', en: 'L4C', zh: 'L4C', group: 'l', cases: scrl4c },
  { key: 'piwat', en: 'Pi + Wat Perm', zh: 'Pi + Wat Perm', group: 'pi', cases: scrpiwat },
  { key: 'pwat', en: 'Peanut + Wat Perm', zh: 'Peanut + Wat Perm', group: 'peanut', cases: scrpwat },
  { key: 'l5c', en: 'L5C', zh: 'L5C', group: 'l', cases: scrl5c },
  { key: 'pix', en: 'Pi + X Perm', zh: 'Pi + X Perm', group: 'pi', cases: scrpix },
  { key: 'px', en: 'Peanut + X Perm', zh: 'Peanut + X Perm', group: 'peanut', cases: scrpx },
  { key: 'pihu', en: 'Pi + Horizontal U Perm', zh: 'Pi + Horizontal U Perm', group: 'pi', cases: scrpihu },
  { key: 'phu', en: 'Peanut + Horizontal U Perm', zh: 'Peanut + Horizontal U Perm', group: 'peanut', cases: scrphu },
  { key: 'pivu', en: 'Pi + Vertical U Perm', zh: 'Pi + Vertical U Perm', group: 'pi', cases: scrpivu },
  { key: 'pvu', en: 'Peanut + Vertical U Perm', zh: 'Peanut + Vertical U Perm', group: 'peanut', cases: scrpvu },
  { key: 'pio', en: 'Pi + O Perm', zh: 'Pi + O Perm', group: 'pi', cases: scrpio },
  { key: 'po', en: 'Peanut + O Perm', zh: 'Peanut + O Perm', group: 'peanut', cases: scrpo },
  { key: 'pizconj', en: 'Pi + Z Perm Conjugates', zh: 'Pi + Z Perm Conjugates', group: 'pi', cases: scrpizconj },
  { key: 'pzconj', en: 'Peanut + Z Perm Conjugates', zh: 'Peanut + Z Perm Conjugates', group: 'peanut', cases: scrpzconj },
  { key: 'pi3s', en: 'Pi + Triple Sledge', zh: 'Pi + Triple Sledge', group: 'pi', cases: scrpi3s },
  { key: 'p3s', en: 'Peanut + Triple Sledge', zh: 'Peanut + Triple Sledge', group: 'peanut', cases: scrp3s },
  { key: 'pihz', en: 'Pi + H or Z Perm', zh: 'Pi + H or Z Perm', group: 'pi', cases: scrpihz },
  { key: 'phzpure', en: 'Peanut + H or Z Perm and Pure Peanut', zh: 'Peanut + H or Z Perm and Pure Peanut', group: 'peanut', cases: scrphzpure },
];

// Matches source `allAlgs` == the #selectAlgsbyID grid order.
export const ALL_ALGS: SkewbAlgCase[] = [
  ...scrpiswirl,
  ...scrpiwat,
  ...scrpix,
  ...scrpihu,
  ...scrpivu,
  ...scrpio,
  ...scrpizconj,
  ...scrpi3s,
  ...scrpihz,
  ...scrpswirl,
  ...scrpwat,
  ...scrpx,
  ...scrphu,
  ...scrpvu,
  ...scrpo,
  ...scrpzconj,
  ...scrp3s,
  ...scrphzpure,
  ...scrl4c,
  ...scrl5c,
];
