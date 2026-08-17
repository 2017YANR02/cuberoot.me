import type { Instructor } from "@/db/schema";
import { Field, Input, TextArea, FormActions, Submit } from "../../_components/Form";
import { FormPanel, GhostLink } from "../../_components/Shell";
import { saveInstructor } from "./actions";

export function InstructorForm({ initial }: { initial?: Instructor }) {
  const isNew = !initial;
  return (
    <form action={saveInstructor}>
      <FormPanel>
        <Field label="ID (slug)" htmlFor="id" hint={isNew ? "必填" : "不可修改"}>
          <Input
            id="id"
            name="id"
            required
            defaultValue={initial?.id ?? ""}
            readOnly={!isNew}
            placeholder="chen-siyuan"
          />
        </Field>

        <Field label="姓名" htmlFor="name">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
        </Field>

        <Field label="头衔" htmlFor="title">
          <Input id="title" name="title" defaultValue={initial?.title ?? ""} />
        </Field>

        <Field label="城市" htmlFor="city">
          <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
        </Field>

        <Field label="擅长方向" htmlFor="specialty" hint="一行一个">
          <TextArea
            id="specialty"
            name="specialty"
            defaultValue={(initial?.specialty ?? []).join("\n")}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="累计学员数" htmlFor="studentsTaught">
            <Input
              id="studentsTaught"
              name="studentsTaught"
              type="number"
              min={0}
              defaultValue={initial?.studentsTaught ?? 0}
            />
          </Field>
          <Field label="授课年数" htmlFor="yearsTeaching">
            <Input
              id="yearsTeaching"
              name="yearsTeaching"
              type="number"
              min={0}
              defaultValue={initial?.yearsTeaching ?? 0}
            />
          </Field>
        </div>

        <Field label="最佳记录" htmlFor="bestRecord" hint="例: 3x3 PB 7.42s,无则填 —">
          <Input id="bestRecord" name="bestRecord" defaultValue={initial?.bestRecord ?? ""} />
        </Field>

        <Field label="简介" htmlFor="bio">
          <TextArea id="bio" name="bio" defaultValue={initial?.bio ?? ""} />
        </Field>

        <FormActions>
          <Submit>{isNew ? "创建" : "保存"}</Submit>
          <GhostLink href="/admin/instructors">取消</GhostLink>
        </FormActions>
      </FormPanel>
    </form>
  );
}
