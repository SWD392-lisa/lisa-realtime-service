# Realtime Audio Class (LMS Demo) 🎙️

Hệ thống Demo phòng học trực tuyến thời gian thực, cho phép người dùng tham gia phòng (Room), giơ tay phát biểu (Raise Hand) và Bật/Tắt Micro để trò chuyện âm thanh (Voice Call) trực tiếp với nhau.

## 🛠 Tech Stack
- **Backend:** NestJS, Socket.IO, Prisma ORM
- **Database:** PostgreSQL (Triển khai qua Docker)
- **Audio Service:** Agora Web SDK (RtcTokenBuilder)
- **Frontend:** Vanilla HTML/CSS/JS (Được Serve Static chung với cổng của Backend)

---

## 🚀 Hướng dẫn cài đặt từ A - Z (Local Development)

### 1. Yêu cầu hệ thống (Prerequisites)
Trước khi chạy dự án, hãy đảm bảo máy tính của bạn đã cài đặt:
- **Node.js** (phiên bản v18 hoặc mới hơn).
- **Docker & Docker Compose** (Để chạy nhanh Database PostgreSQL).
- **Tài khoản Agora** (Lấy `App ID` và `App Certificate` tại trang quản trị Agora.io).

### 2. Khởi động Database (PostgreSQL)
Mở terminal tại thư mục gốc của dự án, di chuyển vào thư mục `backend` và chạy Docker để khởi tạo Database:
```bash
cd backend
docker-compose up -d
```
*Lưu ý: Docker-compose sẽ tạo một database tên là `realtime_db` ở cổng `5433` (để tránh xung đột).*

### 3. Cài đặt thư viện & Cấu hình môi trường
Vẫn ở trong thư mục `backend/`, tiến hành cài đặt các gói NPM:
```bash
npm install
```

Tiếp theo, tạo một file `.env` ở thư mục `backend/` với nội dung như sau:
```env
# Cấu hình chuỗi kết nối Database
DATABASE_URL="postgresql://realtime_user:123@127.0.0.1:5433/realtime_db?schema=public"

# Thông tin xác thực Agora
AGORA_APP_ID="NHẬP_APP_ID_CỦA_BẠN_VÀO_ĐÂY"
AGORA_APP_CERTIFICATE="NHẬP_CERTIFICATE_CỦA_BẠN_VÀO_ĐÂY"
```

### 4. Khởi tạo Prisma ORM
Chạy lệnh sau để đồng bộ bảng dữ liệu vào Postgres và tạo Prisma Client:
```bash
npx prisma db push
npx prisma generate
```

### 5. Khởi chạy Ứng dụng
Chạy Backend (NestJS). NestJS đã được cấu hình nhúng sẵn toàn bộ code Frontend nên bạn chỉ cần chạy đúng 1 lệnh này:
```bash
npm run start:dev
```
Giao diện Web lúc này đã sẵn sàng tại: **[http://localhost:3000](http://localhost:3000)**

---

## 📱 Hướng dẫn cấu hình test trên Điện thoại (Bắt buộc)
> ⚠️ **Quan trọng:** Trình duyệt trên điện thoại di động yêu cầu bắt buộc trang web phải sử dụng giao thức bảo mật `HTTPS://` thì mới cấp quyền sử dụng **Microphone**. Nếu bạn dùng IP mạng LAN (`http://192.168.x.x`), trình duyệt sẽ chặn Mic!

Để test được trên điện thoại, bạn cần bắn cổng 3000 ra ngoài internet thông qua công cụ Tunnel (Khuyên dùng `tunnelmole` vì tính ổn định và miễn phí):

1. Mở một terminal mới (Vẫn giữ terminal chạy `npm run start:dev`).
2. Chạy lệnh sau:
   ```bash
   npx -y tunnelmole 3000
   ```
3. Copy đường link `https://...tunnelmole.net` vừa được sinh ra trên Terminal và gửi qua tin nhắn để mở bằng điện thoại. Bùm! Bạn có thể test Audio thoải mái.

## 🗂 Cấu trúc thư mục
- `/backend`: Toàn bộ mã nguồn NestJS (Controllers, Gateways Socket.io, Prisma Schema).
- `/frontend`: File HTML/CSS/JS thuần, dùng Agora Web SDK giao tiếp phía client.
- `/md`: Chứa các tài liệu ghi chú và báo cáo debug của hệ thống.
