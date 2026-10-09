// Faithful port of the pure virtual-cube core of spooncuber reader.js.
//
// arra = sticker-color (letter) state, arrc = delayed-copy scratch.
// BOTH are 1-indexed: index 0 of every array is a space/0 sentinel and is never
// read on the live path. Faces are arra[1..6], each face arra[f][1..9].
// KEEPING the index-0 sentinel and 1-based indexing VERBATIM is load-bearing —
// any off-by-one silently corrupts the trace.
//
// Upstream uses module globals; this is an INSTANCE class so each read uses a
// fresh, re-entrant cube (no cross-call corruption between edgeread/cornerread/
// edgeorientation/cornerorientation).

const VALID_MOVES = [
  'R', 'L', 'F', 'B', 'U', 'D', 'R2', 'L2', 'F2', 'B2', 'U2', 'D2', "R'", "L'", "F'", "B'", "U'", "D'",
  'x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'",
  'r', 'r2', "r'", 'f', 'f2', "f'", 'u', 'u2', "u'", 'd', 'd2', "d'", 'l', 'l2', "l'", 'b', 'b2', "b'",
  'S', 'S2', "S'", 'M', 'M2', "M'", 'E', 'E2', "E'",
  'Rw', 'Rw2', "Rw'", 'Fw', 'Fw2', "Fw'", 'Uw', 'Uw2', "Uw'", 'Dw', 'Dw2', "Dw'", 'Lw', 'Lw2', "Lw'", 'Bw', 'Bw2', "Bw'",
];

export class CubeModel {
  // [[0],[0],[0],[0],[0],[0],[0]] — 7 rows, index 0 unused; each row grows to length 10.
  arra: (string | number)[][] = [[0], [0], [0], [0], [0], [0], [0]];
  arrc: (string | number)[][] = [[0], [0], [0], [0], [0], [0], [0]];

  transformation1(transa: number, transb: number, transc: number, transd: number): void {
    this.arrc[transa][transb] = this.arra[transa][transb];
    this.arra[transa][transb] = this.arrc[transc][transd];
  }

  transformation2(transa: number, transb: number, transc: number, transd: number): void {
    this.arrc[transa][transb] = this.arra[transa][transb];
    this.arra[transa][transb] = this.arra[transc][transd];
  }

  movef(): void {
    const arra = this.arra;
    const arrc = this.arrc;
    for (let i = 1; i <= 9; i++) {
      arrc[5][i] = arra[5][i];
    }
    arra[5][1] = arra[5][7];
    arra[5][7] = arra[5][9];
    arra[5][9] = arra[5][3];
    arra[5][3] = arrc[5][1];
    arra[5][2] = arra[5][4];
    arra[5][4] = arra[5][8];
    arra[5][8] = arra[5][6];
    arra[5][6] = arrc[5][2];
    for (let i = 1; i <= 3; i++) {
      this.transformation2(3, 3 * i, 2, i);
    }
    for (let i = 1; i <= 3; i++) {
      this.transformation2(2, i, 4, 10 - 3 * i);
    }
    for (let i = 1; i <= 3; i++) {
      this.transformation2(4, 3 * i - 2, 1, 6 + i);
    }
    for (let i = 1; i <= 3; i++) {
      this.transformation1(1, 6 + i, 3, 12 - 3 * i);
    }
  }

