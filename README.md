# Đường dựng

Không gian học dựng video chạy trên máy của bạn: theo dõi lộ trình và mở bài học từ website khóa học bằng quyền truy cập cá nhân.

Ứng dụng dùng Node.js và pnpm. Không cần cài cơ sở dữ liệu riêng cho chế độ local.

```sh
cd web
pnpm install --frozen-lockfile
APP_MODE=demo pnpm dev
```

Mở `http://127.0.0.1:3000/demo` để thử với dữ liệu và video giả lập. Để tạo tài khoản cá nhân, nhập danh mục riêng và xem các giới hạn của nguồn phát, đọc [hướng dẫn sử dụng](web/README.md).

Mỗi người tự chạy ứng dụng và sử dụng dữ liệu, tài khoản khóa học của mình. Danh mục riêng, cơ sở dữ liệu, thông tin đăng nhập và video không được đưa vào Git. Ứng dụng mở trang bài gốc trong cửa sổ riêng hoặc thẻ mới để dùng trực tiếp phiên đăng nhập trên website khóa học.
