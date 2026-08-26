"""LOVO (Leave-One-Video-Out) 评估: KNN vs MLP"""
import warnings; warnings.filterwarnings('ignore')
import numpy as np
import torch, torch.nn as nn
import time

data = np.load('videos/features_cache.npz', allow_pickle=True)
features = data['features']
labels = [str(l) for l in data['labels']]
videoIds = [str(v) for v in data['videoIds']]

# 过滤 y
mask = [l != 'y' for l in labels]
features = features[mask]
labels = [l for l, m in zip(labels, mask) if m]
videoIds = [v for v, m in zip(videoIds, mask) if m]
n = len(labels)
allFaces = sorted(set(labels))
allVideos = list(dict.fromkeys(videoIds))  # 保持顺序去重

face2idx = {f: i for i, f in enumerate(allFaces)}
labelsIdx = np.array([face2idx[l] for l in labels])
nC = len(allFaces)
inD = features.shape[1]

print(f"Segments: {n}, Videos: {len(allVideos)}, Features: {inD}")
for v in allVideos:
    cnt = sum(1 for vid in videoIds if vid == v)
    print(f"  {v}: {cnt} segs")


# =================== KNN LOVO ===================
def knnPredict(trX, trY, teX, k, metric):
    """KNN 预测, 返回标签列表"""
    from scipy.spatial.distance import cdist
    D = cdist(teX, trX, metric=metric)
    preds = []
    for i in range(len(teX)):
        nn_idx = np.argsort(D[i])[:k]
        nn_labels = [trY[j] for j in nn_idx]
        # 多数投票
        votes = {}
        for l in nn_labels:
            votes[l] = votes.get(l, 0) + 1
        preds.append(max(votes, key=votes.get))
    return preds


print("\n=== KNN LOVO ===")
# 标准化 + PCA (用最优配置: PCA50 K=11 cosine)
sc = (features - features.mean(axis=0)) / (features.std(axis=0) + 1e-8)
_, S, Vt = np.linalg.svd(sc, full_matrices=False)
reduced = sc @ Vt[:50].T

knnAllPreds = [''] * n
for vi, vHeld in enumerate(allVideos):
    trMask = [v != vHeld for v in videoIds]
    teMask = [v == vHeld for v in videoIds]
    trX = reduced[trMask]
    trY = [l for l, m in zip(labels, trMask) if m]
    teX = reduced[teMask]
    teY = [l for l, m in zip(labels, teMask) if m]

    preds = knnPredict(trX, trY, teX, k=11, metric='cosine')
    c = sum(1 for p, t in zip(preds, teY) if p == t)
    print(f"  Hold {vHeld}: {c}/{len(teY)} = {c/len(teY)*100:.1f}%")

    j = 0
    for i in range(n):
        if videoIds[i] == vHeld:
            knnAllPreds[i] = preds[j]
            j += 1

knnCorr = sum(1 for p, t in zip(knnAllPreds, labels) if p == t)
print(f"  KNN LOVO Total: {knnCorr}/{n} = {knnCorr/n*100:.1f}%")


# =================== MLP LOVO ===================
print("\n=== MLP LOVO ===")
mlpSc = (features - features.mean(axis=0)) / (features.std(axis=0) + 1e-8)

mlpAllPreds = np.zeros(n, dtype=int)
t0 = time.time()

for vi, vHeld in enumerate(allVideos):
    trMask = np.array([v != vHeld for v in videoIds])
    teMask = np.array([v == vHeld for v in videoIds])

    torch.manual_seed(42)
    model = nn.Sequential(
        nn.Linear(inD, 256), nn.ReLU(), nn.Dropout(0.3),
        nn.Linear(256, nC),
    )
    opt = torch.optim.Adam(model.parameters(), lr=2e-3, weight_decay=1e-3)
    crit = nn.CrossEntropyLoss()

    xTr = torch.tensor(mlpSc[trMask], dtype=torch.float32)
    yTr = torch.tensor(labelsIdx[trMask], dtype=torch.long)
    xTe = torch.tensor(mlpSc[teMask], dtype=torch.float32)

    model.train()
    for _ in range(500):
        opt.zero_grad()
        loss = crit(model(xTr), yTr)
        loss.backward()
        opt.step()

    model.eval()
    with torch.no_grad():
        preds = model(xTe).argmax(1).numpy()

    mlpAllPreds[teMask] = preds
    predLabels = [allFaces[p] for p in preds]
    teY = [l for l, m in zip(labels, teMask) if m]
    c = sum(1 for p, t in zip(predLabels, teY) if p == t)
    elapsed = time.time() - t0
    eta = elapsed / (vi + 1) * (len(allVideos) - vi - 1)
    print(f"  Hold {vHeld}: {c}/{len(teY)} = {c/len(teY)*100:.1f}%  [{vi+1}/{len(allVideos)}] ETA={eta:.0f}s")

mlpPredLabels = [allFaces[p] for p in mlpAllPreds]
mlpCorr = sum(1 for p, t in zip(mlpPredLabels, labels) if p == t)
print(f"  MLP LOVO Total: {mlpCorr}/{n} = {mlpCorr/n*100:.1f}%")


# =================== 汇总 ===================
print(f"\n{'='*50}")
print(f"KNN LOVO: {knnCorr}/{n} = {knnCorr/n*100:.1f}%")
print(f"MLP LOVO: {mlpCorr}/{n} = {mlpCorr/n*100:.1f}%")
print(f"{'='*50}")

# MLP LOVO 混淆矩阵
print("\nMLP LOVO Confusion matrix:")
print("     " + "  ".join(f"{f:>3s}" for f in allFaces))
for gt in allFaces:
    row = []
    for pr in allFaces:
        cnt = sum(1 for t, p in zip(labels, mlpPredLabels) if t == gt and p == pr)
        row.append(f"{cnt:3d}")
    gtN = sum(1 for t in labels if t == gt)
    corr = sum(1 for t, p in zip(labels, mlpPredLabels) if t == gt and p == gt)
    pct = corr / gtN * 100 if gtN > 0 else 0
    print(f" {gt:>2s}  {'  '.join(row)}  ({gtN}) {pct:.0f}%")
