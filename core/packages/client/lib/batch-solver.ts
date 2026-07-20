/**
 * trangium Batch Solver 引擎(BatchSolver/worker.js)的逐分支等价移植。
 * 上游: https://github.com/trangium/trangium.github.io (MIT, Copyright (c) 2021 trangium)
 *
 * 算法逻辑刻意保持与上游逐分支一致(含各种怪癖,如 ±1e-9 epsilon 深度判定、
 * getReducedSet 把 post-adjust 拼在 setup 前面等),禁止顺手"清理";
 * 等价性由 tests/batch_solver.test.ts 的 golden fixture 按消息流逐条锁定。
 *
 * 与上游的结构差异(不影响输出):
 * - postMessage 换成注入的 emit 回调(便于同一引擎驱动 Worker 与测试);
 * - 上游 post 错误消息后代码继续往下跑(UI 端收到首个 stop 即中断),
 *   这里 fail() 发出 stop 后直接抛 BatchStop 终止 —— 用户可见行为等价。
 *
 * 文件末尾附 index.html 侧的排序/计数辅助(removeParens / compareBufferElements /
 * getMoveCount 及各 per-move 指标),MCC 本身复用 lib/mcc.ts 的 algSpeed。
 */

export type BatchSolverMessage =
  | { type: 'stop'; value: string | null }
  | { type: 'moveWeights'; value: Map<string, number> }
  | { type: 'next-state'; value: { index: number; setup: string; num: number } }
  | { type: 'num-states'; value: number | string }
  | { type: 'solution'; value: string }
  | { type: 'depthUpdate'; value: number }
  | { type: 'set-depth'; value: number };

export interface BatchSubgroupInput {
  subgroup: string;
  prune: string;
  search: string;
}

export interface BatchSortingInput {
  type: string;
  pieces: string;
}

export interface BatchSolverInput {
  puzzle: string;
  ignore: string;
  solve: string;
  preAdjust: string;
  postAdjust: string;
  subgroups: BatchSubgroupInput[];
  sorting: BatchSortingInput[];
  esq: string;
  rankesq: string;
  showPost: boolean;
  optimise?: boolean;
}

export class BatchStop extends Error {}

let post: (m: BatchSolverMessage) => void = () => {};

function fail(value: string): never {
  post({ value, type: 'stop' });
  throw new BatchStop(value);
}

function arraysEqual(arr1: number[], arr2: number[]): boolean {
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
}

// 逐层"可选取可跳过"的笛卡尔积,恒含空数组
function cartesian<T>(arrays: T[][]): T[][] {
  const singleStep = (acc: T[][], add: T[]) => acc.concat(...add.map((next) => acc.map((a) => a.concat(next))));
  let prod: T[][] = [[]];
  for (const arr of arrays) prod = singleStep(prod, arr);
  return prod;
}

// 返回"按代价升序的下一手"查表:索引为 move ID,值为代价次高的 move(最贵的记 -1),
// 末尾附加最便宜的 move。getMoveNexts(w).length === w.length + 1。
function getMoveNexts(moveWeights: number[]): number[] {
  const moveOrder = moveWeights
    .map((elem, ind) => [ind, elem] as const)
    .sort((iep1, iep2) => iep1[1] - iep2[1])
    .map((c) => c[0]);
  const moveNexts: number[] = [];
  for (let i = 0; i < moveWeights.length; i++) {
    const moveRanking = moveOrder.indexOf(i) + 1;
    moveNexts.push(moveRanking === moveWeights.length ? -1 : moveOrder[moveRanking]);
  }
  return moveNexts.concat(moveOrder[0]);
}

export function lastAlpha(move: string): number {
  let needle = move.length - 1;
  while (needle >= 0) {
    if (/[a-zA-Z]/.test(move[needle])) {
      return needle;
    }
    needle--;
  }
  return -1;
}

function removeBrackets(s: string): string {
  return s.replace(/\(|\)|\[|\]|{|}|<|>/g, '');
}

export function splitSubgroupStr(s: string): string[] {
  return removeBrackets(s)
    .replaceAll(',', ' ')
    .split(' ')
    .filter((x) => x !== '');
}

export function parseESQ(esq: string): Map<string, number> {
  const moveWeights = new Map<string, number>();
  for (const line of esq.split('\n')) {
    const splitLine = line.split(':');
    if (splitLine.length === 2) {
      const moveNames = splitSubgroupStr(splitLine[0]);
      const data = splitLine[1].trim();
      for (const moveName of moveNames) {
        moveWeights.set(moveName, parseFloat(data));
      }
    }
  }
  return moveWeights;
}

// 解析 Scramble 里 "#" 后的 case 过滤(单号 / 区间 / N+),返回 [选中集合, 起始号]
function parseModifiers(input: string): [Set<number>, number] {
  function errParse(x: string): number {
    const pInt = parseInt(x, 10);
    if (pInt !== pInt || pInt <= 0) {
      fail('"' + x + '" is not a positive number. (Error in Scramble)');
    }
    return pInt;
  }

  input = input.replaceAll('\n', '');
  const indexPound = input.indexOf('#');
  if (indexPound === -1) {
    return [new Set(), 1];
  }
  const modificationStr = input.slice(indexPound + 1);
  const modificationList = modificationStr.split(',').filter((x) => x !== '');
  const modifications = new Set<number>();
  let startNum = Infinity;
  for (const mod of modificationList) {
    if (mod.includes('+')) {
      startNum = Math.min(startNum, errParse(mod));
    } else if (mod.includes('-')) {
      const int1 = errParse(mod.split('-')[0]);
      const int2 = errParse(mod.split('-')[1]);
      if (int2 <= int1) {
        fail('Invalid range: "' + mod + '" (Error in Scramble)');
      }
      for (let i = int1; i <= int2; i++) {
        modifications.add(i);
      }
    } else {
      modifications.add(errParse(mod));
    }
  }
  return [modifications, startNum];
}

// 把 Scramble 切成 [闭合括号类型, 内容] 序列:"" 为裸执行段,"]" 为多分支,">" 为生成元
function parseBatch(input: string): [string, string][] {
  let closingChar = '';
  let dataInside = '';
  const finalData: [string, string][] = [];
  const bracketMap = new Map([
    ['[', ']'],
    ['<', '>'],
  ]);
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (closingChar !== '') {
      if (char === closingChar) {
        finalData.push([closingChar, dataInside]);
        closingChar = '';
        dataInside = '';
      } else {
        dataInside += char;
        if (i === input.length - 1) {
          fail('Missing "' + closingChar + '" in Scramble');
        }
      }
    } else {
      if (!bracketMap.has(char)) {
        dataInside += char;
      }
      if (bracketMap.has(char) || i === input.length - 1) {
        finalData.push(['', dataInside]);
        closingChar = bracketMap.get(char) ?? '';
        dataInside = '';
      }
    }
  }
  return finalData;
}

export class Puzzle {
  cubeOri: number[];
  pcCount: number;
  posBits: number;
  posMask: number;
  oriMask: number;
  totalBits: number; // 上游遗留字段,仅注释引用
  clockwiseMoves: number[][];
  clockwiseMoveStr: string[];
  moveStr: string[];
  nullmove: number[];
  solved: number[];
  moves: number[][];
  inverse: number[];
  validPairs: boolean[][];
  pruneTable: Map<string, number>;
  pruneDepth: number;
  adjustSequences: number[][];
  adjustMovesTable: boolean[];
  adjustCount: number;
  moveWeightsMap: Map<string, number>;
  moveWeights: number[];
  inverseWeights: number[];
  moveNexts: number[];
  inverseNexts: number[];

  // 在 start 上执行一个 move,写入 result(低位存位置,高位存朝向)
  mult(start: number[], move: number[], result: number[]): void {
    for (let p = 0; p < this.pcCount; p++) {
      const temp = start[move[p] & this.posMask] + (move[p] & this.oriMask);
      const tempOri = this.cubeOri[temp & this.posMask];
      result[p] = temp % (tempOri << this.posBits);
    }
  }

