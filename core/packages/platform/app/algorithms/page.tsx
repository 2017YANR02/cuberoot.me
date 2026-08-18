import { MainSiteToolNotice } from "@/components/MainSiteToolNotice";
import { Section } from "@/components/Section";
import { MAIN_SITE_TOOLS } from "@/lib/main-site";

export const metadata = {
  title: "公式库与训练 — 魔方开放社群",
  description: "CubeRoot 公式库与训练统一由主站提供。",
};

export default function AlgorithmsPage() {
  return (
    <Section
      eyebrow="公式训练"
      title="公式库与训练已统一到主站"
      subtitle="Platform 专注教学管理，不再维护第二套算法字典或训练器。"
    >
      <MainSiteToolNotice
        href={MAIN_SITE_TOOLS.algorithms}
        linkLabel="打开主站公式库"
      >
        公式查询、选择与训练统一在 CubeRoot 主站完成。
      </MainSiteToolNotice>
    </Section>
  );
}
