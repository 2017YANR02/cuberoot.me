// case 详情走静态路由 + ?k= 查询参数(58 万 case 不建动态段,免 Vercel 配额)。
import LsllCaseClient from './LsllCaseClient';

export const dynamic = 'force-static';

export default function Page() {
  return <LsllCaseClient />;
}
