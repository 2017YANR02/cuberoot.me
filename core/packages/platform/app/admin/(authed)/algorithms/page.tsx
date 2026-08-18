import { MainSiteToolNotice } from "@/components/MainSiteToolNotice";
import { MAIN_SITE_TOOLS } from "@/lib/main-site";
import { PageHeader } from "../../_components/Shell";

export default function AlgorithmsAdminPage() {
  return (
    <div>
      <PageHeader
        title="公式库已统一到主站"
        subtitle="Platform 后台不再维护第二套公式数据。"
      />
      <MainSiteToolNotice
        href={MAIN_SITE_TOOLS.algorithms}
        linkLabel="打开主站公式库"
      >
        公式内容和训练入口由 CubeRoot 主站统一提供。
      </MainSiteToolNotice>
    </div>
  );
}
