"use client";

import { useState } from "react";
import { Check, Copy, Gift, Share2 } from "lucide-react";

type Props = {
  code: string;
  link: string;
  rewardCoupon?: string | null;
};

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      // ignore
    }
    document.body.removeChild(ta);
  }
}

// 一键分享卡:邀请码大号展示 + 引导文案 + 复制按钮。
// 可整段复制(邀请语 + 码 + 链接)直接发群/私信,也可单独复制码或链接。
export function InviteShareCard({ code, link, rewardCoupon }: Props) {
  const [copied, setCopied] = useState<"none" | "all" | "code" | "link" | "shared">("none");

  const inviteText =
    `我在「魔方开放社群」学魔方,一起来玩吧!\n` +
    `用我的邀请码 ${code} 注册${rewardCoupon ? `,新人立享奖励券` : ""}。\n` +
    `点这里直接注册:${link}`;

  function flash(which: "all" | "code" | "link" | "shared") {
    setCopied(which);
    setTimeout(() => setCopied("none"), 1600);
  }

  async function onCopyAll() {
    await copyText(inviteText);
    flash("all");
  }
  async function onCopyCode() {
    await copyText(code);
    flash("code");
  }
  async function onCopyLink() {
    await copyText(link);
    flash("link");
  }

  async function onShare() {
    // Web Share API:手机原生分享面板;不支持则降级整段复制。
    const navAny = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    if (typeof navAny.share === "function") {
      try {
        await navAny.share({
          title: "魔方开放社群 邀请",
          text: inviteText,
          url: link,
        });
        return;
      } catch {
        // 用户取消或失败,降级复制
      }
    }
    await copyText(inviteText);
    flash("shared");
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-line bg-white">
      {/* 卡面:品牌底色 + 大号邀请码,适合截图分享 */}
      <div className="bg-brand px-6 py-7 text-white">
        <div className="flex items-center gap-2 text-[13px] font-medium text-white/85">
          <Gift size={15} />
          <span>邀请好友一起玩魔方</span>
        </div>
        <div className="mt-4 text-[12px] text-white/75">我的专属邀请码</div>
        <div className="mt-1 font-mono text-[40px] font-semibold leading-none tracking-[0.12em]">
          {code}
        </div>
        {rewardCoupon ? (
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[12px] text-white">
            <Gift size={13} />
            新人注册即得奖励券 {rewardCoupon}
          </div>
        ) : null}
      </div>

      {/* 链接 + 操作 */}
      <div className="px-6 py-5">
        <div className="text-[12px] text-ink-3">注册链接</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="min-w-[200px] flex-1 truncate rounded-md border border-line bg-bg-soft px-3 py-2 font-mono text-[13px] text-ink-2">
            {link}
          </div>
          <button
            type="button"
            onClick={onCopyLink}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 transition hover:border-brand hover:text-brand"
          >
            {copied === "link" ? <Check size={14} /> : <Copy size={14} />}
            {copied === "link" ? "已复制" : "复制链接"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark"
          >
            <Share2 size={15} />
            {copied === "shared" ? "已复制邀请语" : "立即分享"}
          </button>
          <button
            type="button"
            onClick={onCopyAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 transition hover:border-brand hover:text-brand"
          >
            {copied === "all" ? <Check size={14} /> : <Copy size={14} />}
            {copied === "all" ? "已复制" : "复制邀请语"}
          </button>
          <button
            type="button"
            onClick={onCopyCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 transition hover:border-brand hover:text-brand"
          >
            {copied === "code" ? <Check size={14} /> : <Copy size={14} />}
            {copied === "code" ? "已复制" : "复制邀请码"}
          </button>
        </div>

        <p className="mt-4 whitespace-pre-line rounded-md bg-bg-soft px-3 py-3 text-[13px] leading-6 text-ink-2">
          {inviteText}
        </p>
      </div>
    </div>
  );
}
