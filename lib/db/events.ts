import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CubeEvent, CubeEventInsert, EventType, EventStatus } from "@/db/schema";
import { searchEvents, searchEventsCount } from "@/lib/db/search";
import type { PagedResult, ListOpts } from "@/lib/db/courses";

export type { EventType, EventStatus };

export async function list(): Promise<CubeEvent[]> {
  return db.select().from(schema.events).all();
}

export async function listPaged({
  q,
  page = 1,
  pageSize = 12,
}: ListOpts = {}): Promise<PagedResult<CubeEvent>> {
  const safePage = Math.max(1, Math.floor(page));
  const offset = (safePage - 1) * pageSize;
  const query = q?.trim() ?? "";

  if (query) {
    const [items, total] = await Promise.all([
      searchEvents(query, { limit: pageSize, offset }),
      searchEventsCount(query),
    ]);
    return {
      items,
      total,
      page: safePage,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const totalRow = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.events)
    .all();
  const total = totalRow[0]?.n ?? 0;
  const items = db
    .select()
    .from(schema.events)
    .limit(pageSize)
    .offset(offset)
    .all();
  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function findById(id: string): Promise<CubeEvent | undefined> {
  const rows = db.select().from(schema.events).where(eq(schema.events.id, id)).all();
  return rows[0];
}

export async function upsert(values: CubeEventInsert): Promise<void> {
  await db
    .insert(schema.events)
    .values(values)
    .onConflictDoUpdate({
      target: schema.events.id,
      set: {
        title: values.title,
        type: values.type,
        status: values.status,
        startDate: values.startDate,
        endDate: values.endDate ?? null,
        city: values.city,
        venue: values.venue,
        capacity: values.capacity,
        registered: values.registered,
        fee: values.fee,
        events: values.events,
        description: values.description,
      },
    });
}

export async function remove(id: string): Promise<void> {
  await db.delete(schema.events).where(eq(schema.events.id, id));
}

export type { CubeEvent };