  movex(): void {
    const arra = this.arra;
    const arrc = this.arrc;
    for (let i = 1; i <= 9; i++) {
      arrc[3][i] = arra[3][i];
      arrc[4][i] = arra[4][i];
    }
    arra[3][1] = arra[3][3];
    arra[3][3] = arra[3][9];
    arra[3][9] = arra[3][7];
    arra[3][7] = arrc[3][1];
    arra[3][2] = arra[3][6];
    arra[3][6] = arra[3][8];
    arra[3][8] = arra[3][4];
    arra[3][4] = arrc[3][2];
    arra[4][1] = arra[4][7];
    arra[4][7] = arra[4][9];
    arra[4][9] = arra[4][3];
    arra[4][3] = arrc[4][1];
    arra[4][2] = arra[4][4];
    arra[4][4] = arra[4][8];
    arra[4][8] = arra[4][6];
    arra[4][6] = arrc[4][2];
    for (let i = 1; i <= 9; i++) {
      this.transformation2(6, i, 1, 10 - i);
    }
    for (let i = 1; i <= 9; i++) {
      this.transformation1(2, i, 6, 10 - i);
    }
    for (let i = 1; i <= 9; i++) {
      this.transformation1(5, i, 2, i);
    }
    for (let i = 1; i <= 9; i++) {
      this.transformation1(1, i, 5, i);
    }
  }

  movey(): void {
    const arra = this.arra;
    const arrc = this.arrc;
    for (let i = 1; i <= 9; i++) {
      arrc[1][i] = arra[1][i];
      arrc[2][i] = arra[2][i];
    }
    arra[2][1] = arra[2][3];
    arra[2][3] = arra[2][9];
    arra[2][9] = arra[2][7];
    arra[2][7] = arrc[2][1];
    arra[2][2] = arra[2][6];
    arra[2][6] = arra[2][8];
    arra[2][8] = arra[2][4];
    arra[2][4] = arrc[2][2];
    arra[1][1] = arra[1][7];
    arra[1][7] = arra[1][9];
    arra[1][9] = arra[1][3];
    arra[1][3] = arrc[1][1];
    arra[1][2] = arra[1][4];
    arra[1][4] = arra[1][8];
    arra[1][8] = arra[1][6];
    arra[1][6] = arrc[1][2];
    for (let i = 1; i <= 9; i++) {
      this.transformation2(6, i, 3, i);
    }
    for (let i = 1; i <= 9; i++) {
      this.transformation2(3, i, 5, i);
    }
    for (let i = 1; i <= 9; i++) {
      this.transformation2(5, i, 4, i);
    }
    for (let i = 1; i <= 9; i++) {
      arra[4][i] = arrc[6][i];
    }
  }

  initialize(): void {
    const arra = this.arra;
    arra[1][1] = 'D';
    arra[1][2] = 'E';
    arra[1][3] = 'G';
    arra[1][4] = 'C';
    arra[1][5] = 'U';
    arra[1][6] = 'G';
    arra[1][7] = 'A';
    arra[1][8] = 'A';
    arra[1][9] = 'J';
    arra[2][1] = 'W';
    arra[2][2] = 'I';
    arra[2][3] = 'X';
    arra[2][4] = 'K';
    arra[2][5] = 'D';
    arra[2][6] = 'O';
    arra[2][7] = 'O';
    arra[2][8] = 'M';
    arra[2][9] = 'R';
    arra[3][1] = 'E';
    arra[3][2] = 'D';
    arra[3][3] = 'C';
    arra[3][4] = 'X';
    arra[3][5] = 'L';
    arra[3][6] = 'T';
    arra[3][7] = 'Q';
    arra[3][8] = 'L';
    arra[3][9] = 'M';
    arra[4][1] = 'K';
    arra[4][2] = 'H';
    arra[4][3] = 'I';
    arra[4][4] = 'R';
    arra[4][5] = 'R';
    arra[4][6] = 'Z';
    arra[4][7] = 'Z';
    arra[4][8] = 'P';
    arra[4][9] = 'S';
    arra[5][1] = 'B';
    arra[5][2] = 'B';
    arra[5][3] = 'L';
    arra[5][4] = 'S';
    arra[5][5] = 'F';
    arra[5][6] = 'Q';
    arra[5][7] = 'N';
    arra[5][8] = 'J';
    arra[5][9] = 'Y';
    arra[6][1] = 'H';
    arra[6][2] = 'F';
    arra[6][3] = 'F';
    arra[6][4] = 'Y';
    arra[6][5] = 'B';
    arra[6][6] = 'W';
    arra[6][7] = 'T';
    arra[6][8] = 'N';
    arra[6][9] = 'P';
  }

