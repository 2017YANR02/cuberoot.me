export { shouldAutoRecap } from '@cuberoot/shared/timer/reconstruct/recap';

type QuarterTurn = {
  face: string;
  inverse: boolean;
};

function parseQuarterTurn(move: string): QuarterTurn | null {
  const match = /^([URFDLB])('?)$/.exec(move.trim());
  return match ? { face: match[1], inverse: match[2] === "'" } : null;
}

/** Mobile auto-recap exit gesture: one adjacent inverse pair after the dialog is visible. */
export class AutoRecapDismissGesture {
  private displayed = false;
  private previous: QuarterTurn | null = null;

  markDisplayed(): void {
    this.displayed = true;
    this.previous = null;
  }

  reset(): void {
    this.displayed = false;
    this.previous = null;
  }

  observe(move: string): boolean {
    if (!this.displayed) return false;

    const current = parseQuarterTurn(move);
    if (!current) {
      this.previous = null;
      return false;
    }

    const previous = this.previous;
    this.previous = current;
    if (!previous || previous.face !== current.face || previous.inverse === current.inverse) {
      return false;
    }

    this.reset();
    return true;
  }
}
