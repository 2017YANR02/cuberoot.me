import Image from 'next/image';
import './cubing-brand-label.css';

/** Shared brand assets; unknown/custom teams keep their original text. */
const brands = [
  { aliases: ['mfg', 'mfg 战队', 'mfg战队', 'mfg cube'], src: '/images/brands/mfg.svg', circle: false },
  { aliases: ['speedace'], src: '/images/brands/speedace.png', circle: false, width: '4em' },
  { aliases: ['宇宙爆速社-启航队'], src: '/images/brands/speedace-qihang.png', circle: false, width: '6.2em' },
  { aliases: ['宇宙爆速社-领航队'], src: '/images/brands/speedace-linghang.png', circle: false, width: '6.2em' },
  { aliases: ['gan gurus'], src: '/images/brands/gan-gurus.svg', circle: false },
  { aliases: ['魔域战队'], src: '/images/brands/moyu-team.svg', circle: false, monochrome: true, width: '4.1em' },
  { aliases: ['魔域梦之队'], src: '/images/brands/moyu-dream-team.svg', circle: false, monochrome: true, width: '2.3em' },
  { aliases: ['gan', 'gancube'], src: '/images/brands/gan-color.svg', circle: false },
  { aliases: ['魔域', '魔域文化', 'moyu'], src: '/images/brands/moyu-color.png', circle: false },
  { aliases: ['奇艺', '奇艺魔方', '奇艺魔方格', 'qiyi'], src: '/images/brands/qiyi-color.png', circle: true },
];

export function CubingBrandLabel({ name, logoOnly = false, fallbackToName = false }: { name: string; logoOnly?: boolean; fallbackToName?: boolean }) {
  const brand = brands.find(item => item.aliases.includes(name.trim().toLowerCase()));
  return <span className="cubing-brand-label" title={logoOnly && brand ? name : undefined}>
    {brand && (brand.monochrome
      ? <span className="cubing-brand-logo cubing-brand-logo--monochrome" role={logoOnly ? 'img' : undefined} aria-label={logoOnly ? name : undefined} aria-hidden={logoOnly ? undefined : true}
        style={{ maskImage: `url("${brand.src}")`, WebkitMaskImage: `url("${brand.src}")`, width: brand.width }} />
      : <Image className={`cubing-brand-logo${brand.circle ? ' cubing-brand-logo--circle' : ''}`} src={brand.src} alt={logoOnly ? name : ''} width={32} height={32} style={{ width: brand.width }} unoptimized />)}
    {(!logoOnly || (!brand && fallbackToName)) && <span>{name}</span>}
  </span>;
}
