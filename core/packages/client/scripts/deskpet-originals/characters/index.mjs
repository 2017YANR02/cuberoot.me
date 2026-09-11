import hermit from './hermit-crab.mjs';
import fox from './fox.mjs';
import postbird from './postbird.mjs';
import snail from './snail.mjs';
import ray from './ray.mjs';
import pangolin from './pangolin.mjs';
import beetle from './beetle.mjs';
import owl from './owl.mjs';
import chameleon from './chameleon.mjs';
import squid from './squid.mjs';
import lobster from './lobster.mjs';
import pixelLobster from './pixel-lobster.mjs';

const details = [
  ['寄居蟹', 'Hermit Crab', [106,145], [50,118], [155,172], [126,194]],
  ['狐狸', 'Fox', [115,118], [107,190], [135,191], [122,194]],
  ['邮差鸟', 'Postbird', [121,109], [64,168], [175,163], [122,194]],
  ['蜗牛', 'Snail', [89,139], [76,84], [107,84], [124,194]],
  ['鳐鱼', 'Ray', [121,145], [39,125], [202,128], [122,192]],
  ['穿山甲', 'Pangolin', [143,120], [115,150], [145,145], [124,199]],
  ['甲虫', 'Beetle', [99,157], [109,105], [180,109], [126,195]],
  ['猫头鹰', 'Owl', [121,115], [77,164], [166,165], [122,194]],
  ['变色龙', 'Chameleon', [87,123], [107,185], [155,185], [122,193]],
  ['鱿鱼', 'Squid', [119,135], [48,137], [179,184], [122,200]],
  ['龙虾', 'Lobster', [128,150], [59,177], [180,183], [126,199]],
  ['像素龙虾', 'Pixel Lobster', [112,109], [63,90], [171,92], [132,191]],
];
export const ORIGINAL_CHARACTERS = [hermit,fox,postbird,snail,ray,pangolin,beetle,owl,chameleon,squid,lobster,pixelLobster].map((character,i)=>{
  const [zh,en,face,left,right,feet]=details[i];
  return {...character,zh,en,anchors:{face,left,right,feet}};
});