  // ----- composed moves (all derived from movef/movex/movey, verbatim) -----

  movez(): void {
    this.movex();
    this.movey();
    this.movex();
    this.movex();
    this.movex();
  }
  movel(): void {
    this.movey();
    this.movey();
    this.movey();
    this.movef();
    this.movey();
  }
  moveu(): void {
    this.movex();
    this.movex();
    this.movex();
    this.movef();
    this.movex();
  }
  moveb(): void {
    this.movex();
    this.movex();
    this.movef();
    this.movex();
    this.movex();
  }
  mover(): void {
    this.movey();
    this.movef();
    this.movey();
    this.movey();
    this.movey();
  }
  moved(): void {
    this.movex();
    this.movef();
    this.movex();
    this.movex();
    this.movex();
  }
  movedi(): void {
    this.moved();
    this.moved();
    this.moved();
  }
  moveli(): void {
    this.movel();
    this.movel();
    this.movel();
  }
  moveri(): void {
    this.mover();
    this.mover();
    this.mover();
  }
  movefi(): void {
    this.movef();
    this.movef();
    this.movef();
  }
  moveui(): void {
    this.moveu();
    this.moveu();
    this.moveu();
  }
  movebi(): void {
    this.moveb();
    this.moveb();
    this.moveb();
  }
  moved2(): void {
    this.moved();
    this.moved();
  }
  movel2(): void {
    this.movel();
    this.movel();
  }
  mover2(): void {
    this.mover();
    this.mover();
  }
  movef2(): void {
    this.movef();
    this.movef();
  }
  moveu2(): void {
    this.moveu();
    this.moveu();
  }
  moveb2(): void {
    this.moveb();
    this.moveb();
  }
  movexr(): void {
    this.movel();
    this.movex();
  }
  movexf(): void {
    this.moveb();
    this.movez();
  }
  movexu(): void {
    this.moved();
    this.movey();
  }
  movexd(): void {
    this.moveu();
    this.movey();
    this.movey();
    this.movey();
  }
  movexl(): void {
    this.mover();
    this.movex();
    this.movex();
    this.movex();
  }
  movexb(): void {
    this.movef();
    this.movez();
    this.movez();
    this.movez();
  }
  movex2(): void {
    this.movex();
    this.movex();
  }
  movey2(): void {
    this.movey();
    this.movey();
  }
  movez2(): void {
    this.movez();
    this.movez();
  }
  movexi(): void {
    this.movex();
    this.movex();
    this.movex();
  }
  moveyi(): void {
    this.movey();
    this.movey();
    this.movey();
  }
  movezi(): void {
    this.movez();
    this.movez();
    this.movez();
  }
  movem(): void {
    this.mover();
    this.moveli();
    this.movex();
    this.movex();
    this.movex();
  }
  movem2(): void {
    this.mover2();
    this.movel2();
    this.movex2();
  }
  movemi(): void {
    this.movex();
    this.movel();
    this.mover();
    this.mover();
    this.mover();
  }
  moves(): void {
    this.movef();
    this.movef();
    this.movef();
    this.moveb();
    this.movez();
  }
  moves2(): void {
    this.movef2();
    this.moveb2();
    this.movez2();
  }
  movesi(): void {
    this.movez();
    this.movez();
    this.movez();
    this.moveb();
    this.moveb();
    this.moveb();
    this.movef();
  }
  movee(): void {
    this.moveu();
    this.moved();
    this.moved();
    this.moved();
    this.movey();
    this.movey();
    this.movey();
  }
  movee2(): void {
    this.moveu2();
    this.moved2();
    this.movey2();
  }
  moveei(): void {
    this.movey();
    this.moved();
    this.moveu();
    this.moveu();
    this.moveu();
  }
  movexr2(): void {
    this.movexr();
    this.movexr();
  }
  movexf2(): void {
    this.movexf();
    this.movexf();
  }
  movexu2(): void {
    this.movexu();
    this.movexu();
  }
  movexd2(): void {
    this.movexd();
    this.movexd();
  }
  movexl2(): void {
    this.movexl();
    this.movexl();
  }
  movexb2(): void {
    this.movexb();
    this.movexb();
  }
  movexri(): void {
    this.movexr();
    this.movexr();
    this.movexr();
  }
  movexfi(): void {
    this.movexf();
    this.movexf();
    this.movexf();
  }
  movexui(): void {
    this.movexu();
    this.movexu();
    this.movexu();
  }
  movexdi(): void {
    this.movexd();
    this.movexd();
    this.movexd();
  }
  movexli(): void {
    this.movexl();
    this.movexl();
    this.movexl();
  }
  movexbi(): void {
    this.movexb();
    this.movexb();
    this.movexb();
  }

