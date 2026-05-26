import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CubeEvent, CubeEventInsert, EventType, EventStatus } from "@/db/schema";

export type { EventType, EventStatus };

export async function list(): Promise<CubeEvent[]> {
  return db.select().from(schema.events).all();
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