  constructor(
    cubeOri: number[],
    clockwiseMoves: number[][],
    clockwiseMoveStr: string[],
    solvedState: number[] | null = null,
    moveWeightsMap: Map<string, number> = new Map(),
  ) {
    this.cubeOri = cubeOri;
    this.pcCount = cubeOri.length;
    this.posBits = Math.ceil(Math.log2(this.pcCount));
    this.posMask = (1 << this.posBits) - 1;
    this.oriMask = ((1 << Math.ceil(Math.log2(Math.max(...cubeOri)))) - 1) << this.posBits;
    this.totalBits = Math.ceil(Math.log2(this.oriMask));
    this.clockwiseMoves = clockwiseMoves.slice();
    this.clockwiseMoveStr = clockwiseMoveStr.slice();
    this.moveStr = [];

    this.nullmove = [];
    for (let i = 0; i < this.pcCount; i++) {
      this.nullmove[i] = i;
    }
    this.solved = solvedState === null ? this.nullmove : solvedState;

    // 展开每个生成元的全部方向(U, U2, U')并建逆映射
    // (上游直接 shift() 消耗传入数组;这里改为消耗副本,行为一致)
    const moveNames = clockwiseMoveStr.slice();
    this.moves = [];
    this.inverse = [];
    for (let i = 0; i < clockwiseMoves.length; i++) {
      this.moves.push(clockwiseMoves[i]);
      while (true) {
        this.moves.push([]);
        this.mult(this.moves[this.moves.length - 2], clockwiseMoves[i], this.moves[this.moves.length - 1]);
        if (arraysEqual(this.moves[this.moves.length - 1], this.nullmove)) {
          this.moves.pop();
          break;
        }
      }
      const order = this.moves.length - this.inverse.length + 1;
      const currentMove = moveNames.shift();
      for (let j = 1; j < order; j++) {
        if (j <= order / 2) {
          this.moveStr.push(currentMove + (j !== 1 ? String(j) : ''));
        } else {
          this.moveStr.push(currentMove + (order - j !== 1 ? String(order - j) : '') + "'");
        }
      }
      let invCounter = this.moves.length;
      while (this.inverse.length < this.moves.length) {
        invCounter--;
        this.inverse.push(invCounter);
      }
    }

    // 相邻两手是否有效:同类型无效(U U2);可交换的异类型只保留一个顺序(U D2 / D2 U 二选一)
    this.validPairs = [];
    for (let move1 = 0; move1 < this.moves.length; move1++) {
      this.validPairs[move1] = [];
      for (let move2 = 0; move2 < this.moves.length; move2++) {
        const prod1: number[] = [];
        const prod2: number[] = [];
        this.mult(this.moves[move1], this.moves[move2], prod1);
        this.mult(this.moves[move2], this.moves[move1], prod2);
        if (arraysEqual(prod1, prod2)) {
          this.validPairs[move1][move2] = move1 < move2;
          if (arraysEqual(prod1, this.nullmove)) {
            this.validPairs[move1][move2] = false;
          }
          for (let m = 0; m < this.moves.length; m++) {
            if (arraysEqual(prod1, this.moves[m])) {
              this.validPairs[move1][move2] = false;
            }
          }
        } else {
          this.validPairs[move1][move2] = true;
        }
      }
    }

    this.pruneTable = new Map();
    this.pruneDepth = 0;

    this.adjustSequences = [[]];
    this.adjustMovesTable = [];
    for (let i = 0; i < this.moves.length; i++) {
      this.adjustMovesTable[i] = false;
    }
    this.adjustCount = 0;

    // 每手权重:精确名 > 名字通配(R_)> 幅度通配(_2)> 全通配(__)> 1
    this.moveWeightsMap = moveWeightsMap;
    this.moveWeights = [];
    for (let i = 0; i < this.moves.length; i++) {
      const moveName = this.moveStr[i];
      const moveType = moveName.slice(0, lastAlpha(moveName) + 1) + '_';
      const moveAmount = '_' + moveName.slice(lastAlpha(moveName) + 1);
      if (moveWeightsMap.has(moveName)) {
        this.moveWeights.push(moveWeightsMap.get(moveName)!);
      } else if (moveWeightsMap.has(moveType)) {
        this.moveWeights.push(moveWeightsMap.get(moveType)!);
      } else if (moveWeightsMap.has(moveAmount)) {
        this.moveWeights.push(moveWeightsMap.get(moveAmount)!);
      } else if (moveWeightsMap.has('__')) {
        this.moveWeights.push(moveWeightsMap.get('__')!);
      } else {
        this.moveWeights.push(1);
      }
    }

    this.inverseWeights = [];
    for (let i = 0; i < this.moves.length; i++) {
      this.inverseWeights.push(this.moveWeights[this.inverse[i]]);
    }

    this.moveNexts = getMoveNexts(this.moveWeights);
    this.inverseNexts = getMoveNexts(this.inverseWeights);
  }

  execute(start: number[], sequence: number[]): number[] {
    const tempCube: number[] = [];
    for (let j = 0; j < sequence.length; j++) {
      this.mult(start, this.moves[sequence[j]], tempCube);
      start = tempCube.slice();
    }
    return start;
  }

  // 给定前一手,返回按权重序的下一有效手;move === moves.length 时返回首个有效手
  nextValid(prevMove: number, move: number, moveNextTable: number[]): number {
    while (true) {
      move = moveNextTable[move];
      if (move === -1 || this.validPairs[prevMove][move]) {
        return move;
      }
    }
  }

  compressArr(list: number[]): string {
    let string = '';
    for (let i = 0; i < list.length; i++) {
      string += String.fromCharCode(list[i]);
    }
    return string;
  }

  // 同 nextValid,但用于序列首手(跳过 adjust 手)
  nextValidInitial(move: number, moveNextTable: number[]): number {
    let x = moveNextTable[move];
    while (true) {
      if (x === -1 || !this.adjustMovesTable[x]) {
        return x;
      }
      x = moveNextTable[x];
    }
  }

  getCost(sequence: number[], weightTable: number[]): number {
    let cost = 0;
    for (const move of sequence) {
      cost += weightTable[move];
    }
    return cost;
  }

  popAndAdvance(arr: number[], moveNextTable: number[]): void {
    do {
      arr.pop();
      if (arr.length > 1) {
        arr[arr.length - 1] = this.nextValid(arr[arr.length - 2], arr[arr.length - 1], moveNextTable);
      } else if (arr.length) {
        arr[0] = this.nextValidInitial(arr[0], moveNextTable);
        if (arr[0] === -1) {
          arr.pop();
        }
      }
      if (arr.length === 0) {
        return;
      }
    } while (arr[arr.length - 1] === -1);
  }

  // 生成加权有效长度落在 (seqLength-1, seqLength] 的全部序列(不含 adjust 部分的代价)
  *getPruneSequences(seqLength: number): Generator<[number, number[]]> {
    if (seqLength === 0) {
      for (const sequence of this.adjustSequences) {
        yield [0, sequence];
      }
      return;
    }
    post({ value: 1, type: 'depthUpdate' });
    const arr = [this.nextValidInitial(this.moves.length, this.inverseNexts)];
    while (arr.length) {
      const effectiveLength = this.getCost(arr, this.inverseWeights) - 1e-9;
      if (effectiveLength <= seqLength) {
        if (effectiveLength > seqLength - 1) {
          for (const sequence of this.adjustSequences) {
            yield [effectiveLength + 1e-9, sequence.concat(arr)];
          }
        }
        arr.push(this.nextValid(arr[arr.length - 1], this.moves.length, this.inverseNexts));
      }
      if (effectiveLength + this.inverseWeights[arr[arr.length - 1]] > seqLength) {
        this.popAndAdvance(arr, this.inverseNexts);
      }
    }
  }

