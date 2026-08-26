"""MLP 超参搜索: class_weight强度 × hidden × alpha × seed"""
import warnings; warnings.filterwarnings('ignore')
import numpy as np
import torch, torch.nn as nn
from sklearn.model_selection import StratifiedKFold
from collections import Counter
import time
import sys

# 进度追踪
# NOTE: 总配置数 = Phase1(5) + Phase2(6) + Phase3(9) + Phase4(4) = 24
TOTAL_CONFIGS = 24
_configsDone = 0
_startTime = None

data = np.load('videos/features_cache.npz', allow_pickle=True)
features = data['features']
labels = list(data['labels'])

# 过滤 y
mask = [l != 'y' for l in labels]
features = features[mask]
labels = [l for l, m in zip(labels, mask) if m]
n = len(labels)
allFaces = sorted(set(labels))
# NOTE: np.str_ → str, 避免类型问题
allFaces = [str(f) for f in allFaces]
labels = [str(l) for l in labels]

face2idx = {f: i for i, f in enumerate(allFaces)}
labelsIdx = np.array([face2idx[l] for l in labels])
nC = len(allFaces)
inD = features.shape[1]

# 标准化
sc = (features - features.mean(axis=0)) / (features.std(axis=0) + 1e-8)

# 类别样本数
classCounts = np.bincount(labelsIdx, minlength=nC).astype(float)
print(f"Segments: {n}, Features: {inD}")
for f in allFaces:
    cnt = sum(1 for l in labels if l == f)
    print(f"  {f}: {cnt}")


def makeWeights(strength):
    """生成 class_weight, strength=0 表示均匀, strength=1 表示全 balanced"""
    # balanced 权重: n / (nC * count_per_class)
    balanced = n / (nC * classCounts + 1e-8)
    # 均匀权重: 全 1
    uniform = np.ones(nC)
    # 插值: strength=0 → uniform, strength=1 → balanced
    w = uniform * (1 - strength) + balanced * strength
    return torch.tensor(w, dtype=torch.float32)


def buildModel(hidden):
    layers = []
    prevDim = inD
    for i, h in enumerate(hidden):
        layers.append(nn.Linear(prevDim, h))
        layers.append(nn.ReLU())
        layers.append(nn.Dropout(0.3 if i == 0 else 0.2))
        prevDim = h
    layers.append(nn.Linear(prevDim, nC))
    return nn.Sequential(*layers)


def evalConfig(hidden, alpha, lr, epochs, cwStrength, nSeeds=3):
    """多 seed 平均的 5-Fold CV 评估"""
    allAccs = []

    for seed in range(nSeeds):
        torch.manual_seed(seed * 100 + 42)
        preds = np.zeros(n, dtype=int)
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=seed * 100 + 42)
        cw = makeWeights(cwStrength)

        for trIdx, teIdx in skf.split(sc, labelsIdx):
            model = buildModel(hidden)
            opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=alpha)
            crit = nn.CrossEntropyLoss(weight=cw)
            xTr = torch.tensor(sc[trIdx], dtype=torch.float32)
            yTr = torch.tensor(labelsIdx[trIdx], dtype=torch.long)

            model.train()
            for _ in range(epochs):
                opt.zero_grad()
                loss = crit(model(xTr), yTr)
                loss.backward()
                opt.step()

            model.eval()
            with torch.no_grad():
                preds[teIdx] = model(torch.tensor(sc[teIdx], dtype=torch.float32)).argmax(1).numpy()

        c = sum(1 for i in range(n) if allFaces[preds[i]] == labels[i])
        allAccs.append(c / n * 100)

    # 进度追踪
    global _configsDone, _startTime
    if _startTime is None:
        _startTime = time.time()
    _configsDone += 1
    elapsed = time.time() - _startTime
    if _configsDone > 0 and elapsed > 0:
        eta = elapsed / _configsDone * (TOTAL_CONFIGS - _configsDone)
        sys.stderr.write(f"  [{_configsDone}/{TOTAL_CONFIGS}] elapsed={elapsed:.0f}s ETA={eta:.0f}s\n")
        sys.stderr.flush()

    return np.mean(allAccs), np.std(allAccs), preds


