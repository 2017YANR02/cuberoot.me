/** The visible no-WebGL view, kept separate from the native timeline backend. */
export interface NativePgSoftwareView {
  getSvg(): SVGSVGElement | null;
  updateSettings(): void;
  /** Explicit reset also works when the saved view sliders are already at home. */
  resetView?(): void;
  dispose(): void;
}

const views = new WeakMap<object, NativePgSoftwareView>();

/** Enable only geometries whose software projection and pointer path are verified. */
export function supportsNativePgSoftware3D(id: unknown): id is 'radiogem' | 'radiofathom' {
  return id === 'radiogem' || id === 'radiofathom';
}

export function getNativePgSoftwareView(player: unknown): NativePgSoftwareView | undefined {
  return player !== null && typeof player === 'object' ? views.get(player) : undefined;
}

export function setNativePgSoftwareView(player: object, view: NativePgSoftwareView | null): void {
  if (view) views.set(player, view);
  else views.delete(player);
}
