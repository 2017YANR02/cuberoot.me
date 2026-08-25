/**
 * 关注选手(PR 监控)读取 —— 走 PG watched_persons 表,替代本地 person 目录耦合。
 * 带 60s 进程内缓存,避免轮询 loop 每周期都打 PG。
 */
import { query } from '../db/connection.js';

export interface WatchedPerson {
  wcaId: string;
  matchKey: string | null;
}

const TTL_MS = 60_000;
let cache: WatchedPerson[] | null = null;
let cachedAt = 0;

async function load(): Promise<WatchedPerson[]> {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  const rows = await query<{ wca_id: string; match_key: string | null }>(
    `SELECT wca_id, match_key FROM watched_persons`,
  );
  cache = rows.map((r) => ({ wcaId: r.wca_id, matchKey: r.match_key }));
  cachedAt = now;
  return cache;
}

export async function getWatchedPersons(): Promise<WatchedPerson[]> {
  return load();
}

export async function getWatchedWcaIds(): Promise<Set<string>> {
  const rows = await load();
  return new Set(rows.map((r) => r.wcaId));
}

/** 非空 match_key 的集合。 */
export async function getWatchedMatchKeys(): Promise<Set<string>> {
  const rows = await load();
  return new Set(rows.filter((r) => r.matchKey).map((r) => r.matchKey as string));
}
