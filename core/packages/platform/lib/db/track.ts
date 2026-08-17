import "server-only";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db";
import type { EventsTrack, EventsTrackInsert } from "@/db/schema";

export type { EventsTrack };

export async function recordEvent(values: {
  name: string;
  payload?: Record<string, unknown> | null;
  userId?: string | null;
  anonId?: string | null;
  url?: string | null;
  referer?: string | null;
}): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const v: EventsTrackInsert = {
    name: values.name.slice(0, 64),
    payload: values.payload ?? null,
    userId: values.userId ?? null,
    anonId: values.anonId ?? null,
    url: values.url ?? null,
    referer: values.referer ?? null,
    createdAt: now,
  };
  await db.insert(schema.eventsTrack).values(v);
}

export async function listRecent(limit = 100): Promise<EventsTrack[]> {
  return db
    .select()
    .from(schema.eventsTrack)
    .orderBy(desc(schema.eventsTrack.createdAt))
    .limit(limit)
    .all();
}
