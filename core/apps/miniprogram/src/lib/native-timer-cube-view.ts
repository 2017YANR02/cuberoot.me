import type { NativeCubeCanvas, NativeCubeWebgl, NativeCubeWebglOptions } from '@cuberoot/puzzle-render-core/native-cube-webgl';
import { miniProgramApi } from './platform';

export type { NativeCubeWebgl as NativeTimerCubeView };

/** Ask the current page for a real Canvas v2 node before loading the renderer. */
export async function mountNativeTimerCubeView(
  page: Pick<WechatMiniprogram.Page.Instance<WechatMiniprogram.IAnyObject, WechatMiniprogram.IAnyObject>, 'createSelectorQuery'>,
  selector: string,
  onUnavailable?: (error: unknown) => void,
  options?: NativeCubeWebglOptions,
): Promise<NativeCubeWebgl | null> {
  type Selection = { node?: NativeCubeCanvas; width?: number; height?: number };
  try {
    const selection = await new Promise<Selection | undefined>(resolve => page.createSelectorQuery()
      .select(selector).fields({ node: true, size: true }).exec((results: Selection[]) => resolve(results?.[0])));
    if (!selection?.node || !selection.width || !selection.height) return null;
    let pixelRatio = 1;
    try { pixelRatio = miniProgramApi().getSystemInfoSync().pixelRatio; } catch { /* canvas works at its CSS dimensions */ }
    const { createNativeCubeWebgl } = await import('@cuberoot/puzzle-render-core/native-cube-webgl');
    return createNativeCubeWebgl(selection.node, selection.width, selection.height, pixelRatio, onUnavailable, options);
  } catch (error) {
    onUnavailable?.(error);
    return null;
  }
}
