import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { Download, ExternalLink, Printer } from "lucide-react";
import { findByCode } from "@/lib/db/qr";
import { absoluteUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { linksToText } from "@/lib/qr/links";
import { algToText } from "@/lib/qr/cardText";
import { FRONT_ARTS } from "@/components/QrCard";
import { LiveCardPreview } from "../_LiveCardPreview";
import { Card, PageHeader, GhostLink } from "../../../_components/Shell";
import {
  Field,
  FormActions,
  Input,
  Select,
  Submit,
  TextArea,
} from "../../../_components/Form";
import { DeleteButton } from "../../../_components/DeleteButton";
import { saveQr, deleteQr } from "../actions";
import { loadSavedNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

export default async function AdminQrEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ code: rawCode }, sp] = await Promise.all([
    params,
    loadSavedNotice(searchParams),
  ]);
  const code = String(rawCode ?? "").trim().toLowerCase();
  const entry = await findByCode(code);
  if (!entry) notFound();

  const landingUrl = absoluteUrl(`/qr/${entry.code}`);
  const svg = qrSvg(landingUrl);

  return (
    <div>
      <PageHeader
        title={`编辑 ${entry.code}`}
        subtitle={`累计扫码 ${entry.scans} 次,落地 /qr/${entry.code}`}
        actions={<GhostLink href="/admin/qr">返回列表</GhostLink>}
      />

      {sp.saved === "1" ? (
        <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
          已保存。
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <Card className="p-6">
          <form action={saveQr} className="grid gap-4">
            <input type="hidden" name="code" value={entry.code} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="批次标签" hint="内部备注,不展示给用户">
                <Input name="label" defaultValue={entry.label} required />
              </Field>
              <Field label="类型" hint="跳转码=扫码直达;聚合码=展示多链接落地页">
                <Select name="type" defaultValue={entry.type}>
                  <option value="redirect">跳转码 redirect</option>
                  <option value="landing">聚合码 landing</option>
                </Select>
              </Field>
            </div>

            <div className="rounded-md border border-line-soft bg-bg-soft p-4">
              <div className="mb-3 text-[13px] font-medium text-ink-2">
                跳转码 · 仅 redirect 生效
              </div>
              <Field label="目标路径" hint="站内路径,如 /courses 或 /login?invite=XX,默认 / 显示落地页">
                <Input name="target" defaultValue={entry.target} placeholder="/" />
              </Field>
            </div>

            <div className="rounded-md border border-line-soft bg-bg-soft p-4 grid gap-4">
              <div className="text-[13px] font-medium text-ink-2">
                聚合码 · 仅 landing 生效
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="标题" hint="落地页大标题,也用作卡片背面主文案;留空用默认">
                  <Input name="title" defaultValue={entry.title ?? ""} placeholder="魔方开放社群" />
                </Field>
                <Field label="魔方术语角标" hint="卡片/落地页展示,如 CFOP / OLL / F2L">
                  <Input name="term" defaultValue={entry.term ?? ""} placeholder="CFOP" />
                </Field>
              </div>
              <Field label="简介" hint="落地页副标题,也用作卡片背面副文案">
                <TextArea name="intro" defaultValue={entry.intro ?? ""} className="min-h-[70px]" />
              </Field>
              <Field
                label="链接列表"
                hint="每行一个:标签 | 链接 | 备注(可选)。链接可站内 /courses 或站外 https://…"
              >
                <TextArea
                  name="links"
                  defaultValue={linksToText(entry.links)}
                  placeholder={"系统课 | /courses | 0 基础到竞速\n商城 | /shop\n进群 | https://…"}
                  className="min-h-[120px]"
                />
              </Field>
            </div>

            <div className="rounded-md border border-line-soft bg-bg-soft p-4 grid gap-4">
              <div className="text-[13px] font-medium text-ink-2">
                打印卡正面 · 图 + 语录(背面是唯一二维码)
              </div>
              <Field label="正面背景图" hint="挑一张;不选则按卡片顺序轮换">
                <div className="flex flex-wrap gap-3">
                  {FRONT_ARTS.map((o) => (
                    <label
                      key={o.src}
                      className="w-[78px] cursor-pointer overflow-hidden rounded-md border border-line bg-white transition hover:border-brand/40 has-[:checked]:border-brand has-[:checked]:ring-2 has-[:checked]:ring-brand/30"
                    >
                      <input
                        type="radio"
                        name="frontArt"
                        value={o.src}
                        defaultChecked={entry.frontArt === o.src}
                        className="sr-only"
                      />
                      <img
                        src={o.src}
                        alt={o.label}
                        className="block aspect-[1/2] w-full object-cover"
                      />
                      <span className="block py-1 text-center text-[11px] text-ink-2">
                        {o.label}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              <Field
                label="正面语录"
                hint="第一行大字,其余行小字;留空则用默认语录轮换"
              >
                <TextArea
                  name="quote"
                  defaultValue={entry.quote ?? ""}
                  placeholder={"慢就是快\n一次打乱 一次成长"}
                  className="min-h-[70px]"
                />
              </Field>
              <Field
                label="背面精选公式"
                hint="格式:名称 | 记法 | 链接(后两段可省)。如 OLL 33 | R U R' U' R' F R F' | /zh/alg/3x3/oll"
              >
                <Input
                  name="alg"
                  defaultValue={algToText(entry.alg)}
                  placeholder="OLL 33 | R U R' U' R' F R F'"
                />
              </Field>
            </div>

            <FormActions>
              <Submit>保存</Submit>
            </FormActions>
          </form>
          <div className="mt-4 border-t border-line-soft pt-4">
            <DeleteButton id={entry.code} action={deleteQr} />
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink mb-3">二维码</h2>
            <div
              className="mx-auto w-full max-w-[200px] aspect-square"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <div className="mt-3 break-all text-center text-[11px] text-ink-3 font-mono">
              {landingUrl}
            </div>
            <div className="mt-4 grid gap-2">
              <a
                href={`/api/qr/${entry.code}/svg`}
                download={`qr-${entry.code}.svg`}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark transition"
              >
                <Download size={14} /> 下载 SVG
              </a>
              <a
                href={`/admin/qr/cards?codes=${entry.code}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
              >
                <Printer size={14} /> 卡片打印
              </a>
              <a
                href={`/qr/${entry.code}?stay=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
              >
                <ExternalLink size={14} /> 预览落地
              </a>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-semibold text-ink mb-3">卡片预览</h2>
            <div className="overflow-x-auto">
              <div className="inline-block" style={{ "--s": "1.8" } as CSSProperties}>
                <LiveCardPreview entry={entry} svg={svg} />
              </div>
            </div>
            <p className="mt-3 text-[12px] text-ink-3 leading-relaxed">
              左正面(图 + 语录),右背面(二维码)。选图 / 改语录即时预览,保存后生效。
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
