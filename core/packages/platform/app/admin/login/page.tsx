import { loginAction } from "../actions";
import { loadAdminLoginParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const metadata = {
  title: "登录 — 管理后台",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { next, error } = await loadAdminLoginParams(searchParams);
  const hasError = error === "1";

  return (
    <div className="min-h-[80vh] grid place-items-center px-4 py-12">
      <form
        action={loginAction}
        className="w-full max-w-sm rounded-[14px] border border-line bg-white p-6"
      >
        <div className="text-[18px] font-semibold text-ink">管理后台</div>
        <div className="mt-1 text-[13px] text-ink-3">魔方开放社群</div>

        <label className="mt-6 block text-[13px] text-ink-2" htmlFor="password">
          管理员密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand"
        />
        <input type="hidden" name="next" value={next} />

        {hasError ? (
          <div className="mt-3 text-[13px] text-red-600">密码错误,请重试</div>
        ) : null}

        <button
          type="submit"
          className="mt-5 w-full rounded-md bg-brand text-white py-2.5 text-[14px] font-medium hover:bg-brand-dark transition"
        >
          登录
        </button>

        <div className="mt-4 text-[12px] text-ink-3 leading-5">
          密码通过环境变量{" "}
          <code className="rounded bg-bg-soft px-1.5 py-0.5">ADMIN_PASSWORD</code>{" "}
          配置(部署时务必设置强密码)。
        </div>
      </form>
    </div>
  );
}
