import type { NewsItem } from "@/db/schema";
import { Field, Input, TextArea, Select, FormActions, Submit } from "../../_components/Form";
import { FormPanel, GhostLink } from "../../_components/Shell";
import { saveNews } from "./actions";

const CATEGORIES = ["公告", "赛事", "教学", "行业"];

export function NewsForm({ initial }: { initial?: NewsItem }) {
  const isNew = !initial;
  return (
    <form action={saveNews}>
      <FormPanel>
        <Field label="ID (slug)" htmlFor="id" hint={isNew ? "必填" : "不可修改"}>
          <Input
            id="id"
            name="id"
            required
            defaultValue={initial?.id ?? ""}
            readOnly={!isNew}
            placeholder="platform-launch"
          />
        </Field>

        <Field label="标题" htmlFor="title">
          <Input id="title" name="title" required defaultValue={initial?.title ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="日期" htmlFor="date" hint="YYYY-MM-DD">
            <Input
              id="date"
              name="date"
              required
              defaultValue={initial?.date ?? ""}
              placeholder="2026-05-20"
            />
          </Field>
          <Field label="分类" htmlFor="category">
            <Select id="category" name="category" defaultValue={initial?.category ?? "公告"}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="摘要" htmlFor="excerpt">
          <TextArea id="excerpt" name="excerpt" defaultValue={initial?.excerpt ?? ""} />
        </Field>

        <Field
          label="正文 (Markdown)"
          htmlFor="body"
          hint="支持 # / ## 标题、bullet list、> 引用、**bold**、[链接](url)"
        >
          <TextArea
            id="body"
            name="body"
            defaultValue={initial?.body ?? ""}
            rows={20}
            className="min-h-[360px]"
          />
        </Field>

        <FormActions>
          <Submit>{isNew ? "创建" : "保存"}</Submit>
          <GhostLink href="/admin/news">取消</GhostLink>
        </FormActions>
      </FormPanel>
    </form>
  );
}
