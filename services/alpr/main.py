"""
Parkly ALPR Microservice
========================
GPU-accelerated license plate recognition using YOLOv8 (detection) + PaddleOCR (OCR).

Design goals
------------
- Detect LP region with YOLOv8, then run PaddleOCR on the cropped region.
- Load models ONCE at startup; never reload per-request.
- RTX 4070 CUDA acceleration for both detection and OCR.
- Fallback gracefully when GPU is unavailable (CPU mode with warning).
- JSON contract matches what Parkly backend expects (apps/api/src/server/services/alpr-provider-http.ts).

Request  → POST /predict/  (multipart or JSON)
Response ← {
    "success": true,
    "candidates": [{ "plate": "20AA56789", "score": 95.2, "rawText": "20-AA 567.89" }],
    "metadata": { "detectionMs": 8, "ocrMs": 22, "totalMs": 31, "device": "cuda:0" }
}
Error    ← { "success": false, "error": "...", "code": "NO_DETECTION" | "OCR_FAILED" }

Environment variables
---------------------
  HOST             Bind address  (default 0.0.0.0)
  PORT             TCP port       (default 8765)
  CUDA_DEVICE     cuda:0, cuda:1 (default cuda:0)
  YOLO_MODEL      yolov8n.pt / best.pt  (default yolov8n.pt)
  OCR_LANG        en / ch / korean / japan / etc  (default en)
                  For Vietnamese plates, 'en' works well (Latin A-Z + 0-9)
  LOG_LEVEL       INFO / DEBUG  (default INFO)
  BEARER_TOKEN    If set, all /predict/ requests must send Authorization: Bearer <token>
  SKIP_OCR        Set to "1" to disable PaddleOCR (for debugging)
"""

from __future__ import annotations

import io
import logging
import os
import sys
import time
import traceback
from dataclasses import dataclass, field
from typing import Optional, Annotated

# ─────────────────────────────────────────────────────────────────────────────
# Logging (must be defined first so other modules can use it)
# ─────────────────────────────────────────────────────────────────────────────

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("alpr")
logger.setLevel(LOG_LEVEL)

# ─────────────────────────────────────────────────────────────────────────────
# Windows CPU: disable oneDNN/MKLDNN to avoid "ConvertPirAttribute2RuntimeAttribute" errors
# ─────────────────────────────────────────────────────────────────────────────
# CRITICAL: These flags MUST be set as env vars BEFORE importing torch/paddle

if os.name == "nt":
    WINDOWS_DISABLE_FLAGS = [
        "FLAGS_use_mkldnn",
        "FLAGS_use_onednn",
        "FLAGS_enable_pir_in_executor",
        "FLAGS_enable_pir_api",
        "FLAGS_use_mkldnn_bfloat16",
        "FLAGS_onednn_allow_bf16",
    ]
    for flag in WINDOWS_DISABLE_FLAGS:
        os.environ[flag] = "0"
    # Force Paddle to use legacy executor (disable PIR)
    os.environ["NEW_EXECUTOR"] = "0"
    os.environ["GFLAGS_use_pir_mode"] = "0"
    # Disable PyTorch shared memory on Windows (can cause DLL errors)
    os.environ["PYTORCH_DISABLE_SHM"] = os.environ.get("PYTORCH_DISABLE_SHM", "1")
    logger.info("Windows detected — disabled oneDNN/MKLDNN/PIR flags and NEW_EXECUTOR=0 via env vars")

# ─────────────────────────────────────────────────────────────────────────────
# Imports (ordered: stdlib → third-party → local)
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI, Depends, HTTPException, Header, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

import cv2
import numpy as np
import torch
import uvicorn

# ─────────────────────────────────────────────────────────────────────────────
# Device resolution
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_device() -> str:
    """Return the best available compute device string."""
    if torch.cuda.is_available():
        device_env = os.getenv("CUDA_DEVICE", "cuda:0")
        gpu_id = int(device_env.split(":")[1]) if ":" in device_env else 0
        try:
            gpu_name = torch.cuda.get_device_name(gpu_id)
            logger.info("CUDA available — using GPU %s (%s)", device_env, gpu_name)
        except Exception:
            logger.info("CUDA available — using %s", device_env)
        return device_env
    logger.warning("CUDA not available — running on CPU (slow, dev only)")
    return "cpu"


DEVICE = _resolve_device()

# ─────────────────────────────────────────────────────────────────────────────
# PaddleOCR initialization (handle Windows CPU issues)
# ─────────────────────────────────────────────────────────────────────────────

