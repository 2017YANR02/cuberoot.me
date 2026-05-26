import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireInstructor } from "@/lib/auth/instructor";
import { findByIdForInstructor } from "@/lib/db/courses";
import { saveOwnedCourse } from "../actions";

export const dynamic = "force-dynamic";

const LEVELS = ["入门", "进阶", "高阶", "竞速"];
const FORMATS = ["录播系统课", "线上直播", "一对一私教", "线下家教"];

function toLocalInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function InstructorEditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { instructor } = await requireInstructor();
  const course = await findByIdForInstructor(id, instructor.id);
  if (!course) {
    // Not yours or doesn't exist.
    redirect("/instructor/courses");
    notFound();
  }
  const outlineText = (course.outline ?? [])
    .map((o) => `${o.week} | ${o.topic}`)
    .join("\n");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-ink">编辑课程</h1>
        <p className="mt-1 text-[13px] text-ink-3">{course.title}</p>
      </div>

      {sp.saved ? (
        <div className="mb-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          已保存
        </div>
      ) : null}

      <form action={saveOwnedCourse}>
        <div className="rounded-[14px] border border-line bg-white p-6 grid gap-4 max-w-3xl">
          <input type="hidden" name="id" value={course.id} />

          <FormField label="标题" htmlFor="title">
            <TextInput id="title" name="title" required defaultValue={course.title} />
          </FormField>

          <FormField label="副标题" htmlFor="subtitle">
            <TextInput id="subtitle" name="subtitle" defaultValue={course.subtitle} />
          </FormField>

          <div className="grid sm:grid-cols-2 gap-4">
            <FormField label="等级" htmlFor="level">
              <SelectInput id="level" name="level" defaultValue={course.level}>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </SelectInput>
            </FormField>

            <FormField label="形式" htmlFor="format">
              <SelectInput id="format" name="format" defaultValue={course.format}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </SelectInput>
            </FormField>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <FormField label="时长 (小时)" htmlFor="durationHours">
              <TextInput
                id="durationHours"
                name="durationHours"
                type="number"
                min={0}
                defaultValue={course.durationHours}
              />
            </FormField>
            <FormField label="课时数" htmlFor="lessons">
              <TextInput
                id="lessons"
                name="lessons"
                type="number"
                min={0}
                defaultValue={course.lessons}
              />
            </FormField>
            <FormField label="价格 (元)" htmlFor="price">
              <TextInput
                id="price"
                name="price"
                type="number"
                min={0}
                defaultValue={course.price}
              />
            </FormField>
          </div>

          <FormField label="亮点" htmlFor="highlights" hint="一行一个">
            <TextArea
              id="highlights"
              name="highlights"
              defaultValue={(course.highlights ?? []).join("\n")}
            />
          </FormField>

          <FormField
            label="大纲"
            htmlFor="outline"
            hint="一行一条,格式: 周次 | 主题 (例: Week 1 | Cross 训练)"
          >
            <TextArea id="outline" name="outline" defaultValue={outlineText} />
          </FormField>

          <FormField label="标签" htmlFor="tags" hint="一行一个">
            <TextArea id="tags" name="tags" defaultValue={(course.tags ?? []).join("\n")} />
          </FormField>

          <FormField
            label="视频 URL"
            htmlFor="videoUrl"
            hint="支持 .mp4 / .webm 直链,或 bilibili / vimeo / youtube 嵌入页 URL"
          >
            <TextInput
              id="videoUrl"
              name="videoUrl"
              defaultValue={course.videoUrl ?? ""}
              placeholder="https://"
            />
          </FormField>

          <FormField label="封面图 URL" htmlFor="coverUrl" hint="可选">
            <TextInput
              id="coverUrl"
              name="coverUrl"
              defaultValue={course.coverUrl ?? ""}
              placeholder="https://"
            />
          </FormField>

          <FormField label="下次直播时间" htmlFor="nextLiveAt" hint="可选,本地时区">
            <TextInput
              id="nextLiveAt"
              name="nextLiveAt"
              type="datetime-local"
              defaultValue={toLocalInput(course.nextLiveAt)}
            />
          </FormField>

          <div className="mt-2 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-md bg-brand text-white px-5 py-2 text-[14px] font-medium hover:bg-brand-dark transition"
            >
              保存
            </button>
            <Link
              href="/instructor/courses"
              className="inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
            >
              取消
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="block text-[13px] text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-ink-3 mt-1">{hint}</span> : null}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputBase + " " + (props.className ?? "")} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        inputBase + " min-h-[100px] font-mono text-[13px] " + (props.className ?? "")
      }
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputBase + " " + (props.className ?? "")} />;
}
