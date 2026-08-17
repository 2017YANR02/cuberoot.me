import Link from "next/link";
import { Section } from "@/components/Section";
import { ApplyForm } from "./ApplyForm";

export const metadata = { title: "讲师入驻申请 — 魔方开放社群" };

export default function ApplyPage() {
  return (
    <Section
      eyebrow="讲师入驻"
      title="加入魔方开放社群讲师团队"
      subtitle="填写下方信息,我们会在 3 个工作日内联系你。"
    >
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4 text-[14px] text-ink-2 leading-7">
          <p>我们正在寻找以下方向的讲师:</p>
          <ul className="space-y-2 text-[13px] text-ink-3">
            <li>入门 / CFOP 系统教学方向</li>
            <li>高阶 ZBLL / COLL 训练方向</li>
            <li>盲拧 / 多盲 / 单手专项</li>
            <li>异形(金字塔 / 斜转 / SQ-1)</li>
            <li>WCA 赛事赛前突击</li>
            <li>少儿魔方启蒙</li>
          </ul>
          <p className="pt-4 border-t border-line">
            分成比例:录播 60% / 直播 65% / 1v1 70% / 线下 75–80%。
            合作方式见{" "}
            <Link href="/instructors" className="text-brand hover:underline">
              讲师页面
            </Link>
            。
          </p>
        </div>

        <ApplyForm />
      </div>
    </Section>
  );
}