SKIP_OCR = os.getenv("SKIP_OCR", "0") == "1"
_ocr_instance: Optional["PaddleOCR"] = None
_ocr_init_error: Optional[str] = None


def _init_paddleocr() -> Optional["PaddleOCR"]:
    """
    Initialize PaddleOCR with proper error handling for Windows CPU.
    Returns None if initialization fails.
    """
    global _ocr_instance, _ocr_init_error
    
    if _ocr_instance is not None or _ocr_init_error is not None:
        return _ocr_instance
    
    if SKIP_OCR:
        logger.warning("SKIP_OCR=1 — PaddleOCR is disabled")
        _ocr_init_error = "DISABLED_VIA_SKIP_OCR"
        return None
    
    ocr_lang = os.getenv("OCR_LANG", "en")
    paddle_device = "cpu" if DEVICE == "cpu" else "gpu:" + (DEVICE.split(":")[-1] if ":" in DEVICE else "0")
    
    logger.info("Loading PaddleOCR (lang=%s, device=%s)", ocr_lang, paddle_device)
    
    try:
        # Try importing paddle and set flags (if not already set via env vars)
        try:
            import paddle
            # Env vars should already be set, but try to reinforce via set_flags
            try:
                paddle.set_flags({
                    "FLAGS_use_mkldnn": False,
                    "FLAGS_use_onednn": False,
                    "FLAGS_enable_pir_in_executor": False,
                    "FLAGS_enable_pir_api": False,
                    "FLAGS_use_mkldnn_bfloat16": False,
                    "FLAGS_onednn_allow_bf16": False,
                })
                logger.info("Windows CPU mode — reinforced oneDNN/PIR flags via paddle.set_flags()")
            except Exception as flag_err:
                logger.debug("paddle.set_flags() not supported or already finalized: %s", flag_err)
        except ImportError:
            logger.debug("Could not import paddle for flag reinforcement")
        
        # Import PaddleOCR (after setting flags if Windows CPU)
        from paddleocr import PaddleOCR
        
        # Build kwargs based on PaddleOCR version
        # PaddleOCR 2.7.x: uses show_log, use_angle_cls, use_gpu
        # PaddleOCR 3.x+: removed show_log, use_gpu; uses device only
        paddleocr_kwargs = {
            "lang": ocr_lang,
        }
        
        # Detect version and adjust kwargs
        try:
            import paddleocr as _paddleocr
            ver = getattr(_paddleocr, "__version__", "0.0.0")
            major = int(ver.split(".")[0])
            logger.info("PaddleOCR version: %s", ver)
            if major < 3:
                # PaddleOCR 2.7.x style
                paddleocr_kwargs["show_log"] = False
                paddleocr_kwargs["use_angle_cls"] = True
                paddleocr_kwargs["use_gpu"] = DEVICE != "cpu"
                paddleocr_kwargs["device"] = paddle_device
            else:
                # PaddleOCR 3.x style
                paddleocr_kwargs["device"] = paddle_device
        except Exception as e:
            logger.debug("Could not detect PaddleOCR version: %s", e)
            # Default to 2.7.x style
            paddleocr_kwargs["show_log"] = False
            paddleocr_kwargs["use_angle_cls"] = True
            paddleocr_kwargs["use_gpu"] = DEVICE != "cpu"
            paddleocr_kwargs["device"] = paddle_device
        
        # Initialize PaddleOCR
        _ocr_instance = PaddleOCR(**paddleocr_kwargs)
        logger.info("PaddleOCR initialized successfully (device=%s)", paddle_device)
        return _ocr_instance
        
    except Exception as exc:
        error_msg = f"Failed to initialize PaddleOCR: {exc}"
        logger.error("%s\n%s", error_msg, traceback.format_exc())
        
        # Provide helpful troubleshooting hints
        if os.name == "nt" and DEVICE == "cpu":
            logger.error(
                "Windows CPU detected. Common issues:\n"
                "  1. oneDNN/PIR errors: Set environment variables BEFORE importing paddle:\n"
                "       set FLAGS_use_onednn=0\n"
                "       set FLAGS_enable_pir_in_executor=0\n"
                "  2. Missing dependencies: pip install paddlepaddle (CPU version)\n"
                "  3. Or skip OCR for now: set SKIP_OCR=1"
            )
        elif DEVICE == "cpu":
            logger.error(
                "CPU mode failed. Try:\n"
                "  1. pip install paddlepaddle (CPU version)\n"
                "  2. Or use GPU if available\n"
                "  3. Or skip OCR for now: set SKIP_OCR=1"
            )
        
        _ocr_init_error = error_msg
        return None


