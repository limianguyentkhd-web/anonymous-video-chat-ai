# 🛡️ SafeConnect - Anonymous Video Chat AI

> **Nền tảng Chat Video Ẩn danh An toàn tích hợp AI Kiểm duyệt Thời gian thực & Diễn đàn Cộng đồng.**

---

## 📖 1. Giới thiệu Tổng quan

**SafeConnect** là một ứng dụng web kết nối video chat ẩn danh giữa người dùng ngẫu nhiên, tập trung vào tính **an toàn**, **bảo mật** và **ngừa vi phạm/quấy rối**. Hệ thống tích hợp module AI tự động kiểm duyệt mối đe dọa âm thanh (tiếng la hò, tiếng nổ, từ ngữ quấy rối) thời gian thực và cung cấp diễn đàn ẩn danh lành mạnh cho cộng đồng.

### 🌟 Tính năng chính:
- 🎥 **Video Chat Ngẫu nhiên (WebRTC + PeerJS)**: Kết nối P2P ẩn danh tốc độ cao, hỗ trợ Socket.IO ghép cặp nhanh.
- 🎙️ **AI Audio Safety Shield (TensorFlow.js + Web Audio API)**: Phân tích tần số âm thanh thời gian thực, tự động phát hiện tiếng la giật gân, độc hại và cảnh báo/ngắt kết nối.
- 💬 **Diễn đàn Ẩn danh (Anonymous Forum)**: Chia sẻ bài viết, thảo luận cộng đồng không lộ danh tính.
- 🚨 **Hệ thống Báo cáo & Bắn Thẻ (Incident Reporting)**: Tự động ghi lại vi phạm, chặn người dùng vi phạm quy chuẩn.

---

## 📁 2. Cấu trúc Thư mục Dự án

```text
safeconnect-anonymous-video-chat-ai/
├── css/                        # Thư mục chứa CSS giao diện
│   ├── style.css               # Giao diện chính dự án
│   ├── forum.css               # Giao diện cho mục Diễn đàn
│   └── improvements.css        # Các nâng cấp giao diện bổ sung
├── js/                         # Thư mục chứa JavaScript Client-side
│   ├── app.js                  # Logic WebRTC, Socket.IO ghép cặp & UI chính
│   ├── audio-classifier.js     # Module AI phán đoán âm thanh độc hại (TensorFlow.js)
│   └── forum.js                # Logic tương tác Diễn đàn ẩn danh
├── data/                       # Dữ liệu JSON tĩnh fallback (Users, Incidents, Banned)
├── uploads/                    # Thư mục lưu trữ video/hình ảnh tải lên
├── .env                        # Biến môi trường & cấu hình Database
├── .gitignore                  # Cấu hình loại bỏ file rác khi đẩy lên Git
├── db.js                       # Module kết nối Database (MySQL/Postgres)
├── index.html                  # Giao diện chính của ứng dụng (Single Page)
├── package.json                # Khai báo thư viện dependencies & scripts Node.js
├── README.md                   # Tài liệu hướng dẫn sử dụng & cấu trúc dự án
└── server.js                   # Express Backend, Socket.IO & PeerJS Server
```

---

## 🛠️ 3. Công nghệ Sử dụng (Tech Stack)

* **Frontend**: HTML5, CSS3, JavaScript (ES6+), WebRTC API, Web Audio API, TensorFlow.js.
* **Backend**: Node.js, Express.js, Socket.IO (Signaling), PeerJS Server.
* **Database**: MySQL / PostgreSQL (Tích hợp chế độ JSON Storage Fallback khi không có DB).
* **Quản lý mã nguồn**: Git & GitHub (Mô hình Feature Branching).

---

## 🚀 4. Hướng dẫn Cài đặt & Chạy Dự án (How to Run)

### 📋 Yêu cầu tiên quyết:
- Đã cài đặt **Node.js** (Phiên bản 16.x hoặc mới hơn).
- *(Tùy chọn)* Đã cài đặt **XAMPP / MySQL** nếu muốn lưu trữ Database thực tế.

### ⚙️ Các bước thực hiện:

#### Bước 1: Clone dự án hoặc tải mã nguồn
```bash
git clone https://github.com/limianguyentkhd-web/anonymous-video-chat-ai.git
cd safeconnect-anonymous-video-chat-ai
```

#### Bước 2: Cài đặt các thư viện phụ thuộc (Dependencies)
```bash
npm install
```

#### Bước 3: Cấu hình biến môi trường
Kiểm tra hoặc tạo file `.env` tại thư mục gốc dự án:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_NAME=safeconnect_db
DB_USER=root
DB_PASSWORD=
```

#### Bước 4: Khởi chạy Server
```bash
# Chạy server chính
npm start

# Hoặc chạy trực tiếp bằng node
node server.js
```

#### Bước 5: Truy cập ứng dụng
Mở trình duyệt web bất kỳ và truy cập đường dẫn:
👉 `http://localhost:3000`

---

## 🌿 5. Mô hình Quản lý Nhánh Git (Git Branching)

Dự án áp dụng mô hình phân chia nhánh theo tính năng (**Feature Branching**):

* **`main`**: Nhánh chính thức, chứa mã nguồn đã kiểm thử ổn định.
* **`dev`**: Nhánh tích hợp chính dùng trong quá trình phát triển.
* **`feature/<tên-tính-năng>`**: Nhánh làm việc riêng cho từng phần:
  * `feature/webrtc-video-chat`: Tính năng Video Call & Socket.IO.
  * `feature/ai-audio-classifier`: Module AI kiểm duyệt âm thanh.
  * `feature/anonymous-forum`: Diễn đàn ẩn danh.
  * `feature/backend-api-db`: Backend Express & Database.

---

## 📝 License & Contact
Dự án được phát triển phục vụ mục đích nghiên cứu & học tập.
- **Tác giả**: SafeConnect Team
