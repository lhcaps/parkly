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
  OCR_LANG        en / ch  (default en)
  LOG_LEVEL       INFO / DEBUG  (default INFO)
  BEARER_TOKEN    If set, all /predict/ requests must send Authorization: Bearer <token>
"""

from __future__ import annotations

import io
import logging
import os
import time
import traceback
from dataclasses import dataclass, field
from typing import Optional, Annotated

# Disable oneDNN/MKLDNN on Windows CPU to avoid "ConvertPirAttribute2RuntimeAttribute not support" errors
if os.name == "nt":
    os.environ.setdefault("FLAGS_use_mkldnn", "0")
    os.environ.setdefault("FLAGS_use_onednn", "0")

from fastapi import Depends, HTTPException, Header, Request

import cv2
import numpy as np
import torch
import uvicorn
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
# Set Paddle flags before PaddleOCR loads paddle (reduces oneDNN errors on Windows CPU)
try:
    import paddle
    if os.name == "nt":
        try:
            paddle.set_flags({"FLAGS_use_mkldnn": False})
        except Exception:
            pass
except Exception:
    pass
from paddleocr import PaddleOCR
from ultralytics import YOLO

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("alpr")
logger.setLevel(LOG_LEVEL)


# ─────────────────────────────────────────────────────────────────────────────
# Device resolution
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_device() -> str:
    """Return the best available compute device string."""
    if torch.cuda.is_available():
        device_env = os.getenv("CUDA_DEVICE", "cuda:0")
        gpu_id = int(device_env.split(":")[1]) if ":" in device_env else 0
        gpu_name = torch.cuda.get_device_name(gpu_id)
        logger.info("CUDA available — using GPU %s (%s)", device_env, gpu_name)
        return device_env
    logger.warning("CUDA not available — running on CPU (slow, dev only)")
    return "cpu"


DEVICE = _resolve_device()


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
        yolo_model_name = os.getenv("YOLO_MODEL", "yolov8n.pt")
        ocr_lang = os.getenv("OCR_LANG", "en")

        logger.info("Loading YOLOv8 model: %s (device=%s)", yolo_model_name, DEVICE)
        self.yolo = YOLO(yolo_model_name)
        self.yolo.to(DEVICE)
        logger.info("YOLOv8 warm-up on device %s", DEVICE)
        _ = self.yolo.predict(
            np.zeros((640, 640, 3), dtype=np.uint8),
            verbose=False,
            device=DEVICE,
        )

        logger.info("Loading PaddleOCR (lang=%s, device=%s)", ocr_lang, DEVICE)
        # PaddleOCR 3.x: use "device" ("gpu:0" / "cpu"), not "use_gpu"
        paddle_device = "cpu" if DEVICE == "cpu" else "gpu:" + (DEVICE.split(":")[-1] if ":" in DEVICE else "0")
        paddleocr_kwargs: dict = {
            "lang": ocr_lang,
            "device": paddle_device,
        }
        # PaddleOCR 2.x: use_angle_cls, use_gpu, show_log
        try:
            import paddleocr as _paddleocr
            ver = getattr(_paddleocr, "__version__", "0.0.0")
            major = int(ver.split(".")[0])
            if major < 3:
                paddleocr_kwargs["use_angle_cls"] = True
                paddleocr_kwargs["use_gpu"] = DEVICE != "cpu"
                paddleocr_kwargs["show_log"] = False
        except Exception:
            pass
        self.ocr = PaddleOCR(**paddleocr_kwargs)
        logger.info("PaddleOCR ready (device=%s)", DEVICE)

        logger.info("ALPR service initialised — models loaded")

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

        # ── Step 2: OCR ─────────────────────────────────────────────────
        ocr_ms = 0.0
        all_candidates: list[Candidate] = []

        try:
            ocr_start = time.perf_counter()

            # OCR each detected crop (PaddleOCR 3.x: no cls arg; 2.x used cls=True)
            for crop in crops:
                ocr_result = self.ocr.ocr(crop)
                if ocr_result and ocr_result[0]:
                    parsed = _parse_ocr_result(ocr_result, b"")
                    all_candidates.extend(parsed)
                    logger.debug("Crop OCR → %d candidate(s)", len(parsed))

            # Also OCR the full image (catches LP missed by detector)
            full_result = self.ocr.ocr(img)
            if full_result and full_result[0]:
                parsed = _parse_ocr_result(full_result, b"")
                all_candidates.extend(parsed)
                logger.debug("Full-image OCR → %d candidate(s)", len(parsed))

            ocr_ms = (time.perf_counter() - ocr_start) * 1000
            logger.debug("OCR done in %.1fms — %d total candidate(s)", ocr_ms, len(all_candidates))

        except Exception as exc:
            logger.warning("OCR step failed: %s", exc)
            # Fall back to hint-only
            all_candidates = []

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
            "cropsDetected": len(crops),
            "candidatesReturned": len(final_candidates),
        }

        if not final_candidates:
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
logger.info("Starting Parkly ALPR Service...")
try:
    alpr_service = AlprService()
    logger.info("ALPR service ready")
except Exception as exc:
    logger.critical("Failed to initialise ALPR service: %s\n%s", exc, traceback.format_exc())
    raise


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Lightweight health check (no GPU needed)."""
    return {
        "status": "ok",
        "device": DEVICE,
        "yolo_model": os.getenv("YOLO_MODEL", "yolov8n.pt"),
        "ocr_lang": os.getenv("OCR_LANG", "en"),
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
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            if len(resp.content) > 20 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="Image exceeds 20 MB limit")
            return load_image_from_bytes(resp.content)
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
