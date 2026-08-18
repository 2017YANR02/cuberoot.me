import { MainSiteToolNotice } from "@/components/MainSiteToolNotice";
import { MAIN_SITE_TOOLS } from "@/lib/main-site";
import { PageHeader } from "../../../_components/Shell";

export default function NewAlgorithmPage() {
  return (
    <div>
      <PageHeader
        title="公式维护已停用"
        subtitle="请在主站的统一公式系统中维护内容。"
      />
      <MainSiteToolNotice
        href={MAIN_SITE_TOOLS.algorithms}
        linkLabel="打开主站公式库"
      >
        Platform 不再创建独立公式记录。
      </MainSiteToolNotice>
    </div>
  );
}
