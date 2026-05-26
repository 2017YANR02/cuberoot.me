import Link from "next/link";
import { MapPin, Users, Trophy, Award } from "lucide-react";
import { list as listInstructors } from "@/lib/db/instructors";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";

export const metadata = { title: "讲师 — 魔方开放社群" };

const TIERS = [
  { type: "录播系统课 / 社群训练营", platform: "40%", inst: "60%" },
  { type: "线上直播课 / 小班付费课", platform: "35%", inst: "65%" },
  { type: "一对一线上私教", platform: "30%", inst: "70%" },
  { type: "线下同城家教派单", platform: "20–25%", inst: "75–80%" },
];

export default async function InstructorsPage() {
  const instructors = await listInstructors();
  return (
    <>
      <Section
        eyebrow="讲师团队"
        title="入驻平台的专业魔方教练"
        subtitle="经过认证的全国教练池,涵盖入门启蒙、CFOP、盲拧、ZBLL、竞速等专项方向。"
      >
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((i) => (
            <div key={i.id} className="rounded-[14px] border border-line bg-white p-6">
              <div className="flex items-start gap-4">
                <Avatar name={i.name} />
                <div className="min-w-0">
                  <div className="text-[16px] font-semibold text-ink">{i.name}</div>
                  <div className="text-[12px] text-ink-3 mt-0.5">{i.title}</div>
                </div>
              </div>
              <p className="mt-4 text-[13px] leading-6 text-ink-3 line-clamp-3">{i.bio}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {i.specialty.map((s) => <Badge key={s} tone="brand">{s}</Badge>)}
              </div>
              <div className="mt-5 pt-4 border-t border-line grid grid-cols-3 gap-2 text-[12px] text-ink-3">
                <span className="inline-flex items-center gap-1"><MapPin size={12} />{i.city}</span>
                <span className="inline-flex items-center gap-1"><Users size={12} />{i.studentsTaught}</span>
                <span className="inline-flex items-center gap-1"><Trophy size={12} />{i.bestRecord}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        tone="soft"
        eyebrow="讲师合作模式"
        title="无底薪 + 业绩阶梯分成 · 行业领先"
        subtitle="平台统一负责收款、售后与流量分发,讲师可专注教学质量;阶梯激励机制深度绑定核心讲师。"
      >
        <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] items-start">
          <div className="rounded-[14px] border border-line bg-white overflow-hidden">
            <table className="w-full text-[14px]">
              <thead className="bg-brand text-white">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">课程类型</th>
                  <th className="text-right px-5 py-3 font-medium">平台分成</th>
                  <th className="text-right px-5 py-3 font-medium">讲师分成</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {TIERS.map((t) => (
                  <tr key={t.type}>
                    <td className="px-5 py-3 text-ink-2">{t.type}</td>
                    <td className="px-5 py-3 text-right text-ink-3">{t.platform}</td>
                    <td className="px-5 py-3 text-right text-brand font-semibold">{t.inst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <ModelCard icon={Trophy} title="高激励" text="行业领先的分成比例,最大化激励讲师发挥潜能。" />
            <ModelCard icon={Award} title="强绑定" text="阶梯激励机制和平台附加权益,深度绑定核心优秀人才。" />
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/instructors/apply"
            className="inline-flex items-center justify-center rounded-md bg-brand text-white px-6 py-3 text-[14px] font-medium hover:bg-brand-dark transition"
          >
            申请讲师入驻
          </Link>
        </div>
      </Section>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div
      className="h-12 w-12 shrink-0 rounded-full grid place-items-center text-white text-[15px] font-semibold"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 65% 55%), hsl(${(hue + 30) % 360} 70% 45%))` }}
    >
      {name.slice(-1)}
    </div>
  );
}

function ModelCard({ icon: Icon, title, text }: { icon: typeof Trophy; title: string; text: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-5 flex items-start gap-4">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-[15px] font-semibold text-ink mb-1">{title}</div>
        <p className="text-[13px] leading-6 text-ink-3">{text}</p>
      </div>
    </div>
  );
}
