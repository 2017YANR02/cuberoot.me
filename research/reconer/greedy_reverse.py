"""
greedy_reverse.py - 贪心逆推复盘引擎

从 Solved 态开始, 逐步逆推每一步:
  1. 取 KNN Top-K 面 x 3 方向 = 候选集
  2. 对每个候选执行逆操作 → 预期状态
  3. [TODO Step 2] 比较预期 B 面颜色 vs 视频帧 → 选最像的

当前版本 (Step 1): 裸逆推框架, 暂用 KNN Top-1 面选择, 验证框架正确性.
"""

import json
import os
import sys
import re
import cv2
import numpy as np
from collections import Counter
from cube_state import CubeState, _tokenize


# ============================================================
# 视觉评分配置
# ============================================================

# B 面 ROI (基于 find_roi.py 的结果)
# x=1268, y=1064, w=508, h=318
ROI_B_FACE = (1268, 1064, 508, 318)

# 颜色阈值 (HSV)
COLOR_RANGES = {
    'W': [(0, 0, 150), (180, 60, 255)],       # 白色: 低饱和度, 高明度
    'R': [(0, 100, 100), (10, 255, 255)],     # 红色1
    'R2': [(170, 100, 100), (180, 255, 255)], # 红色2
    'O': [(10, 100, 100), (25, 255, 255)],    # 橙色
    'Y': [(25, 100, 100), (35, 255, 255)],    # 黄色
    'G': [(35, 100, 40), (85, 255, 255)],     # 绿色
    'B': [(90, 100, 40), (130, 255, 255)],    # 蓝色
}

# 虚拟魔方颜色 ID -> 实际颜色名映射
# CubeState: 0=U(W), 1=R(R), 2=F(G), 3=D(Y), 4=L(O), 5=B(B)
# 注意: 视频 3 中 "B面" 是绿色(F面颜色), 所以 ID 5 对应这里看到的 'G'
CUBE_COLOR_TO_NAME = {
    0: 'W', 1: 'R', 2: 'G', 3: 'Y', 4: 'O', 5: 'B' 
    # WAIT: 用户说 B 面是绿色, 所以 ID 5 (B) 应该是 Green?
    # 不对, CubeState 的 ID 是固定的 (F=2绿, B=5蓝). 
    # 如果视频里 B 面是绿色, 那说明魔方整体被转过了 (y2).
    # 我们用 tailRotations 校正了初始状态, 所以:
    #   校正后的 State, 其 B 面 (ID 5) 的颜色 ID 应该是 2 (F面的绿色)
    #   所以这里只需要标准的 ID->Name 映射:
    #   0->W, 1->R, 2->G, 3->Y, 4->O, 5->B
}


def get_roi_color(hsv_img, x, y, w, h):
    """统计区域内的主颜色"""
    roi = hsv_img[y:y+h, x:x+w]
    
    # 统计各颜色像数
    counts = Counter()
    for name, ranges in COLOR_RANGES.items():
        if name == 'R2': name = 'R' # 合并红色
        
        # 简单掩码计数
        if isinstance(ranges[0], tuple): # 单一范围
             lower = np.array(ranges[0])
             upper = np.array(ranges[1])
             mask = cv2.inRange(roi, lower, upper)
             counts[name] += cv2.countNonZero(mask)
        else: # 像红色这种分段的 (暂未处理, 简化为上面格式) 
             pass 

    # 针对红色特殊处理 (跨越 0/180)
    lower1 = np.array(COLOR_RANGES['R'][0]); upper1 = np.array(COLOR_RANGES['R'][1])
    mask1 = cv2.inRange(roi, lower1, upper1)
    
    lower2 = np.array(COLOR_RANGES['R2'][0]); upper2 = np.array(COLOR_RANGES['R2'][1])
    mask2 = cv2.inRange(roi, lower2, upper2)
    
    counts['R'] = cv2.countNonZero(mask1) + cv2.countNonZero(mask2)

    # 归一化
    total = w * h
    scores = {k: v/total for k, v in counts.items()}
    return scores

