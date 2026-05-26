import type { Course } from "@/db/schema";
import { Field, Input, TextArea, Select, FormActions, Submit } from "../../_components/Form";
import { FormPanel, GhostLink } from "../../_components/Shell";
import { saveCourse } from "./actions";

const LEVELS = ["入门", "进阶", "高阶", "竞速"];
const FORMATS = ["录播系统课", "线上直播", "一对一私教", "线下家教"];

function toLocalInput(ts: number | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CourseForm({ initial }: { initial?: Course }) {
  const isNew = !initial;
  const outlineText = (initial?.outline ?? [])
    .map((o) => `${o.week} | ${o.topic}`)
    .join("\n");

  return (
    <form action={saveCourse}>
      <FormPanel>
        <Field label="ID (slug, URL 一部分)" htmlFor="id" hint={isNew ? "必填,字母数字短横线" : "不可修改"}>
          <Input
            id="id"
            name="id"
            required
            defaultValue={initial?.id ?? ""}
            readOnly={!isNew}
            placeholder="cfop-foundation"
          />
        </Field>

        <Field label="标题" htmlFor="title">
          <Input id="title" name="title" required defaultValue={initial?.title ?? ""} />
        </Field>

        <Field label="副标题" htmlFor="subtitle">
          <Input id="subtitle" name="subtitle" defaultValue={initial?.subtitle ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="等级" htmlFor="level">
            <Select id="level" name="level" defaultValue={initial?.level ?? "入门"}>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="形式" htmlFor="format">
            <Select id="format" name="format" defaultValue={initial?.format ?? "录播系统课"}>
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="讲师" htmlFor="instructor">
          <Input id="instructor" name="instructor" defaultValue={initial?.instructor ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="时长 (小时)" htmlFor="durationHours">
            <Input
              id="durationHours"
              name="durationHours"
              type="number"
              min={0}
              defaultValue={initial?.durationHours ?? 0}
            />
          </Field>
          <Field label="课时数" htmlFor="lessons">
            <Input
              id="lessons"
              name="lessons"
              type="number"
              min={0}
              defaultValue={initial?.lessons ?? 0}
            />
          </Field>
          <Field label="价格 (元)" htmlFor="price">
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              defaultValue={initial?.price ?? 0}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="已报名学员数" htmlFor="studentsEnrolled">
            <Input
              id="studentsEnrolled"
              name="studentsEnrolled"
              type="number"
              min={0}
              defaultValue={initial?.studentsEnrolled ?? 0}
            />
          </Field>
          <Field label="评分" htmlFor="rating">
            <Input
              id="rating"
              name="rating"
              type="number"
              step="0.01"
              min={0}
              max={5}
              defaultValue={initial?.rating ?? 0}
            />
          </Field>
        </div>

        <Field label="亮点" htmlFor="highlights" hint="一行一个">
          <TextArea
            id="highlights"
            name="highlights"
            defaultValue={(initial?.highlights ?? []).join("\n")}
          />
        </Field>

        <Field
          label="大纲"
          htmlFor="outline"
          hint="一行一条,格式: 周次 | 主题  (例: Week 1 | Cross 训练)"
        >
          <TextArea id="outline" name="outline" defaultValue={outlineText} />
        </Field>

        <Field label="标签" htmlFor="tags" hint="一行一个">
          <TextArea id="tags" name="tags" defaultValue={(initial?.tags ?? []).join("\n")} />
        </Field>

        <Field
          label="视频 URL"
          htmlFor="videoUrl"
          hint="支持 .mp4 / .webm 直链,或 bilibili / vimeo / youtube 嵌入页 URL"
        >
          <Input
            id="videoUrl"
            name="videoUrl"
            defaultValue={initial?.videoUrl ?? ""}
            placeholder="https://"
          />
        </Field>

        <Field label="封面图 URL" htmlFor="coverUrl" hint="可选">
          <Input
            id="coverUrl"
            name="coverUrl"
            defaultValue={initial?.coverUrl ?? ""}
            placeholder="https://"
          />
        </Field>

        <Field label="下次直播时间" htmlFor="nextLiveAt" hint="可选,本地时区">
          <Input
            id="nextLiveAt"
            name="nextLiveAt"
            type="datetime-local"
            defaultValue={toLocalInput(initial?.nextLiveAt)}
          />
        </Field>

        <FormActions>
          <Submit>{isNew ? "创建" : "保存"}</Submit>
          <GhostLink href="/admin/courses">取消</GhostLink>
        </FormActions>
      </FormPanel>
    </form>
  );
}
