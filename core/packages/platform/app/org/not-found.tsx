import Link from "next/link";

export default function OrganizationNotFound() {
  return (
    <div className="container-page py-12">
      <h1 className="text-[22px] font-semibold text-ink">找不到这个机构</h1>
      <p className="mt-2 text-[14px] leading-6 text-ink-2">
        该机构不存在，或你当前没有访问权限。
      </p>
      <Link
        href="/org"
        prefetch={false}
        className="mt-5 inline-block text-[14px] font-medium text-brand-dark hover:underline"
      >
        查看我的机构
      </Link>
    </div>
  );
}
