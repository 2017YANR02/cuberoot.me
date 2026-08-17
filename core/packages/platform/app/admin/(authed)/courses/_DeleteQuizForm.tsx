"use client";

import { deleteQuizAction } from "./quiz-actions";

export function QuizDeleteForm({
  id,
  courseId,
  lessonId,
}: {
  id: string;
  courseId: string;
  lessonId: string;
}) {
  return (
    <form
      action={deleteQuizAction}
      onSubmit={(e) => {
        if (!window.confirm("确定删除此题?该题的历史作答将不再计入成绩。")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="lessonId" value={lessonId} />
      <button type="submit" className="text-[13px] text-red-600 hover:underline">
        删除
      </button>
    </form>
  );
}