  operate(operateChar: string): void {
    switch (operateChar) {
      case 'R':
        this.mover();
        break;
      case 'L':
        this.movel();
        break;
      case 'F':
        this.movef();
        break;
      case 'B':
        this.moveb();
        break;
      case 'U':
        this.moveu();
        break;
      case 'D':
        this.moved();
        break;
      case 'R2':
        this.mover2();
        break;
      case 'L2':
        this.movel2();
        break;
      case 'F2':
        this.movef2();
        break;
      case 'B2':
        this.moveb2();
        break;
      case 'U2':
        this.moveu2();
        break;
      case 'D2':
        this.moved2();
        break;
      case "R'":
        this.moveri();
        break;
      case "L'":
        this.moveli();
        break;
      case "F'":
        this.movefi();
        break;
      case "B'":
        this.movebi();
        break;
      case "U'":
        this.moveui();
        break;
      case "D'":
        this.movedi();
        break;
      case 'x':
        this.movex();
        break;
      case 'x2':
        this.movex2();
        break;
      case "x'":
        this.movexi();
        break;
      case 'y':
        this.movey();
        break;
      case 'y2':
        this.movey2();
        break;
      case "y'":
        this.moveyi();
        break;
      case 'z':
        this.movez();
        break;
      case 'z2':
        this.movez2();
        break;
      case "z'":
        this.movezi();
        break;
      case 'r':
        this.movexr();
        break;
      case 'r2':
        this.movexr2();
        break;
      case "r'":
        this.movexri();
        break;
      case 'f':
        this.movexf();
        break;
      case 'f2':
        this.movexf2();
        break;
      case "f'":
        this.movexfi();
        break;
      case 'u':
        this.movexu();
        break;
      case 'u2':
        this.movexu2();
        break;
      case "u'":
        this.movexui();
        break;
      case 'd':
        this.movexd();
        break;
      case 'd2':
        this.movexd2();
        break;
      case "d'":
        this.movexdi();
        break;
      case 'l':
        this.movexl();
        break;
      case 'l2':
        this.movexl2();
        break;
      case "l'":
        this.movexli();
        break;
      case 'b':
        this.movexb();
        break;
      case 'b2':
        this.movexb2();
        break;
      case "b'":
        this.movexbi();
        break;
      case 'S':
        this.moves();
        break;
      case 'S2':
        this.moves2();
        break;
      case "S'":
        this.movesi();
        break;
      case 'M':
        this.movem();
        break;
      case 'M2':
        this.movem2();
        break;
      case "M'":
        this.movemi();
        break;
      case 'E':
        this.movee();
        break;
      case 'E2':
        this.movee2();
        break;
      case "E'":
        this.moveei();
        break;
      case 'Rw':
        this.movexr();
        break;
      case 'Rw2':
        this.movexr2();
        break;
      case "Rw'":
        this.movexri();
        break;
      case 'Fw':
        this.movexf();
        break;
      case 'Fw2':
        this.movexf2();
        break;
      case "Fw'":
        this.movexfi();
        break;
      case 'Uw':
        this.movexu();
        break;
      case 'Uw2':
        this.movexu2();
        break;
      case "Uw'":
        this.movexui();
        break;
      case 'Dw':
        this.movexd();
        break;
      case 'Dw2':
        this.movexd2();
        break;
      case "Dw'":
        this.movexdi();
        break;
      case 'Lw':
        this.movexl();
        break;
      case 'Lw2':
        this.movexl2();
        break;
      case "Lw'":
        this.movexli();
        break;
      case 'Bw':
        this.movexb();
        break;
      case 'Bw2':
        this.movexb2();
        break;
      case "Bw'":
        this.movexbi();
        break;
      default:
        break;
    }
  }

