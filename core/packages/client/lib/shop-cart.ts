'use client';

import { persistItem } from './safe-storage';
import { useMemo, useSyncExternalStore } from 'react';
import { MAX_CART_LINES, parseCart, purchasedCartRemainder, type CartLine } from './shop';

const KEY = 'cuberoot.shop.cart.v1';
const EVENT = 'cuberoot:shop-cart';
let fallback = '[]';
let memoryOnly = false;
function snapshot() {
  if (memoryOnly) return fallback;
  try { return localStorage.getItem(KEY) ?? '[]'; } catch { return fallback; }
}
function subscribe(onChange: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) onChange(); };
  window.addEventListener('storage', storage);
  window.addEventListener(EVENT, onChange);
  return () => { window.removeEventListener('storage', storage); window.removeEventListener(EVENT, onChange); };
}
function save(lines: CartLine[]) {
  fallback = JSON.stringify(lines);
  memoryOnly = !persistItem(KEY, fallback);
  window.dispatchEvent(new Event(EVENT));
}
export function useShopCart() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '[]');
  return useMemo(() => parseCart(raw), [raw]);
}
export function addToShopCart(line: CartLine, stock: number): boolean {
  const lines = parseCart(snapshot());
  const previous = lines.find(item => item.variantId === line.variantId);
  if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity + (previous?.quantity ?? 0) > Math.min(99, stock)) return false;
  if (previous) previous.quantity += line.quantity;
  else { if (lines.length >= MAX_CART_LINES) return false; lines.push(line); }
  save(lines);
  return true;
}
export function setShopCartQuantity(variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 99) return;
  save(parseCart(snapshot()).map(item => item.variantId === variantId ? { ...item, quantity } : item).filter(item => item.quantity > 0));
}
export function removePurchasedShopItems(lines: CartLine[]) { save(purchasedCartRemainder(parseCart(snapshot()), lines)); }
