# 🅿️ Parkly - Hướng Dẫn Cài Đặt Chi Tiết

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài đặt môi trường](#2-cài-đặt-môi-trường)
3. [Cấu hình Database & Redis](#3-cấu-hình-database--redis)
4. [Cài đặt Backend API](#4-cài-đặt-backend-api)
5. [Cài đặt Frontend Web](#5-cài-đặt-frontend-web)
6. [Chạy dự án](#6-chạy-dự-án)
7. [Kiểm tra hoạt động](#7-kiểm-tra-hoạt-động)
8. [Các lệnh hữu ích](#8-các-lệnh-hữu-ích)
9. [Xử lý sự cố](#9-xử-lý-sự-cố)
10. [Triển khai ALPR (Optional)](#10-triển-khai-alpr-optional)

---

## 1. Yêu cầu hệ thống

### Phần mềm bắt buộc

| Phần mềm | Phiên bản tối thiểu | Mục đích |
|----------|---------------------|----------|
| **Node.js** | v20.x LTS | Runtime cho frontend web |
| **pnpm** | v10.x | Package manager (quản lý monorepo) |
| **Docker Desktop** | Latest | Chạy MySQL, Redis, MinIO |
| **Git** | Latest | Version control |

### Phần mềm khuyến nghị

| Phần mềm | Mục đích |
|----------|----------|
| VS Code | Code editor chính |
| TablePlus / DBeaver | Truy cập MySQL database |
| Redis Commander / Another Redis Desktop | Truy cập Redis cache |

### Phần cứng tối thiểu

- **RAM**: 8GB (16GB khuyến nghị)
- **Ổ cứng**: 20GB trống
- **CPU**: 4 cores

---

## 2. Cài đặt môi trường

### 2.1 Cài đặt Node.js

```bash
# Windows - Dùng nvm-windows
# Download: https://github.com/coreybutler/nvm-windows/releases

# Sau khi cài nvm, chạy:
nvm install 20
nvm use 20

# Kiểm tra:
node --version  # Should show v20.x.x
npm --version
```

### 2.2 Cài đặt pnpm

```bash
# Cách 1: Dùng npm
npm install -g pnpm

# Cách 2: Dùng Corepack (khuyến nghị - có sẵn từ Node.js 16.10)
corepack enable
corepack prepare pnpm@10 --activate

# Kiểm tra:
pnpm --version  # Should show 10.x.x
```

### 2.3 Cài đặt Docker Desktop

1. Download Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Cài đặt và khởi động Docker Desktop
3. Đợi Docker daemon khởi động xong (icon màu xanh)

### 2.4 Clone dự án

```bash
# Clone repository
git clone <your-repo-url> parkly
cd parkly

# Hoặc nếu đã có sẵn:
cd parkly
```

---

## 3. Cấu hình Database & Redis

### 3.1 Khởi động Docker containers

```bash
# Từ thư mục gốc của dự án
cd parkly

# Chạy MySQL và Redis (tối thiểu)
pnpm --dir apps/api compose:up:local

# Hoặc với MinIO (nếu cần test object storage)
pnpm --dir apps/api compose:up:rc
```

### 3.2 Kiểm tra containers đang chạy

```bash
# Xem containers
docker ps

# Output mong đợi:
# CONTAINER ID   IMAGE           STATUS          PORTS
# xxxxxxxx        mysql:8.4       Up 2 minutes    0.0.0.0:3306->3306
# xxxxxxxx        redis:7.4       Up 2 minutes    0.0.0.0:6379->6379
```

### 3.3 Tạo database schema

```bash
# Chạy migrations (Flyway)
pnpm --dir apps/api db:migrate

# Apply grants cho app user
pnpm --dir apps/api db:grant:app

# Seed dữ liệu mẫu
pnpm --dir apps/api db:seed:min
```

---

## 4. Cài đặt Backend API

### 4.1 Copy và cấu hình .env

```bash
# Từ thư mục apps/api
cd apps/api

# Copy file env example
cp .env.example .env

# Hoặc tạo thủ công với nội dung tối thiểu:
```

### 4.2 Nội dung .env tối thiểu (apps/api/.env)

```env
# Core HTTP
API_HOST=127.0.0.1
API_PORT=3000
API_PREFIX=/api
API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# Auth - Demo mode
API_AUTH_MODE=ON
API_AUTH_BOOTSTRAP_PROFILE=DEMO
API_AUTH_DEMO_SEED_CREDENTIALS=ON

# Database
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=parking_app
DATABASE_PASSWORD=AppPassword@123
DATABASE_NAME=parking_mgmt
DATABASE_URL=mysql://parking_app:AppPassword%40123@127.0.0.1:3306/parking_mgmt

# Database Admin
DATABASE_ADMIN_HOST=127.0.0.1
DATABASE_ADMIN_PORT=3306
DATABASE_ADMIN_USER=parking_root
DATABASE_ADMIN_PASSWORD=RootPassword@123
DATABASE_ADMIN_NAME=parking_mgmt
DATABASE_URL_ADMIN=mysql://parking_root:RootPassword%40123@127.0.0.1:3306/parking_mgmt

# Redis
REDIS_URL=redis://127.0.0.1:6379
REDIS_PREFIX=parkly:development
REDIS_DB=0
REDIS_REQUIRED=ON

# Media (LOCAL = dùng ổ cứng, không cần MinIO)
MEDIA_STORAGE_DRIVER=LOCAL

# Demo site
DEMO_SITE_CODE=SITE_HCM_01
PARKLY_DEPLOYMENT_PROFILE=DEMO
```

### 4.3 Cài đặt dependencies

```bash
# Từ thư mục gốc của dự án
cd parkly
pnpm install
```

---

## 5. Cài đặt Frontend Web

### 5.1 Copy và cấu hình .env

```bash
# Từ thư mục apps/web
cd apps/web

# Copy file env example
cp .env.example .env
```

### 5.2 Nội dung .env tối thiểu (apps/web/.env)

```env
# Để trống = dùng Vite proxy (dev mode)
VITE_API_BASE_URL=

# Hoặc chỉ định API URL trực tiếp:
# VITE_API_BASE_URL=http://127.0.0.1:3000

# Public web origin cho QR code
VITE_PUBLIC_WEB_ORIGIN=http://localhost:5173
```

---

## 6. Chạy dự án

### 6.1 Chạy toàn bộ dự án (Khuyến nghị)

```bash
# Terminal 1: Chạy Backend API
pnpm dev:api

# Terminal 2: Chạy Frontend Web
pnpm dev:web
```

### 6.2 Chạy riêng lẻ

**Backend API:**
```bash
cd parkly
pnpm dev:api
# API sẽ chạy tại: http://127.0.0.1:3000
```

**Frontend Web:**
```bash
cd parkly
pnpm dev:web
# Web sẽ chạy tại: http://localhost:5173
```

### 6.3 Docker containers

```bash
# Chỉ chạy database services (nếu chưa chạy)
docker compose -f infra/docker/docker-compose.local.yml up -d mysql redis
```

---

## 7. Kiểm tra hoạt động

### 7.1 Truy cập ứng dụng

1. **Frontend Web**: http://localhost:5173
2. **Backend API Health**: http://127.0.0.1:3000/api/health
3. **API Documentation**: http://127.0.0.1:3000/api/docs

### 7.2 Đăng nhập demo

```
Username: ops
Password: Parkly@123
```

Hoặc các tài khoản demo khác:

| Username | Password | Role |
|----------|----------|------|
| ops | Parkly@123 | OPS |
| admin | Parkly@123 | ADMIN |
| guard | Parkly@123 | GUARD |
| cashier | Parkly@123 | CASHIER |

### 7.3 Kiểm tra các endpoint

```bash
# Health check
curl http://127.0.0.1:3000/api/health

# Login
curl -X POST http://127.0.0.1:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ops","password":"Parkly@123"}'

# Sites
curl http://127.0.0.1:3000/api/sites \
  -H "Authorization: Bearer <your-token>"
```

---

## 8. Các lệnh hữu ích

### 8.1 Database Commands

```bash
# Run migrations
pnpm --dir apps/api db:migrate

# Seed data
pnpm --dir apps/api db:seed:min      # Minimal seed
pnpm --dir apps/api db:seed:big      # Full seed

# Reset database
pnpm --dir apps/api db:seed:reset

# Apply grants
pnpm --dir apps/api db:grant:app

# View database info
pnpm --dir apps/api db:info

# Validate migrations
pnpm --dir apps/api db:validate
```

### 8.2 Build Commands

```bash
# Build frontend web
pnpm build:web

# Type check
pnpm typecheck:api

# Prisma generate (sau khi thay đổi schema)
pnpm prisma:generate
```

### 8.3 Test Commands

```bash
# Chạy unit tests (Backend)
pnpm --dir apps/api test:pr02

# Chạy tất cả tests
pnpm --dir apps/api test:pr01
pnpm --dir apps/api test:pr02
pnpm --dir apps/api test:pr20

# Smoke test backend bundle
pnpm --dir apps/api smoke:bundle

# Smoke test frontend
pnpm smoke:web
```

### 8.4 Docker Commands

```bash
# Stop containers
docker compose -f infra/docker/docker-compose.local.yml down

# View logs
docker logs parkly-mysql
docker logs parkly-redis

# Restart containers
docker restart parkly-mysql parkly-redis
```

---

## 9. Xử lý sự cố

### 9.1 Lỗi "Connection refused" MySQL

```bash
# Kiểm tra MySQL container
docker ps | grep mysql

# Khởi động lại container
docker restart parkly-mysql

# Kiểm tra logs
docker logs parkly-mysql
```

### 9.2 Lỗi "Connection refused" Redis

```bash
# Kiểm tra Redis container
docker ps | grep redis

# Khởi động lại
docker restart parkly-redis

# Test connection
redis-cli ping
```

### 9.3 Lỗi Prisma generate

```bash
# Xóa generated files và regenerate
rm -rf apps/api/node_modules/.prisma
pnpm prisma:generate
```

### 9.4 Lỗi Port đã sử dụng

```bash
# Tìm process sử dụng port
netstat -ano | findstr :3000   # API
netstat -ano | findstr :5173   # Web
netstat -ano | findstr :3306   # MySQL
netstat -ano | findstr :6379   # Redis

# Kill process (thay <PID> bằng process ID)
taskkill /PID <PID> /F
```

### 9.5 Lỗi CORS

Đảm bảo `API_CORS_ORIGINS` trong `.env` có origin của frontend:

```env
API_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

### 9.6 Reset toàn bộ dữ liệu

```bash
# Stop containers
docker compose -f infra/docker/docker-compose.local.yml down -v

# Xóa volumes
docker volume rm parkly-local_mysql-data parkly-local_redis-data

# Restart containers
docker compose -f infra/docker/docker-compose.local.yml up -d

# Re-run setup
pnpm --dir apps/api db:migrate
pnpm --dir apps/api db:grant:app
pnpm --dir apps/api db:seed:min
```

---

## 10. Triển khai ALPR (Optional)

ALPR (Automatic License Plate Recognition) là service ML riêng biệt để nhận diện biển số xe. Nếu không cần, có thể bỏ qua phần này.

### 10.1 Yêu cầu

- GPU NVIDIA (khuyến nghị) hoặc CPU mạnh
- Python 3.10+
- Docker (optional)

### 10.2 Cài đặt ALPR Service

```bash
cd services/alpr

# Tạo virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt
# Hoặc cho CPU:
pip install -r requirements-cpu.txt

# Download YOLOv8 model
# (File yolov8n.pt sẽ được tải tự động khi chạy)
```

### 10.3 Cấu hình ALPR

```env
# apps/api/.env
ALPR_MODE=MOCK  # Đổi thành HTTP khi có ALPR service
ALPR_HTTP_PROVIDER_URL=http://localhost:8765/predict/
ALPR_HTTP_PROVIDER_TOKEN=your-token
```

### 10.4 Chạy ALPR Service

```bash
cd services/alpr
python main.py
```

### 10.5 Docker ALPR (GPU)

```bash
cd services/alpr
docker build -t parkly-alpr .
docker run --gpus all -p 8765:8765 parkly-alpr
```

---

## Cấu trúc thư mục

```
parkly/
├── apps/
│   ├── api/                 # Backend Node.js/Express API
│   │   ├── db/             # Database migrations (Flyway)
│   │   ├── src/            # Source code
│   │   ├── .env.example    # Environment template
│   │   └── package.json
│   └── web/                 # Frontend React/Vite Web
│       ├── src/            # Source code
│       ├── dist/           # Build output
│       ├── .env.example    # Environment template
│       └── package.json
├── packages/               # Shared packages
│   ├── contracts/          # TypeScript contracts
│   └── gate-core/          # Core business logic
├── services/
│   └── alpr/              # ALPR ML Service (optional)
├── infra/
│   └── docker/            # Docker configurations
├── .gitignore
├── package.json           # Root workspace config
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

---

## Liên hệ & Hỗ trợ

Nếu gặp vấn đề, hãy kiểm tra:

1. Docker Desktop đang chạy
2. Ports không bị chiếm dụng
3. .env files đã được cấu hình đúng
4. Đã chạy `pnpm install` ở thư mục gốc

---

**Lưu ý quan trọng:**
- Không bao giờ commit file `.env` lên git
- File `.env.example` đã được commit, chứa template
- ALPR service (services/alpr/) không được commit do kích thước lớn
- Luôn chạy `docker compose down` trước khi tắt máy để tránh mất dữ liệu

Happy coding! 🚀
