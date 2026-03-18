# Parkly ALPR Service
GPU-accelerated license plate recognition microservice using **YOLOv8** + **PaddleOCR**.

## Python version

**Python 3.12+** — PaddlePaddle 3.x và PaddleOCR 3.x đã có wheel chính thức cho Python 3.12 trên PyPI. Không cần dùng Python 3.11.

```bash
# Windows: tạo venv với Python 3.12 đã có sẵn
py -3.12 -m venv .venv
.venv\Scripts\activate

# Linux/macOS
python3.12 -m venv .venv
source .venv/bin/activate
```

## Architecture

```
Mobile Camera
    │  POST /api/mobile-capture/upload  (pair token)
    ▼
Parkly API  (Node.js / Express)
    │
    │  ALPR_MODE=TESSERACT + ALPR_PROVIDER_ORDER=LOCAL,HTTP
    │
    ├── LOCAL Tesseract (fast pass)
    │       └── if result.valid && score >= 86  →  done
    │
    └── HTTP  →  POST http://localhost:8765/predict/   (YOLOv8 + PaddleOCR)
                    │
                    ├── YOLOv8  ──► crop LP region
                    └── PaddleOCR ──► OCR on crop  ──► "20AA56789"
```

## Quick Start

### 1. Install dependencies

Requires **Python 3.12+**, and for GPU: **CUDA 11.x**, **cuDNN 8.x**.

```bash
cd services/alpr

# Activate Python 3.12 venv first, then:

# GPU (CUDA) — PaddlePaddle GPU build
pip install -r requirements.txt

# CPU fallback (dev only — slow)
pip install -r requirements-cpu.txt
```

### 2. Start the service

```bash
# Download YOLOv8n weights (first run only ~6 MB)
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

python main.py
# Logs:  YOLOv8 warm-up, PaddleOCR ready, models loaded
# Listens on 0.0.0.0:8765
```

### 3. Verify

```bash
curl http://localhost:8765/health
# {"status":"ok","device":"cuda:0","yolo_model":"yolov8n.pt","ocr_lang":"en"}
```

### 4. Test with an image

```bash
curl -X POST http://localhost:8765/predict/ \
  -F "file=@/path/to/car.jpg"
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `8765` | TCP port |
| `CUDA_DEVICE` | `cuda:0` | GPU device (use `cuda:1` for second GPU) |
| `YOLO_MODEL` | `yolov8n.pt` | YOLOv8 model file. Use a fine-tuned plate-detection model for best accuracy |
| `OCR_LANG` | `en` | PaddleOCR language (`en`, `ch`, ...) |
| `BEARER_TOKEN` | _(none)_ | If set, all `/predict/` requests require `Authorization: Bearer <token>` |
| `LOG_LEVEL` | `INFO` | `DEBUG` for verbose per-request logging |
| `FLAGS_use_mkldnn` | `0` on Windows | On Windows CPU the service sets this to `0` to avoid oneDNN "Unimplemented" errors. Override with `1` only if your build supports it. |

## Parkly API Integration

In `apps/api/.env`:

```env
ALPR_MODE=TESSERACT
ALPR_PROVIDER_ORDER=LOCAL,HTTP
ALPR_HTTP_PROVIDER_URL=http://localhost:8765/predict/
ALPR_HTTP_PROVIDER_TOKEN=   # match BEARER_TOKEN above if set
```

When the local Tesseract result is **not** `STRICT_VALID` or score < 86,
the API automatically escalates to this service.

## Custom YOLOv8 Model (recommended for production)

The default `yolov8n.pt` is a general object detector. For production,
train a dedicated plate detection model:

```bash
# Train (example — replace with your annotated dataset)
yolo detect train data=plates.yaml model=yolov8n.pt epochs=100

# Export to ONNX or PyTorch
yolo export model=runs/detect/train/weights/best.pt format=pt

# Use it
YOLO_MODEL=runs/detect/train/weights/best.pt python main.py
```

Place the `.pt` file in `services/alpr/` and set `YOLO_MODEL=best.pt`.

## API Reference

### `GET /health`

```json
{
  "status": "ok",
  "device": "cuda:0",
  "yolo_model": "yolov8n.pt",
  "ocr_lang": "en"
}
```

### `POST /predict/`

**Form fields** (one required):

| Field | Type | Description |
|---|---|---|
| `file` | `UploadFile` | Image file (JPEG/PNG/WebP/BMP) |
| `imageUrl` | `string` | HTTP(S) URL of the image |
| `imagePath` | `string` | Absolute path to image file on server |
| `plateHint` | `string` | Known plate text — injected as top candidate if OCR misses |

**Success response** (200):

```json
{
  "success": true,
  "candidates": [
    {
      "plate": "20AA56789",
      "score": 95.2,
      "rawText": "20-AA 567.89"
    }
  ],
  "metadata": {
    "detectionMs": 8.4,
    "ocrMs": 22.1,
    "totalMs": 31.2,
    "device": "cuda:0",
    "cropsDetected": 1,
    "candidatesReturned": 1
  }
}
```

**No detection** (422):

```json
{
  "success": false,
  "error": "Không tìm thấy biển số trong ảnh.",
  "code": "NO_DETECTION",
  "metadata": { ... }
}
```
