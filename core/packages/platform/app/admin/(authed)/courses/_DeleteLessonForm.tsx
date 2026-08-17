"use client";

import { deleteLessonAction } from "./lessons-actions";

export function LessonDeleteForm({
  id,
  courseId,
}: {
  id: string;
  courseId: string;
}) {
  return (
    <form
      action={deleteLessonAction}
      onSubmit={(e) => {
        if (!window.confirm("确定删除此章节?该章节的学习进度将一并失效。")) {
          e.preventDefault();
        }
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <button type="submit" className="text-[13px] text-red-600 hover:underline">
        删除
      </button>
    </form>
  );
}
