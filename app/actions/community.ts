"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import {
  createComment,
  createPost,
  findPostById,
  isCircleId,
  isLikedByUser,
  toggleLike,
} from "@/lib/db/posts";
import {
  findUserIdByNickname,
  notify,
  parseMentions,
} from "@/lib/db/notifications";

// 解析正文里的 @昵称并给被提及者发通知(跳过 actor 本人 / 查不到的昵称)。
// notify 内部对 userId===actorId 已去重;这里再排除收件人列表里的重复对象。
async function notifyMentions(opts: {
  body: string;
  actorId: string;
  actorNickname: string;
  href: string;
  refType: string;
  refId: string;
  exclude?: Set<string>;
}): Promise<void> {
  const names = parseMentions(opts.body);
  if (names.length === 0) return;
  const seen = new Set<string>(opts.exclude ?? []);
  for (const name of names) {
    const targetId = await findUserIdByNickname(name);
    if (!targetId || seen.has(targetId)) continue;
    seen.add(targetId);
    await notify({
      userId: targetId,
      type: "mention",
      actorId: opts.actorId,
      title: `${opts.actorNickname} 在内容里提到了你`,
      body: opts.body.slice(0, 120),
      href: opts.href,
      refType: opts.refType,
      refId: opts.refId,
    });
  }
}

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
  // 帖子正文里 @ 到的人发提及通知(不影响发帖主流程)。
  try {
    await notifyMentions({
      body,
      actorId: user.id,
      actorNickname: user.nickname,
      href: `/community/posts/${post.id}`,
      refType: "post",
      refId: post.id,
    });
  } catch {
    // 通知失败不影响发帖主流程。
  }
  revalidatePath("/community");
  revalidatePath(`/community/circle/${circleId}`);
  redirect(`/community/posts/${post.id}`);
}

export async function togglePostLike(f: FormData): Promise<void> {
  const user = await requireUser();
  const postId = String(f.get("postId") ?? "");
  if (!postId) redirect("/community");
  // 记录翻转前状态:只在「从无到有」点赞那一侧通知作者。
  const wasLiked = await isLikedByUser(postId, user.id);
  await toggleLike(postId, user.id);
  if (!wasLiked) {
    try {
      const post = await findPostById(postId);
      if (post) {
        await notify({
          userId: post.authorId,
          type: "like",
          actorId: user.id,
          title: `${user.nickname} 赞了你的帖子`,
          body: post.title,
          href: `/community/posts/${postId}`,
          refType: "post",
          refId: postId,
        });
      }
    } catch {
      // 通知失败不影响点赞主流程。
    }
  }
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
  // 通知帖子作者被评论 + 通知正文里 @ 到的人(均不影响主流程)。
  try {
    const post = await findPostById(postId);
    const href = `/community/posts/${postId}`;
    if (post) {
      await notify({
        userId: post.authorId,
        type: "comment",
        actorId: user.id,
        title: `${user.nickname} 评论了你的帖子`,
        body,
        href,
        refType: "post",
        refId: postId,
      });
    }
    await notifyMentions({
      body,
      actorId: user.id,
      actorNickname: user.nickname,
      href,
      refType: "comment",
      refId: postId,
      // 已给作者发过 comment,不再额外发 mention 给同一人。
      exclude: post ? new Set([post.authorId]) : undefined,
    });
  } catch {
    // 通知失败不影响评论主流程。
  }
  revalidatePath(`/community/posts/${postId}`);
  redirect(`/community/posts/${postId}`);
}
