import type { Product } from "@/db/schema";
import { Field, Input, TextArea, Select, FormActions, Submit } from "../../_components/Form";
import { FormPanel, GhostLink } from "../../_components/Shell";
import { saveProduct } from "./actions";

const CATEGORIES = ["竞速魔方", "配件", "周边", "异形"];

export function ProductForm({ initial }: { initial?: Product }) {
  const isNew = !initial;
  return (
    <form action={saveProduct}>
      <FormPanel>
        <Field label="ID (slug)" htmlFor="id" hint={isNew ? "必填" : "不可修改"}>
          <Input
            id="id"
            name="id"
            required
            defaultValue={initial?.id ?? ""}
            readOnly={!isNew}
            placeholder="speed-pro-v5"
          />
        </Field>

        <Field label="名称" htmlFor="name">
          <Input id="name" name="name" required defaultValue={initial?.name ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="分类" htmlFor="category">
            <Select id="category" name="category" defaultValue={initial?.category ?? "竞速魔方"}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="品牌" htmlFor="brand">
            <Input id="brand" name="brand" defaultValue={initial?.brand ?? ""} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="价格 (元)" htmlFor="price">
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              defaultValue={initial?.price ?? 0}
              required
            />
          </Field>
          <Field label="原价 (元,可空)" htmlFor="originalPrice">
            <Input
              id="originalPrice"
              name="originalPrice"
              type="number"
              min={0}
              defaultValue={initial?.originalPrice ?? ""}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
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
          <Field label="评价数" htmlFor="reviews">
            <Input
              id="reviews"
              name="reviews"
              type="number"
              min={0}
              defaultValue={initial?.reviews ?? 0}
            />
          </Field>
        </div>

        <Field label="描述" htmlFor="description">
          <TextArea id="description" name="description" defaultValue={initial?.description ?? ""} />
        </Field>

        <Field label="特性" htmlFor="features" hint="一行一个">
          <TextArea
            id="features"
            name="features"
            defaultValue={(initial?.features ?? []).join("\n")}
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label="会员价 (元,可空)"
            htmlFor="memberPrice"
            hint="低于常规价才生效,会员下单按此实付"
          >
            <Input
              id="memberPrice"
              name="memberPrice"
              type="number"
              min={0}
              defaultValue={initial?.memberPrice ?? ""}
            />
          </Field>
        </div>

        <div className="space-y-2.5">
          <label className="inline-flex items-center gap-2 text-[14px] text-ink-2">
            <input
              type="checkbox"
              name="inStock"
              defaultChecked={initial?.inStock ?? true}
              className="h-4 w-4 accent-brand"
            />
            有货
          </label>
          <label className="flex items-center gap-2 text-[14px] text-ink-2">
            <input
              type="checkbox"
              name="memberOnly"
              defaultChecked={initial?.memberOnly ?? false}
              className="h-4 w-4 accent-brand"
            />
            会员专享(仅会员可购买,非会员下单被拦)
          </label>
        </div>

        <FormActions>
          <Submit>{isNew ? "创建" : "保存"}</Submit>
          <GhostLink href="/admin/products">取消</GhostLink>
        </FormActions>
      </FormPanel>
    </form>
  );
}
