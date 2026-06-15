"use client";

import { useState } from "react";
import { StarRating } from "@/components/StarRating";
import { submitReviewAction } from "@/app/actions/reviews";

type Props = {
  courseId: string;
  // 已有评价时回填(可改)
  initialRating?: number;
  initialBody?: string;
  hasExisting?: boolean;
};

// 我的评价表单:StarRating 选分(写进 hidden input)+ 正文 textarea,提交走 server action。
// 未选分时禁用提交,避免提交 rating=0 被服务端打回。
export function ReviewForm({
  courseId,
  initialRating = 0,
  initialBody = "",
  hasExisting = false,
}: Props) {
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);

  return (
    <form action={submitReviewAction} className="mt-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="rating" value={rating} />

      <div className="flex flex-wrap items-center gap-3">
        <StarRating value={rating} onChange={setRating} size={26} />
        <span className="text-[13px] text-ink-3">
          {rating > 0 ? `${rating} 星` : "点击星星打分"}
        </span>
      </div>

      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={1000}
        placeholder="说说这门课对你的帮助,留给后来同学参考(选填)"
        className="mt-3 w-full resize-y rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-[14px] leading-6 text-ink outline-none placeholder:text-ink-3 focus:border-brand"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={rating < 1}
          className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-2 text-[14px] font-medium text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {hasExisting ? "更新评价" : "发表评价"}
        </button>
        {hasExisting ? (
          <span className="text-[12px] text-ink-3">
            你已评价过这门课,重新提交会覆盖原来的
          </span>
        ) : null}
      </div>
    </form>
  );
}
