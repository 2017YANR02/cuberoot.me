/** 2x2 FL Algorithms (First Layer), credited to Anthony Brooks and Andy Klise.
 *  Each row is one case in source order, with the primary algorithm first.
 */
export const FL_CASE_ALGS = {
  top: {
    '0': [
      ["U2 R2"],
      ["U2 R U' R U R' U' R"],
      ["U R2' U R U' R", "U R' U R U2' R"],
      ["R U R' U R2"],
      ["U2 R U2 R"],
      ["U R U R2'"],
      ["R U2 R U2' R"],
      ["U2 R U R", "U' R' U R U' R2'"],
      ["R2 U R' U R2", "R' U R2 U R2'"],
    ],
    '+': [
      ["U' R U' R' U2 R'"],
      ["U R U2' R U R'"],
      ["U' R U R' U R' U' R"],
      ["U2 R' U' R2"],
      ["R U' R U R'"],
      ["y U R U' R2' F2 R", "R2' U' R U R2 U2 R"],
      ["R2' U' R U R'"],
      ["U' R U2 R U' R'", "U' R U' R U2' R'"],
      ["R U2 R' U' R2", "x U R2 U' L"],
    ],
    '-': [
      ["U2 R' U R' U' R U R'"],
      ["U R2 U2' R'"],
      ["U R U2' R2' U' R", "U' L' U R2 U' x'", "U' R' F R2 F'"],
      ["U R' U2 R'"],
      ["R2 U' R'"],
      ["U' R' U R' U' R", "R U' R2' U' R"],
      ["R' U' R'"],
      ["R U' R' U R' U' R", "R2 U' R2' U' R"],
      ["R U R' U2 R'"],
    ],
  },
  mixed: {
    '0': [
      ["y R U2' R' U R U' R'", "U' R2' U' R2 U R2'"],
      ["y U' R U R'", "U R' U2 R"],
      ["U' R' U' R"],
    ],
    '+': [
      ["U R U' R2'"],
      ["U' R' U R2 U' R2'", "U2 R U' R U2 R"],
      ["U2 R U2 R U R2'", "y F' R' F R2 U' R2' F R"],
    ],
    '-': [
      ["U R' U' R' U R'"],
      ["U' R2 U R'"],
      ["R U R2' U' R U R'", "y R U' R2' F R U' R' F R", "R F R' F' U2 R"],
    ],
  },
  bottom: {
    '0': [
      ["R U R' U' R2 U' R", "y R U' R' U R U' R'"],
      ["R' U R U' R' U R"],
    ],
    '+': [
      ["R U' R' U R U' R'"],
      ["R U' R U' R"],
      ["R U2' R2' U R2", "R' U2 R2 U' R2'"],
    ],
    '-': [
      ["R U R' U' R U R'"],
      ["R2 U R2' U2' R"],
      ["R' U R' U R'"],
    ],
  },
} as const;
