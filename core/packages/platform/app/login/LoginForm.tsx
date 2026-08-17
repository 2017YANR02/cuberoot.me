"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/track";

type Status = { kind: "idle" } | { kind: "error"; msg: string } | { kind: "ok"; msg: string };

export function LoginForm({ next, invite }: { next: string; invite?: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const phoneOk = /^1[3-9]\d{9}$/.test(phone);
  const codeOk = /^\d{6}$/.test(code);

  async function handleSend() {
    if (!phoneOk || cooldown > 0 || sending) return;
    setSending(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        retryAfter?: number;
      };
      if (!res.ok) {
        if (res.status === 429 && data.retryAfter) {
          setCooldown(data.retryAfter);
          setStatus({ kind: "error", msg: "发送过于频繁,稍后再试" });
        } else if (data.error === "invalid_phone") {
          setStatus({ kind: "error", msg: "手机号格式不正确" });
        } else {
          setStatus({ kind: "error", msg: "发送失败,请稍后再试" });
        }
        return;
      }
      setCooldown(60);
      setStatus({ kind: "ok", msg: "验证码已发送,请查看服务器控制台" });
      setTimeout(() => codeInputRef.current?.focus(), 50);
    } finally {
      setSending(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneOk || !codeOk || verifying) return;
    setVerifying(true);
    setStatus({ kind: "idle" });
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, code, invite: invite ?? null }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "invalid_or_expired") {
          setStatus({ kind: "error", msg: "验证码错误或已过期" });
        } else {
          setStatus({ kind: "error", msg: "登录失败,请重试" });
        }
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        isNew?: boolean;
        invite?: { code: string; rewardCoupon: string | null } | null;
      };
      if (data.isNew) {
        track("signup", { phone, invite: data.invite?.code ?? null });
      } else {
        track("login", { phone });
      }
      let target = next;
      if (data.isNew && data.invite?.rewardCoupon) {
        const sep = target.includes("?") ? "&" : "?";
        target = `${target}${sep}toast=invite_reward&coupon=${encodeURIComponent(data.invite.rewardCoupon)}`;
      }
      router.replace(target);
      router.refresh();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <form onSubmit={handleVerify} className="mt-5 grid gap-3">
      <label className="block">
        <span className="block text-[13px] text-ink-2 mb-1.5">手机号</span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={11}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="11 位手机号"
          className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
        />
      </label>

      <label className="block">
        <span className="block text-[13px] text-ink-2 mb-1.5">验证码</span>
        <div className="flex gap-2">
          <input
            ref={codeInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6 位验证码"
            className="flex-1 rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!phoneOk || cooldown > 0 || sending}
            className="shrink-0 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:border-brand hover:text-brand transition disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-2 disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `${cooldown}s` : sending ? "发送中" : "获取验证码"}
          </button>
        </div>
      </label>

      {status.kind === "error" ? (
        <div className="text-[13px] text-red-600">{status.msg}</div>
      ) : null}
      {status.kind === "ok" ? (
        <div className="text-[13px] text-emerald-700">{status.msg}</div>
      ) : null}

      <button
        type="submit"
        disabled={!phoneOk || !codeOk || verifying}
        className="mt-2 w-full rounded-md bg-brand text-white py-2.5 text-[14px] font-medium hover:bg-brand-dark transition disabled:opacity-50 disabled:hover:bg-brand"
      >
        {verifying ? "登录中…" : "登录 / 注册"}
      </button>
    </form>
  );
}
