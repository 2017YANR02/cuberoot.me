import { SiApple, SiWechat, SiQq, SiAlipay, SiTiktok } from 'react-icons/si';

/** Google 官方四色 "G" 标(内嵌 SVG,自包含,不依赖外部图标 CDN)。 */
function GoogleGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18A13.98 13.98 0 0 1 10.94 24c0-1.45.25-2.86.7-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}

/** WCA 官方标 — 随客户端一起打包。 */
const WcaGlyph = ({ size = 16 }: { size?: number }) => (
  <img src={new URL('./wca.svg', import.meta.url).href} alt="" width={size} height={size} aria-hidden="true" />
);

/** 国内三方品牌标:react-icons/si(simple-icons)按需 import,打进 bundle、不走 CDN。 */
const WechatGlyph = ({ size = 16 }: { size?: number }) => <SiWechat size={size} color="#07C160" aria-hidden="true" />;
const QqGlyph = ({ size = 16 }: { size?: number }) => <SiQq size={size} color="#1EBAFC" aria-hidden="true" />;
const AlipayGlyph = ({ size = 16 }: { size?: number }) => <SiAlipay size={size} color="#1677FF" aria-hidden="true" />;
const AppleGlyph = ({ size = 16 }: { size?: number }) => <SiApple size={size} aria-hidden="true" />;
const DouyinGlyph = ({ size = 16 }: { size?: number }) => (
  <SiTiktok size={size} aria-hidden="true" />
);

export const providerGlyphs = { apple: AppleGlyph, wca: WcaGlyph, google: GoogleGlyph, wechat: WechatGlyph, qq: QqGlyph, alipay: AlipayGlyph, douyin: DouyinGlyph };
