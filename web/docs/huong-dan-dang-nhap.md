# Tài khoản và tiến độ

## Tạo và thử hai tài khoản

1. Khi máy chủ cá nhân đang dừng, chạy `pnpm bootstrap` trong `web/` và nhập tên, email, mật khẩu của quản trị viên. Lệnh chỉ hoạt động trên cơ sở dữ liệu trống; bản demo riêng không mở cơ sở dữ liệu này.
2. Chạy `pnpm dev:private`, mở `http://127.0.0.1:3001/dang-nhap` và đăng nhập.
3. Trong **Cài đặt tài khoản**, tạo một liên kết mời. Chỉ chia sẻ liên kết qua kênh riêng; liên kết có hiệu lực 24 giờ và chỉ dùng một lần.
4. Mở liên kết bằng cửa sổ riêng, tạo tài khoản thứ hai và đăng nhập. Chọn một bài hoặc bài thực hành, cập nhật trạng thái, tải lại trang và kiểm tra trạng thái vẫn còn.
5. Trở lại cửa sổ của tài khoản đầu tiên: tiến độ của hai tài khoản tách biệt. Dùng nút **Đăng xuất tài khoản** trong phần cài đặt khi đã thử xong.

Không cần nhập mật khẩu hoặc thông tin đăng nhập của website khóa học vào ứng dụng. Nút mở bài chỉ mở trang bài gốc; người học tự quản lý phiên của mình ở đó.

## Email và khôi phục

Email xác minh và đặt lại mật khẩu yêu cầu cấu hình SMTP. Khi chưa cấu hình, trang khôi phục hiển thị trạng thái chưa sẵn sàng, còn người học vẫn có thể đăng nhập với mật khẩu hiện có. Sau khi SMTP được cấu hình, liên kết trong thư có thời hạn một giờ; mã được đặt trong fragment của URL và xóa khỏi thanh địa chỉ khi trang đã tải. Đổi mật khẩu sẽ thu hồi các phiên cũ.

[Hướng dẫn cấu hình và giới hạn kiểm thử SMTP](thu-dien-tu.md). Đường gửi SMTP thật và hộp thư đến chưa được kiểm tra trên môi trường đích.

## Mã nguồn liên quan

| Chức năng | Tệp |
| --- | --- |
| Cấu hình xác thực, băm mật khẩu và phiên | `src/lib/auth/config.ts` và Better Auth |
| Tạo quản trị viên ban đầu | `scripts/bootstrap.ts`, `src/lib/auth/bootstrap.ts` |
| Tạo và sử dụng lời mời | `src/lib/auth/invitations.ts`, `src/app/api/invitations/route.ts`, `src/app/api/register/route.ts` |
| Email và kiểm thử hộp thư giả | `src/lib/mail/`, `tests/auth-mail.test.ts` |
| Lưu tiến độ theo ID tài khoản | `src/lib/progress/store.ts`, `src/app/api/progress/route.ts` |
| Cơ sở dữ liệu và cấu trúc bảng | `src/lib/db/` |

Trong môi trường cục bộ, dữ liệu và khóa xác thực nằm trong `.data/`; chỉ một tiến trình PGlite được mở thư mục này tại một thời điểm. Production yêu cầu `DATABASE_URL` và `BETTER_AUTH_SECRET` riêng qua biến môi trường.
