import { cubieToFacelet, faceletToCubie, validateFacelet } from '@cuberoot/shared/cube-facelet';
import type { AssistantAnswer } from '@cuberoot/shared/site-assistant';
import { requestsCubeMoveVerification } from './site_assistant_moves.js';

/** A last-layer photo match is conditional on hidden pieces. Never use it as a full state. */
export function fullCubeHandoff(question: string, hasImages: boolean, lang: 'zh' | 'en'): AssistantAnswer | undefined {
  const text = question.normalize('NFKC').trim();
  if (/\b(?:OLL|PLL|CMLL|ZBLL|F2L|case|last[- ]layer)\b|顶层|最后一层|末层|对比|撤回|倒序|比较|二阶|四阶|五阶|异形|不要.{0,4}(?:链接|入口)|\b(?:[245]\s*[x×]\s*[245]|compare|inverse|no links)\b/i.test(text)) return;

  const hasSolveIntent = /还原|复原|拼回|拼好|怎么拧|怎么解|求解|\b(?:solve|restore|unscramble)\b/i.test(text);
  const hasValidationIntent = /验证|校验|核验|是否合法|\b(?:verify|validate|legal|reachable)\b/i.test(text);
  const stickers = /(?:六面(?:贴纸)?|贴纸(?:编码|状态)?|魔方状态|facelets?|cube state)\s*[:：]\s*([A-Z?\s,/|]+)[。.!！]?$/i.exec(text);
  const explicit = !!stickers && (hasSolveIntent || hasValidationIntent);
  if (explicit && requestsCubeMoveVerification(text.slice(0, stickers.index))) return;
  const photoRequest = hasImages && hasSolveIntent && !hasValidationIntent && /魔方|三阶|\b(?:3\s*[x×]\s*3|cube)\b/i.test(text);
  if (!explicit && !photoRequest) return;

  const label = (zh: string, en: string) => ({ zh, en })[lang];
  const scan = { id: 'cube3-six-face-scan', title: label('六面拍照', 'Scan all six faces'), href: '/scramble/solver?event=333&view=photo' };
  const board = { id: 'cube3-facelet-board', title: label('三阶涂色画板', '3×3 color editor'), href: '/scramble/solver?event=333&view=net' };
  const facelets = stickers?.[1].replace(/[\s,/|]/g, '').toUpperCase();
  let answer: string;
  let actions = [scan, board];
  if (!facelets) {
    answer = label('要给出整颗三阶的解法，需要核对六个面。先打开六面拍照，按提示拍齐；遮挡或颜色认错的格子可以在画板上补色。',
      'A full 3×3 solution needs all six faces. Open the six-face scanner and follow its prompts. Use the editor to fill hidden stickers or correct misread colors.');
  } else if (facelets.length !== 54 || /[?X]/.test(facelets)) {
    answer = label('当前贴纸信息不足。请按 U、R、F、D、L、B 的顺序补齐，每面 9 格，或在六面拍照后用画板校对。',
      'Some stickers are missing. Provide nine stickers per face in U, R, F, D, L, B order, or scan the six faces and check the colors in the editor.');
  } else if (validateFacelet(facelets) !== null) {
    answer = label('这组贴纸无法组成可还原的三阶局面。先在画板核对六个中心、每色 9 格和朝向，再检查有没有抄错棱块或角块。',
      'These stickers do not form a reachable 3×3 position. Check the six centers, nine stickers per color and face orientation, then recheck the edges and corners.');
    actions = [board, scan];
  } else {
    // Use center identities, so a valid nonstandard color scheme maps to the same solver state.
    const canonical = cubieToFacelet(faceletToCubie(facelets));
    answer = label('已校验这组贴纸能组成合法的三阶局面。打开画板核对预填状态，再点击求解。',
      'The stickers form a legal 3×3 position. Open the editor to check the prefilled state, then choose Solve.');
    if (canonical !== facelets) answer += label('画板按六面中心映射为默认配色。', ' The editor maps the six center labels to its standard colors.');
    actions = [{ ...board, href: `${board.href}&facelets=${canonical}` }];
  }
  return { answer, actions, sources: actions.map(action => ({ ...action, read: false })) };
}
