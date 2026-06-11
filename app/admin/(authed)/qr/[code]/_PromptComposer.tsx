"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import {
  assemblePrompt,
  composePrompt,
  PROMPT_DIMENSIONS,
  type PromptDimension,
} from "@/lib/qr/prompt";

// 后台传入的提示词数据(只取要用的字段)
export type PromptTpl = { id: number; name: string; category: string | null; body: string };
export type PromptBlk = { id: number; name: string; dimension: string | null; body: string };

const EMPTY_BLOCK_SEL: Record<PromptDimension, number | null> = {
  风格: null,
  主体: null,
  主题: null,
  构图: null,
  光影: null,
};

const TA_CLS =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-brand";

// 正面背景图「提示词组合器」:按维度各挑一项(可留空)即时拼成完整提示词,或用整套模板一键填入,
// 可继续手改 → 复制去外部 AI 生图。常驻显示(独立于卡片元素点选),隐藏 input 随「保存」记 front_art_prompt。
export function PromptComposer({
  templates,
  blocks,
  formId,
  defaultPrompt,
}: {
  templates: PromptTpl[];
  blocks: PromptBlk[];
  formId: string;
  defaultPrompt: string;
}) {
  const [artPrompt, setArtPrompt] = useState(defaultPrompt);
  const [blockSel, setBlockSel] =
    useState<Record<PromptDimension, number | null>>(EMPTY_BLOCK_SEL);
  const [copied, setCopied] = useState(false);

  // 按 blockSel 取各维度选中积木正文,按维度序拼成完整提示词(全空则空)
  const composeFromSel = (sel: Record<PromptDimension, number | null>): string => {
    const bodies = PROMPT_DIMENSIONS.map((d) => {
      const id = sel[d.key];
      return id ? (blocks.find((b) => b.id === id)?.body ?? null) : null;
    });
    return bodies.some(Boolean) ? composePrompt(bodies) : "";
  };
  // 点维度积木:同维度再点一次=取消;变更后即时重组文本框
  const pickBlock = (dim: PromptDimension, id: number) => {
    const sel = { ...blockSel, [dim]: blockSel[dim] === id ? null : id };
    setBlockSel(sel);
    setArtPrompt(composeFromSel(sel));
  };
  // 用整套预设:直接填入并清空维度选区(两种填法互斥,最后一次操作为准)
  const usePreset = (body: string) => {
    setBlockSel({ ...EMPTY_BLOCK_SEL });
    setArtPrompt(assemblePrompt(body));
  };
  const clearComposer = () => {
    setBlockSel({ ...EMPTY_BLOCK_SEL });
    setArtPrompt("");
  };

  const copyPrompt = async () => {
    const text = artPrompt.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 无 clipboard 权限时退回选区复制
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* 实在不行用户可手动选中文本框复制 */
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <input type="hidden" name="frontArtPrompt" value={artPrompt} form={formId} readOnly />

      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-ink">用 AI 生成新背景图</h2>
        <a
          href="/admin/qr/prompts"
          target="_blank"
          rel="noreferrer"
          className="text-[12px] text-brand hover:underline"
        >
          管理提示词
        </a>
      </div>
      <p className="mb-4 text-[12px] leading-relaxed text-ink-3">
        按维度各挑一项(可留空)自动拼成提示词,或用「整套现成模板」一键填入,还能在右侧框里继续加自己的描述 → 复制 → 拿去即梦 / Midjourney / SD 生图 → 下载无水印竖版高清图 → 回到上方点卡片正面图、用「上传自己的正面图」传回来。语录和品牌名不用让 AI 写,系统自动叠。
      </p>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(300px,400px)]">
        {/* 左:维度积木 + 整套模板 */}
        <div className="grid content-start gap-3">
          {PROMPT_DIMENSIONS.map((d) => {
            const opts = blocks.filter((b) => b.dimension === d.key);
            if (opts.length === 0) return null;
            return (
              <div key={d.key} className="grid gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-medium text-ink-2">{d.label}</span>
                  <span className="text-[11px] text-ink-3">{d.hint}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((b) => {
                    const on = blockSel[d.key] === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => pickBlock(d.key, b.id)}
                        title={b.body}
                        className={
                          "rounded-full border px-2.5 py-1 text-[12px] transition " +
                          (on
                            ? "border-brand bg-brand/5 text-brand ring-1 ring-brand/30"
                            : "border-line bg-white text-ink-2 hover:border-brand/50 hover:text-brand")
                        }
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {templates.length > 0 ? (
            <details className="rounded-md border border-line bg-bg-soft/40 px-3 py-2">
              <summary className="cursor-pointer select-none text-[12px] font-medium text-ink-2">
                或直接用整套现成模板({templates.length})
              </summary>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => usePreset(t.body)}
                    title={t.body}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-[12px] text-ink-2 transition hover:border-brand/50 hover:text-brand"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        {/* 右:拼好的提示词(可继续手改)+ 复制 */}
        <div className="grid content-start gap-2">
          <textarea
            value={artPrompt}
            onChange={(e) => setArtPrompt(e.target.value)}
            placeholder="左边挑维度或选整套模板会自动拼到这里,也可直接在此写 / 改 / 加自己的描述…"
            className={TA_CLS + " min-h-[220px] leading-relaxed"}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <button
              type="button"
              onClick={copyPrompt}
              disabled={!artPrompt.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check size={14} /> 已复制
                </>
              ) : (
                <>
                  <Copy size={14} /> 复制提示词
                </>
              )}
            </button>
            {artPrompt.trim() ? (
              <button
                type="button"
                onClick={clearComposer}
                className="text-[12px] text-ink-3 hover:text-brand"
              >
                清空
              </button>
            ) : null}
            <span className="text-[12px] text-ink-3">
              复制内容已含通用头(WCA 配色 + 1:2 + 无文字)。
            </span>
          </div>
          <span className="text-[12px] text-ink-3">
            这段提示词会随「保存」记到本码,下次打开能看到这张图当时怎么生成的,方便复刻 / 微调同款。
          </span>
        </div>
      </div>
    </div>
  );
}
