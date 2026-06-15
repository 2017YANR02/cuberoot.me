import type { Algorithm } from "@/db/schema";
import { Field, Input, TextArea, FormActions, Submit } from "../../_components/Form";
import { FormPanel, GhostLink } from "../../_components/Shell";
import { saveAlgorithm } from "./actions";

export function AlgorithmForm({ initial }: { initial?: Algorithm }) {
  const isNew = !initial;
  return (
    <form action={saveAlgorithm}>
      <FormPanel>
        <input type="hidden" name="mode" value={isNew ? "new" : "edit"} />
        {!isNew ? <input type="hidden" name="id" value={initial.id} /> : null}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="类目" htmlFor="category" hint="如 PLL / OLL / F2L / CMLL">
            <Input
              id="category"
              name="category"
              required
              defaultValue={initial?.category ?? "PLL"}
              placeholder="PLL"
            />
          </Field>
          <Field label="适用魔方" htmlFor="puzzle">
            <Input
              id="puzzle"
              name="puzzle"
              defaultValue={initial?.puzzle ?? "333"}
              placeholder="333"
            />
          </Field>
        </div>

        <Field label="名称" htmlFor="name" hint="如 T Perm / OLL 33">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
        </Field>

        <Field label="公式记法" htmlFor="notation" hint="标准记法,如 R U R' U' R' F R2 U' R' U' R U R' F'">
          <TextArea
            id="notation"
            name="notation"
            required
            defaultValue={initial?.notation ?? ""}
            className="min-h-[60px]"
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="形态大类" htmlFor="caseGroup" hint="可空,如「邻角邻棱」">
            <Input
              id="caseGroup"
              name="caseGroup"
              defaultValue={initial?.caseGroup ?? ""}
            />
          </Field>
          <Field label="排序" htmlFor="sortOrder" hint="同类目内升序">
            <Input
              id="sortOrder"
              name="sortOrder"
              type="number"
              defaultValue={initial?.sortOrder ?? 0}
            />
          </Field>
        </div>

        <Field label="记忆提示" htmlFor="hint" hint="可空,手法 / 口诀">
          <TextArea id="hint" name="hint" defaultValue={initial?.hint ?? ""} className="min-h-[60px]" />
        </Field>

        <Field label="说明" htmlFor="description" hint="可空,适用场景 / 状态描述">
          <TextArea
            id="description"
            name="description"
            defaultValue={initial?.description ?? ""}
            className="min-h-[80px]"
          />
        </Field>

        <FormActions>
          <Submit>{isNew ? "创建" : "保存"}</Submit>
          <GhostLink href="/admin/algorithms">取消</GhostLink>
        </FormActions>
      </FormPanel>
    </form>
  );
}
