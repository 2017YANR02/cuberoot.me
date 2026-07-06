"""
P6 多视频联合训练: CNN 中间帧 + 直方图差分 + PCA + KNN

数据: 5 个视频共 233 段
特征: CNN 中间帧 (512d) + HS 颜色直方图差分 (96d) = 608d
降维: PCA → 20~40d
分类: Leave-one-out KNN (余弦/欧氏距离, K=3~9)
"""

import cv2
import numpy as np
import torch
import torch.nn as nn
from torchvision import models
from collections import Counter
import re
import os
import json

VIDEOS_DIR = 'videos'
FILES = [
    '1 4.448.MP4.splits.txt',
    '2 4.369.MP4.splits.txt',
    '3 4.375.MP4.splits.txt',
    '4 4.610.MP4.splits.txt',
    '5 4.067.MP4.splits.txt',
]
SCALE = 0.5
ROI_X1, ROI_X2 = 0.25, 0.65
ROI_Y1, ROI_Y2 = 0.18, 0.65

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

FINGERING = '\u2191\u2193\u00b7'
ROTATIONS = {'x', "x'", 'y', "y'"}


# =================== 数据解析 ===================

def splitByFingering(t):
    for c in FINGERING:
        t = t.replace(c, ' ')
    return [p.strip() for p in t.split() if p.strip()]


def getFace(token):
    for ch in token:
        if ch in 'UDLRFB':
            return ch
        if ch in 'udlrf':
            return ch.upper()
    if token.startswith('y'):
        return 'y'
    return None


def parseSegMoves(splitsPath):
    with open(splitsPath, 'r', encoding='utf-8') as f:
        content = f.read()
    lines = content.strip().split('\n')

    splitsLine = [l for l in lines if l.strip().startswith('Splits:')]
    splits = []
    if splitsLine:
        splits = [int(x) for x in splitsLine[0].strip()[7:].rstrip('|').split(':')]

    reconLines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('Splits:') or not stripped:
            continue
        if re.match(r'^\d+\s*(段|STM)', stripped):
            continue
        reconLines.append(stripped)

    segLabels = []
    for line in reconLines:
        if '//' in line:
            line = line[:line.index('//')]
        line = line.strip()
        if not line:
            continue
        for token in line.split():
            parts = token.split('...')
            for p in parts:
                subTokens = splitByFingering(p)
                for st in subTokens:
                    if not st:
                        continue
                    face = getFace(st)
                    if face is None:
                        continue
                    segLabels.append(face)

    return splits, segLabels


# =================== CNN 特征 ===================

class CNNExtractor:
    def __init__(self):
        self.model = models.resnet18(weights='DEFAULT')
        self.model = nn.Sequential(*list(self.model.children())[:-1])
        self.model.eval()

    def preprocess(self, bgrImg):
        rgb = cv2.cvtColor(bgrImg, cv2.COLOR_BGR2RGB)
        h, w = rgb.shape[:2]
        if h < w:
            nH, nW = 256, int(256 * w / h)
        else:
            nH, nW = int(256 * h / w), 256
        rgb = cv2.resize(rgb, (nW, nH))
        cy, cx = nH // 2, nW // 2
        rgb = rgb[cy-112:cy+112, cx-112:cx+112]
        arr = rgb.astype(np.float32) / 255.0
        arr = (arr - MEAN) / STD
        return arr.transpose(2, 0, 1)

    def extract(self, bgrImg):
        arr = self.preprocess(bgrImg)
        tensor = torch.tensor(arr, dtype=torch.float32).unsqueeze(0)
        with torch.no_grad():
            feat = self.model(tensor)
        return feat.squeeze().numpy()


