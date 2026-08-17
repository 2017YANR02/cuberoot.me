import { logoutAction } from "../actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:border-brand/40 transition"
      >
        退出登录
      </button>
    </form>
  );
}
