"use client";

export default function OrganizationError({ reset }: { reset: () => void }) {
  return (
    <div className="container-page py-12">
      <h1 className="text-[22px] font-semibold text-ink">机构工作台暂时无法加载</h1>
      <p className="mt-2 text-[14px] text-ink-2">请稍后重试；如果持续出现，请联系平台管理员检查教学服务配置。</p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-md bg-brand px-4 py-2 text-[14px] font-medium text-white hover:bg-brand-dark"
      >
        重新加载
      </button>
    </div>
  );
}