  // 生成加权有效长度(不含末手)落在 [seqLength-1, seqLength) 的全部序列
  *getSearchSequences(seqLength: number): Generator<[number, number[]]> {
    if (seqLength === 0) {
      for (const sequence of this.adjustSequences) {
        yield [0, sequence];
      }
      return;
    }
    post({ value: 1, type: 'depthUpdate' });
    const arr = [this.nextValidInitial(this.moves.length, this.moveNexts)];
    while (arr.length) {
      const effectiveLength = this.getCost(arr, this.moveWeights) + 1e-9;
      if (effectiveLength - this.moveWeights[arr[arr.length - 1]] < seqLength) {
        if (effectiveLength - this.moveWeights[arr[arr.length - 1]] >= seqLength - 1) {
          for (const sequence of this.adjustSequences) {
            yield [effectiveLength - 1e-9, sequence.concat(arr)];
          }
        }
        arr.push(this.nextValid(arr[arr.length - 1], this.moves.length, this.moveNexts));
      }
      if (effectiveLength >= seqLength) {
        this.popAndAdvance(arr, this.moveNexts);
      }
    }
  }

  moveListToStr(list: number[], parens = false): string {
    let result = '';
    let adjusting = false;
    for (let i = 0; i < list.length; i++) {
      if (parens && i === 0 && this.adjustMovesTable[list[i]]) {
        result += '(';
        adjusting = true;
      }
      result += this.moveStr[list[i]];
      if (parens && adjusting && (i === list.length - 1 || !this.adjustMovesTable[list[i + 1]])) {
        result += ')';
        adjusting = false;
      }
      if (i !== list.length - 1) {
        result += ' ';
      }
    }
    return result;
  }

  moveStrToList(alg: string): number[] {
    const result: number[] = [];
    const algSplit = alg.split(' ');
    for (let i = 0; i < algSplit.length; i++) {
      if (algSplit[i] !== '') {
        const moveNum = this.moveStr.indexOf(algSplit[i]);
        if (moveNum !== -1) {
          result.push(moveNum);
        } else {
          fail('Unexpected token in Scramble: "' + algSplit[i] + '"');
        }
      }
    }
    return result;
  }

  createPrun(maxDepth: number): void {
    const tempTable = new Map<string, number>();
    for (let depth = 0; depth <= maxDepth; depth++) {
      for (const [cost, sequence] of this.getPruneSequences(depth)) {
        const cubeStr = this.compressArr(this.execute(this.solved, sequence));
        if (!tempTable.has(cubeStr) || tempTable.get(cubeStr)! > cost) {
          tempTable.set(cubeStr, cost);
        }
      }
    }
    this.pruneTable = tempTable;
    this.pruneDepth = maxDepth;
  }

  // createPrunSized 的停表判据:外推增长率超限,或增量趋缓(收敛)即停
  stopPruning(maxSize: number, highestCost: number, prevSizes: number[]): boolean {
    let sizeRatio = 0;
    for (let i = prevSizes.length - highestCost; i < prevSizes.length; i++) {
      if (i > 0) {
        sizeRatio = Math.max(sizeRatio, prevSizes[i] / (prevSizes[i - 1] + 1));
      }
    }
    if (sizeRatio * prevSizes[prevSizes.length - 1] > maxSize) {
      return true;
    }
    const hcPrevious = prevSizes.length - 1 - highestCost >= 0 ? prevSizes[prevSizes.length - 1 - highestCost] : 0;
    const hc2Previous = prevSizes.length - 1 - 2 * highestCost >= 0 ? prevSizes[prevSizes.length - 1 - 2 * highestCost] : 0;
    if (2 * hcPrevious > prevSizes[prevSizes.length - 1] + hc2Previous) {
      return true;
    }
    return false;
  }

  createPrunSized(maxSize: number): void {
    const tempTable = new Map<string, number>();
    const highestCost = Math.ceil(this.moveWeights[this.moveNexts.indexOf(-1)]);
    const prevSizes: number[] = [];
    let depth = 0;
    while (true) {
      for (const [cost, sequence] of this.getPruneSequences(depth)) {
        const cubeStr = this.compressArr(this.execute(this.solved, sequence));
        if (!tempTable.has(cubeStr) || tempTable.get(cubeStr)! > cost) {
          tempTable.set(cubeStr, cost);
        }
      }
      prevSizes.push(tempTable.size);
      if (this.stopPruning(maxSize, highestCost, prevSizes)) {
        break;
      }
      depth++;
    }
    this.pruneTable = tempTable;
    this.pruneDepth = depth;
  }

  // 沿 prune 表递归枚举给定状态在深度内的全部收尾解
  *readPrun(state: number[], partialSolve: number[], showPostAdj: boolean, maxDepth = this.pruneDepth): Generator<string> {
    for (let m = 0; m < this.moves.length; m++) {
      if (partialSolve.length === 0 || this.validPairs[partialSolve[partialSolve.length - 1]][m]) {
        const nextState = this.execute(state, [m]);
        const nextDistance = this.pruneTable.get(this.compressArr(nextState));
        if (nextDistance === 0) {
          const fullSolve = partialSolve.concat(m);
          if (!this.hasEndAdjust(fullSolve)) {
            if (showPostAdj) {
              yield this.moveListToStr(fullSolve, true) + ' ' + this.moveListToStr(this.getEndAdjust(nextState), true);
            } else {
              yield this.moveListToStr(fullSolve, true);
            }
          }
        } else if (nextDistance !== undefined && nextDistance <= maxDepth - this.moveWeights[m]) {
          yield* this.readPrun(nextState, partialSolve.concat(m), showPostAdj, maxDepth - this.moveWeights[m]);
        }
      }
    }
  }

  // 枚举一个状态的全部解
  *solve(state: number[], searchDepth: number, showPostAdj: boolean, startDepth = 0): Generator<string> {
    for (let depth = startDepth; depth <= searchDepth; depth++) {
      for (const [cost, sequence] of this.getSearchSequences(depth)) {
        const nextState = this.execute(state, sequence);
        const thisDistance = this.pruneTable.get(this.compressArr(nextState));
        if (thisDistance !== undefined) {
          yield* this.readPrun(nextState, sequence, showPostAdj, Math.min(this.pruneDepth, this.pruneDepth + searchDepth - cost));
        }
      }
    }
  }

  invert(list: number[]): number[] {
    return list.map((x) => this.inverse[x]).reverse();
  }

  commutes(index1: number, index2: number): boolean {
    const prod1: number[] = [];
    const prod2: number[] = [];
    this.mult(this.moves[index1], this.moves[index2], prod1);
    this.mult(this.moves[index2], this.moves[index1], prod2);
    return arraysEqual(prod1, prod2);
  }

  // 序列末尾是否含(可经交换移到末尾的)adjust 手
  hasEndAdjust(list: number[]): boolean {
    for (let i = list.length - 1; i < list.length && i >= 0; i--) {
      if (this.adjustMovesTable[list[i]]) {
        let allAfterCommute = true;
        for (let j = i + 1; j < list.length; j++) {
          if (!this.commutes(list[i], list[j])) {
            allAfterCommute = false;
          }
        }
        if (allAfterCommute) {
          return true;
        }
      } else {
        let noAdjustCommute = true;
        for (let j = 0; j < this.adjustMovesTable.length; j++) {
          if (this.adjustMovesTable[j] && this.commutes(list[i], j)) {
            noAdjustCommute = false;
          }
        }
        if (noAdjustCommute) {
          return false;
        }
      }
    }
    return false;
  }

  // 输入只差 adjust 手即还原的状态,返回该 adjust 序列
  getEndAdjust(nextState: number[]): number[] {
    for (const seq of this.adjustSequences) {
      if (arraysEqual(this.execute(nextState, seq), this.solved)) {
        return seq;
      }
    }
    throw new Error('getEndAdjust: no adjust sequence solves the state');
  }

