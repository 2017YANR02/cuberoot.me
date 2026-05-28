import Link from "next/link";

const COLS: { title: string; items: { href: string; label: string }[] }[] = [
  {
    title: "平台",
    items: [
      { href: "/courses", label: "课程" },
      { href: "/shop", label: "商城" },
      { href: "/events", label: "赛事" },
      { href: "/community", label: "社群" },
    ],
  },
  {
    title: "内容",
    items: [
      { href: "/news", label: "资讯" },
      { href: "/instructors", label: "讲师" },
      { href: "/about", label: "关于我们" },
      { href: "/progress", label: "建设成果" },
    ],
  },
  {
    title: "加入",
    items: [
      { href: "/instructors/apply", label: "讲师入驻" },
      { href: "mailto:hello@example.com", label: "商务合作" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-bg-soft">
      <div className="container-page py-12 grid grid-cols-2 gap-10 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="font-semibold text-ink mb-2">魔方开放社群</div>
          <p className="text-[13px] leading-6 text-ink-3">
            一站式魔方垂直综合服务平台。<br />
            汇聚热爱,连接你我,共同进步。
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <div className="text-[13px] font-medium text-ink mb-3">{c.title}</div>
            <ul className="space-y-2 text-[13px] text-ink-3">
              {c.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="hover:text-ink">
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page py-4 text-[12px] text-ink-3 flex flex-wrap items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} 魔方开放社群</span>
          <span>共创成长 · 共建生态</span>
        </div>
      </div>
    </footer>
  );
}
