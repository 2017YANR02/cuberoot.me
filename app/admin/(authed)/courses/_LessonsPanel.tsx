import type { Lesson } from "@/db/schema";
import { UploadField } from "@/components/UploadField";
import { Card } from "../../_components/Shell";
import { LessonDeleteForm } from "./_DeleteLessonForm";
import {
  createLessonAction,
  updateLessonAction,
  moveLessonAction,
} from "./lessons-actions";

function formatDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function LessonsPanel({
  courseId,
  lessons,
}: {
  courseId: string;
  lessons: Lesson[];
}) {
  return (
    <div id="lessons" className="mt-10 max-w-3xl">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[16px] font-semibold text-ink">课程目录</h2>
        <span className="text-[12px] text-ink-3">共 {lessons.length} 节</span>
      </div>

      <div className="space-y-4">
        {lessons.length === 0 ? (
          <Card className="px-4 py-6 text-center text-[13px] text-ink-3">
            还没有章节,使用下方添加。
          </Card>
        ) : null}

        {lessons.map((l) => (
          <Card key={l.id} className="p-4">
            <form
              action={updateLessonAction}
              className="grid gap-3 md:grid-cols-[80px_1fr] items-start"
            >
              <input type="hidden" name="id" value={l.id} />
              <input type="hidden" name="courseId" value={courseId} />

              <div className="text-[12px] text-ink-3">
                <div className="font-mono text-ink">#{l.idx}</div>
                <div className="mt-1">{formatDuration(l.durationSec)}</div>
                <div className="mt-1 text-[11px] truncate">{l.id}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px_70px] items-end">
                <label className="block">
                  <span className="block text-[12px] text-ink-3 mb-1">标题</span>
                  <input
                    name="title"
                    defaultValue={l.title}
                    required
                    className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-[13px] outline-none focus:border-brand"
                  />
                </label>
                <label className="block">
                  <span className="block text-[12px] text-ink-3 mb-1">序号</span>
                  <input
                    type="number"
                    name="idx"
                    defaultValue={l.idx}
                    min={1}
                    className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-[13px] outline-none focus:border-brand"
                  />
                </label>
                <label className="block">
                  <span className="block text-[12px] text-ink-3 mb-1">时长(秒)</span>
                  <input
                    type="number"
                    name="durationSec"
                    defaultValue={l.durationSec ?? ""}
                    min={0}
                    className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-[13px] outline-none focus:border-brand"
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 pb-2 text-[13px] text-ink-2">
                  <input type="checkbox" name="free" defaultChecked={Boolean(l.free)} />
                  试看
                </label>

                <div className="sm:col-span-4 grid gap-2">
                  <span className="text-[12px] text-ink-3">视频 (URL 或上传)</span>
                  <UploadField
                    id={`videoUrl-${l.id}`}
                    name="videoUrl"
                    defaultValue={l.videoUrl ?? ""}
                    placeholder="https://"
                    accept="video/mp4,video/webm"
                    uploadLabel="上传视频 (mp4 / webm)"
                  />
                  <label className="block">
                    <span className="block text-[12px] text-ink-3 mb-1">storage key (可选,优先用 URL)</span>
                    <input
                      type="text"
                      name="videoKey"
                      defaultValue={l.videoKey ?? ""}
                      placeholder="2026-05/uuid.mp4"
                      className="w-full rounded-md border border-line bg-white px-3 py-1.5 text-[12px] font-mono outline-none focus:border-brand"
                    />
                  </label>
                </div>

                <div className="sm:col-span-4 flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="rounded-md bg-brand text-white px-3 py-1.5 text-[13px] hover:bg-brand-dark transition"
                  >
                    保存
                  </button>
                  <MoveButton id={l.id} courseId={courseId} idx={l.idx} dir="up" />
                  <MoveButton id={l.id} courseId={courseId} idx={l.idx} dir="down" />
                  <span className="flex-1" />
                  <LessonDeleteForm id={l.id} courseId={courseId} />
                </div>
              </div>
            </form>
          </Card>
        ))}
      </div>

      <form
        action={createLessonAction}
        className="mt-4 rounded-[14px] border border-line bg-white p-4 grid gap-3 sm:grid-cols-[1fr_120px_120px_auto] items-end"
      >
        <input type="hidden" name="courseId" value={courseId} />
        <label className="block">
          <span className="block text-[12px] text-ink-3 mb-1">标题</span>
          <input
            name="title"
            required
            placeholder="新章节标题"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="block text-[12px] text-ink-3 mb-1">序号</span>
          <input
            name="idx"
            type="number"
            min={1}
            placeholder="自动"
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="block text-[12px] text-ink-3 mb-1">时长 (秒)</span>
          <input
            name="durationSec"
            type="number"
            min={0}
            className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
        </label>
        <label className="inline-flex items-center gap-2 self-center pb-1 text-[13px] text-ink-2">
          <input type="checkbox" name="free" />
          试看
        </label>
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-md bg-brand text-white px-4 py-2 text-[13px] font-medium hover:bg-brand-dark transition"
          >
            添加章节
          </button>
          <span className="ml-3 text-[12px] text-ink-3">
            创建后再在卡片里上传视频 / 调整详情
          </span>
        </div>
      </form>
    </div>
  );
}

function MoveButton({
  id,
  courseId,
  idx,
  dir,
}: {
  id: string;
  courseId: string;
  idx: number;
  dir: "up" | "down";
}) {
  return (
    <form action={moveLessonAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="idx" value={idx} />
      <input type="hidden" name="dir" value={dir} />
      <button
        type="submit"
        className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 hover:border-brand hover:text-brand transition"
        title={dir === "up" ? "上移" : "下移"}
      >
        {dir === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}
