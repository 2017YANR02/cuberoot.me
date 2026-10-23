#!/usr/bin/env python3
"""One visible-sticker Mask R-CNN baseline. No implicit downloads or GT inference.

doctor/audit are lightweight. train/evaluate/predict are compute entry points and
must obey the repository's local memory guard. See the research README.
"""
from __future__ import annotations

import argparse
from collections import defaultdict
import importlib.metadata
import importlib.util
import json
import math
import os
from pathlib import Path
import platform
import random
import signal
import subprocess
import sys
import tempfile
import time

from dataset import COLORS, DataError, assert_disjoint, dataset_summary, image_and_masks, load_dataset, provenance, sha256
from metrics import match_instances, summarize_counts

FORMAT = "reconer-visible-maskrcnn-v1"


def emit(value):
    print(json.dumps(value, ensure_ascii=False, allow_nan=False), flush=True)


def atomic_json(path, value):
    atomic_write(path, lambda stream: stream.write((json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()))


def atomic_write(path, write):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f".{path.name}.", delete=False) as stream:
            temporary = Path(stream.name)
            write(stream)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def fresh_directory(path):
    if path.exists() and (not path.is_dir() or any(path.iterdir())):
        raise DataError(f"Output must be a new or empty directory: {path}")


def resources(started):
    try:
        import resource
    except ImportError as exc:
        raise DataError("The RSS budget backend currently requires Linux/macOS; do not run unmonitored training") from exc
    maximum = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # macOS reports bytes; Linux reports KiB. This is peak RSS, not current free memory.
    divisor = 1024 * 1024 if sys.platform == "darwin" else 1024
    return {"pid": os.getpid(), "elapsed_seconds": round(time.monotonic() - started, 3), "peak_rss_mib": round(maximum / divisor, 3)}


def resource_reason(args, usage):
    if usage["elapsed_seconds"] >= args.max_seconds:
        return "max_seconds"
    if usage["peak_rss_mib"] >= args.max_rss_mib:
        return "max_rss_mib"
    return None


def doctor():
    dependencies = {}
    for module, distribution in (("torch", "torch"), ("torchvision", "torchvision"), ("PIL", "pillow"), ("numpy", "numpy")):
        try:
            dependencies[module] = importlib.metadata.version(distribution) if importlib.util.find_spec(module) else None
        except importlib.metadata.PackageNotFoundError:
            dependencies[module] = None
    return {"status": "ready_for_dependency_check" if all(dependencies.values()) else "dependencies_missing",
            "python": sys.version.split()[0], "executable": sys.executable,
            "platform": platform.platform(), "dependencies": dependencies,
            "model_loaded": False, "downloads": False,
            "note": "Dependency presence does not establish model compatibility, training readiness or no-swap protection."}


def framework(args):
    try:
        import torch
        import torchvision
    except (ImportError, RuntimeError) as exc:
        raise DataError(f"Compatible torch/torchvision required; use vision/pyproject.toml. {exc}") from exc
    torch.set_num_threads(args.threads)
    if args.device == "cuda" and not torch.cuda.is_available():
        raise DataError("CUDA requested but unavailable; no silent CPU fallback")
    if args.device == "mps":
        raise DataError("MPS detection operators have not been validated for this baseline; use CPU or CUDA")
    return torch, torchvision, torch.device(args.device)


def build_model(torchvision, config, pretrained=None):
    """Same ResNet50-FPN architecture as the official COCO_V1 baseline.

    Construct without weight enums so neither backbone nor detector downloads.
    FrozenBatchNorm + eps=0 reproduce the published COCO_V1 normalization.
    """
    import torch
    from torchvision.models.detection import MaskRCNN
    from torchvision.models.detection.backbone_utils import resnet_fpn_backbone
    from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
    from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor
    from torchvision.ops.misc import FrozenBatchNorm2d
    backbone = resnet_fpn_backbone(backbone_name="resnet50", weights=None, trainable_layers=3, norm_layer=FrozenBatchNorm2d)
    model = MaskRCNN(backbone, num_classes=91 if pretrained else 7,
                    min_size=config["min_size"], max_size=config["max_size"],
                    box_score_thresh=0.0, box_detections_per_img=64)
    for module in model.modules():
        if isinstance(module, FrozenBatchNorm2d):
            module.eps = 0.0
    if pretrained:
        model.load_state_dict(torch.load(pretrained, map_location="cpu", weights_only=True))
        model.roi_heads.box_predictor = FastRCNNPredictor(model.roi_heads.box_predictor.cls_score.in_features, 7)
        model.roi_heads.mask_predictor = MaskRCNNPredictor(model.roi_heads.mask_predictor.conv5_mask.in_channels, 256, 7)
    return model