def extract_b_face_colors(frame):
    """
    提取 B 面 3x3 网格的颜色分布.
    返回: 长度 9 的 list, 每个元素是 {ColorName: Score}
    """
    x0, y0, w0, h0 = ROI_B_FACE
    
    # 稍微缩小 ROI 以排除边缘
    margin = int(w0 * 0.05)
    x0 += margin; y0 += margin
    w0 -= 2*margin; h0 -= 2*margin
    
    cell_w = w0 // 3
    cell_h = h0 // 3

    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    
    grid_colors = []
    # 3x3 网格遍历: row 0..2, col 0..2
    # 对应 facelet 索引: 
    # 45 46 47
    # 48 49 50  <-- 注意: 这里的 48 是左边, 但在 B 面视图里(从背面看), 
    # 51 52 53      左边其实是 B 的右边 (镜像)?
    # 
    # CubeState 的 B 面定义 (functions.cpp):
    #             | 0  1  2 |
    #             | 3  4  5 |
    #             | 6  7  8 |
    #   | 36 37 38| 18 19 20| 9 10 11| 45 46 47|
    #   | 39 40 41| 21 22 23|12 13 14| 48 49 50|
    #   | 42 43 44| 24 25 26|15 16 17| 51 52 53|
    #             | 27 28 29|
    #
    # B 面索引 45,46,47 是 B 的“上行”。
    # 当我们看着 B 面时 (绿色面朝我们):
    #   45 46 47
    #   48 49 50
    #   51 52 53
    # 这个顺序是从左到右吗? 
    # 标准定义里, B 面是从背面看的. 
    # 但我们现在是“相机看着 B 面”.
    # 相机的左边 = B 面的右边 (索引 47, 50, 53)
    # 相机的右边 = B 面的左边 (索引 45, 48, 51)
    # 这是一个关键的镜像关系!
    
    # 修正后的遍历顺序 (相机视角):
    # Row 0: 47, 46, 45
    # Row 1: 50, 49, 48
    # Row 2: 53, 52, 51
    
    for r in range(3):
        for c in range(3):
            cx = x0 + c * cell_w
            cy = y0 + r * cell_h
            scores = get_roi_color(hsv, cx, cy, cell_w, cell_h)
            grid_colors.append(scores)
            
    # grid_colors 现在的顺序是 相机视角的 0..8
    # 我们需要映射回 CubeState B 面索引 45..53
    # Map: Cam 0 -> Idx 47, Cam 1 -> Idx 46...
    reordered = [None] * 9
    
    # Row 0
    reordered[2] = grid_colors[0] # 47
    reordered[1] = grid_colors[1] # 46
    reordered[0] = grid_colors[2] # 45
    
    # Row 1
    reordered[5] = grid_colors[3] # 50
    reordered[4] = grid_colors[4] # 49
    reordered[3] = grid_colors[5] # 48
    
    # Row 2
    reordered[8] = grid_colors[6] # 53
    reordered[7] = grid_colors[7] # 52
    reordered[6] = grid_colors[8] # 51
    
    return reordered

