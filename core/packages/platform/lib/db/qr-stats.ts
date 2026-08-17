import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const QR_SCAN = "qr_scan";

// json_extract(payload, '$.code') on the events_track row.
const evCode = sql<string>`json_extract(${schema.eventsTrack.payload}, '$.code')`;

export type QrCodeStat = {
  code: string;
  label: string;
  type: string;
  totalScans: number; // qr_codes.scans (counter)
  eventScans: number; // count of qr_scan events for this code
  uniqueVisitors: number; // distinct non-null anonId among qr_scan events
  lastScanAt: number | null; // max created_at among qr_scan events
};

export type QrBatchStat = {
  label: string;
  codes: number;
  totalScans: number;
  uniqueVisitors: number;
};

export type QrTrendPoint = { day: string; count: number };

export type QrStatsSummary = {
  totalScans: number;
  totalCodes: number;
  uniqueVisitors: number;
};

// Aggregate of qr_scan events keyed by the payload code.
type EventAgg = {
  code: string;
  eventScans: number;
  uniqueVisitors: number;
  lastScanAt: number | null;
};

function eventAggByCode(): Map<string, EventAgg> {
  const rows = db
    .select({
      code: evCode,
      eventScans: sql<number>`COUNT(*)`,
      uniqueVisitors: sql<number>`COUNT(DISTINCT NULLIF(${schema.eventsTrack.anonId}, ''))`,
      lastScanAt: sql<number | null>`MAX(${schema.eventsTrack.createdAt})`,
    })
    .from(schema.eventsTrack)
    .where(and(eq(schema.eventsTrack.name, QR_SCAN), sql`${evCode} IS NOT NULL`))
    .groupBy(evCode)
    .all();

  const map = new Map<string, EventAgg>();
  for (const r of rows) {
    if (!r.code) continue;
    map.set(r.code, {
      code: r.code,
      eventScans: r.eventScans ?? 0,
      uniqueVisitors: r.uniqueVisitors ?? 0,
      lastScanAt: r.lastScanAt ?? null,
    });
  }
  return map;
}

// Per-code stats: scans counter from qr_codes joined with qr_scan event aggregates.
export async function statsByCode(): Promise<QrCodeStat[]> {
  const codes = db
    .select({
      code: schema.qrCodes.code,
      label: schema.qrCodes.label,
      type: schema.qrCodes.type,
      scans: schema.qrCodes.scans,
      createdAt: schema.qrCodes.createdAt,
    })
    .from(schema.qrCodes)
    .orderBy(desc(schema.qrCodes.scans), desc(schema.qrCodes.createdAt))
    .all();

  const agg = eventAggByCode();

  return codes.map((c) => {
    const a = agg.get(c.code);
    return {
      code: c.code,
      label: c.label,
      type: c.type,
      totalScans: c.scans,
      eventScans: a?.eventScans ?? 0,
      uniqueVisitors: a?.uniqueVisitors ?? 0,
      lastScanAt: a?.lastScanAt ?? null,
    };
  });
}

// Per-batch stats: group qr_codes by label, fold in per-code unique visitors.
export async function statsByBatch(): Promise<QrBatchStat[]> {
  const perCode = await statsByCode();
  const map = new Map<string, QrBatchStat>();
  for (const s of perCode) {
    const cur = map.get(s.label) ?? {
      label: s.label,
      codes: 0,
      totalScans: 0,
      uniqueVisitors: 0,
    };
    cur.codes += 1;
    cur.totalScans += s.totalScans;
    cur.uniqueVisitors += s.uniqueVisitors;
    map.set(s.label, cur);
  }
  return [...map.values()].sort((a, b) => b.totalScans - a.totalScans);
}

// qr_scan events grouped by local-time day over the last `days` days.
export async function scanTrend(days = 30): Promise<QrTrendPoint[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const rows = db
    .select({
      day: sql<string>`date(${schema.eventsTrack.createdAt}, 'unixepoch', 'localtime')`,
      count: sql<number>`COUNT(*)`,
    })
    .from(schema.eventsTrack)
    .where(
      and(
        eq(schema.eventsTrack.name, QR_SCAN),
        sql`${schema.eventsTrack.createdAt} >= ${since}`,
      ),
    )
    .groupBy(sql`date(${schema.eventsTrack.createdAt}, 'unixepoch', 'localtime')`)
    .orderBy(sql`date(${schema.eventsTrack.createdAt}, 'unixepoch', 'localtime')`)
    .all();
  return rows.map((r) => ({ day: r.day, count: r.count ?? 0 }));
}

// Top-of-page totals.
export async function statsSummary(): Promise<QrStatsSummary> {
  const codeRow = db
    .select({
      totalCodes: sql<number>`COUNT(*)`,
      totalScans: sql<number>`COALESCE(SUM(${schema.qrCodes.scans}), 0)`,
    })
    .from(schema.qrCodes)
    .all();

  const uvRow = db
    .select({
      uniqueVisitors: sql<number>`COUNT(DISTINCT NULLIF(${schema.eventsTrack.anonId}, ''))`,
    })
    .from(schema.eventsTrack)
    .where(eq(schema.eventsTrack.name, QR_SCAN))
    .all();

  return {
    totalScans: codeRow[0]?.totalScans ?? 0,
    totalCodes: codeRow[0]?.totalCodes ?? 0,
    uniqueVisitors: uvRow[0]?.uniqueVisitors ?? 0,
  };
}