def versions(torch, torchvision):
    return {"torch": str(torch.__version__), "torchvision": str(torchvision.__version__), "python": sys.version.split()[0]}


def code_fingerprint():
    here = Path(__file__).parent
    return {name: sha256(here / name) for name in ("baseline.py", "dataset.py", "metrics.py", "pyproject.toml")}


def revision():
    result = subprocess.run(["git", "rev-parse", "HEAD"], cwd=Path(__file__).parent, capture_output=True, text=True, check=False)
    return result.stdout.strip() if result.returncode == 0 else None


def restore_rng(torch, checkpoint):
    random.setstate(checkpoint["rng"]["python"])
    torch.set_rng_state(checkpoint["rng"]["torch"])
    if checkpoint["rng"]["cuda"] is not None:
        if not torch.cuda.is_available():
            raise DataError("Cannot resume CUDA RNG on a CPU-only runtime")
        torch.cuda.set_rng_state_all(checkpoint["rng"]["cuda"])


def train(args, loaded):
    data, selected, annotations, root = loaded
    started = time.monotonic()
    if not args.resume and (args.pretrained is None or not args.pretrained.is_file()):
        raise DataError("Training requires --pretrained pointing to a local official COCO_V1 .pth; no download or random-init fallback")
    latest = args.output / "latest.pt"
    if not args.resume:
        fresh_directory(args.output)
    elif args.output.exists() and any(args.output.iterdir()) and args.resume.resolve() != latest.resolve():
        raise DataError("Nonempty output can only resume its own latest.pt; use a new output directory")
    args.output.mkdir(parents=True, exist_ok=True)
    config = {key: getattr(args, key) for key in ("seed", "epochs", "batch_size", "lr", "min_size", "max_size")}
    dataset_hash = sha256(args.dataset)
    source_hashes = code_fingerprint()
    torch, tv, device = framework(args)
    random.seed(args.seed)
    torch.manual_seed(args.seed)
    if device.type == "cuda":
        torch.cuda.manual_seed_all(args.seed)
        torch.backends.cudnn.benchmark = False
    checkpoint = torch.load(args.resume, map_location="cpu", weights_only=True) if args.resume else None
    if checkpoint and (checkpoint.get("format") != FORMAT or checkpoint.get("config") != config or checkpoint.get("dataset_sha256") != dataset_hash or checkpoint.get("code_sha256") != source_hashes or checkpoint.get("versions") != versions(torch, tv) or checkpoint.get("device") != args.device):
        raise DataError("Resume inputs/config/code/runtime/device differ from checkpoint; do not silently restart or relabel the run")
    if checkpoint and checkpoint.get("completed"):
        raise DataError("Checkpoint is already complete")
    model = build_model(tv, config, None if checkpoint else args.pretrained).to(device)
    optimizer = torch.optim.SGD([p for p in model.parameters() if p.requires_grad], lr=args.lr, momentum=0.9, weight_decay=0.0005)
    epoch, next_index, global_step = 0, 0, 0
    pretrained_hash = sha256(args.pretrained) if args.pretrained and not checkpoint else checkpoint["pretrained_sha256"]
    if checkpoint:
        model.load_state_dict(checkpoint["model"])
        optimizer.load_state_dict(checkpoint["optimizer"])
        epoch, next_index, global_step = checkpoint["epoch"], checkpoint["next_index"], checkpoint["global_step"]
        restore_rng(torch, checkpoint)
    rows = [im for im in selected if im["split"] == "train"]
    stopped = False
    stop_reason = None
    session_id = f"{time.time_ns()}-{os.getpid()}"

    def request_stop(_signum, _frame):
        nonlocal stopped, stop_reason
        stopped = True
        stop_reason = "signal"

    def check_limits():
        nonlocal stopped, stop_reason
        usage = resources(started)
        reason = resource_reason(args, usage)
        if reason:
            stopped, stop_reason = True, reason
        return usage

    for sig in (signal.SIGINT, signal.SIGTERM):
        signal.signal(sig, request_stop)

    def save(completed=False, reason=None):
        state = {"format": FORMAT, "config": config, "colors": COLORS,
                 "dataset_sha256": dataset_hash, "dataset": str(args.dataset.resolve()),
                 "code_sha256": source_hashes, "git_revision": revision(),
                 "versions": versions(torch, tv), "device": args.device,
                 "pretrained_sha256": pretrained_hash,
                 "provenance": {split: provenance([im for im in selected if im["split"] == split]) for split in ("train", "val")},
                 "training_data": dataset_summary(data, rows),
                 "session_id": session_id,
                 "runtime_limits": {"max_seconds": args.max_seconds, "max_rss_mib": args.max_rss_mib},
                 "resource_usage": resources(started),
                 "epoch": epoch, "next_index": next_index, "global_step": global_step,
                 "model": model.state_dict(), "optimizer": optimizer.state_dict(),
                 "rng": {"python": random.getstate(), "torch": torch.get_rng_state(),
                         "cuda": torch.cuda.get_rng_state_all() if device.type == "cuda" else None},
                 "completed": completed, "stop_reason": reason}
        atomic_write(latest, lambda stream: torch.save(state, stream))
        atomic_json(args.output / "run.json", {k: v for k, v in state.items() if k not in ("model", "optimizer", "rng")})

    model.train()
    if not checkpoint:
        save(reason="initialized")
    check_limits()
    while epoch < args.epochs and not stopped:
        order = list(range(len(rows)))
        random.Random(args.seed + epoch).shuffle(order)
        while next_index < len(rows) and not stopped:
            check_limits()
            if stopped:
                break
            batch_started = time.monotonic()
            batch = [rows[i] for i in order[next_index:next_index + args.batch_size]]
            images, targets = [], []
            for row in batch:
                anns = annotations[row["id"]]
                rgb, masks = image_and_masks(row, anns, root)
                image = torch.from_numpy(rgb).permute(2, 0, 1).float().div_(255)
                mask_tensor = torch.stack([torch.from_numpy(m) for m in masks]) if masks else torch.zeros((0, row["height"], row["width"]), dtype=torch.uint8)
                # Derive boxes from the actual raster mask, avoiding polygon-edge rounding drift.
                boxes = []
                for mask in mask_tensor:
                    ys, xs = torch.where(mask > 0)
                    boxes.append([xs.min().item(), ys.min().item(), xs.max().item() + 1, ys.max().item() + 1])
                targets.append({"boxes": torch.tensor(boxes, dtype=torch.float32).reshape(-1, 4).to(device),
                                "labels": torch.tensor([a["category_id"] for a in anns], dtype=torch.int64).to(device),
                                "masks": mask_tensor.to(device)})
                images.append(image.to(device))
            losses = model(images, targets)
            loss = sum(losses.values())
            if not torch.isfinite(loss).item():
                raise DataError("Non-finite loss; previous checkpoint retained. Do not auto-restart.")
            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            optimizer.step()
            next_index += len(batch)
            global_step += 1
            event = {"status": "training", "session_id": session_id, "epoch": epoch,
                     "next_index": next_index, "global_step": global_step,
                     "loss": float(loss.detach().cpu()), "batch_seconds": round(time.monotonic() - batch_started, 3),
                     **check_limits()}
            with (args.output / "progress.jsonl").open("a", encoding="utf-8") as stream:
                stream.write(json.dumps(event, allow_nan=False) + "\n")
                stream.flush()
                os.fsync(stream.fileno())
            emit(event)
            del images, targets, losses, loss
            if global_step % args.checkpoint_every == 0 or stopped:
                save(reason=stop_reason)
        if next_index == len(rows):
            epoch += 1
            next_index = 0
            save()
    save(completed=epoch == args.epochs, reason=stop_reason)
    return {"status": "interrupted" if stopped else "training_complete", "checkpoint": str(latest),
            "checkpoint_sha256": sha256(latest), "global_step": global_step,
            "stop_reason": stop_reason, "resource_usage": resources(started),
            "quality_verified": False, "next": "Evaluate the frozen checkpoint on val; train completion is not accuracy evidence."}