def scoreVisual(cubeState, frame_color_grid):
    """
    计算虚拟魔方与视频帧的视觉相似度.
    frame_color_grid: extract_b_face_colors 返回的 9 个分布
    """
    score = 0.0
    
    # 获取虚拟魔方 B 面 (45-53) 的颜色 ID
    b_face_ids = [cubeState.sc[i] // 9 for i in range(45, 54)]
    
    for i, color_id in enumerate(b_face_ids):
        expected_name = CUBE_COLOR_TO_NAME[color_id]
        
        # 获取视频对应位置该颜色的概率
        # frame_color_grid[i] 是 {ColorName: prob}
        prob = frame_color_grid[i].get(expected_name, 0.0)
        
        # 简单累加概率
        score += prob
        
    return score



# ============================================================
# 动作工具
# ============================================================

FACE_DIRECTIONS = {
    'U': ['U', "U'", 'U2'],
    'D': ['D', "D'", 'D2'],
    'R': ['R', "R'", 'R2'],
    'L': ['L', "L'", 'L2'],
    'F': ['F', "F'", 'F2'],
    'B': ['B', "B'", 'B2'],
}

WIDE_MOVES = {
    'F': ['f', "f'"],
    'R': ['r', "r'"],
    'U': ['u', "u'"],
}

SIMULTANEOUS_PAIRS = [
    "U D'", "U' D", "U D", "U' D'",
]

INVERSE_MAP = {
    "U": "U'", "U'": "U", "U2": "U2",
    "D": "D'", "D'": "D", "D2": "D2",
    "R": "R'", "R'": "R", "R2": "R2",
    "L": "L'", "L'": "L", "L2": "L2",
    "F": "F'", "F'": "F", "F2": "F2",
    "B": "B'", "B'": "B", "B2": "B2",
    "f": "f'", "f'": "f", "r": "r'", "r'": "r",
    "u": "u'", "u'": "u",
    "x": "x'", "x'": "x", "x2": "x2",
    "y": "y'", "y'": "y", "y2": "y2",
    "z": "z'", "z'": "z", "z2": "z2",
}


def getMoveFace(move):
    """提取动作的主面名 (大写)"""
    if move is None:
        return None
    for ch in move:
        if ch in 'UDLRFB':
            return ch
        if ch in 'udlrf':
            return ch.upper()
    return None


def getInverse(move):
    """获取逆操作"""
    if ' ' in move:
        return ' '.join(INVERSE_MAP.get(p, p) for p in move.split())
    return INVERSE_MAP.get(move, move)


def getBFaceColors(state):
    """获取 B 面 3x3 颜色数组 (从 solver 视角)"""
    return [state.sc[i] // 9 for i in B_FACE_INDICES]


# ============================================================
# GT 解析
# ============================================================

def parseGT(splitsPath):
    """
    解析 splits.txt, 返回 (segMoves, tailRotations).
    segMoves: 每段对应的动作列表 (不含末尾转体)
    tailRotations: 末尾的转体序列 (y2, y, z2 等)
    """
    FINGERING = '\u2191\u2193\u00b7'
    with open(splitsPath, 'r', encoding='utf-8') as f:
        content = f.read()
    lines = content.strip().split('\n')

    # 找到动作行
    reconLines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('Splits:') or not stripped:
            continue
        if re.match(r'^\d+\s*(段|STM)', stripped):
            continue
        reconLines.append(stripped)

    # 解析所有 token
    allTokens = []
    for line in reconLines:
        if '//' in line:
            line = line[:line.index('//')]
        line = line.strip()
        if not line:
            continue

        for token in line.split():
            parts = token.split('...')
            for p in parts:
                for c in FINGERING:
                    p = p.replace(c, ' ')
                subTokens = [s.strip() for s in p.split() if s.strip()]
                for st in subTokens:
                    if not st:
                        continue
                    # 纯转体或面转动
                    if st in ('y', "y'", 'x', "x'", 'y2', 'x2', 'z2'):
                        allTokens.append(st)
                    elif any(ch in 'UDLRFBudlrf' for ch in st):
                        allTokens.append(st)

    # 分离末尾转体
    # NOTE: 末尾的 y/y2/z2 是用户添加的朝向校正, 不对应视频段
    tailRotations = []
    while allTokens and allTokens[-1] in ('y', "y'", 'y2', 'x', "x'", 'x2', 'z2'):
        tailRotations.insert(0, allTokens.pop())

    return allTokens, tailRotations


def parseSplitFrames(splitsPath):
    """解析 Splits 行的帧编号列表"""
    with open(splitsPath, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip().startswith('Splits:'):
                data = line.strip()[len('Splits:'):].rstrip('|')
                return [int(x) for x in data.split(':')]
    return []


# ============================================================
# 贪心逆推
# ============================================================

def greedyReverse(probDists, tailRotations, videoPath, splitFrames):
    """
    贪心逆推: 从 Solved 态出发, 结合 KNN 概率与视觉评分.
    
    videoPath: 视频文件路径
    splitFrames: splits.txt 中的帧号列表
    """
    nSegs = len(probDists)
    
    # 打开视频
    cap = cv2.VideoCapture(videoPath)
    if not cap.isOpened():
        print(f"Error opening video: {videoPath}")
        return [], CubeState()
        
    print(f"Video opened, processing {nSegs} segments...")

    # 从 Solved 态开始
    state = CubeState()

    # 先执行末尾转体的逆操作 (朝向校正)
    print(f"Applying tail rotations (reverse): {tailRotations}")
    for rot in reversed(tailRotations):
        inv = getInverse(rot)
        state.apply(inv)
        
    predicted = []
    
    # 逆序遍历每一段
    # segments 0..N-1
    # splitFrames 对应: start, s1, s2, ..., end
    # Segment i 的结束时间是 splitFrames[i+1]
    # 我们取结束时间前几帧作为“该状态的观测帧”
    #   (因为在这个 split 点，动作刚完成，魔方处于该状态)
    
    # splitFrames 长度通常是 nSegs + 1 (start + nSegs end points)
    # 但有时 splits.txt 会多。我们要对齐 probDists。
    # probs 0 对应 split 0->1
    # ...
    # probs i 对应 split i->i+1. 结束帧是 splitFrames[i+1]
    
    for t in range(nSegs - 1, -1, -1):
        # 1. 获取目标状态的“观测帧”
        # 我们要逆推 Seg t (动作 M).
        # 当前 state 是 M 完成后的状态.
        # 逆推后 nextState = state * inv(M) 是 M 开始前的状态.
        # 所以应该与 Seg t 开始时的视频帧对比.
        # Seg t 的时间范围: splitFrames[t] ~ splitFrames[t+1]
        # 取 splitFrames[t] 后几帧 (动作刚开始前, 或者上一个动作刚结束后)
        
        OFFSET = 3 # split 点后 3 帧 (确保上一个动作已稳, 且当前动作未开始)
        frameIdx = splitFrames[t] + OFFSET
        cap.set(cv2.CAP_PROP_POS_FRAMES, frameIdx)
        ret, frame = cap.read()
        
        frame_colors = None
        if ret:
            frame_colors = extract_b_face_colors(frame)
            
            # --- DEBUG: 可视化 B 面颜色 ---
            debug_img = frame.copy()
            x0, y0, w0, h0 = ROI_B_FACE
            margin = int(w0 * 0.05)
            x0 += margin; y0 += margin; w0 -= 2*margin; h0 -= 2*margin
            cell_w = w0 // 3; cell_h = h0 // 3
            
            # 颜色 BGR 映射
            BGR_MAP = {
                'W': (255, 255, 255), 'R': (0, 0, 255), 'G': (0, 255, 0),
                'Y': (0, 255, 255), 'O': (0, 165, 255), 'B': (255, 0, 0)
            }
            
            # 绘制 3x3 网格 (重映射回相机视角的 0..8)
            # frame_colors 的顺序是 CubeState 的 45..53
            # 下面的 Reorder 是 extract_b_face_colors 的逆过程
            # Row 0: 47, 46, 45 -> grid[0], grid[1], grid[2]
            # ...
            # 最好直接重新遍历一次 ROI 
            
            for r in range(3):
                for c in range(3):
                    cx = x0 + c * cell_w
                    cy = y0 + r * cell_h
                    
                    # 确定对应 CubeState 索引
                    # Map: Row 0 -> 47, 46, 45
                    if r == 0: idx = 47 - c
                    elif r == 1: idx = 50 - c
                    elif r == 2: idx = 53 - c
                    
                    # 对应的颜色分布
                    # B 面索引 45 开始, 所以 frame_colors 下标是 idx - 45
                    dist = frame_colors[idx - 45]
                    # 找概率最大的颜色
                    if dist:
                        dom_color = max(dist, key=dist.get)
                        color_bgr = BGR_MAP.get(dom_color, (128, 128, 128))
                        
                        # 画矩形
                        cv2.rectangle(debug_img, (cx, cy), (cx+cell_w, cy+cell_h), color_bgr, 2)
                        cv2.putText(debug_img, dom_color, (cx+5, cy+20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color_bgr, 2)
            
            os.makedirs("debug_vis", exist_ok=True)
            cv2.imwrite(f"debug_vis/seg_{t:02d}.jpg", debug_img)
            
            # --- DEBUG LOG: 打印提取到的颜色 ---
            # 简单打印 3x3 网格的主颜色
            grid_str = []
            for i in range(9):
                dist = frame_colors[i]
                dom = max(dist, key=dist.get) if dist else '?'
                grid_str.append(dom)
            print(f"  Frame {frameIdx} B-Face: {grid_str[:3]} / {grid_str[3:6]} / {grid_str[6:]}")
            # -----------------------------
            
        else:
            print(f"  Warning: failed to read frame {frameIdx}")

        # 2. 生成候选
        probs = probDists[t]
        # 取 Top-3 面
        topFaces = list(probs.keys())[:3]
        
        candidates = []
        for face in topFaces:
            # 基础 3 方向
            for move in FACE_DIRECTIONS[face]:
                candidates.append(move)
            # 宽转 (简化: 暂不考虑, 除非 F/U/R 在 Top-1)
            
        # 3. 评分并贪心选择
        bestMove = None
        bestScore = -float('inf')
        
        # 调试输出用
        debug_scores = []
        
        for move in candidates:
            # 执行逆操作
            invMove = getInverse(move)
            nextState = state.clone()
            nextState.apply(invMove)
            
            # 视觉分
            visScore = 0.0
            if frame_colors:
                visScore = scoreVisual(nextState, frame_colors)
            
            # 概率分 (简单用 rank: Top-1=1.0, Top-2=0.5, Top-3=0.2)
            face = getMoveFace(move)
            probRank = topFaces.index(face)
            probScore = 1.0 if probRank == 0 else (0.5 if probRank == 1 else 0.2)
            
            # 综合分 (视觉权重高一些)
            # 视觉分 range 0~9 (9个块匹配度累加)
            # 概率分 range 0~1
            score = visScore + probScore * 2.0
            
            debug_scores.append((move, score, visScore, probScore))
            
            if score > bestScore:
                bestScore = score
                bestMove = move
        
        # 打印调试信息 (Top-5 候选)
        debug_scores.sort(key=lambda x: x[1], reverse=True)
        # 格式: Move: Total (Vis + Prob)
        debug_str = " | ".join([f"{m}: {s:.2f} ({v:.2f}+{p:.1f})" for m, s, v, p in debug_scores[:5]])
        print(f"  Seg {t} Top candidates: {debug_str}")
        print(f"  -> Chosen: {bestMove}")

        # 更新状态
        state.apply(getInverse(bestMove))
        predicted.insert(0, bestMove)
        
    cap.release()
    return predicted, state


# ============================================================
# 对比
# ============================================================

def compareMoves(predicted, gtMoves):
    """逐步对比"""
    nPred = len(predicted)
    nGT = len(gtMoves)
    maxLen = max(nPred, nGT)

    faceCorrect = 0
    fullCorrect = 0
    total = 0

    print(f"\n{'Seg':>4s}  {'Predicted':>10s}  {'GT':>10s}  {'Face':>5s}  {'Full':>5s}")
    print("-" * 50)

    for i in range(maxLen):
        pred = predicted[i] if i < nPred else '---'
        gt = gtMoves[i] if i < nGT else '---'

        predFace = getMoveFace(pred) if pred != '---' else '?'
        gtFace = getMoveFace(gt) if gt != '---' else '?'

        faceOk = predFace == gtFace
        fullOk = pred == gt

        if pred != '---' and gt != '---':
            total += 1
            if faceOk:
                faceCorrect += 1
            if fullOk:
                fullCorrect += 1

        faceStr = 'OK' if faceOk else 'X'
        fullStr = 'OK' if fullOk else 'X'
        print(f"{i+1:4d}  {pred:>10s}  {gt:>10s}  {faceStr:>5s}  {fullStr:>5s}")

    print("-" * 50)
    if total > 0:
        print(f"Face accuracy: {faceCorrect}/{total} = {faceCorrect/total*100:.1f}%")
        print(f"Full accuracy: {fullCorrect}/{total} = {fullCorrect/total*100:.1f}%")

    return faceCorrect, fullCorrect, total


# ============================================================
# 主流程
# ============================================================

def main():
    if len(sys.argv) < 2:
        print("Usage: python greedy_reverse.py <splits.txt>")
        sys.exit(1)

    splitsPath = sys.argv[1]
    videoName = os.path.basename(splitsPath).replace('.splits.txt', '')

    # 加载概率
    probsPath = splitsPath.replace('.splits.txt', '.probs.json')
    if not os.path.exists(probsPath):
        print(f"ERROR: probs file not found: {probsPath}")
        sys.exit(1)

    with open(probsPath, 'r') as f:
        probDists = json.load(f)

    # 解析 GT
    gtMoves, tailRotations = parseGT(splitsPath)
    # 过滤中间的 y 转体 (非末尾)
    gtMovesNoMidY = [m for m in gtMoves if m not in ('y', "y'", 'y2', 'x', "x'", 'x2', 'z2')]

    print(f"Video: {videoName}")
    print(f"Prob segments: {len(probDists)}")
    print(f"GT moves (excl rotations): {len(gtMovesNoMidY)}")
    print(f"Tail rotations: {tailRotations}")
    print(f"GT: {' '.join(gtMovesNoMidY)}")

    if len(probDists) != len(gtMovesNoMidY):
        print(f"WARNING: count mismatch! probs={len(probDists)} vs gt={len(gtMovesNoMidY)}")

    splitsFrames = parseSplitFrames(splitsPath)

    # 裁剪: 如果有 tailRotations, 说明最后几段是转体, 不参与逆推 (已预先 Apply)
    # 假设每个 tailRot 对应一个 segment (通常如此)
    numTail = len(tailRotations)
    if numTail > 0:
        print(f"Removing last {numTail} segments (tail rotations) from search.")
        probDists = probDists[:-numTail]
        # splitFrames 是 N+1 个点, 移除最后 numTail 个区间 -> 移除最后 numTail 个点
        # 保留 0..N-numTail (共 N-numTail+1 个点)
        splitsFrames = splitsFrames[:-numTail]

    # 逆推
    print(f"\nGreedy reverse (Step 3: Visual Scoring)...")
    videoPath = splitsPath.replace('.splits.txt', '')
    predicted, finalState = greedyReverse(probDists, tailRotations, videoPath, splitsFrames)
    print(f"Predicted: {' '.join(predicted)}")

    # 对比
    compareMoves(predicted, gtMovesNoMidY)

    # 验证: 正向执行预测序列 + 末尾转体后应得到 Solved
    checkCube = CubeState()
    for m in predicted:
        checkCube.apply(m)
    for r in tailRotations:
        checkCube.apply(r)
    print(f"\nVerification: apply predicted + tail rotations -> Solved? {checkCube.is_solved()}")


if __name__ == '__main__':
    main()