  /**
   * Re-initializes to the solved Chichu layout, then applies each whitespace-
   * separated token. Unknown tokens are SILENTLY IGNORED (matches upstream: the
   * else branch is empty — no initialize()/return false). Returns arra (for
   * parity with upstream operatealg's `return outarr`, used by m2p bridge).
   */
  operatealg(s1: string): (string | number)[][] {
    this.initialize();
    const arr = s1.split(' ');
    for (let i = 0; i < arr.length; i++) {
      if (VALID_MOVES.indexOf(arr[i]) > -1) {
        this.operate(arr[i]);
      } else {
        // upstream: empty else (silently ignore unknown tokens)
      }
    }
    return this.arra;
  }

  /** Edge permutation oracle: default-scheme EDGE letter -> sticker letter at that physical position. */
  track1(track1Str: string): string | number {
    const arra = this.arra;
    switch (track1Str) {
      case 'A':
        return arra[1][8];
      case 'B':
        return arra[5][2];
      case 'C':
        return arra[1][4];
      case 'D':
        return arra[3][2];
      case 'E':
        return arra[1][2];
      case 'F':
        return arra[6][2];
      case 'G':
        return arra[1][6];
      case 'H':
        return arra[4][2];
      case 'I':
        return arra[2][2];
      case 'J':
        return arra[5][8];
      case 'K':
        return arra[2][4];
      case 'L':
        return arra[3][8];
      case 'M':
        return arra[2][8];
      case 'N':
        return arra[6][8];
      case 'O':
        return arra[2][6];
      case 'P':
        return arra[4][8];
      case 'Q':
        return arra[5][6];
      case 'R':
        return arra[4][4];
      case 'S':
        return arra[5][4];
      case 'T':
        return arra[3][6];
      case 'W':
        return arra[6][6];
      case 'X':
        return arra[3][4];
      case 'Y':
        return arra[6][4];
      case 'Z':
        return arra[4][6];
      default:
        return 0;
    }
  }

  /** Corner permutation oracle: default-scheme CORNER letter -> sticker letter at that physical position. */
  track2(track2Str: string): string | number {
    const arra = this.arra;
    switch (track2Str) {
      case 'A':
        return arra[1][7];
      case 'B':
        return arra[5][1];
      case 'C':
        return arra[3][3];
      case 'D':
        return arra[1][1];
      case 'E':
        return arra[3][1];
      case 'F':
        return arra[6][3];
      case 'G':
        return arra[1][3];
      case 'H':
        return arra[6][1];
      case 'I':
        return arra[4][3];
      case 'J':
        return arra[1][9];
      case 'K':
        return arra[4][1];
      case 'L':
        return arra[5][3];
      case 'W':
        return arra[2][1];
      case 'M':
        return arra[3][9];
      case 'N':
        return arra[5][7];
      case 'O':
        return arra[2][7];
      case 'P':
        return arra[6][9];
      case 'Q':
        return arra[3][7];
      case 'R':
        return arra[2][9];
      case 'S':
        return arra[4][9];
      case 'T':
        return arra[6][7];
      case 'X':
        return arra[2][3];
      case 'Y':
        return arra[5][9];
      case 'Z':
        return arra[4][7];
      default:
        return 0;
    }
  }
}