def get_ocr() -> Optional["PaddleOCR"]:
    """Get the PaddleOCR instance, initializing if needed."""
    if _ocr_instance is None and _ocr_init_error is None:
        _init_paddleocr()
    return _ocr_instance


# ─────────────────────────────────────────────────────────────────────────────
# YOLOv8 initialization
# ─────────────────────────────────────────────────────────────────────────────

SKIP_YOLO = os.getenv("SKIP_YOLO", "0") == "1"
_yolo_instance: Optional["YOLO"] = None
_yolo_init_error: Optional[str] = None


def _init_yolo() -> Optional["YOLO"]:
    """
    Initialize YOLOv8 with proper error handling.
    Returns None if initialization fails.
    """
    global _yolo_instance, _yolo_init_error
    
    if _yolo_instance is not None or _yolo_init_error is not None:
        return _yolo_instance
    
    if SKIP_YOLO:
        logger.warning("SKIP_YOLO=1 — YOLOv8 is disabled")
        _yolo_init_error = "DISABLED_VIA_SKIP_YOLO"
        return None
    
    yolo_model_name = os.getenv("YOLO_MODEL", "yolov8n.pt")
    
    try:
        from ultralytics import YOLO
        
        logger.info("Loading YOLOv8 model: %s (device=%s)", yolo_model_name, DEVICE)
        _yolo_instance = YOLO(yolo_model_name)
        _yolo_instance.to(DEVICE)
        
        # Warm-up inference
        logger.info("YOLOv8 warm-up on device %s", DEVICE)
        try:
            _ = _yolo_instance.predict(
                np.zeros((640, 640, 3), dtype=np.uint8),
                verbose=False,
                device=DEVICE,
            )
            logger.info("YOLOv8 warm-up complete")
        except Exception as warmup_exc:
            logger.warning("YOLOv8 warm-up failed (will retry on first request): %s", warmup_exc)
        
        logger.info("YOLOv8 ready (device=%s)", DEVICE)
        return _yolo_instance
        
    except Exception as exc:
        error_msg = f"Failed to initialize YOLOv8: {exc}"
        logger.error("%s\n%s", error_msg, traceback.format_exc())
        
        if DEVICE != "cpu":
            logger.error(
                "GPU mode failed. Try:\n"
                "  1. Check CUDA installation\n"
                "  2. Or run on CPU: set CUDA_DEVICE=cpu\n"
                "  3. Or skip YOLO for now: set SKIP_YOLO=1"
            )
        
        _yolo_init_error = error_msg
        return None


def get_yolo() -> Optional["YOLO"]:
    """Get the YOLO instance, initializing if needed."""
    if _yolo_instance is None and _yolo_init_error is None:
        _init_yolo()
    return _yolo_instance


# ─────────────────────────────────────────────────────────────────────────────
# Result dataclasses
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Candidate:
    plate: str        # sanitized, uppercase, no special chars  e.g. "20AA56789"
    score: float      # 0–100
    rawText: str      # raw PaddleOCR output                e.g. "20-AA 567.89"


@dataclass
class AlprResult:
    success: bool
    candidates: list[Candidate] = field(default_factory=list)
    error: Optional[str] = None
    code: Optional[str] = None
    metadata: dict = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# OCR Normalization utilities
# ─────────────────────────────────────────────────────────────────────────────

ALPHA_MAP = str.maketrans(
    {
        "O": "0", "Q": "0", "D": "0", "I": "1", "L": "1",
        "Z": "2", "S": "5", "G": "6", "B": "8",
    }
)

# Characters allowed in a normalized plate
_PLATE_CHARS = frozenset("ABCDEFGHJKLMNPRSTUVWXYZ0123456789")


def sanitize_plate(raw: str) -> str:
    """Strip noise and convert to uppercase plate-compatible string."""
    if not raw:
        return ""
    # NFKC normalize, drop Vietnamese diacritics
    import unicodedata
    raw = unicodedata.normalize("NFKC", raw).upper()
    raw = raw.translate(ALPHA_MAP)
    # Keep only alphanumeric
    return "".join(c for c in raw if c in _PLATE_CHARS)