  getMoveMultiples(moveNum: number): number[] {
    const moveReps: number[] = [];
    let currentRep = moveNum;
    while (true) {
      moveReps.push(currentRep);
      const move = this.execute(this.moves[currentRep], [moveNum]);
      currentRep = -1;
      for (let i = 0; i < this.moves.length; i++) {
        if (arraysEqual(this.moves[i], move)) {
          currentRep = i;
          break;
        }
      }
      if (currentRep === -1) {
        break;
      }
    }
    return moveReps;
  }

  // 依赖 getSubPuzzle 已把 adjust 生成元排到最前
  setAdjustMoves(num: number): void {
    const moveList = this.clockwiseMoveStr.slice(0, num).map((str) => this.moveStr.indexOf(str));
    this.adjustCount = moveList.length;
    const adjustMoves: number[][] = [];
    for (let i = 0; i < this.moves.length; i++) {
      this.adjustMovesTable[i] = false;
    }
    for (const moveNum of moveList) {
      const moveReps = this.getMoveMultiples(moveNum);
      for (const j of moveReps) {
        this.adjustMovesTable[j] = true;
      }
      adjustMoves.push(moveReps);
    }
    this.adjustSequences = cartesian(adjustMoves);
  }

  setSubgroup(generators: string[]): Puzzle {
    const genArray: number[][] = [];
    for (let i = 0; i < generators.length; i++) {
      const gen = generators[i];
      if (!this.moveStr.includes(gen)) {
        fail('"' + gen + '" is not a valid move in Subgroup.');
      }
      genArray.push(this.execute(this.nullmove, this.moveStrToList(gen)));
    }
    return new Puzzle(this.cubeOri.slice(), genArray, generators, this.solved.slice(), this.moveWeightsMap);
  }

  compressStr(str: string): string {
    return this.compressArr(this.execute(this.solved, this.moveStrToList(str)));
  }

  seriesMult(stateLists: string[][]): string[] {
    let states = new Map(stateLists[0].map((x) => [this.compressStr(x), x]));
    for (let i = 1; i < stateLists.length; i++) {
      const newStates = new Map<string, string>();
      const algs = stateLists[i];
      for (const state of states.values()) {
        for (const alg of algs) {
          const newState = state + ' ' + alg;
          newStates.set(this.compressStr(newState), newState);
        }
      }
      states = new Map(newStates);
    }
    return Array.from(states.values());
  }

  bfs(startStates: string[], generators: string[]): string[] {
    const states = new Map(startStates.map((x) => [this.compressStr(x), x]));
    let newStates = new Map(startStates.map((x) => [this.compressStr(x), x]));
    let nextStates = new Map<string, string>();
    while (true) {
      for (const state of newStates.values()) {
        for (const gen of generators) {
          const prod = state + ' ' + gen;
          if (!states.has(this.compressStr(prod))) {
            nextStates.set(this.compressStr(prod), prod);
            states.set(this.compressStr(prod), prod);
          }
        }
      }
      if (nextStates.size === 0) {
        break;
      }
      newStates = nextStates;
      nextStates = new Map();
      post({ value: states.size + ' (not reduced)', type: 'num-states' });
    }
    return Array.from(states.values());
  }

  getAdjustFromStr(adjStr: string): number[][] {
    return adjStr === '' ? [[]] : cartesian(splitSubgroupStr(adjStr).map((str) => this.getMoveMultiples(this.moveStr.indexOf(str))));
  }

  // 去掉只差一个 pre/post-adjust 的重复 setup(注意上游把 post-adjust 拼在 setup 之前)
  getReducedSet(states: string[], preAdjust: string, postAdjust: string): Set<string> {
    const preAdjustSequences = this.getAdjustFromStr(preAdjust);
    const postAdjustSequences = this.getAdjustFromStr(postAdjust);
    const reducedStates = new Set<string>();
    const duplicateStates = new Set<string>();
    for (const state of states) {
      const cubeStr = this.compressStr(state);
      if (!duplicateStates.has(cubeStr)) {
        reducedStates.add(state);
        for (const preAdjustment of preAdjustSequences) {
          for (const postAdjustment of postAdjustSequences) {
            duplicateStates.add(this.compressStr(this.moveListToStr(postAdjustment) + ' ' + state + ' ' + this.moveListToStr(preAdjustment)));
          }
        }
      }
    }
    return reducedStates;
  }

  compareStates(state1: number[], state2: number[]): number {
    for (let i = 0; i < state1.length; i++) {
      if (state1[i] > state2[i]) return 1;
      if (state1[i] < state2[i]) return -1;
    }
    return 0;
  }

  // 展开 Scramble 得到全部去重排序后的 setup
  getBatchStates(input: string, preAdjust: string, postAdjust: string, pieceList: string[], sorting: BatchSortingInput[]): Set<string> {
    input = (input.includes('#') ? input.slice(0, input.indexOf('#')) : input).replaceAll('\n', '');
    const parsedInput = parseBatch(input);
    let states = [''];
    for (let i = 0; i < parsedInput.length; i++) {
      const type = parsedInput[i][0];
      const data = parsedInput[i][1];
      if (type === '') {
        states = states.map((state) => state + ' ' + data);
      } else if (type === ']') {
        const algs = data.split(',');
        states = this.seriesMult([states, algs]);
      } else if (type === '>') {
        states = this.bfs(states, data.split(','));
      }
    }
    const pieceMap = new Map(pieceList.map((pc, ind) => [pc, ind] as const));
    const sortLookupTable = new Map(states.map((x) => [x, getStatePriority(x, pieceMap, sorting, this)] as const));
    states.sort((s1, s2) => this.compareStates(sortLookupTable.get(s1)!, sortLookupTable.get(s2)!));
    return this.getReducedSet(states, preAdjust, postAdjust);
  }
}

function maskedIndex(stateArr: number[], num: number, bitMask: number, piece: string): number {
  let ind = 0;
  for (const n of stateArr) {
    if ((n & bitMask) === num) {
      return ind;
    }
    ind++;
  }
  fail('Invalid piece: "' + piece + '"');
}

function getStatePriority(str: string, pieceMap: Map<string, number>, sortCriteria: BatchSortingInput[], fullPuzzle: Puzzle): number[] {
  const stateArr = fullPuzzle.execute(fullPuzzle.nullmove, fullPuzzle.moveStrToList(str));
  const pcCount = pieceMap.size;
  let minIndex = 0;
  const pcPriority: number[] = [];
  let statePriority: number[] = [];
  for (let i = 0; i < pcCount; i++) {
    pcPriority.push(i);
  }
  for (const criteria of sortCriteria) {
    if (criteria.pieces.trim().length > 0) {
      if (criteria.type === 'priority') {
        minIndex -= pcCount;
        for (const pieceFull of criteria.pieces.split(' ')) {
          const piece = pieceFull.trim();
          if (piece.length > 0) {
            if (!pieceMap.has(piece)) {
              fail('Invalid piece: "' + piece + '" (in Case Sorting)');
            }
            pcPriority[pieceMap.get(piece)!] = minIndex;
            minIndex++;
          }
        }
        minIndex -= pcCount;
      } else {
        const ori: number[] = [];
        for (const pieceFull of criteria.pieces.split(' ')) {
          const piece = pieceFull.trim();
          if (piece.length > 0) {
            const pieceInd = pieceMap.get(piece);
            if (pieceInd === undefined) {
              fail('Invalid piece: "' + piece + '" (in Case Sorting)');
            }
            if (criteria.type === 'ori-at') {
              ori.push(stateArr[pieceInd] & fullPuzzle.oriMask);
            } else if (criteria.type === 'ori-of') {
              ori.push(stateArr[maskedIndex(stateArr, pieceInd, fullPuzzle.posMask, piece)] & fullPuzzle.oriMask);
            } else if (criteria.type === 'perm-at') {
              ori.push(pcPriority[stateArr[pieceInd] & fullPuzzle.posMask]);
            } else if (criteria.type === 'perm-of') {
              ori.push(pcPriority[maskedIndex(stateArr, pieceInd, fullPuzzle.posMask, piece)]);
            }
          }
        }
        if (criteria.type === 'ori-at' || criteria.type === 'ori-of') {
          const sortedOri = ori.slice().sort((a, b) => a - b);
          statePriority = statePriority.concat(sortedOri);
        }
        statePriority = statePriority.concat(ori);
      }
    }
  }
  return statePriority;
}