def load_checkpoint(args):
    if not args.checkpoint.is_file():
        raise DataError(f"Checkpoint missing: {args.checkpoint}")
    torch, tv, device = framework(args)
    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
    if checkpoint.get("format") != FORMAT or checkpoint.get("colors") != COLORS or checkpoint.get("completed") is not True:
        raise DataError("A complete reconer visible-instance checkpoint is required")
    if checkpoint.get("versions", {}).get("torchvision") != str(tv.__version__):
        raise DataError("TorchVision version differs from training checkpoint")
    model = build_model(tv, checkpoint["config"])
    model.load_state_dict(checkpoint["model"])
    model.to(device).eval()
    for key in ("model", "optimizer", "rng"):
        checkpoint.pop(key, None)
    return torch, model, device, checkpoint


def predict_one(torch, model, device, rgb):
    tensor = torch.from_numpy(rgb).permute(2, 0, 1).float().div_(255).to(device)
    with torch.inference_mode():
        return {k: v.cpu() for k, v in model([tensor])[0].items()}


def evaluate(args, loaded):
    import numpy as np
    data, rows, annotations, root = loaded
    if args.output.exists():
        raise DataError(f"Evaluation report already exists: {args.output}; use a new filename")
    checkpoint_hash = sha256(args.checkpoint) if args.checkpoint.is_file() else None
    if args.split == "test":
        if args.validation_report is None:
            raise DataError("Test requires --validation-report to freeze the validation-selected threshold")
        report = json.loads(args.validation_report.read_text())
        if report.get("split") != "val" or report.get("checkpoint_sha256") != checkpoint_hash:
            raise DataError("Validation report must belong to these frozen weights")
        if args.threshold != report.get("threshold"):
            raise DataError("Test threshold must equal the frozen validation threshold")
    torch, model, device, checkpoint = load_checkpoint(args)
    assert_disjoint(rows, checkpoint["provenance"]["train"], "Validation/test")
    if args.split == "test":
        assert_disjoint(rows, checkpoint["provenance"]["val"], "Held-out test")
        assert_disjoint(rows, report["provenance"], "Held-out test")
    by_source = defaultdict(list)
    frame_results = []
    started = time.monotonic()
    for row in rows:
        anns = annotations[row["id"]]
        rgb, masks = image_and_masks(row, anns, root)
        output = predict_one(torch, model, device, rgb)
        predictions = output["masks"][:, 0].numpy() >= 0.5
        valid = [(a, m.astype(bool)) for a, m in zip(anns, masks) if a.get("ignore") is not True]
        ignored = [m.astype(bool) for a, m in zip(anns, masks) if a.get("ignore") is True]
        overlaps, ignored_overlaps = [], []
        for mask in predictions:
            overlaps.append([float(np.logical_and(mask, truth).sum() / max(1, np.logical_or(mask, truth).sum())) for _, truth in valid])
            ignored_overlaps.append([float(np.logical_and(mask, region).sum() / max(1, mask.sum())) for region in ignored])
        counts = match_instances([a["category_id"] for a, _ in valid], output["labels"].tolist(), output["scores"].tolist(), overlaps, ignored_overlaps, args.threshold)
        by_source[row["source_id"]].append(counts)
        frame_results.append({"image_id": row["id"], "source_id": row["source_id"], "pts_seconds": row["pts_seconds"],
                              "ignored_regions": len(ignored), **counts})
    report = {"format": FORMAT, "status": "evaluated", "split": args.split,
              "dataset_sha256": sha256(args.dataset), "checkpoint_sha256": checkpoint_hash,
              "provenance": provenance(rows),
              "threshold": args.threshold, "mask_threshold": 0.5, "match_iou": 0.5,
              "summary": summarize_counts(frame_results),
              "per_source": {source: summarize_counts(counts) for source, counts in by_source.items()},
              "frames": frame_results, "elapsed_seconds": time.monotonic() - started,
              "center_identity": "not_predicted", "boundary_coverage": "not_evaluated_by_image_baseline",
              "scores_calibrated": False, "action_quality_verified": False}
    atomic_json(args.output, report)
    return {"status": "evaluated", "report": str(args.output), **report["summary"]}


