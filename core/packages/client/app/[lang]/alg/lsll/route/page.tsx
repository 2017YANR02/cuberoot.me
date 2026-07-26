// 路线详情走静态路由 + ?z=&l= 查询参数(15 万条路线不建动态段,免 Vercel 配额,同 case 页)。
import LsllRouteClient from './LsllRouteClient';

export const dynamic = 'force-static';

export default function Page() {
  return <LsllRouteClient />;
}
