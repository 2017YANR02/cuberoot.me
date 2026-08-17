import type { CubeEvent } from "@/db/schema";
import { Field, Input, TextArea, Select, FormActions, Submit } from "../../_components/Form";
import { FormPanel, GhostLink } from "../../_components/Shell";
import { saveEvent } from "./actions";

const TYPES = ["WCA 官方赛", "城市开放赛", "线上挑战赛", "社群交流赛"];
const STATUSES = ["报名中", "即将开放", "已结束"];

export function EventForm({ initial }: { initial?: CubeEvent }) {
  const isNew = !initial;
  return (
    <form action={saveEvent}>
      <FormPanel>
        <Field label="ID (slug)" htmlFor="id" hint={isNew ? "必填" : "不可修改"}>
          <Input
            id="id"
            name="id"
            required
            defaultValue={initial?.id ?? ""}
            readOnly={!isNew}
            placeholder="open-2026-shenzhen"
          />
        </Field>

        <Field label="标题" htmlFor="title">
          <Input id="title" name="title" required defaultValue={initial?.title ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="类型" htmlFor="type">
            <Select id="type" name="type" defaultValue={initial?.type ?? "城市开放赛"}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="状态" htmlFor="status">
            <Select id="status" name="status" defaultValue={initial?.status ?? "报名中"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="开始日期" htmlFor="startDate" hint="YYYY-MM-DD">
            <Input
              id="startDate"
              name="startDate"
              required
              defaultValue={initial?.startDate ?? ""}
              placeholder="2026-07-12"
            />
          </Field>
          <Field label="结束日期 (可空)" htmlFor="endDate" hint="YYYY-MM-DD,留空表示单日">
            <Input
              id="endDate"
              name="endDate"
              defaultValue={initial?.endDate ?? ""}
              placeholder="2026-07-13"
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="城市" htmlFor="city">
            <Input id="city" name="city" defaultValue={initial?.city ?? ""} />
          </Field>
          <Field label="场地" htmlFor="venue">
            <Input id="venue" name="venue" defaultValue={initial?.venue ?? ""} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="容量" htmlFor="capacity">
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={0}
              defaultValue={initial?.capacity ?? 0}
            />
          </Field>
          <Field label="已报名" htmlFor="registered">
            <Input
              id="registered"
              name="registered"
              type="number"
              min={0}
              defaultValue={initial?.registered ?? 0}
            />
          </Field>
          <Field label="费用 (元)" htmlFor="fee">
            <Input
              id="fee"
              name="fee"
              type="number"
              min={0}
              defaultValue={initial?.fee ?? 0}
            />
          </Field>
        </div>

        <Field label="比赛项目" htmlFor="events" hint="一行一个">
          <TextArea
            id="events"
            name="events"
            defaultValue={(initial?.events ?? []).join("\n")}
          />
        </Field>

        <Field label="赛事描述" htmlFor="description">
          <TextArea id="description" name="description" defaultValue={initial?.description ?? ""} />
        </Field>

        <FormActions>
          <Submit>{isNew ? "创建" : "保存"}</Submit>
          <GhostLink href="/admin/events">取消</GhostLink>
        </FormActions>
      </FormPanel>
    </form>
  );
}
