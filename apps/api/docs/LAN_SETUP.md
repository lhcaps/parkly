# Parkly API — Truy cập từ LAN (mobile / máy khác)

Khi mở web tại `http://<IP>:5173` (ví dụ từ điện thoại), frontend gọi API tại `http://<IP>:3000/api/...`. Để tránh **ERR_CONNECTION_TIMED_OUT**:

## 1. Chạy API trên đúng máy

- **VITE_API_BASE_URL** trong `apps/web/.env` phải trỏ đến **đúng IP máy đang chạy API**.
- Ví dụ: nếu `VITE_API_BASE_URL=http://192.168.1.84:3000/api` thì API **bắt buộc** chạy trên máy có IP **192.168.1.84**.

## 2. Trên chính máy đó (máy có IP trong VITE_API_BASE_URL)

### Cách nhanh (khuyến nghị)

```powershell
cd apps\api\scripts
.\start-api-for-lan.ps1
```

Script sẽ:

- Đặt `API_HOST=0.0.0.0` trong `apps/api/.env` (nếu chưa có).
- Mở port 3000 trên Windows Firewall (Private + Public) — sẽ bật cửa sổ Admin.
- Khởi động API (listen `0.0.0.0:3000`).

### Cách thủ công

1. **Firewall** (PowerShell **Run as Administrator**):

   ```powershell
   cd apps\api\scripts
   .\allow-api-firewall.ps1
   ```

2. **Đảm bảo** trong `apps/api/.env`:

   ```env
   API_HOST=0.0.0.0
   API_PORT=3000
   ```

3. **Chạy API**:

   ```powershell
   cd apps\api
   .\run.ps1
   ```

## 3. Kiểm tra

- Trên **cùng máy**: mở `http://localhost:3000/api/health` → phải trả 200.
- Từ **máy/điện thoại khác trong LAN**: mở `http://<IP-may-chay-API>:3000/api/health` (ví dụ `http://192.168.1.84:3000/api/health`) → phải trả 200.

Nếu vẫn timeout từ máy khác: kiểm tra cùng Wi‑Fi/LAN, tắt tạm antivirus/firewall khác, hoặc thử tắt Windows Firewall tạm để thử.
