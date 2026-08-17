"use client";

import { useMemo, useState, useTransition } from "react";
import { CheckCircle2, XCircle, ListChecks, RotateCcw, Award } from "lucide-react";
import { submitQuizAction, type QuizGradeItem } from "@/app/actions/quiz";

// 题目传给客户端时不带 answerIdx —— 正确答案只在提交后由 server 回传,避免源码里泄题。
export type QuizForClient = {
  id: string;
  question: string;
  options: string[];
};

// 进入页面时已有的作答结果(每题最近一次),用于「已做过测验」直接展示成绩。
export type LessonQuizInitial = {
  total: number;
  correctCount: number;
  answered: number;
  latestByQuiz: Record<string, { selectedIdx: number; correct: boolean }>;
};

type Props = {
  lessonId: string;
  quizzes: QuizForClient[];
  initial?: LessonQuizInitial | null;
};

type Graded = {
  total: number;
  correctCount: number;
  allCorrect: boolean;
  awardedPoints: boolean;
  byQuiz: Record<string, QuizGradeItem>;
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function LessonQuiz({ lessonId, quizzes, initial }: Props) {
  // 无题不渲染(server 也会判,这里二次兜底)。
  const hasQuiz = quizzes.length > 0;

  // 进度页若已答过且每题都有最近作答,初始即展示成绩(可重做)。
  const fullyAnswered =
    !!initial && initial.answered === quizzes.length && quizzes.length > 0;

  const [selected, setSelected] = useState<Record<string, number>>(() => {
    if (!initial) return {};
    const init: Record<string, number> = {};
    for (const [qid, r] of Object.entries(initial.latestByQuiz)) {
      init[qid] = r.selectedIdx;
    }
    return init;
  });

  const [graded, setGraded] = useState<Graded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const answeredCount = useMemo(
    () => quizzes.filter((q) => selected[q.id] !== undefined).length,
    [quizzes, selected],
  );
  const allAnswered = answeredCount === quizzes.length;

  if (!hasQuiz) return null;

  const choose = (quizId: string, idx: number) => {
    if (graded) return; // 出分后锁定,需点「重做」才能再改。
    setSelected((s) => ({ ...s, [quizId]: idx }));
  };

  const submit = () => {
    if (!allAnswered || pending) return;
    setError(null);
    startTransition(async () => {
      const res = await submitQuizAction({ lessonId, answers: selected });
      if (res.ok) {
        const byQuiz: Record<string, QuizGradeItem> = {};
        for (const it of res.items) byQuiz[it.quizId] = it;
        setGraded({
          total: res.total,
          correctCount: res.correctCount,
          allCorrect: res.allCorrect,
          awardedPoints: res.awardedPoints,
          byQuiz,
        });
      } else {
        setError(
          res.error === "no_quiz"
            ? "本节暂无测验题"
            : "提交失败,请重试",
        );
      }
    });
  };

  const redo = () => {
    setGraded(null);
    setSelected({});
    setError(null);
  };

  return (
    <div className="mt-8 rounded-[14px] border border-line bg-white p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <ListChecks size={17} className="text-brand" />
          章节小测验
          <span className="text-[12px] font-normal text-ink-3">
            共 {quizzes.length} 题
          </span>
        </div>
        {graded ? (
          <ScoreBadge
            correctCount={graded.correctCount}
            total={graded.total}
            allCorrect={graded.allCorrect}
            awardedPoints={graded.awardedPoints}
          />
        ) : fullyAnswered && initial ? (
          <span className="text-[12px] text-ink-3">
            上次成绩 {initial.correctCount}/{initial.total},可重新作答
          </span>
        ) : (
          <span className="text-[12px] text-ink-3">
            已选 {answeredCount}/{quizzes.length}
          </span>
        )}
      </div>

      <ol className="mt-4 space-y-5">
        {quizzes.map((q, qi) => {
          const g = graded?.byQuiz[q.id];
          const sel = selected[q.id];
          return (
            <li key={q.id}>
              <div className="flex gap-2 text-[14px] font-medium text-ink leading-6">
                <span className="font-mono text-ink-3">{qi + 1}.</span>
                <span className="flex-1">{q.question}</span>
              </div>

              <ul className="mt-2.5 space-y-2">
                {q.options.map((opt, oi) => {
                  const chosen = sel === oi;
                  const isAnswer = g ? g.answerIdx === oi : false;
                  const isWrongChoice = g ? chosen && !isAnswer : false;

                  // 出分后:正确项绿、误选项红;未出分:选中项高亮。
                  let cls =
                    "flex items-start gap-2.5 rounded-md border px-3 py-2 text-[14px] leading-6 transition cursor-pointer ";
                  if (g) {
                    cls += isAnswer
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 "
                      : isWrongChoice
                        ? "border-red-300 bg-red-50 text-red-700 "
                        : "border-line bg-white text-ink-2 ";
                    cls += "cursor-default ";
                  } else {
                    cls += chosen
                      ? "border-brand bg-brand-tint text-ink "
                      : "border-line bg-white text-ink-2 hover:border-brand/40 ";
                  }

                  return (
                    <li key={oi}>
                      <label className={cls}>
                        <input
                          type="radio"
                          name={`quiz-${q.id}`}
                          className="sr-only"
                          checked={chosen}
                          disabled={!!graded}
                          onChange={() => choose(q.id, oi)}
                        />
                        <span
                          className={
                            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono " +
                            (g && isAnswer
                              ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                              : g && isWrongChoice
                                ? "border-red-400 bg-red-100 text-red-600"
                                : chosen
                                  ? "border-brand bg-brand text-white"
                                  : "border-line text-ink-3")
                          }
                        >
                          {LETTERS[oi] ?? oi + 1}
                        </span>
                        <span className="flex-1">{opt}</span>
                        {g && isAnswer ? (
                          <CheckCircle2
                            size={16}
                            className="mt-0.5 shrink-0 text-emerald-600"
                          />
                        ) : g && isWrongChoice ? (
                          <XCircle
                            size={16}
                            className="mt-0.5 shrink-0 text-red-500"
                          />
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>

              {g ? (
                <div className="mt-2 flex items-start gap-2 text-[13px] leading-6">
                  {g.correct ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 size={14} /> 答对了
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600">
                      <XCircle size={14} /> 答错了
                    </span>
                  )}
                  {g.explain ? (
                    <span className="text-ink-3">
                      解析:{g.explain}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-[13px] text-red-600">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex items-center gap-3">
        {graded ? (
          <button
            type="button"
            onClick={redo}
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-4 py-2 text-[13px] font-medium text-ink-2 transition hover:border-brand hover:text-brand"
          >
            <RotateCcw size={14} />
            重新作答
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={submit}
              disabled={!allAnswered || pending}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "提交中…" : "提交答案"}
            </button>
            {!allAnswered ? (
              <span className="text-[12px] text-ink-3">
                答完全部 {quizzes.length} 题再提交
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({
  correctCount,
  total,
  allCorrect,
  awardedPoints,
}: {
  correctCount: number;
  total: number;
  allCorrect: boolean;
  awardedPoints: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium " +
          (allCorrect
            ? "bg-emerald-50 text-emerald-700"
            : "bg-brand-soft text-brand-dark")
        }
      >
        {allCorrect ? <CheckCircle2 size={14} /> : null}
        {correctCount}/{total} 正确
      </span>
      {awardedPoints ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700">
          <Award size={13} />
          +5 积分
        </span>
      ) : null}
    </div>
  );
}