def score_from_confidence(confidence: float) -> float:
    """
    Convert PaddleOCR confidence (0–1) to a 0–100 score.
    PaddleOCR already returns 0–1, but we guard against 0–100 input.
    """
    if confidence > 1:
        confidence = confidence / 100.0
    return round(min(max(confidence * 100.0, 0.0), 100.0), 2)


# ─────────────────────────────────────────────────────────────────────────────
# OCR result parsing (handles PaddleOCR's result format)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_ocr_result(ocr_result: list, raw_bytes: bytes) -> list[Candidate]:
    """
    Parse PaddleOCR output into Candidate list.

    PaddleOCR returns:
        [ [ [ [x1,y1],[x2,y2],[x3,y3],[x4,y4] ], (text, confidence) ] ]   # angle=0
        [ [ [ ... ] ] ]                                                    # angle=90
        [ [ [ ... ] ], [ [ ... ] ] ]                                      # multi-line
    """
    candidates: list[Candidate] = []

    for region_group in ocr_result:
        if not region_group:
            continue
        for region in region_group:
            if not region or len(region) < 2:
                continue
            box_info, text_info = region[0], region[1]
            if isinstance(text_info, (list, tuple)) and len(text_info) >= 2:
                raw_text, confidence = text_info[0], text_info[1]
            elif isinstance(text_info, str):
                raw_text, confidence = text_info, 0.5
            else:
                continue

            raw_str = str(raw_text).strip()
            if not raw_str:
                continue

            plate = sanitize_plate(raw_str)
            if not plate:
                continue

            score = score_from_confidence(float(confidence))
            candidates.append(Candidate(plate=plate, score=score, rawText=raw_str))

    # Sort by score descending
    candidates.sort(key=lambda c: c.score, reverse=True)
    return candidates


# ─────────────────────────────────────────────────────────────────────────────
# Image loading helpers
# ─────────────────────────────────────────────────────────────────────────────

