# Cubing manufacturer logos

Shared public assets for manufacturer/team identification. Retrieved 2026-10-10.
Keep source artwork here, independent of WCA results. React consumers use
`@/components/CubingBrandLabel`; the public URLs also work outside React.
Names and trademarks belong to their respective owners.

| Asset | Source | Notes |
| --- | --- | --- |
| `gan.svg` | https://upload.wikimedia.org/wikipedia/en/9/9d/Gancube_logo.svg (https://en.wikipedia.org/wiki/Gancube) | Original vector wordmark. |
| `gan-mark.svg` | Same source as `gan.svg` | First path (cube emblem) extracted unchanged, with its own viewBox. |
| `moyu.png` | https://maru.tw/wp-content/uploads/data/moyu.png (https://maru.tw/cube-icons/) | Transparent 300×300 PNG from MARU's cubing logo collection; official site was unavailable during retrieval. No verified SVG found. |
| `qiyi.webp` | https://33490320.s21i.faiusr.com/4/ABUIABAEGAAguIi2wQYouvn21gIwwQs4nwc.png.webp (https://www.qiyitoys.net/) | Official website logo, transparent 1473×927 WebP. No verified SVG found. |

Current UI uses original-color PNGs directly, without CSS masks or recoloring:

| Asset | Source | Notes |
| --- | --- | --- |
| `gan-color.png` | https://maru.tw/wp-content/uploads/data/gan.png (https://maru.tw/cube-icons/) | Original blue emblem, transparent PNG. |
| `moyu-color.png` | https://cubershop.com/cdn/shop/files/Moyu_Square_Logo_Transparent_background.png?v=1754573872 (https://cubershop.com/collections/moyu) | Original blue wordmark, transparent PNG. |
| `qiyi-color.png` | https://cdn.shopify.com/s/files/1/0855/0152/files/qiyi_logo.png?v=1765968050 (https://kewbz.co.uk/blogs/cubing-blogs/the-big-speedcube-brands-compared-what-sets-gan-moyu-qiyi-yj-apart) | Original yellow-disc artwork. CSS crops the surrounding white canvas to the circle; no recoloring. |

The monochrome files above remain available as alternate source artwork. No
verified original-color SVG was found; the UI must not substitute monochrome
artwork merely to use SVG.
Do not wrap raster images in SVG and describe them as vector artwork.
