"""Fixed Stage B joint mask/color matching, independent of the ML framework."""
from __future__ import annotations


def match_instances(truth_labels, prediction_labels, scores, overlaps, ignore_overlaps=None, threshold=0.5):
    """Greedy confidence order, max IoU among unused ground truth (IoU >= .5).

    A geometrically matched wrong color consumes that match and counts FP+FN.
    A duplicate is FP even if it also overlaps an ignored region. Otherwise
    a prediction with >= .5 of its own area in a fixed ignored region is ignored.
    """
    unused = set(range(len(truth_labels)))
    tp = fp = wrong_color = ignored = rejected = 0
    for i in sorted(range(len(scores)), key=lambda i: (-scores[i], i)):
        if scores[i] < threshold:
            rejected += 1
            continue
        j = max(unused, key=lambda j: (overlaps[i][j], -j), default=None)
        if j is not None and overlaps[i][j] >= 0.5:
            unused.remove(j)
            if prediction_labels[i] == truth_labels[j]:
                tp += 1
            else:
                wrong_color += 1
                fp += 1
        elif any(value >= 0.5 for value in overlaps[i]):
            fp += 1
        elif ignore_overlaps and any(value >= 0.5 for value in ignore_overlaps[i]):
            ignored += 1
        else:
            fp += 1
    return {"tp": tp, "fp": fp, "fn": len(unused) + wrong_color, "wrong_color": wrong_color,
            "ignored_predictions": ignored, "rejected_predictions": rejected,
            "truth_instances": len(truth_labels)}


def summarize_counts(counts):
    total = {key: sum(row[key] for row in counts) for key in
             ("tp", "fp", "fn", "wrong_color", "ignored_predictions", "rejected_predictions", "truth_instances")}
    precision_denominator = total["tp"] + total["fp"]
    recall_denominator = total["tp"] + total["fn"]
    precision = total["tp"] / precision_denominator if precision_denominator else None
    recall = total["tp"] / recall_denominator if recall_denominator else None
    return {**total, "precision": precision, "recall": recall,
            "passed_instance_gate": precision is not None and recall is not None and precision >= 0.95 and recall >= 0.8}
