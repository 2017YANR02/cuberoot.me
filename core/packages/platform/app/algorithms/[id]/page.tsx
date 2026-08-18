import { MainSiteToolNotice } from "@/components/MainSiteToolNotice";
import { Section } from "@/components/Section";
import { MAIN_SITE_TOOLS } from "@/lib/main-site";

export const metadata = {
  title: "公式详情 — 魔方开放社群",
};

export default function AlgorithmDetail() {
  return (
    <Section
      eyebrow="公式训练"
      title="该公式已迁移到主站"
      subtitle="Platform 不再维护独立公式详情，避免两套内容产生差异。"
    >
      <MainSiteToolNotice
        href={MAIN_SITE_TOOLS.algorithms}
        linkLabel="打开主站公式库"
      >
        请在主站公式库中搜索并继续训练。
      </MainSiteToolNotice>
    </Section>
  );
}
