import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  ApplicationStatus,
  InstructorApplication,
  InstructorApplicationInsert,
} from "@/db/schema";
import { newApplicationId } from "@/lib/auth-user";

export type { InstructorApplication, ApplicationStatus };

export async function list(): Promise<InstructorApplication[]> {
  return db
    .select()
    .from(schema.instructorApplications)
    .orderBy(desc(schema.instructorApplications.createdAt))
    .all();
}

export async function findById(id: string): Promise<InstructorApplication | undefined> {
  const rows = db
    .select()
    .from(schema.instructorApplications)
    .where(eq(schema.instructorApplications.id, id))
    .all();
  return rows[0];
}

export async function create(
  values: Omit<InstructorApplicationInsert, "id" | "createdAt" | "status">,
): Promise<InstructorApplication> {
  const now = Math.floor(Date.now() / 1000);
  const v: InstructorApplicationInsert = {
    ...values,
    id: newApplicationId(),
    status: "pending",
    createdAt: now,
    reviewedAt: null,
    reviewNote: null,
  };
  await db.insert(schema.instructorApplications).values(v);
  const row = await findById(v.id);
  if (!row) throw new Error("application create failed");
  return row;
}

export async function setStatus(
  id: string,
  status: ApplicationStatus,
  reviewNote?: string | null,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(schema.instructorApplications)
    .set({ status, reviewNote: reviewNote ?? null, reviewedAt: now })
    .where(eq(schema.instructorApplications.id, id));
}
