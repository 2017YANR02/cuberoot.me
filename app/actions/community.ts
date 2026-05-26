"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import {
  createComment,
  createPost,
  isCircleId,
  toggleLike,
} from "@/lib/db/posts";

export async function createPostFromForm(f: FormData): Promise<void> {
  const user = await requireUser("/community/posts/new");
  const circleId = String(f.get("circleId") ?? "");
  const title = String(f.get("title") ?? "").trim();
  const body = String(f.get("body") ?? "").trim();
  if (!isCircleId(circleId) || !title || !body) {
    redirect("/community/posts/new?error=missing");
  }
  const post = await createPost({
    authorId: user.id,
    circleId,
    title,
    body,
  });
  revalidatePath("/community");
  revalidatePath(`/community/circle/${circleId}`);
  redirect(`/community/posts/${post.id}`);
}

export async function togglePostLike(f: FormData): Promise<void> {
  const user = await requireUser();
  const postId = String(f.get("postId") ?? "");
  if (!postId) redirect("/community");
  await toggleLike(postId, user.id);
  revalidatePath(`/community/posts/${postId}`);
  revalidatePath("/community");
  redirect(`/community/posts/${postId}`);
}

export async function submitComment(f: FormData): Promise<void> {
  const postId = String(f.get("postId") ?? "");
  const user = await requireUser(postId ? `/community/posts/${postId}` : "/community");
  const body = String(f.get("body") ?? "").trim();
  if (!postId || !body) {
    redirect(`/community/posts/${postId}`);
  }
  await createComment({ postId, authorId: user.id, body });
  revalidatePath(`/community/posts/${postId}`);
  redirect(`/community/posts/${postId}`);
}