function initCubeOri(pzl: Puzzle, pieceList: string[], ignore: string): void {
  const lines = ignore.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(':')) {
      const numOri = parseInt(line.split(':')[0], 10);
      if (numOri !== numOri) {
        fail('"' + line.split(':')[0] + ':" is not a valid Unique Orientations header.');
      }
      if (numOri <= 0) {
        fail('"' + line.split(':')[0] + ':" is invalid because the number of orientations must be positive.');
      }
      const orientData = line.split(':')[1].split(' ');
      for (let j = 0; j < orientData.length; j++) {
        const pieceIndex = pieceList.indexOf(removeBrackets(orientData[j]));
        if (pieceIndex !== -1) {
          if (pzl.cubeOri[pieceIndex] % numOri !== 0) {
            fail(
              'Cannot set number of orientations of piece ' +
                removeBrackets(orientData[j]) +
                ' to ' +
                numOri +
                ' because ' +
                numOri +
                ' is not divisible by ' +
                pzl.cubeOri[pieceIndex] +
                '.',
            );
          }
          pzl.cubeOri[pieceIndex] = numOri;
        } else if (removeBrackets(orientData[j]) !== '') {
          fail('"' + removeBrackets(orientData[j]) + '" is not a piece. (error in Unique Orientations & Equivalences)');
        }
      }
    }
  }
}

function checkMoveGroup(puzzle: Puzzle, movegroup: string, errorStr: string): void {
  const moves = splitSubgroupStr(movegroup);
  for (const move of moves) {
    if (!puzzle.moveStr.includes(move)) {
      fail('"' + move + '" is not a valid move in ' + errorStr);
    }
  }
}

function getSubPuzzle(pieceList: string[], fullPuzzle: Puzzle, ignore: string, subgroup: string, prune: string, adjust: string[]): Puzzle {
  const generators = subgroup.replace(' ', '').length > 0 ? splitSubgroupStr(subgroup) : fullPuzzle.clockwiseMoveStr;

  let hasNonAdjust = false;
  for (const move of generators) {
    for (const move2 of generators) {
      if (!fullPuzzle.commutes(fullPuzzle.moveStr.indexOf(move), fullPuzzle.moveStr.indexOf(move2))) {
        hasNonAdjust = true;
      }
    }
  }
  if (!hasNonAdjust) {
    fail('"' + subgroup + '" is not a valid subgroup because it is commutative.');
  }

  for (const move of adjust) {
    if (!generators.includes(move)) {
      fail('"' + subgroup + '" is not a valid subgroup because it does not contain the adjust move "' + move + '".');
    }
  }

  generators.sort((x, y) => Number(adjust.includes(y)) - Number(adjust.includes(x))); // adjust 手排到最前
  const subPuzzle = fullPuzzle.setSubgroup(generators);

  initCubeOri(subPuzzle, pieceList, ignore);

  subPuzzle.setAdjustMoves(adjust.length);
  post({ value: 0, type: 'set-depth' });

  function errParse(x: string, parseFunc: (s: string, radix: number) => number): number {
    const pFloat = parseFunc(x, 10);
    if (pFloat !== pFloat) {
      fail('"' + x + '" is not a valid prune depth.');
    }
    return pFloat;
  }

  if (prune.toLowerCase().includes('m')) {
    subPuzzle.createPrunSized(errParse(prune, parseFloat) * 1e6);
  } else if (prune.toLowerCase().includes('k')) {
    subPuzzle.createPrunSized(errParse(prune, parseFloat) * 1e3);
  } else {
    subPuzzle.createPrun(errParse(prune, parseInt));
  }

  return subPuzzle;
}

interface SubPuzzleData {
  puzzle: Puzzle;
  search: string;
}

function setPuzzles(
  scramble: string,
  puzzleDef: string,
  ignore: string,
  subgroups: BatchSubgroupInput[],
  adjust: string,
  postAdjust: string,
  sorting: BatchSortingInput[],
  esq: string,
): [Puzzle, Set<string>, SubPuzzleData[]] {
  const moveLines = puzzleDef.split('\n');

  const pieceList: string[] = [];
  const moveDataList: [number, number][][][] = [];

  const cubeOri: number[] = [];
  const moveList: number[][] = [];
  const clockwiseMoveStr: string[] = [];

  // 解析 Puzzle 一行冒号后的循环记号;朝向数 = 块名里大写字母个数(至少 1)
  function parseMove(data: string): [number, number][][] {
    const cycleList: [number, number][][] = [];
    const openParenSplit = data.split('(');
    for (let i = 1; i < openParenSplit.length; i++) {
      const cycle: [number, number][] = [];
      const cycleStr = openParenSplit[i].split(')')[0];
      const pieces = cycleStr.split(' ');
      for (let j = 0; j < pieces.length; j++) {
        const pieceData = pieces[j];
        if (pieceData !== '') {
          const suffixLoc = pieceData.indexOf('+') === -1 ? pieceData.indexOf('-') : pieceData.indexOf('+');
          const piece = suffixLoc === -1 ? pieceData : pieceData.slice(0, suffixLoc);
          const twist = suffixLoc === -1 ? 0 : parseInt(pieceData.slice(suffixLoc), 10);
          let pieceIndex = pieceList.indexOf(piece);
          if (pieceIndex === -1) {
            pieceList.push(piece);
            pieceIndex = pieceList.length - 1;
            cubeOri.push(Math.max(1, piece.replace(/[^A-Z]/g, '').length));
          }
          cycle.push([pieceIndex, twist]);
        }
      }
      cycleList.push(cycle);
    }
    return cycleList;
  }

  function mod(a: number, n: number): number {
    return a - n * Math.floor(a / n);
  }

  for (let ln = 0; ln < moveLines.length; ln++) {
    const line = moveLines[ln].split('//')[0];
    if (line.includes(':')) {
      const cycleStr = moveLines[ln].split(':');
      const moveName = cycleStr[0];
      if (!/^[A-Za-z0-9]*$/.test(moveName)) {
        fail("'" + moveName + "' is not a valid move name, because move names must only contain alphanumeric characters.");
      } else if (moveName[moveName.length - 1] >= '0' && moveName[moveName.length - 1] <= '9') {
        fail("'" + moveName + "' is not a valid move name, because move names cannot end in a number.");
      }
      clockwiseMoveStr.push(moveName);
      moveDataList.push(parseMove(cycleStr[1]));
    }
  }

  const oriMult = 2 ** Math.ceil(Math.log2(pieceList.length));

  for (let m = 0; m < moveDataList.length; m++) {
    const cycleList = moveDataList[m];
    const move: number[] = [];
    for (let i = 0; i < pieceList.length; i++) {
      move.push(i);
    }
    for (let c = 0; c < cycleList.length; c++) {
      const cycle = cycleList[c];
      for (let i = 0; i < cycle.length - 1; i++) {
        move[cycle[i + 1][0]] = cycle[i][0] + oriMult * mod(cycle[i][1], cubeOri[cycle[i][0]]);
      }
      if (cycle.length === 1 || cycle[0][0] !== cycle[cycle.length - 1][0]) {
        move[cycle[0][0]] = cycle[cycle.length - 1][0] + oriMult * mod(cycle[cycle.length - 1][1], cubeOri[cycle[cycle.length - 1][0]]);
      }
    }
    moveList.push(move);
  }

  // 等价集:{} 内的块置换不计,solved 态映射到代表元
  const splitEquivalences = ignore.split('{');
  const solvedState: number[] = [];
  for (let i = 0; i < pieceList.length; i++) {
    solvedState[i] = i;
  }
  for (let i = 1; i < splitEquivalences.length; i++) {
    if (!splitEquivalences[i].includes('}')) {
      fail('Missing "}" in Unique Orientations and Equivalences');
    }
    const equivSet = splitEquivalences[i].split('}')[0];
    const equivPieces = equivSet.split(' ').filter((x) => x !== '');
    const equivNum = pieceList.indexOf(equivPieces[0]);
    if (equivNum === -1) {
      fail('"' + equivPieces[0] + '" is not a piece. (error in Unique Orientations & Equivalences)');
    }
    for (let j = 1; j < equivPieces.length; j++) {
      const equivWithNum = pieceList.indexOf(equivPieces[j]);
      if (equivWithNum === -1) {
        fail('"' + equivPieces[j] + '" is not a piece. (error in Unique Orientations & Equivalences)');
      }
      if (cubeOri[equivNum] !== cubeOri[equivWithNum]) {
        fail('"' + equivPieces[j] + '" and "' + equivPieces[0] + '" cannot be in the same equivalence set because they are different types of pieces.');
      }
      solvedState[equivWithNum] = equivNum;
    }
  }

  const moveWeights = parseESQ(esq);

  const fullPuzzle = new Puzzle(cubeOri.slice(), moveList.slice(), clockwiseMoveStr.slice(), solvedState.slice(), moveWeights);
  const fullPuzzleDupe = new Puzzle(cubeOri.slice(), moveList.slice(), clockwiseMoveStr.slice(), solvedState.slice(), moveWeights);
  checkMoveGroup(fullPuzzle, adjust, 'pre-adjust');
  checkMoveGroup(fullPuzzle, postAdjust, 'post-adjust');
  for (const sub of subgroups) {
    checkMoveGroup(fullPuzzle, sub.subgroup, 'a subgroup');
  }
  const adjustList = adjust === '' ? [] : splitSubgroupStr(adjust);
  // 上游此处有一段 pre-adjust 两两交换性检查,但报错语句被注释掉了(纯 no-op),略
  initCubeOri(fullPuzzleDupe, pieceList, ignore);

  const batchStates = fullPuzzleDupe.getBatchStates(scramble, adjust, postAdjust, pieceList, sorting);
  let numStates = 0;
  let solutionIndex = 1;
  const [modifiers, startNum] = parseModifiers(scramble);
  for (const stateStr of batchStates) {
    const state = fullPuzzleDupe.execute(fullPuzzleDupe.solved, fullPuzzleDupe.moveStrToList(stateStr));
    if (!arraysEqual(fullPuzzleDupe.solved, state)) {
      if (solutionIndex >= startNum || modifiers.has(solutionIndex)) {
        numStates++;
      }
      solutionIndex++;
    }
  }
  post({ value: numStates, type: 'num-states' });

  const subPuzzles: SubPuzzleData[] = [];
  for (const sub of subgroups) {
    subPuzzles.push({ puzzle: getSubPuzzle(pieceList, fullPuzzle, ignore, sub.subgroup, sub.prune, adjustList), search: sub.search });
  }

  initCubeOri(fullPuzzle, pieceList, ignore);
  return [fullPuzzle, batchStates, subPuzzles];
}

