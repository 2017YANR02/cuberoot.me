import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-user";
import { findById as findInstructor, findByUserId } from "@/lib/db/instructors";
import type { User, Instructor } from "@/db/schema";

export type InstructorContext = {
  user: User;
  instructor: Instructor;
};

/**
 * Server-only: require the request to come from a logged-in user with
 * role === "instructor" and a resolvable instructors row. Redirects on miss.
 */
export async function requireInstructor(
  nextPath?: string,
): Promise<InstructorContext> {
  const user = await getCurrentUser();
  if (!user) {
    const q = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${q}`);
  }
  if (user.role !== "instructor") {
    redirect("/instructors/apply");
  }
  let instructor: Instructor | undefined;
  if (user.instructorId) {
    instructor = await findInstructor(user.instructorId);
  }
  if (!instructor) {
    instructor = await findByUserId(user.id);
  }
  if (!instructor) {
    redirect("/instructors/apply");
  }
  return { user, instructor };
}
