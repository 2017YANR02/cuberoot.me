import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { CIRCLE_META } from "@/lib/db/posts";
import type { CircleId } from "@/db/schema";
import { createPostFromForm } from "@/app/actions/community";

export const metadata = { title: "发帖 — 社群" };
export const dynamic = "force-dynamic";

const CIRCLE_ORDER: CircleId[] = ["newbie", "speed", "blind", "campus"];

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ circle?: string; error?: string }>;
}) {
  await requireUser("/community/posts/new");
  const sp = await searchParams;
  const initialCircle: CircleId =
    sp.circle === "newbie" ||
    sp.circle === "speed" ||
    sp.circle === "blind" ||
    sp.circle === "campus"
      ? sp.circle
      : "newbie";

  return (
    <div className="container-page py-12 md:py-16 max-w-3xl">
      <Link
        href="/community"
        className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={13} />
        返回社群
      </Link>

      <h1 className="mt-6 mb-6 text-[26px] md:text-[30px] font-semibold text-ink leading-tight">
        发帖
      </h1>

      {sp.error === "missing" ? (
        <div className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-700">
          请填写完整:圈子、标题、正文都不能为空。
        </div>
      ) : null}

      <form action={createPostFromForm} className="grid gap-5">
        <label className="block">
          <span className="block text-[13px] text-ink-2 mb-1.5">圈子</span>
          <select
            name="circleId"
            defaultValue={initialCircle}
            required
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
          >
            {CIRCLE_ORDER.map((id) => (
              <option key={id} value={id}>
                {CIRCLE_META[id].name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[13px] text-ink-2 mb-1.5">标题</span>
          <input
            name="title"
            required
            placeholder="给你的帖子起个题"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
          />
        </label>

        <label className="block">
          <span className="block text-[13px] text-ink-2 mb-1.5">
            正文 (Markdown)
          </span>
          <textarea
            name="body"
            required
            rows={16}
            placeholder="支持 # / ## 标题、bullet list、> 引用、**bold**、[链接](url)"
            className="w-full min-h-[360px] rounded-md border border-line bg-white px-3 py-2 text-[13px] font-mono outline-none focus:border-brand transition"
          />
          <span className="mt-1 block text-[12px] text-ink-3">
            支持 Markdown 基础语法,发布后可在详情页查看渲染效果。
          </span>
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            className="rounded-md bg-brand text-white px-5 py-2 text-[14px] font-medium hover:bg-brand-dark transition"
          >
            发布
          </button>
          <Link
            href="/community"
            className="rounded-md border border-line bg-white px-5 py-2 text-[14px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
