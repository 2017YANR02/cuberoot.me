export const NXN_ORDER_MIN = 1;
export const NXN_ORDER_MAX = 400;
export const NXN_ORDER_DEFAULT = 3;

export function clampNxNOrder(value: number): number {
  const integer = Number.isFinite(value) ? Math.floor(value) : NXN_ORDER_DEFAULT;
  return Math.max(NXN_ORDER_MIN, Math.min(NXN_ORDER_MAX, integer));
}
