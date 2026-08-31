/** Owns the one async request allowed to fill the currently visible slot. */
export class MobileVisibleScrambleRequestGate {
  private active: AbortController | null = null;

  begin(): AbortController {
    this.cancel();
    const controller = new AbortController();
    this.active = controller;
    return controller;
  }

  finish(controller: AbortController): void {
    if (this.active === controller) this.active = null;
  }

  cancel(): void {
    this.active?.abort();
    this.active = null;
  }
}
