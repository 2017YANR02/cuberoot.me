import type { Metadata } from "next";
import { Section } from "@/components/Section";
import { CubeTimer } from "@/components/CubeTimer";

export const metadata: Metadata = {
  title: "计时训练 — 魔方开放社群",
  description: "前往 CubeRoot 主站使用统一计时器。",
};

export default function TimerPage() {
  return (
    <Section
      eyebrow="训练工具"
      title="计时训练已统一到主站"
      subtitle="Platform 聚焦机构、课程、课包、作业与课堂管理，训练工具直接复用 CubeRoot 主站。"
    >
      <CubeTimer />
    </Section>
  );
}