function calcState(state: number[], subPuzzles: SubPuzzleData[], showPostAdj: boolean, optimiseBoolean: boolean): void {
  let numSolutions = 0;
  for (const subData of subPuzzles) {
    let searchDepth = parseInt(subData.search, 10);
    if (searchDepth !== searchDepth) {
      if (subData.search[0] === '=') {
        searchDepth = subData.puzzle.pruneDepth;
      } else if (subData.search[0] === '+') {
        searchDepth = subData.puzzle.pruneDepth + (subData.search.split('+').length - 1);
      } else if (subData.search[0] === '-') {
        searchDepth = subData.puzzle.pruneDepth - (subData.search.split('-').length - 1);
      } else {
        fail('"' + subData.search + '" is not a valid search depth.');
      }
    }
    for (const solution of subData.puzzle.solve(state, searchDepth, showPostAdj)) {
      if (optimiseBoolean) {
        // 上游 Optimised 变体:每个 case 只要第一条解
        if (numSolutions < 1) {
          numSolutions++;
          post({ value: solution, type: 'solution' });
        } else {
          return;
        }
      } else {
        post({ value: solution, type: 'solution' });
      }
    }
    post({ value: 0, type: 'set-depth' });
  }
}

function main(input: BatchSolverInput): void {
  const scramble = input.solve;
  if (scramble.includes(':')) {
    fail('Colon notation for indicating adjust moves is deprecated.');
  }
  const [fullPuzzle, batchStates, subPuzzles] = setPuzzles(
    scramble,
    input.puzzle,
    input.ignore,
    input.subgroups,
    input.preAdjust,
    input.postAdjust,
    input.sorting,
    input.esq,
  );
  post({ value: parseESQ(input.rankesq), type: 'moveWeights' });
  const [modifiers, startNum] = parseModifiers(scramble);
  let caseNum = 1;
  let solutionIndex = 1;
  for (const stateStr of batchStates) {
    const state = fullPuzzle.execute(fullPuzzle.solved, fullPuzzle.moveStrToList(stateStr));
    if (!arraysEqual(fullPuzzle.solved, state)) {
      if (caseNum >= startNum || modifiers.has(caseNum)) {
        post({ value: { index: solutionIndex, setup: stateStr, num: caseNum }, type: 'next-state' });
        calcState(state, subPuzzles, input.showPost, !!input.optimise);
        solutionIndex++;
      }
      caseNum++;
    }
  }
  post({ value: null, type: 'stop' });
}

/** 跑一次完整批量求解,所有进度/解/错误经 emit 流出(对应上游 worker 的 postMessage)。 */
export function runBatchSolver(input: BatchSolverInput, emit: (m: BatchSolverMessage) => void): void {
  post = emit;
  try {
    main(input);
  } catch (e) {
    if (!(e instanceof BatchStop)) throw e;
  } finally {
    post = () => {};
  }
}

/* ------------------------------------------------------------------ */
/* index.html 侧:结果排序与 per-move 指标(getMoveCount / compare 等) */
/* ------------------------------------------------------------------ */

/** 去掉括号(pre/post-adjust)内的内容 */
export function removeParens(alg: string): string {
  let accum = '';
  let insideParen = false;
  for (const char of alg) {
    if (char === ')' || char === ']') {
      insideParen = false;
    } else if (char === '(' || char === '[') {
      insideParen = true;
    } else if (insideParen === false) {
      accum += char;
    }
  }
  return accum.trim();
}

export function customParseFloat(x: number | string): number {
  const pFloat = parseFloat(String(x));
  if (pFloat !== pFloat) {
    return Infinity;
  }
  return pFloat;
}

export type BufferElement = [number | string, string];

/** 主指标 → 方括号内次指标 → 去括号字典序 */
export function compareBufferElements(x: BufferElement, y: BufferElement): number {
  if (customParseFloat(x[0]) > customParseFloat(y[0])) return 1;
  else if (customParseFloat(x[0]) < customParseFloat(y[0])) return -1;
  const hasSecondaryMetric = x[1][x[1].length - 1] === ']';
  if (hasSecondaryMetric && parseFloat(x[1].slice(x[1].lastIndexOf('[') + 1)) > parseFloat(y[1].slice(y[1].lastIndexOf('[') + 1))) return 1;
  else if (hasSecondaryMetric && parseFloat(x[1].slice(x[1].lastIndexOf('[') + 1)) < parseFloat(y[1].slice(y[1].lastIndexOf('[') + 1))) return -1;
  if (removeParens(x[1]) > removeParens(y[1])) return 1;
  else if (removeParens(x[1]) < removeParens(y[1])) return -1;
  else return 0;
}

export function moveStm(): number {
  return 1;
}

export function moveSqtm(move: string): number {
  const moveAmount = move.slice(lastAlpha(move) + 1).replace("'", '');
  if (moveAmount === '') {
    return 1;
  }
  return parseInt(moveAmount, 10);
}