def computeColorHist(roi, hBins=12, sBins=4):
    """HS 联合直方图, 分上下两区域"""
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    h = hsv.shape[0]
    hists = []
    for y1, y2 in [(0, h // 2), (h // 2, h)]:
        region = hsv[y1:y2]
        hist = cv2.calcHist([region], [0, 1], None,
                            [hBins, sBins], [0, 180, 0, 256])
        hist = hist.flatten()
        total = hist.sum()
        if total > 0:
            hist /= total
        hists.append(hist)
    return np.concatenate(hists)


def extractVideoFeatures(videoPath, splits, ext):
    """提取单个视频所有段的特征"""
    cap = cv2.VideoCapture(videoPath)
    if not cap.isOpened():
        print(f"  ERROR: cannot open {videoPath}")
        return None
    
    nSegs = len(splits) - 1
    features = []

    for i in range(nSegs):
        s, e = splits[i], splits[i + 1]
        nFr = e - s

        frames = {}
        for name, idx in [('s', s), ('e', e-1), ('m', s + nFr//2)]:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ret, frame = cap.read()
            if ret:
                frames[name] = cv2.resize(frame, None, fx=SCALE, fy=SCALE)

        if len(frames) < 3:
            features.append(np.zeros(512 + 96))
            continue

        fh, fw = frames['s'].shape[:2]
        x1, x2 = int(fw * ROI_X1), int(fw * ROI_X2)
        y1, y2 = int(fh * ROI_Y1), int(fh * ROI_Y2)

        # CNN 中间帧
        roiMid = frames['m'][y1:y2, x1:x2]
        cnnFeat = ext.extract(roiMid)

        # 颜色直方图差分
        roi1 = frames['s'][y1:y2, x1:x2]
        roi2 = frames['e'][y1:y2, x1:x2]
        histDiff = computeColorHist(roi2) - computeColorHist(roi1)

        features.append(np.concatenate([cnnFeat, histDiff]))

    cap.release()
    return np.array(features)


# =================== KNN ===================

def _knnDistances(trF, teF, metric):
    """计算测试样本到所有训练样本的距离"""
    if metric == 'cosine':
        nt = np.linalg.norm(teF) + 1e-8
        ntr = np.linalg.norm(trF, axis=1) + 1e-8
        return 1 - (trF @ teF) / (ntr * nt)
    return np.linalg.norm(trF - teF, axis=1)


def knnLOO(features, labels, k=5, metric='euclidean'):
    n = len(features)
    preds = []
    for i in range(n):
        trF = np.delete(features, i, axis=0)
        trL = [labels[j] for j in range(n) if j != i]
        teF = features[i]
        dists = _knnDistances(trF, teF, metric)
        kIdx = np.argsort(dists)[:k]
        kLab = [trL[j] for j in kIdx]
        preds.append(Counter(kLab).most_common(1)[0][0])
    return preds


def knnTopK(features, labels, k=5, metric='euclidean'):
    """LOO KNN，返回每个样本的概率分布 (K 近邻投票归一化)"""
    n = len(features)
    probDists = []  # 每个样本一个 {face: prob} 字典
    for i in range(n):
        trF = np.delete(features, i, axis=0)
        trL = [labels[j] for j in range(n) if j != i]
        teF = features[i]
        dists = _knnDistances(trF, teF, metric)
        kIdx = np.argsort(dists)[:k]
        kLab = [trL[j] for j in kIdx]
        # 投票计数 → 归一化为概率
        counts = Counter(kLab)
        total = sum(counts.values())
        prob = {face: cnt / total for face, cnt in counts.most_common()}
        probDists.append(prob)
    return probDists


# =================== 主流程 ===================

def main():
    CACHE_PATH = os.path.join(VIDEOS_DIR, 'features_cache.npz')

    # 尝试加载缓存
    if os.path.exists(CACHE_PATH):
        print(f"Loading cached features from {CACHE_PATH}...")
        data = np.load(CACHE_PATH, allow_pickle=True)
        features = data['features']
        labels = list(data['labels'])
        allVideoIds = list(data['videoIds'])
        n = len(labels)
        print(f"Loaded {n} segments, feature dim: {features.shape[1]}")
    else:
        # 首次运行: 提取特征并缓存
        allFeatures = []
        allLabels = []
        allVideoIds = []
        allSegIds = []

        ext = CNNExtractor()

        for fn in FILES:
            path = os.path.join(VIDEOS_DIR, fn)
            videoPath = path.replace('.splits.txt', '')
            vName = fn.replace('.MP4.splits.txt', '')

            splits, segLabels = parseSegMoves(path)
            nSegs = len(splits) - 1

            if nSegs != len(segLabels):
                print(f"SKIP {vName}: mismatch {nSegs} segs vs {len(segLabels)} labels")
                continue

            print(f"Extracting {vName} ({nSegs} segs)...")
            feats = extractVideoFeatures(videoPath, splits, ext)
            if feats is None:
                continue

            allFeatures.append(feats)
            allLabels.extend(segLabels)
            allVideoIds.extend([vName] * nSegs)
            allSegIds.extend(range(nSegs))

        features = np.vstack(allFeatures)
        labels = allLabels
        n = len(labels)
        print(f"\nTotal: {n} segments, feature dim: {features.shape[1]}")

        # 保存缓存
        np.savez(CACHE_PATH,
                 features=features,
                 labels=np.array(labels),
                 videoIds=np.array(allVideoIds))
        print(f"Saved feature cache to {CACHE_PATH}")

    # 面分布
    faceCounts = Counter(labels)
    print("Face distribution:")
    for f in sorted(faceCounts.keys()):
        print(f"  {f}: {faceCounts[f]}")

    # 过滤 y 转体 (不参与分类)
    mask = [l != 'y' for l in labels]
    features = features[mask]
    labels = [l for l, m in zip(labels, mask) if m]
    videoIds = [v for v, m in zip(allVideoIds, mask) if m]
    n = len(labels)
    allFaces = sorted(set(labels))
    print(f"\nAfter filtering y: {n} segments")

    # 标准化 + PCA
    mu = features.mean(axis=0)
    sigma = features.std(axis=0) + 1e-8
    scaled = (features - mu) / sigma
    U, S, Vt = np.linalg.svd(scaled, full_matrices=False)
    totalVar = (S ** 2).sum()

    # 搜索最佳配置
    bestAcc, bestCfg, bestPreds = 0, "", []

    print("\n=== PCA + KNN 搜索 ===")
    for nComp in [10, 20, 30, 40, 50]:
        reduced = scaled @ Vt[:nComp].T
        varPct = (S[:nComp] ** 2).sum() / totalVar * 100

        for metric in ['cosine', 'euclidean']:
            for k in [3, 5, 7, 9, 11]:
                preds = knnLOO(reduced, labels, k=k, metric=metric)
                c = sum(1 for p, t in zip(preds, labels) if p == t)
                acc = c / n * 100
                if acc >= bestAcc:
                    marker = ' ***' if acc > bestAcc else ''
                    print(f"  PCA{nComp:2d}({varPct:.0f}%) K={k:2d} {metric:>10s}: {c}/{n} = {acc:.1f}%{marker}")
                    if acc > bestAcc:
                        bestAcc, bestCfg, bestPreds = acc, f"PCA{nComp} K={k} {metric}", preds

    print(f"\n{'='*50}")
    print(f"KNN Best: {bestCfg} = {bestAcc:.1f}%")
    print(f"{'='*50}")

    # =================== MLP 分类头 ===================
    # NOTE: 超参搜索结论: h=(256,) cw=0 a=1e-3 lr=2e-3 ep=500 = 62.9% (3-seed avg)

    print(f"\n=== MLP 5-Fold CV ===")

    mlpScaled = (features - features.mean(axis=0)) / (features.std(axis=0) + 1e-8)

    face2idx = {f: i for i, f in enumerate(allFaces)}
    labelsIdx = np.array([face2idx[l] for l in labels])

    def trainMLP(trX, trY, teX):
        """训练最优配置 MLP 并预测"""
        model = nn.Sequential(
            nn.Linear(trX.shape[1], 256), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(256, len(allFaces)),
        )
        optimizer = torch.optim.Adam(model.parameters(), lr=2e-3, weight_decay=1e-3)
        criterion = nn.CrossEntropyLoss()  # NOTE: cw=0, 不加 class_weight

        xTr = torch.tensor(trX, dtype=torch.float32)
        yTr = torch.tensor(trY, dtype=torch.long)
        xTe = torch.tensor(teX, dtype=torch.float32)

        model.train()
        for _ in range(500):
            optimizer.zero_grad()
            loss = criterion(model(xTr), yTr)
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            return model(xTe).argmax(dim=1).numpy()

    from sklearn.model_selection import StratifiedKFold

    torch.manual_seed(42)
    mlpPreds = np.zeros(n, dtype=int)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    for trIdx, teIdx in skf.split(mlpScaled, labelsIdx):
        mlpPreds[teIdx] = trainMLP(mlpScaled[trIdx], labelsIdx[trIdx], mlpScaled[teIdx])

    mlpPredLabels = [allFaces[p] for p in mlpPreds]
    mlpCorrect = sum(1 for p, t in zip(mlpPredLabels, labels) if p == t)
    mlpAcc = mlpCorrect / n * 100
    print(f"  MLP: {mlpCorrect}/{n} = {mlpAcc:.1f}%")

    # 选 KNN 和 MLP 中更好的那个
    if mlpAcc > bestAcc:
        print(f"\n  >>> MLP wins ({mlpAcc:.1f}% > KNN {bestAcc:.1f}%) <<<")
        bestAcc, bestCfg, bestPreds = mlpAcc, "MLP h=256 cw=0", mlpPredLabels
    else:
        print(f"\n  >>> KNN wins ({bestAcc:.1f}% >= MLP {mlpAcc:.1f}%) <<<")

    print(f"\n{'='*50}")
    print(f"Overall Best: {bestCfg} = {bestAcc:.1f}%")
    print(f"{'='*50}")

    # 混淆矩阵
    print("\nConfusion matrix (row=GT, col=Pred):")
    print("     " + "  ".join(f"{f:>3s}" for f in allFaces))
    for gt in allFaces:
        row = [f"{sum(1 for t,p in zip(labels,bestPreds) if t==gt and p==pr):3d}"
               for pr in allFaces]
        gtN = sum(1 for t in labels if t == gt)
        corr = sum(1 for t, p in zip(labels, bestPreds) if t == gt and p == gt)
        pct = corr / gtN * 100 if gtN > 0 else 0
        print(f" {gt:>2s}  {'  '.join(row)}  ({gtN}) {pct:.0f}%")

    total = sum(1 for p, t in zip(bestPreds, labels) if p == t)
    print(f"\nOverall: {total}/{n} = {total/n*100:.1f}%")

    # 每视频准确率
    print("\nPer-video accuracy:")
    for vName in dict.fromkeys(allVideoIds):
        if vName not in [v for v, m in zip(allVideoIds, mask) if m]:
            continue
        vMask = [v == vName for v in videoIds]
        vPreds = [p for p, m in zip(bestPreds, vMask) if m]
        vLabels = [l for l, m in zip(labels, vMask) if m]
        c = sum(1 for p, t in zip(vPreds, vLabels) if p == t)
        print(f"  {vName}: {c}/{len(vLabels)} = {c/len(vLabels)*100:.1f}%")

    # =================== Top-K 命中率统计 ===================
    # NOTE: Top-K 概率分布始终用 KNN 计算 (MLP 没有等价的逐样本概率机制)
    import re as _re
    knnCfgStr = bestCfg if not bestCfg.startswith('MLP') else f"PCA50 K=11 cosine"
    cfgMatch = _re.search(r'PCA(\d+) K=(\d+) (\w+)', knnCfgStr)
    bestNComp = int(cfgMatch.group(1))
    bestK = int(cfgMatch.group(2))
    bestMetric = cfgMatch.group(3)
    bestReduced = scaled @ Vt[:bestNComp].T

    print(f"\n{'='*50}")
    print(f"Top-K analysis (using KNN {knnCfgStr})")
    print(f"{'='*50}")

    probDists = knnTopK(bestReduced, labels, k=bestK, metric=bestMetric)

    # 统计 Top-1/2/3 命中率
    for topN in [1, 2, 3]:
        hits = 0
        for prob, gt in zip(probDists, labels):
            topFaces = list(prob.keys())[:topN]
            if gt in topFaces:
                hits += 1
        print(f"  Top-{topN} hit rate: {hits}/{n} = {hits/n*100:.1f}%")

    # 每视频 Top-K 命中率
    print("\nPer-video Top-3 hit rate:")
    for vName in dict.fromkeys(allVideoIds):
        if vName not in [v for v, m in zip(allVideoIds, mask) if m]:
            continue
        vMask = [v == vName for v in videoIds]
        vProbs = [p for p, m in zip(probDists, vMask) if m]
        vLabels = [l for l, m in zip(labels, vMask) if m]
        hits = sum(1 for p, gt in zip(vProbs, vLabels) if gt in list(p.keys())[:3])
        print(f"  {vName}: {hits}/{len(vLabels)} = {hits/len(vLabels)*100:.1f}%")

    # 保存概率分布到 JSON (每视频一个文件)
    idx = 0  # probDists 中的当前索引
    for vName in dict.fromkeys(allVideoIds):
        if vName not in [v for v, m in zip(allVideoIds, mask) if m]:
            continue
        vCount = sum(1 for v in videoIds if v == vName)
        vProbs = probDists[idx:idx + vCount]
        idx += vCount
        outPath = os.path.join(VIDEOS_DIR, f"{vName}.MP4.probs.json")
        with open(outPath, 'w', encoding='utf-8') as f:
            json.dump(vProbs, f, indent=2)
        print(f"\nSaved {outPath} ({vCount} segments)")


if __name__ == '__main__':
    main()
