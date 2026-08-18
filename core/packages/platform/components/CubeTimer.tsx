import { MainSiteToolNotice } from "@/components/MainSiteToolNotice";
import { MAIN_SITE_TOOLS } from "@/lib/main-site";

export function CubeTimer() {
  return (
    <MainSiteToolNotice href={MAIN_SITE_TOOLS.timer} linkLabel="打开主站计时器">
      Platform 不再提供独立计时器，也不迁移旧计时历史。新训练统一在 CubeRoot 主站完成。
    </MainSiteToolNotice>
  );
}