export function moveEsq(move: string, moveWeights: Map<string, number>): number {
  const moveType = move.slice(0, lastAlpha(move) + 1) + '_';
  const moveAmount = '_' + move.slice(lastAlpha(move) + 1);
  if (moveWeights.has(move)) return moveWeights.get(move)!;
  else if (moveWeights.has(moveType)) return moveWeights.get(moveType)!;
  else if (moveWeights.has(moveAmount)) return moveWeights.get(moveAmount)!;
  else if (moveWeights.has('__')) return moveWeights.get('__')!;
  return 1;
}

/** 按指标累加一条解的计数(括号内的 adjust 手不计) */
export function getMoveCount(alg: string, metric: (move: string) => number): number {
  const splitAlg = alg.split(' ');
  let count = 0;
  let insideParen = false;
  for (const move of splitAlg) {
    if (move === '') {
      continue;
    } else if (move.includes(')') || move.includes(']')) {
      insideParen = false;
    } else if (move.includes('(') || move.includes('[')) {
      insideParen = true;
    } else if (insideParen === false) {
      count += metric(move);
    }
  }
  return Math.round(count * 1e3) / 1e3;
}

/* ------------------------------------------------------------------ */
/* 内置谜题定义(上游 index.html puzzleSelected 的原文)                */
/* ------------------------------------------------------------------ */

export const BATCH_PUZZLE_NAMES = ['3x3x3', '2x2x2', '4x4x4', 'Skewb', 'Pyraminx', 'Megaminx', 'FTO', 'Custom'] as const;
export type BatchPuzzleName = (typeof BATCH_PUZZLE_NAMES)[number];