def load_image_from_bytes(data: bytes) -> np.ndarray:
    """Decode bytes → BGR numpy array (OpenCV format)."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cv2.imdecode failed — invalid image data")
    return img


def load_image_from_file(file: UploadFile) -> np.ndarray:
    """Read an UploadFile → BGR numpy array."""
    data = file.file.read()
    return load_image_from_bytes(data)


# ─────────────────────────────────────────────────────────────────────────────
# Crop helpers
# ─────────────────────────────────────────────────────────────────────────────

def crop_by_box(img: np.ndarray, box: list[list[float]]) -> np.ndarray:
    """
    Crop a rotated/perspective box from the image.
    box: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]  (PaddleOCR format)
    Returns: cropped + perspective-corrected sub-image.
    """
    points = np.array([[pt[0], pt[1]] for pt in box], dtype=np.float32)

    # Sort points: top-left, top-right, bottom-right, bottom-left
    rect = np.zeros((4, 2), dtype=np.float32)
    s = points.sum(axis=1)
    rect[0] = points[np.argmin(s)]
    rect[2] = points[np.argmax(s)]
    diff = np.diff(points, axis=1)
    rect[1] = points[np.argmin(diff)]
    rect[3] = points[np.argmax(diff)]

    (tl, tr, br, bl) = rect
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    max_w = int(max(width_a, width_b))
    max_h = int(max(height_a, height_b))

    dst = np.array([[0, 0], [max_w - 1, 0], [max_w - 1, max_h - 1], [0, max_h - 1]], dtype=np.float32)
    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(img, M, (max_w, max_h))


# ─────────────────────────────────────────────────────────────────────────────
# ALPR Service (loaded once at startup)
# ─────────────────────────────────────────────────────────────────────────────

class AlprService:
    """
    YOLOv8 detection + PaddleOCR OCR pipeline.
    Models are loaded once when the app starts.
    """

    def __init__(self) -> None:
        # Initialize models (already done at module level, but we verify here)
        self.yolo = get_yolo()
        self.ocr = get_ocr()
        
        # Check for initialization errors
        errors = []
        if self.yolo is None:
            errors.append(f"YOLOv8: {_yolo_init_error or 'Not initialized'}")
        if self.ocr is None:
            errors.append(f"PaddleOCR: {_ocr_init_error or 'Not initialized'}")
        
        if errors:
            logger.warning("ALPR service started with errors: %s", "; ".join(errors))
        else:
            logger.info("ALPR service initialized — both models loaded successfully")

    # ------------------------------------------------------------------
    # Core recognition
    # ------------------------------------------------------------------

    def recognize(
        self,
        img: np.ndarray,
        plate_hint: str | None = None,
    ) -> AlprResult:
        """
        Run the full ALPR pipeline on a BGR image.

        Pipeline:
          1. Detection (YOLOv8) → plate region(s)
          2. OCR (PaddleOCR) on each crop + full image
          3. Merge candidates, sort by score
          4. If plate_hint provided: boost / inject hint candidate
        """
        t0 = time.perf_counter()

        # ── Step 1: Detection ─────────────────────────────────────────
        det_ms = 0.0
        crops: list[np.ndarray] = []

        if self.yolo is not None:
            try:
                det_start = time.perf_counter()
                results = self.yolo.predict(
                    img,
                    verbose=False,
                    conf=0.25,
                    iou=0.45,
                    device=DEVICE,
                )
                det_ms = (time.perf_counter() - det_start) * 1000

                for result in results:
                    boxes = result.boxes
                    if boxes is None or len(boxes) == 0:
                        continue

                    for box in boxes:
                        # xyxy pixel coords
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        # Add 5% padding around the detection
                        pad_x = int((x2 - x1) * 0.05)
                        pad_y = int((y2 - y1) * 0.05)
                        x1_p = max(0, x1 - pad_x)
                        y1_p = max(0, y1 - pad_y)
                        x2_p = min(img.shape[1], x2 + pad_x)
                        y2_p = min(img.shape[0], y2 + pad_y)
                        crop = img[y1_p:y2_p, x1_p:x2_p]
                        crops.append(crop)

                logger.debug(
                    "Detection done in %.1fms — %d plate region(s) found", det_ms, len(crops)
                )
            except Exception as exc:
                logger.warning("Detection step failed (continuing with crops=%d): %s", len(crops), exc)
        else:
            logger.warning("YOLOv8 not available — skipping detection, will OCR full image")

        # ── Step 2: OCR ─────────────────────────────────────────────────
        ocr_ms = 0.0
        all_candidates: list[Candidate] = []

        if self.ocr is not None:
            try:
                ocr_start = time.perf_counter()

                # OCR each detected crop (PaddleOCR 3.x: no cls arg; 2.x used cls=True)
                for crop in crops:
                    try:
                        # On Windows CPU, resize large crops to avoid oneDNN errors
                        ocr_crop = crop
                        if os.name == "nt" and DEVICE == "cpu":
                            ch, cw = crop.shape[:2]
                            if ch > 800 or cw > 800:
                                scale = 800 / max(ch, cw)
                                ocr_crop = cv2.resize(crop, (int(cw*scale), int(ch*scale)), interpolation=cv2.INTER_AREA)
                                logger.debug("Resized crop for OCR: %dx%d → %dx%d", cw, ch, ocr_crop.shape[1], ocr_crop.shape[0])
                        
                        ocr_result = self.ocr.ocr(ocr_crop)
                        if ocr_result and ocr_result[0]:
                            parsed = _parse_ocr_result(ocr_result, b"")
                            all_candidates.extend(parsed)
                            logger.debug("Crop OCR → %d candidate(s)", len(parsed))
                    except Exception as crop_exc:
                        error_str = str(crop_exc)
                        if "ConvertPirAttribute2RuntimeAttribute" in error_str or "onednn" in error_str.lower():
                            logger.warning("Crop OCR failed due to oneDNN error (Windows CPU): %s", error_str[:150])
                        else:
                            logger.debug("Crop OCR failed: %s", crop_exc)
                        continue

                # Also OCR the full image (catches LP missed by detector)
                # On Windows CPU, prefer center crop over full-image to avoid oneDNN errors
                # Strategy:
                #   1. If we have crops and candidates → skip full-image OCR (avoid oneDNN)
                #   2. If no crops → try center crop first (safer than full-image)
                #   3. If center crop fails → try resized full-image as last resort
                
                should_skip_full = (
                    os.name == "nt" and 
                    DEVICE == "cpu" and 
                    len(all_candidates) > 0 and 
                    len(crops) > 0
                )
                
                if should_skip_full:
                    logger.debug("Skipping full-image OCR on Windows CPU (already have %d candidates from %d crops)", len(all_candidates), len(crops))
                elif len(crops) == 0:
                    # No YOLO detections — try center crop first (safer on Windows CPU)
                    logger.info("No YOLO detections — trying center crop OCR (Windows CPU workaround)")
                    try:
                        h, w = img.shape[:2]
                        # Crop center 60% of image (where plate usually is)
                        center_crop = img[int(h*0.2):int(h*0.8), int(w*0.2):int(w*0.8)]
                        ch, cw = center_crop.shape[:2]
                        # Resize if too large (oneDNN workaround)
                        if ch > 800 or cw > 800:
                            scale = 800 / max(ch, cw)
                            center_crop = cv2.resize(center_crop, (int(cw*scale), int(ch*scale)), interpolation=cv2.INTER_AREA)
                            logger.debug("Resized center crop: %dx%d → %dx%d", cw, ch, center_crop.shape[1], center_crop.shape[0])
                        
                        center_result = self.ocr.ocr(center_crop)
                        if center_result and center_result[0]:
                            parsed = _parse_ocr_result(center_result, b"")
                            all_candidates.extend(parsed)
                            logger.info("Center crop OCR → %d candidate(s)", len(parsed))
                        else:
                            logger.warning("Center crop OCR returned no text")
                    except Exception as center_exc:
                        error_str = str(center_exc)
                        if "ConvertPirAttribute2RuntimeAttribute" in error_str or "onednn" in error_str.lower():
                            logger.warning("Center crop OCR failed due to oneDNN error — trying resized full-image as last resort")
                            # Last resort: try resized full-image
                            try:
                                h, w = img.shape[:2]
                                max_dim = 1280  # Smaller resize for Windows CPU
                                if h > max_dim or w > max_dim:
                                    scale = max_dim / max(h, w)
                                    resized = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
                                    logger.debug("Resized full image: %dx%d → %dx%d", w, h, resized.shape[1], resized.shape[0])
                                    resized_result = self.ocr.ocr(resized)
                                    if resized_result and resized_result[0]:
                                        parsed = _parse_ocr_result(resized_result, b"")
                                        all_candidates.extend(parsed)
                                        logger.info("Resized full-image OCR → %d candidate(s)", len(parsed))
                            except Exception as resize_exc:
                                logger.error("Resized full-image OCR also failed: %s", resize_exc)
                        else:
                            logger.warning("Center crop OCR failed: %s", center_exc)
                else:
                    # We have crops but no candidates yet — try resized full-image
                    logger.debug("Have crops but no candidates yet — trying resized full-image OCR")
                    try:
                        h, w = img.shape[:2]
                        max_dim = 1920
                        if h > max_dim or w > max_dim:
                            scale = max_dim / max(h, w)
                            ocr_img = cv2.resize(img, (int(w*scale), int(h*scale)), interpolation=cv2.INTER_AREA)
                            logger.debug("Resized image for OCR: %dx%d → %dx%d", w, h, ocr_img.shape[1], ocr_img.shape[0])
                        else:
                            ocr_img = img
                        
                        full_result = self.ocr.ocr(ocr_img)
                        if full_result and full_result[0]:
                            parsed = _parse_ocr_result(full_result, b"")
                            all_candidates.extend(parsed)
                            logger.debug("Full-image OCR → %d candidate(s)", len(parsed))
                    except Exception as full_exc:
                        error_str = str(full_exc)
                        if "ConvertPirAttribute2RuntimeAttribute" in error_str or "onednn" in error_str.lower():
                            logger.warning("Full-image OCR failed due to oneDNN error (Windows CPU) — continuing with crop candidates only")
                        else:
                            logger.warning("Full-image OCR failed: %s", full_exc)

                ocr_ms = (time.perf_counter() - ocr_start) * 1000
                logger.debug("OCR done in %.1fms — %d total candidate(s)", ocr_ms, len(all_candidates))

            except Exception as exc:
                logger.warning("OCR step failed: %s", exc)
                logger.debug("OCR error traceback:\n%s", traceback.format_exc())
                
                # Check for specific errors
                error_msg = str(exc)
                if "ConvertPirAttribute2RuntimeAttribute" in error_msg:
                    logger.error("PaddleOCR PIR error — try setting FLAGS_enable_pir_in_executor=0")
                elif "onednn" in error_msg.lower():
                    logger.error("PaddleOCR oneDNN error — try setting FLAGS_use_onednn=0")
        else:
            logger.warning("PaddleOCR not available — no OCR performed")

        # ── Step 3: Deduplicate & merge ─────────────────────────────────
        # Keep highest-scoring candidate per normalised plate string
        seen: dict[str, Candidate] = {}
        for c in all_candidates:
            key = c.plate
            if key not in seen or c.score > seen[key].score:
                seen[key] = c

        final_candidates = sorted(seen.values(), key=lambda c: c.score, reverse=True)

        # ── Step 4: Inject hint if provided ──────────────────────────────
        if plate_hint:
            hint_normalized = sanitize_plate(plate_hint)
            if hint_normalized:
                hint_raw = plate_hint.strip()
                # Check if hint already present
                if not any(c.plate == hint_normalized for c in final_candidates):
                    # Insert hint as a high-confidence candidate
                    final_candidates.insert(
                        0, Candidate(plate=hint_normalized, score=99.0, rawText=hint_raw)
                    )
                    logger.info("Plate hint injected: %s (%s)", hint_normalized, hint_raw)
                else:
                    # Boost existing candidate
                    for c in final_candidates:
                        if c.plate == hint_normalized:
                            c.score = max(c.score, 99.0)
                            c.rawText = hint_raw
                    final_candidates.sort(key=lambda c: c.score, reverse=True)

        total_ms = (time.perf_counter() - t0) * 1000
        metadata = {
            "detectionMs": round(det_ms, 1),
            "ocrMs": round(ocr_ms, 1),
            "totalMs": round(total_ms, 1),
            "device": DEVICE,
            "yoloAvailable": self.yolo is not None,
            "ocrAvailable": self.ocr is not None,
            "cropsDetected": len(crops),
            "candidatesReturned": len(final_candidates),
        }

        if not final_candidates:
            # Determine error message based on what's available
            if self.yolo is None and self.ocr is None:
                return AlprResult(
                    success=False,
                    error="ALPR service unavailable (both YOLOv8 and PaddleOCR failed to initialize).",
                    code="SERVICE_UNAVAILABLE",
                    metadata=metadata,
                )
            elif self.ocr is None:
                return AlprResult(
                    success=False,
                    error="OCR unavailable — PaddleOCR failed to initialize.",
                    code="OCR_UNAVAILABLE",
                    metadata=metadata,
                )
            else:
                return AlprResult(
                    success=False,
                    error="Không tìm thấy biển số trong ảnh.",
                    code="NO_DETECTION",
                    metadata=metadata,
                )

        return AlprResult(success=True, candidates=final_candidates, metadata=metadata)


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Parkly ALPR Service",
    description="GPU-accelerated license plate recognition (YOLOv8 + PaddleOCR)",
    version="1.0.0",
)

# Load models ONCE at startup
logger.info("=" * 60)
logger.info("Starting Parkly ALPR Service...")
logger.info("Device: %s", DEVICE)
logger.info("Log Level: %s", LOG_LEVEL)
logger.info("=" * 60)

# Pre-initialize models at startup (will fail fast if there's a problem)
_init_yolo()
_init_paddleocr()

try:
    alpr_service = AlprService()
    logger.info("ALPR service ready")
except Exception as exc:
    logger.critical("Failed to initialise ALPR service: %s\n%s", exc, traceback.format_exc())
    # Don't raise — allow server to start so we can check health endpoint
    alpr_service = None


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Lightweight health check with model status."""
    yolo_ok = get_yolo() is not None
    ocr_ok = get_ocr() is not None
    
    return {
        "status": "ok" if (yolo_ok or ocr_ok) else "degraded",
        "device": DEVICE,
        "models": {
            "yolo": {
                "available": yolo_ok,
                "error": _yolo_init_error,
                "model": os.getenv("YOLO_MODEL", "yolov8n.pt"),
            },
            "paddleocr": {
                "available": ocr_ok,
                "error": _ocr_init_error,
                "lang": os.getenv("OCR_LANG", "en"),
            },
        },
        "flags": {
            "skip_yolo": SKIP_YOLO,
            "skip_ocr": SKIP_OCR,
        },
    }


