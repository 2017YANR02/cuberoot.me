import type { Quiz } from "@/db/schema";
import { Card } from "../../_components/Shell";
import { QuizDeleteForm } from "./_DeleteQuizForm";
import { createQuizAction, updateQuizAction } from "./quiz-actions";

const inputCls =
  "w-full rounded-md border border-line bg-white px-3 py-1.5 text-[13px] outline-none focus:border-brand";

// 某 lesson 的出题面板:列出已有题(可改/删)+ 底部新增。
// 选项一行一个(textarea),answerIdx 为正确项下标(从 0 起)。
export function QuizPanel({
  courseId,
  lessonId,
  quizzes,
}: {
  courseId: string;
  lessonId: string;
  quizzes: Quiz[];
}) {
  return (
    <div id={`quiz-${lessonId}`} className="mt-3 border-t border-dashed border-line pt-3">
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[13px] font-medium text-ink">章节测验</h4>
        <span className="text-[11px] text-ink-3">共 {quizzes.length} 题</span>
      </div>

      <div className="space-y-3">
        {quizzes.map((q, qi) => (
          <Card key={q.id} className="p-3 bg-bg-soft">
            <form action={updateQuizAction} className="grid gap-2.5">
              <input type="hidden" name="id" value={q.id} />
              <input type="hidden" name="courseId" value={courseId} />
              <input type="hidden" name="lessonId" value={lessonId} />

              <div className="flex items-center gap-2 text-[11px] text-ink-3">
                <span className="font-mono">第 {qi + 1} 题</span>
                <span className="truncate">{q.id}</span>
              </div>

              <label className="block">
                <span className="block text-[12px] text-ink-3 mb-1">题干</span>
                <input
                  name="question"
                  defaultValue={q.question}
                  required
                  className={inputCls}
                />
              </label>

              <div className="grid gap-2.5 sm:grid-cols-[1fr_120px_120px] items-start">
                <label className="block">
                  <span className="block text-[12px] text-ink-3 mb-1">
                    选项(一行一个,至少 2 条)
                  </span>
                  <textarea
                    name="options"
                    defaultValue={q.options.join("\n")}
                    rows={Math.max(2, q.options.length)}
                    required
                    className={inputCls + " font-mono leading-6 resize-y"}
                  />
                </label>
                <label className="block">
                  <span className="block text-[12px] text-ink-3 mb-1">
                    正确项下标(0 起)
                  </span>
                  <input
                    type="number"
                    name="answerIdx"
                    defaultValue={q.answerIdx}
                    min={0}
                    className={inputCls}
                  />
                </label>
                <label className="block">
                  <span className="block text-[12px] text-ink-3 mb-1">排序</span>
                  <input
                    type="number"
                    name="sortOrder"
                    defaultValue={q.sortOrder}
                    className={inputCls}
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-[12px] text-ink-3 mb-1">解析(可选)</span>
                <input
                  name="explain"
                  defaultValue={q.explain ?? ""}
                  placeholder="答对/答错后展示的讲解"
                  className={inputCls}
                />
              </label>

              <div className="flex items-center gap-3 pt-0.5">
                <button
                  type="submit"
                  className="rounded-md bg-brand text-white px-3 py-1.5 text-[13px] hover:bg-brand-dark transition"
                >
                  保存
                </button>
                <span className="flex-1" />
                <QuizDeleteForm id={q.id} courseId={courseId} lessonId={lessonId} />
              </div>
            </form>
          </Card>
        ))}
      </div>

      <form
        action={createQuizAction}
        className="mt-3 rounded-[14px] border border-dashed border-line bg-white p-3 grid gap-2.5"
      >
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="lessonId" value={lessonId} />

        <div className="text-[12px] font-medium text-ink">新增一题</div>

        <label className="block">
          <span className="block text-[12px] text-ink-3 mb-1">题干</span>
          <input
            name="question"
            required
            placeholder="如:还原十字应优先对齐什么?"
            className={inputCls}
          />
        </label>

        <div className="grid gap-2.5 sm:grid-cols-[1fr_140px] items-start">
          <label className="block">
            <span className="block text-[12px] text-ink-3 mb-1">
              选项(一行一个,至少 2 条)
            </span>
            <textarea
              name="options"
              rows={4}
              required
              placeholder={"中心块颜色\n相邻棱块\n随便对齐\n底面颜色"}
              className={inputCls + " font-mono leading-6 resize-y"}
            />
          </label>
          <label className="block">
            <span className="block text-[12px] text-ink-3 mb-1">
              正确项下标(0 起)
            </span>
            <input
              type="number"
              name="answerIdx"
              defaultValue={0}
              min={0}
              className={inputCls}
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-[12px] text-ink-3 mb-1">解析(可选)</span>
          <input
            name="explain"
            placeholder="答对/答错后展示的讲解"
            className={inputCls}
          />
        </label>

        <div>
          <button
            type="submit"
            className="rounded-md bg-brand text-white px-4 py-1.5 text-[13px] font-medium hover:bg-brand-dark transition"
          >
            添加题目
          </button>
          <span className="ml-3 text-[11px] text-ink-3">
            正确项下标从 0 起:第一项填 0,第二项填 1
          </span>
        </div>
      </form>
    </div>
  );
}