export const BATCH_PUZZLE_PRESETS: Record<string, string> = {
  '3x3x3': `U: (UF UL UB UR) (UFR UFL UBL UBR)
R: (UR BR DR FR) (UFR-1 UBR+1 DBR-1 DFR+1)
F: (UF+1 FR+1 DF+1 FL+1) (UFR+1 DFR-1 DFL+1 UFL-1)
D: (DF DR DB DL) (DFR DBR DBL DFL)
L: (UL FL DL BL) (UFL+1 DFL-1 DBL+1 UBL-1)
B: (UB+1 BL+1 DB+1 BR+1) (UBR-1 UBL+1 DBL-1 DBR+1)
u: (UF UL UB UR) (UFR UFL UBL UBR) (FR+1 FL+1 BL+1 BR+1) (RL FB+1 RL+1)
r: (UR BR DR FR) (UFR-1 UBR+1 DBR-1 DFR+1) (UF+1 UB+1 DB+1 DF+1) (FB UD+1 FB+1)
f: (UF+1 FR+1 DF+1 FL+1) (UFR+1 DFR-1 DFL+1 UFL-1) (UR+1 DR+1 DL+1 UL+1) (UD RL+1 UD+1)
d: (DF DR DB DL) (DFR DBR DBL DFL) (FR+1 BR+1 BL+1 FL+1) (FB RL+1 FB+1)
l: (UL FL DL BL) (UFL+1 DFL-1 DBL+1 UBL-1) (UF+1 DF+1 DB+1 UB+1) (UD FB+1 UD+1)
b: (UB+1 BL+1 DB+1 BR+1) (UBR-1 UBL+1 DBL-1 DBR+1) (UR+1 UL+1 DL+1 DR+1) (RL UD+1 RL+1)
M: (UF+1 DF+1 DB+1 UB+1) (UD FB+1 UD+1)
S: (UR+1 DR+1 DL+1 UL+1) (UD RL+1 UD+1)
E: (FR+1 BR+1 BL+1 FL+1) (FB RL+1 FB+1)
x: (UR BR DR FR) (UFR-1 UBR+1 DBR-1 DFR+1) (UL BL DL FL) (UFL+1 UBL-1 DBL+1 DFL-1) (UF+1 UB+1 DB+1 DF+1) (FB UD+1 FB+1)
y: (UF UL UB UR) (UFR UFL UBL UBR) (DF DL DB DR) (DFR DFL DBL DBR) (FR+1 FL+1 BL+1 BR+1) (RL FB+1 RL+1)
z: (UF+1 FR+1 DF+1 FL+1) (UFR+1 DFR-1 DFL+1 UFL-1) (UB+1 BR+1 DB+1 BL+1) (UBR-1 DBR+1 DBL-1 UBL+1) (UR+1 DR+1 DL+1 UL+1) (UD RL+1 UD+1)`,
  '2x2x2': `U: (UFR UFL UBL UBR)
R: (UFR-1 UBR+1 DBR-1 DFR+1)
F: (UFR+1 DFR-1 DFL+1 UFL-1)
D: (DFR DBR DBL DFL)
L: (UFL+1 DFL-1 DBL+1 UBL-1)
B: (UBR-1 UBL+1 DBL-1 DBR+1)`,
  '4x4x4': `U: (Ublc Ubrc Ufrc Uflc) (UFR UFL UBL UBR) (Ufr Ulf Ubl Urb) (Ful Lub Bur Ruf)
R: (Rufc Rubc Rdbc Rdfc) (UFR-1 UBR+1 DBR-1 DFR+1) (Ruf Rbu Rdb Rfd) (Urb Brd Drf Fru)
F: (Fulc Furc Fdrc Fdlc) (UFR+1 DFR-1 DFL+1 UFL-1) (Ful Fru Fdr Fld) (Ufr Rfd Dfl Lfu)
D: (Dflc Dfrc Dbrc Dblc) (DFR DBR DBL DFL) (Dfl Drf Dbr Dlb) (Fdr Rdb Bdl Ldf)
L: (Lubc Lufc Ldfc Ldbc) (UFL+1 DFL-1 DBL+1 UBL-1) (Lub Lfu Ldf Lbd) (Ulf Fld Dlb Blu)
B: (Burc Bulc Bdlc Bdrc) (UBR-1 UBL+1 DBL-1 DBR+1) (Bur Blu Bdl Brd) (Ubl Lbd Dbr Rbu)
2U: (Furc Lufc Bulc Rubc) (Fulc Lubc Burc Rufc) (Fru Lfu Blu Rbu)
2R: (Ubrc Bdrc Dfrc Furc) (Ufrc Burc Dbrc Fdrc) (Ufr Bur Dbr Fdr)
2F: (Ufrc Rdfc Dflc Lufc) (Uflc Rufc Dfrc Ldfc) (Ulf Ruf Drf Ldf)
2D: (Fdlc Rdfc Bdrc Ldbc) (Fdrc Rdbc Bdlc Ldfc) (Fld Rfd Brd Lbd)
2L: (Uflc Fdlc Dblc Bulc) (Ublc Fulc Dflc Bdlc) (Ubl Ful Dfl Bdl)
2B: (Ubrc Lubc Dblc Rdbc) (Ublc Ldbc Dbrc Rubc) (Urb Lub Dlb Rdb)
u: (Ublc Ubrc Ufrc Uflc) (Furc Lufc Bulc Rubc) (Fulc Lubc Burc Rufc) (UFR UFL UBL UBR) (Ufr Ulf Ubl Urb) (Ful Lub Bur Ruf) (Fru Lfu Blu Rbu)
r: (Rufc Rubc Rdbc Rdfc) (Ubrc Bdrc Dfrc Furc) (Ufrc Burc Dbrc Fdrc) (UFR-1 UBR+1 DBR-1 DFR+1) (Ruf Rbu Rdb Rfd) (Urb Brd Drf Fru) (Ufr Bur Dbr Fdr)
f: (Fulc Furc Fdrc Fdlc) (Ufrc Rdfc Dflc Lufc) (Uflc Rufc Dfrc Ldfc) (UFR+1 DFR-1 DFL+1 UFL-1) (Ful Fru Fdr Fld) (Ufr Rfd Dfl Lfu) (Ulf Ruf Drf Ldf)
d: (Dflc Dfrc Dbrc Dblc) (Fdlc Rdfc Bdrc Ldbc) (Fdrc Rdbc Bdlc Ldfc) (DFR DBR DBL DFL) (Dfl Drf Dbr Dlb) (Fdr Rdb Bdl Ldf)(Fld Rfd Brd Lbd)
l: (Lubc Lufc Ldfc Ldbc) (Uflc Fdlc Dblc Bulc) (Ublc Fulc Dflc Bdlc) (UFL+1 DFL-1 DBL+1 UBL-1) (Lub Lfu Ldf Lbd) (Ulf Fld Dlb Blu) (Ubl Ful Dfl Bdl)
b: (Burc Bulc Bdlc Bdrc) (Ubrc Lubc Dblc Rdbc) (Ublc Ldbc Dbrc Rubc) (UBR-1 UBL+1 DBL-1 DBR+1) (Bur Blu Bdl Brd) (Ubl Lbd Dbr Rbu) (Urb Lub Dlb Rdb)`,
  Skewb: `l: (UFL-1 DFR-1 DBL-1) (DLF+1) (L F D)
L: (URF-1 DLF-1 ULB-1) (UFL+1) (U F L)
r: (DFR-1 UBR-1 DBL-1) (DRB+1) (R B D)
R: (URF-1 ULB-1 DRB-1) (UBR+1) (R U B)
b: (ULB-1 DLF-1 DRB-1) (DBL+1) (L D B)
B: (UBR-1 UFL-1 DBL-1) (ULB+1) (U L B)
F: (UFL-1 UBR-1 DFR-1) (URF+1) (F U R)
f: (URF-1 DRB-1 DLF-1) (DFR+1) (F R D)
S: (URF-1) (UFL+1) (ULB+1) (UBR-1) (R U) (F B)
H: (URF+1) (UFL-1) (ULB-1) (UBR+1) (R U) (F B)
s: (UBR-1) (ULB+1) (DRB-1) (DBL+1) (U D) (R B)
h: (UBR+1) (ULB-1) (DRB+1) (DBL-1) (U D) (R B)
x: (F U B D) (URF+1 UBR-1 DRB+1 DFR-1) (UFL-1 ULB+1 DBL-1 DLF+1)
y: (F L B R) (URF UFL ULB UBR) (DFR DLF DBL DRB)
z: (U R D L) (URF-1 DFR+1 DLF-1 UFL+1) (UBR+1 DRB-1 DBL+1 ULB-1)
vUperm: (U B D)
hUperm: (U R D)`,
  Pyraminx: `U: (UB UR UL) (UUU+1) (TUU+1)
R: (UR DR DF) (RRR+1) (TRR+1)
L: (UL+1 DF+1 DL) (LLL+1) (TLL+1)
B: (UB+1 DL DR+1) (BBB+1) (TBB+1)
u: (TUU+1)
r: (TRR+1)
l: (TLL+1)
b: (TBB+1)`,
  Megaminx: `U: (UF UL UBl UBr UR) (UFR UFL ULB UDB URB)
R: (UR RB RDr RDl RF) (UFR-1 URB+1 RDB-1 RDD RDF+1)
L: (UL LF LDr LDl LB) (ULB-1 UFL+1 LDF-1 LDD LDB+1)
F: (UF+1 RF+1 FDr+1 FDl LF+1) (UFL-1 UFR+1 RDF-1 FDD LDF+1)
Dfr: (RDl+1 DFrr+1 DFrb+1 DFrl FDr+1) (RDF-1 RDD+1 DFRr-1 DFRl FDD+1)
Br: ( UBr+1 DB+1 BRd+1 BRf RB+1) (URB-1 UDB+1 BRB-1 BRD RDB+1)
Bl: ( UBl+1 DB+1 BLd+1 BLf LB+1) (ULB-1 UDB+1 BLB-1 BLD LDB+1)`,
  FTO: `U: (UF UN UM) (Ur Ul Ub) (lUr bUl rUb) (uRf uLn uBm) (fLu nBu mRu)
D: (FM FN+1 MN+1) (Fd Nd Md) (mDf fDn nDm) (dFr dNl dMb) (lFd bNd rMd)
F: (UF FM FN) (Fl Fr Fd) (rFl dFr lFd) (uRf mDf nLf) (fLu fRm fDn)
B: (UM+1 UN MN+1) (Ub Mb Nb) (mBn uBm nBu) (rUb lNb dMb) (bUl bNd bMr)
L: (UF+1 FN UN+1) (Ul Fl Nl) (nLf uLn fLu) (lUr lFd lNb) (rFl dNl bUl)
R: (UF+1 UM FM+1) (Ur Mr Fr) (fRm uRf mRu) (lUr bMr dFr) (rFl rUb rMd)
BL: (UN FN+1 MN+1) (Nl Nd Nb) (lNb bNd dNl) (uLn fDn mBn) (nLf nDm nBu)
BR: (UM MN+1 FM+1) (Mr Mb Md) (bMr dMb rMd) (mRu mBn mDf) (fRm uBm nDm)
u: (UF UN UM) (Ur Ul Ub) (Fr Nl Mb) (Fl Nb Mr) (lUr bUl rUb) (uRf uLn uBm) (fLu nBu mRu) (rFl lNb bMr) (fRm nLf mBn)
d: (FM FN+1 MN+1) (Fd Nd Md) (mDf fDn nDm) (dFr dNl dMb) (lFd bNd rMd) (Fl Mr Nb) (Fr Mb Nl) (rFl bMr lNb) (fRm mBn nLf)
f: (UF FM FN) (Fl Fr Fd) (rFl dFr lFd) (uRf mDf nLf) (fLu fRm fDn) (Ul Mr Nd) (Ur Md Nl) (lUr rMd dNl) (mRu nDm uLn)
b: (UM+1 UN MN+1) (Ub Mb Nb) (mBn uBm nBu) (rUb lNb dMb) (bUl bNd bMr) (Ul Nd Mr) (Ur Nl Md) (lUr dNl rMd) (mRu uLn nDm)
l: (UF+1 FN UN+1) (Ul Fl Nl) (nLf uLn fLu) (lUr lFd lNb) (rFl dNl bUl) (UR Fd Nb) (Ub Fr Nd) (rUb dFr bNd) (uRf fDn nBu)
r: (UF+1 UM FM+1) (Ur Mr Fr) (Ul Mb Fd) (Ub Md Fl) (fRm uRf mRu) (lUr bMr dFr) (rFl rUb rMd) (fLu uBm mDf) (bUl dMb lFd)
bl: (UN FN+1 MN+1) (Nl Nd Nb) (lNb bNd dNl) (uLn fDn mBn) (nLf nDm nBu) (Ul Fd Mb) (Ub Fl Md) (bUl lFd dMb) (fLu mDf uBm)
br: (UM MN+1 FM+1) (Mr Mb Md) (bMr dMb rMd) (mRu mBn mDf) (fRm uBm nDm) (Ur Nb Fd) (Ub Nd Fr) (rUb bNd dFr) (uRf nBu fDn)
M: (Ul Fd Mb) (Ub Fl Md) (bUl lFd dMb) (fLu mDf uBm)
N: (Ur Fd Nb) (Ub Fr Nd) (rUb dFr bNd) (uRf fDn nBu)
E: (Fl Mr Nb) (Fr Mb Nl) (rFl bMr lNb) (fRm mBn nLf)
S: (Ul Mr Nd) (Ur Md Nl) (lUr rMd dNl) (mRu nDm uLn)`,
  Custom: '',
};

/** 选择内置谜题时随带填入的 Unique Orientations & Equivalences 预设 */
export const BATCH_UOE_PRESETS: Record<string, string> = {
  '4x4x4':
    '{Ublc Ubrc Ufrc Uflc} {Rufc Rubc Rdbc Rdfc} {Fulc Furc Fdrc Fdlc} {Dflc Dfrc Dbrc Dblc} {Lubc Lufc Ldfc Ldbc} {Burc Bulc Bdlc Bdrc}',
};

/** 上游 Rank ESQ 默认定义 */
export const BATCH_RANK_ESQ_DEFAULT = `R_ L_ r_ l_: 1
R2 L2 r2 l2: 2
__: 2
_2: 3`;
