# Thư điện tử trong Roadmap Studio

Module này gửi thư giao dịch đặt lại mật khẩu và xác nhận email. Mã nguồn nằm ở
`web/src/lib/mail/`; Better Auth gọi module qua `web/src/lib/auth/config.ts`.
Lời mời tài khoản hiện được tạo thành liên kết để người quản trị tự sao chép.

## API

```ts
import { createMailer } from "@/lib/mail";

const mailer = createMailer(); // mặc định đọc process.env

if (mailer.configured) {
  await mailer.send({
    to: "hoc-vien@example.invalid",
    subject: "Đặt lại mật khẩu",
    text: "Nội dung thư dạng văn bản thuần.",
  });
}
```

- `createMailer(env?: NodeJS.ProcessEnv)` trả `{ configured: boolean; send(message): Promise<void> }`.
- `getMailer()` trả một bộ gửi thư dùng chung, tạo một lần từ `process.env` — nên dùng hàm này
  trong luồng Better Auth để không tạo transporter mới cho mỗi lần gửi.
- `configured` là `false` khi thiếu cấu hình; khi đó `send()` ném `MailError` với mã
  `MAIL_NOT_CONFIGURED` và **không** mở kết nối mạng.
- `send()` kiểm tra người nhận, tiêu đề và nội dung trước khi gửi; dữ liệu sai ném
  `MAIL_INVALID_MESSAGE`.
- Lỗi từ máy chủ SMTP được thay bằng thông báo chung `MAIL_DELIVERY_FAILED`, không kèm lỗi gốc,
  mật khẩu hay liên kết có chữ ký.
- Module không ghi log nội dung thư, thông tin xác thực hay URL có token.

Giới hạn hiện tại: chỉ gửi thư văn bản thuần (`text`), chưa hỗ trợ HTML/đính kèm.

## Cấu hình SMTP

Đặt các biến sau trong `.env.local` (không commit) hoặc biến môi trường của nền tảng triển khai:

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=no-reply@example.com
SMTP_PASSWORD=...
SMTP_FROM=Đường dựng <no-reply@example.com>
```

| Biến | Bắt buộc | Ghi chú |
| --- | --- | --- |
| `SMTP_HOST` | Có | Tên máy chủ SMTP, không chứa khoảng trắng. |
| `SMTP_PORT` | Có | Số nguyên 1–65535. |
| `SMTP_FROM` | Có | Địa chỉ hoặc dạng `Tên <địa chỉ>`. |
| `SMTP_SECURE` | Không | `true` cho TLS ngay từ đầu (thường cổng 465); mặc định `true` khi cổng là 465, ngược lại `false`. Giá trị lạ làm cấu hình bị coi là thiếu. |
| `SMTP_USER` | Không | Phải đi cùng `SMTP_PASSWORD`; đặt lẻ một trong hai thì cấu hình không hợp lệ. |
| `SMTP_PASSWORD` | Không | Không bao giờ được ghi ra log hay trả về trong lỗi. |

Thiếu bất kỳ biến bắt buộc nào thì `configured === false`; ứng dụng vẫn chạy nhưng không gửi thư.
Đây là chủ đích: không gửi khi chưa cấu hình thay vì thử kết nối mù.

## Hộp thư giả lập (chỉ dùng khi kiểm thử)

Bộ gửi thư trong bộ nhớ chỉ hoạt động khi **đồng thời**:

- tiến trình đang chạy với `NODE_ENV === "test"` (biến môi trường thật của tiến trình), và
- env truyền cho `createMailer` có `NODE_ENV === "test"` và `MAIL_TRANSPORT === "memory"`.

Điều kiện kép này để một tiến trình production không thể bật hộp thư giả lập chỉ vì ai đó truyền
nhầm env hoặc đặt `MAIL_TRANSPORT=memory` trong file cấu hình.

Khi đó `send()` chỉ thêm thư vào mảng trong bộ nhớ, không kết nối SMTP. Có thể đọc và xoá bằng:

```ts
import { clearTestMailbox, readTestMailbox } from "@/lib/mail";

clearTestMailbox();
// ... gọi mã cần kiểm thử ...
const inbox = readTestMailbox(); // [{ to, subject, text, sentAt }]
```

`readTestMailbox()` trả bản sao để mã kiểm thử không sửa được hộp thư gốc. Nếu đặt
`MAIL_TRANSPORT=memory` ngoài môi trường test, cờ này bị bỏ qua hoàn toàn — production không thể
vô tình nuốt thư vào bộ nhớ. Khi kiểm thử có cấu hình SMTP thật, hộp thư giả lập vẫn được ưu tiên
để không gửi thư thật.

## Trạng thái xác minh

- Đã kiểm thử bằng bộ nhớ và bằng nodemailer giả (mock): không có kết nối SMTP thật nào được mở.
- **Chưa xác nhận với máy chủ SMTP bên ngoài**, chưa gửi thư thật, chưa kiểm tra thư vào hộp thư đến,
  SPF/DKIM/DMARC hay khả năng bị đánh dấu spam. Cần người vận hành cấu hình SMTP thật và tự gửi thử
  ở môi trường riêng trước khi dùng cho người học.

## Tích hợp trong ứng dụng

- `src/lib/auth/config.ts` gắn email xác minh và đặt lại mật khẩu vào Better Auth. Khi SMTP được
  cấu hình, đăng ký gửi yêu cầu xác minh; người học cũng có thể yêu cầu lại trong phần cài đặt.
  Xác minh email hiện không phải điều kiện bắt buộc để đăng nhập.
- Trang `quen-mat-khau` gửi yêu cầu với thông báo chung, không xác nhận địa chỉ có tài khoản hay
  không. Khi SMTP chưa được cấu hình, trang báo tính năng chưa sẵn sàng.
- Liên kết xác minh và đặt lại chứa mã trong fragment (`#token=...`); mã được xóa khỏi thanh địa
  chỉ sau khi trang tải và chỉ được gửi qua nội dung POST. Mã đặt lại có hiệu lực một giờ và chỉ
  sử dụng một lần; đặt lại mật khẩu thu hồi phiên cũ.
- `tests/auth-mail.test.ts` kiểm tra xác minh, thông báo chung, liên kết hết hạn và thu hồi phiên
  bằng hộp thư giả; không kết nối SMTP thật. Một phản hồi chấp nhận yêu cầu không xác nhận thư đã
  đến hộp thư người nhận, vì vậy cần kiểm tra nhà cung cấp SMTP trước khi sử dụng từ xa.