@app.get("/")
async def root():
    """Service info."""
    return {
        "service": "Parkly ALPR",
        "version": "1.0.0",
        "device": DEVICE,
        "endpoints": {
            "health": "/health",
            "predict": "/predict/",
        },
    }


def _check_bearer(authorization: Annotated[str | None, Header()] = None) -> None:
    """Verify Bearer token if BEARER_TOKEN env var is set."""
    token = os.getenv("BEARER_TOKEN", "").strip()
    if not token:
        return  # No auth configured
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, credentials = authorization.partition(" ")
    if scheme.lower() != "bearer" or credentials != token:
        raise HTTPException(status_code=401, detail="Invalid Bearer token")


@app.post("/predict/")
async def predict(
    request: Request,
    file: UploadFile | None = None,
    imageUrl: str | None = None,
    imagePath: str | None = None,
    plateHint: str | None = None,
    _auth: None = Depends(_check_bearer),
):
    """
    Recognise license plate(s) from an image.

    Supports three image sources (checked in order):
      1. file  — multipart file upload (recommended for direct POST)
      2. imageUrl — URL to fetch the image from (server must have network access)
      3. imagePath — absolute path on the server filesystem

    Accepts:
      - application/json: { "imageUrl": "...", "imagePath": "...", "plateHint": "..." }
      - multipart/form-data: file, imageUrl, imagePath, plateHint as form fields
    """
    # Check if service is available
    if alpr_service is None:
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": "ALPR service failed to initialize",
                "code": "SERVICE_UNAVAILABLE",
                "metadata": {
                    "yoloError": _yolo_init_error,
                    "ocrError": _ocr_init_error,
                },
            },
        )

    # Parkly API sends application/json with imageUrl; FastAPI does not inject JSON into query/form params
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            body = await request.json()
            if body:
                imageUrl = imageUrl or (body.get("imageUrl") or "").strip() or None
                imagePath = imagePath or (body.get("imagePath") or "").strip() or None
                plateHint = plateHint or (body.get("plateHint") or "").strip() or None
        except Exception as e:
            logger.warning("Failed to parse JSON body: %s", e)

    # ── Load image ────────────────────────────────────────────────────────
    img: np.ndarray | None = None

    if file is not None and (file.filename or getattr(file, "size", 0)):
        logger.debug("Received file upload: %s (%s)", file.filename, getattr(file, "content_type", ""))
        img = await _load_from_upload(file)

    elif imageUrl:
        logger.debug("Fetching image from URL: %s", imageUrl)
        img = await _load_from_url(imageUrl)

    elif imagePath:
        logger.debug("Loading image from path: %s", imagePath)
        img = _load_from_path(imagePath)

    else:
        raise HTTPException(
            status_code=400,
            detail="Must provide one of: file (multipart), imageUrl, or imagePath.",
        )

    # ── Run ALPR ──────────────────────────────────────────────────────────
    try:
        result = alpr_service.recognize(img, plate_hint=plateHint)
    except Exception as exc:
        logger.exception("ALPR pipeline error: %s", exc)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"ALPR pipeline error: {exc}",
                "code": "PIPELINE_ERROR",
                "metadata": {},
            },
        )

    # ── Serialise response ────────────────────────────────────────────────
    status_code = 200 if result.success else 422

    return JSONResponse(
        status_code=status_code,
        content={
            "success": result.success,
            "error": result.error,
            "code": result.code,
            "candidates": [
                {
                    "plate": c.plate,
                    "score": c.score,
                    "rawText": c.rawText,
                }
                for c in result.candidates
            ],
            "metadata": result.metadata,
        },
    )


