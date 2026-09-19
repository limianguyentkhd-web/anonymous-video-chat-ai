# SAFE CONNECT - ANONYMOUS VIDEO CHAT AI

Dự án nghiên cứu và phát triển ứng dụng trò chuyện video ẩn danh tích hợp kiểm duyệt âm thanh tự động bằng trí tuệ nhân tạo (AI) và diễn đàn thảo luận cộng đồng.

---

## 1. Giới thiệu dự án

SafeConnect là hệ thống ứng dụng web hỗ trợ kết nối trò chuyện video ngẫu nhiên giữa người dùng theo hình thức ẩn danh. Hệ thống tích hợp các công nghệ kiểm duyệt thời gian thực nhằm phát hiện các hành vi vi phạm chuẩn mực ứng xử (tiếng la hò, âm thanh bất thường) và cung cấp môi trường diễn đàn trao đổi an toàn.

### Các tính năng chính:
- Kết nối trò chuyện Video ngẫu nhiên ẩn danh qua giao thức WebRTC và PeerJS.
- Tự động nhận diện và phân tích mối đe dọa âm thanh sử dụng TensorFlow.js và Web Audio API.
- Diễn đàn thảo luận cộng đồng ẩn danh.
- Hệ thống báo cáo vi phạm và lưu trữ nhật ký sự cố.

---

## 2. Cấu trúc thư mục mã nguồn

```text
safeconnect-anonymous-video-chat-ai/
├── css/                        # Thư mục chứa các tệp định dạng giao diện (CSS)
│   ├── style.css               # Giao diện chính dự án
│   ├── forum.css               # Giao diện mục diễn đàn
│   └── improvements.css        # Giao diện bổ sung
├── js/                         # Thư mục chứa mã nguồn xử lý phía Client (JavaScript)
│   ├── app.js                  # Logic kết nối WebRTC, Socket.IO và điều khiển UI
│   ├── audio-classifier.js     # Module AI phân tích và xử lý âm thanh
│   └── forum.js                # Logic tương tác diễn đàn
├── data/                       # Dữ liệu lưu trữ định dạng JSON (người dùng, sự cố)
├── uploads/                    # Thư mục lưu trữ tệp tin tải lên
├── .env                        # Biến môi trường và cấu hình cơ sở dữ liệu
├── .gitignore                  # Danh sách tệp loại trừ khi đưa lên Git
├── db.js                       # Module kết nối và truy vấn cơ sở dữ liệu
├── index.html                  # Giao diện trang chủ ứng dụng
├── package.json                # Quản lý thư viện và thông tin dự án Node.js
├── README.md                   # Tài liệu hướng dẫn sử dụng và cấu trúc dự án
└── server.js                   # Mã nguồn máy chủ Express, Socket.IO và PeerJS
```

---

## 3. Công nghệ sử dụng

- Phía người dùng (Frontend): HTML5, CSS3, JavaScript (ES6+), WebRTC API, Web Audio API, TensorFlow.js.
- Phía máy chủ (Backend): Node.js, Express.js, Socket.IO (Signaling Server), PeerJS Server.
- Cơ sở dữ liệu (Database): MySQL / PostgreSQL (hỗ trợ bộ lưu trữ JSON fallback).
- Quản lý phiên bản: Git và GitHub.

---

## 4. Hướng dẫn cài đặt và vận hành

### Yêu cầu hệ thống:
- Node.js phiên bản 16.x trở lên.
- Trình duyệt web hỗ trợ WebRTC (Google Chrome, Microsoft Edge, Mozilla Firefox).

### Quy trình khởi chạy:

1. Tải mã nguồn dự án về máy:
   ```bash
   git clone https://github.com/limianguyentkhd-web/anonymous-video-chat-ai.git
   cd safeconnect-anonymous-video-chat-ai
   ```

2. Cài đặt các thư viện phụ thuộc:
   ```bash
   npm install
   ```

3. Cấu hình tệp biến môi trường `.env`:
   ```env
   PORT=3000
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=safeconnect_db
   DB_USER=root
   DB_PASSWORD=
   ```

4. Khởi chạy máy chủ:
   ```bash
   npm start
   ```

5. Truy cập ứng dụng trên trình duyệt:
   `http://localhost:3000`

---

## 5. Cấu trúc phân chia nhánh mã nguồn (Git Branching)

- main: Nhánh mã nguồn chính thức đã qua kiểm thử.
- dev: Nhánh tích hợp mã nguồn trong quá trình phát triển.
- feature/webrtc-video-chat: Nhánh phát triển tính năng kết nối video.
- feature/ai-audio-classifier: Nhánh phát triển module AI xử lý âm thanh.
- feature/anonymous-forum: Nhánh phát triển tính năng diễn đàn.
- feature/backend-api-db: Nhánh phát triển máy chủ và cơ sở dữ liệu.