def predict(args):
    # No dataset/annotations/answers argument exists in this entry point.
    for path in args.image:
        if not path.is_file():
            raise DataError(f"Image missing: {path}")
    fresh_directory(args.output)
    import numpy as np
    from PIL import Image
    torch, model, device, _ = load_checkpoint(args)
    args.output.mkdir(parents=True, exist_ok=True)
    results = []
    started = time.monotonic()
    for index, path in enumerate(args.image):
        with Image.open(path) as source:
            rgb = np.array(source.convert("RGB"), copy=True)
        prediction = predict_one(torch, model, device, rgb)
        instances = []
        for i, score in enumerate(prediction["scores"].tolist()):
            if score < args.threshold:
                continue
            mask_name = f"image-{index:04d}-mask-{i:03d}.png"
            mask = (prediction["masks"][i, 0].numpy() >= 0.5).astype(np.uint8) * 255
            atomic_write(args.output / mask_name, lambda stream: Image.fromarray(mask).save(stream, format="PNG"))
            instances.append({"color": COLORS[prediction["labels"][i].item() - 1], "detection_score": score,
                              "box_xyxy": prediction["boxes"][i].tolist(), "visible_mask": mask_name,
                              "color_distribution": None, "is_center": None})
        results.append({"image": str(path.resolve()), "image_sha256": sha256(path),
                        "width": rgb.shape[1], "height": rgb.shape[0], "instances": instances,
                        "rejected_predictions": int((prediction["scores"] < args.threshold).sum())})
    report = {"format": FORMAT, "status": "predicted", "checkpoint_sha256": sha256(args.checkpoint),
              "threshold": args.threshold, "mask_threshold": 0.5, "scores_calibrated": False,
              "frames": results, "elapsed_seconds": time.monotonic() - started,
              "reconstruction_complete": False}
    atomic_json(args.output / "predictions.json", report)
    return {"status": "predicted", "report": str(args.output / "predictions.json"), "images": len(results)}


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    commands = p.add_subparsers(dest="command", required=True)
    commands.add_parser("doctor")
    for name in ("audit", "train", "evaluate", "predict"):
        sub = commands.add_parser(name)
        if name != "predict":
            sub.add_argument("--dataset", required=True, type=Path)
            sub.add_argument("--images-root", type=Path)
        if name == "audit":
            continue
        sub.add_argument("--output", required=True, type=Path)
        sub.add_argument("--device", choices=("cpu", "cuda", "mps"), default="cpu")
        sub.add_argument("--threads", type=int, default=2)
        if name == "train":
            sub.add_argument("--pretrained", type=Path)
            sub.add_argument("--resume", type=Path)
            sub.add_argument("--seed", type=int, default=1729)
            sub.add_argument("--epochs", type=int, default=10)
            sub.add_argument("--batch-size", type=int, default=1)
            sub.add_argument("--lr", type=float, default=0.005)
            sub.add_argument("--min-size", type=int, default=480)
            sub.add_argument("--max-size", type=int, default=800)
            sub.add_argument("--checkpoint-every", type=int, default=10)
            sub.add_argument("--max-seconds", type=float, default=3600)
            sub.add_argument("--max-rss-mib", type=float, default=8192)
        else:
            sub.add_argument("--checkpoint", required=True, type=Path)
            sub.add_argument("--threshold", type=float, default=0.5)
        if name == "evaluate":
            sub.add_argument("--split", choices=("val", "test"), default="val")
            sub.add_argument("--validation-report", type=Path)
        elif name == "predict":
            sub.add_argument("--image", required=True, type=Path, action="append")
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        if args.command == "doctor":
            emit(doctor())
            return 0
        if getattr(args, "threads", 1) < 1 or getattr(args, "threads", 1) > 14:
            raise DataError("threads must be between 1 and 14")
        if not 0 <= getattr(args, "threshold", 0.5) <= 1:
            raise DataError("threshold must be between 0 and 1")
        if args.command == "train" and (min(args.epochs, args.batch_size, args.min_size, args.max_size, args.checkpoint_every) < 1 or args.max_size < args.min_size or not all(math.isfinite(v) and v > 0 for v in (args.lr, args.max_seconds, args.max_rss_mib))):
            raise DataError("Invalid positive training parameters or image-size range")
        if args.command == "predict":
            emit(predict(args))
        else:
            splits = ("train", "val") if args.command == "train" else (args.split,) if args.command == "evaluate" else ()
            loaded = load_dataset(args.dataset, args.images_root, splits, training=args.command == "train")
            if args.command == "audit":
                emit({"status": "dataset_valid", "dataset_sha256": sha256(args.dataset), **dataset_summary(loaded[0], loaded[1])})
            elif args.command == "train":
                emit(train(args, loaded))
            else:
                emit(evaluate(args, loaded))
        return 0
    except (DataError, OSError, ValueError, KeyError, TypeError, ImportError, RuntimeError) as exc:
        emit({"status": "blocked", "command": args.command, "reason": str(exc), "training_completed": False})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