# ─────────────────────────────────────────────────────────────────────────────
# Image loading helpers (per-request)
# ─────────────────────────────────────────────────────────────────────────────

async def _load_from_upload(file: UploadFile) -> np.ndarray:
    """Read multipart UploadFile → BGR image."""
    allowed = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
    ct = (file.content_type or "").lower()
    if ct not in allowed and not ct.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"Unsupported content-type: {ct}")

    data = await file.read()
    # Guard against giant uploads
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit")

    try:
        return load_image_from_bytes(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


async def _load_from_url(url: str) -> np.ndarray:
    """Fetch a remote image URL → BGR image."""
    import httpx
    # Increase timeout for slow networks or large images (especially on CPU)
    timeout_seconds = 30.0 if DEVICE == "cpu" else 10.0
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            if len(resp.content) > 20 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit")
            return load_image_from_bytes(resp.content)
    except httpx.TimeoutException as exc:
        logger.error("Image fetch timeout after %.1fs: %s", timeout_seconds, url)
        raise HTTPException(status_code=408, detail=f"Image fetch timeout after {timeout_seconds}s: {exc}")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=f"URL fetch failed: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not load image from URL: {exc}")


def _load_from_path(path: str) -> np.ndarray:
    """Read a file path → BGR image."""
    if not os.path.isabs(path):
        raise HTTPException(status_code=400, detail="imagePath must be an absolute path")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    try:
        data = open(path, "rb").read()
        if len(data) > 20 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit")
        return load_image_from_bytes(data)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read image from path: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8765"))
    logger.info("Starting server %s:%s (device=%s)", host, port, DEVICE)
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        workers=1 if os.name != "nt" else 1,
        loop="asyncio" if os.name == "nt" else "auto",
        log_level=LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    main()
