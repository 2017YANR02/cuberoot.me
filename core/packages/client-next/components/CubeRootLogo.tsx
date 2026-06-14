'use client';

// 品牌 logo + 主页链接,封装「主题 → 资源」「HomeLink 包裹」「alt/aria」三件事,
// 供 timer Solo 顶栏 / Battle middle-bar 等处复用,避免各处重复内联同一份 ternary.
// logo 跟随主题:dark 用白字版,light 用深字版(否则白 logo 落在浅底看不见).
import HomeLink from '@/components/HomeLink';
import { useEffectiveTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';
import { tr } from '@/i18n/tr';

export default function CubeRootLogo({
  className,
  height = 24,
}: {
  className?: string;
  height?: number;
}) {
  const eff = useEffectiveTheme();
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const src = eff === 'dark' ? '/icons/CubeRoot-dark.png' : '/icons/CubeRoot.png';
  return (
    <HomeLink className={className} aria-label={tr({ zh: '主页', en: 'Home'
    })}>
      <img src={src} alt="CubeRoot" height={height} />
    </HomeLink>
  );
}
