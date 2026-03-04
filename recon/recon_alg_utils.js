/**
 * Recon 公式清理工具（共享模块）
 * 功能：清除复盘文本中各种外部播放器不支持的标记
 * 被 recon.js 和 recon_submit_page.js 共同使用
 */
var ReconAlgUtils = (function () {
    'use strict';

    /**
     * 清理公式供 twisty-player 使用
     * - 删除 .·↑↓⅓⅔（卡顿/换手/分数标记）
     * - 规范化步骤间距（UD → U D，twisty-player 无法解析连写步骤）
     */
    function cleanForPlayer(alg) {
        alg = alg.replace(/[.·↑↓⅓⅔]/g, '');
        // NOTE: 在连写的步骤之间插入空格
        // 支持修饰符组合: 2, ', 2'（如 R2', U2'）
        alg = alg.replace(/([RULDFBMESruldfbmesxyz][w]?2?'?)(?=[RULDFBMESxyz])/g, '$1 ');
        return alg;
    }

    /**
     * 清理公式供 alg.cubing.net 使用
     * - 删除 ·↑↓⅓⅔（但保留 .，alg.cubing.net 支持 . 标记）
     */
    function cleanForAlgCubingNet(alg) {
        return alg.replace(/[·↑↓⅓⅔]/g, '');
    }

    return {
        cleanForPlayer: cleanForPlayer,
        cleanForAlgCubingNet: cleanForAlgCubingNet
    };
})();
