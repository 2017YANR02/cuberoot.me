/** Standard competition rank tracker: rank(value) = prior strictly better values + 1.
 * Ties share a rank, while each tied value still occupies a later rank position. */
export class CompetitionRankTracker {
  private readonly indexByValue: Map<number, number>;
  private readonly tree: Uint32Array;
  count = 0;

  constructor(values: readonly number[]) {
    const coordinates = [...new Set(values)].sort((a, b) => a - b);
    this.indexByValue = new Map(coordinates.map((value, index) => [value, index + 1]));
    this.tree = new Uint32Array(coordinates.length + 1);
  }

  rank(value: number): number {
    const index = this.indexByValue.get(value);
    if (index === undefined) return 1;
    let better = 0;
    for (let i = index - 1; i > 0; i -= i & -i) better += this.tree[i];
    return better + 1;
  }

  add(value: number): void {
    const index = this.indexByValue.get(value);
    if (index === undefined) return;
    for (let i = index; i < this.tree.length; i += i & -i) this.tree[i]++;
    this.count++;
  }
}
