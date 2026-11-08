/** Public navigation presentation only; page authorization is enforced separately. */
export interface HomeLayoutSnapshot {
  locks: Record<string, boolean>;
  orders: Record<string, string[]>;
}

export const HOME_LAYOUT_CACHE_TAG = 'home-layout';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseHomeLocks(value: unknown): HomeLayoutSnapshot['locks'] {
  if (!record(value) || !record(value.locks) || !Object.values(value.locks).every(lock => typeof lock === 'boolean')) {
    throw new Error('Invalid homepage visibility response');
  }
  return value.locks as HomeLayoutSnapshot['locks'];
}

export function parseHomeOrders(value: unknown): HomeLayoutSnapshot['orders'] {
  if (!record(value) || !record(value.orders) || !Object.values(value.orders).every(
    order => Array.isArray(order) && order.every(id => typeof id === 'string'),
  )) {
    throw new Error('Invalid homepage order response');
  }
  return value.orders as HomeLayoutSnapshot['orders'];
}
