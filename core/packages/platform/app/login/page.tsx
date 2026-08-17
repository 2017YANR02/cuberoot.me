import { LoginForm } from "./LoginForm";
import { loadLoginParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const metadata = {
  title: "登录 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { next: rawNext, invite: rawInvite } = await loadLoginParams(searchParams);
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const invite = rawInvite.trim().toUpperCase().slice(0, 16);

  return (
    <div className="min-h-[80vh] grid place-items-center px-4 py-12">
      <div className="w-full max-w-sm rounded-[14px] border border-line bg-white p-6">
        <div className="text-[18px] font-semibold text-ink">手机号登录</div>
        <div className="mt-1 text-[13px] text-ink-3">未注册的手机号将自动创建账号</div>
        {invite ? (
          <div className="mt-3 rounded-md bg-brand-soft px-3 py-2 text-[12px] text-brand-dark">
            邀请码 <span className="font-mono">{invite}</span> 已就绪,完成注册后自动绑定。
          </div>
        ) : null}
        <LoginForm next={next} invite={invite || null} />
        <div className="mt-4 text-[12px] text-ink-3 leading-5">
          开发模式下,验证码会打印到服务器控制台
        </div>
      </div>
    </div>
  );
}