# =================== 搜索 ===================
print("\n=== Phase 1: class_weight 强度搜索 (h=128, a=1e-3, lr=1e-3, 300ep) ===")
bestAcc, bestCW = 0, 0
for cw in [0.0, 0.25, 0.5, 0.75, 1.0]:
    acc, std, _ = evalConfig((128,), 1e-3, 1e-3, 300, cw)
    marker = ' ***' if acc > bestAcc else ''
    print(f"  cw={cw:.2f}: {acc:.1f}% +/- {std:.1f}%{marker}")
    if acc > bestAcc:
        bestAcc, bestCW = acc, cw

print(f"\n  Best cw: {bestCW}")

print(f"\n=== Phase 2: hidden 层搜索 (cw={bestCW}, a=1e-3, lr=1e-3, 300ep) ===")
bestAcc2, bestH = 0, ()
for hidden in [(64,), (128,), (256,), (512,), (128, 64), (256, 128)]:
    acc, std, _ = evalConfig(hidden, 1e-3, 1e-3, 300, bestCW)
    marker = ' ***' if acc > bestAcc2 else ''
    print(f"  h={str(hidden):12s}: {acc:.1f}% +/- {std:.1f}%{marker}")
    if acc > bestAcc2:
        bestAcc2, bestH = acc, hidden

print(f"\n  Best hidden: {bestH}")

print(f"\n=== Phase 3: alpha + lr 搜索 (h={bestH}, cw={bestCW}, 300ep) ===")
bestAcc3, bestAlpha, bestLR = 0, 0, 0
for alpha in [1e-4, 1e-3, 1e-2]:
    for lr in [5e-4, 1e-3, 2e-3]:
        acc, std, _ = evalConfig(bestH, alpha, lr, 300, bestCW)
        marker = ' ***' if acc > bestAcc3 else ''
        print(f"  a={alpha:.0e} lr={lr:.0e}: {acc:.1f}% +/- {std:.1f}%{marker}")
        if acc > bestAcc3:
            bestAcc3, bestAlpha, bestLR = acc, alpha, lr

print(f"\n  Best: a={bestAlpha}, lr={bestLR}")

print(f"\n=== Phase 4: epoch 搜索 (h={bestH}, cw={bestCW}, a={bestAlpha}, lr={bestLR}) ===")
bestAcc4, bestEp = 0, 0
for ep in [200, 300, 500, 800]:
    acc, std, preds = evalConfig(bestH, bestAlpha, bestLR, ep, bestCW)
    marker = ' ***' if acc > bestAcc4 else ''
    print(f"  ep={ep:4d}: {acc:.1f}% +/- {std:.1f}%{marker}")
    if acc > bestAcc4:
        bestAcc4, bestEp, bestPreds = acc, ep, preds

# 最终结果
print(f"\n{'='*50}")
print(f"Final Best: h={bestH} cw={bestCW} a={bestAlpha} lr={bestLR} ep={bestEp}")
print(f"Accuracy: {bestAcc4:.1f}%")
print(f"{'='*50}")

# 最优的混淆矩阵
predLabels = [allFaces[p] for p in bestPreds]
print("\nConfusion matrix (row=GT, col=Pred):")
print("     " + "  ".join(f"{f:>3s}" for f in allFaces))
for gt in allFaces:
    row = []
    for pr in allFaces:
        cnt = sum(1 for t, p in zip(labels, predLabels) if t == gt and p == pr)
        row.append(f"{cnt:3d}")
    gtN = sum(1 for t in labels if t == gt)
    corr = sum(1 for t, p in zip(labels, predLabels) if t == gt and p == gt)
    pct = corr / gtN * 100 if gtN > 0 else 0
    print(f" {gt:>2s}  {'  '.join(row)}  ({gtN}) {pct:.0f}%")

c = sum(1 for p, t in zip(predLabels, labels) if p == t)
print(f"\nOverall: {c}/{n} = {c/n*100:.1f}%")
