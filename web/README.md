# Đường dựng — bản dùng thử cục bộ

Đường dựng giúp học dựng video theo danh mục nguồn và lưu tiến độ riêng theo tài khoản. Trong bản cá nhân, lộ trình đi theo từng bài và từng chương của khóa Elite; những bài tự luyện có liên kết Elite xuất hiện sau bài liên quan. Đầy đủ 36 nhiệm vụ và cột mốc tham khảo vẫn có trong mục Bài thực hành. Có thể mở từng chương và chuyển giữa sơ đồ với danh sách.

Hướng dẫn và ví dụ là đề xuất tự luyện, không phải brief được xác nhận từ giảng viên. Elite là trục của các dự án dựng; các khóa bổ trợ được dẫn theo nhu cầu. Thông tin đối chiếu từ danh mục hoặc phần chữ không xác nhận nội dung video đã được xem. Ghi thời gian thực làm để điều chỉnh kế hoạch; mọi thời lượng dự kiến chỉ là tham khảo.

Bước tiếp theo trong bản cá nhân ưu tiên bài Elite chưa hoàn thành đầu tiên. Các nhiệm vụ thực hành vẫn có thể mở theo nhu cầu; sau clip đầu có hai bước ghi nhận xét và rà hoặc sửa. Bài giả lập cần ghi rõ và không chứng minh đã có khách hoặc thu nhập. Mọi liên hệ, gửi và đăng do bạn tự quyết định.

Các ID cũ giữ nguyên tiến độ. Những bước mới không tự chuyển sang hoàn thành; một số được bỏ qua trong gợi ý khi cột mốc cũ đã bắt đầu hoặc hoàn tất và vẫn mở lại được. Hai bước nhận xét, rà sửa sau clip đầu được để chưa làm để bạn chủ động thực hành. Tổng số bước tăng có thể làm tỷ lệ hoàn thành giảm dù trạng thái cũ không thay đổi. Ứng dụng không sao chép video hay lưu ghi chú phản hồi.

## Xem nhanh bằng dữ liệu mẫu

Ứng dụng cần Node.js từ 22.9 và pnpm; nên dùng Node.js 24. Từ thư mục `web/`:

```sh
pnpm install --frozen-lockfile
APP_MODE=demo pnpm dev
```

Mở [bản demo](http://127.0.0.1:3000/demo). Demo dùng các khóa và bài giả, không mở trang khóa học bên ngoài. Trạng thái demo được lưu trong trình duyệt trên máy này và có thể mất nếu xóa dữ liệu trình duyệt.

Sau khi cập nhật ứng dụng, hãy tải lại các tab demo đang mở. Nếu trình duyệt từ chối lưu, trang sẽ báo lỗi và cho phép thử lại; các trạng thái trong ảnh chụp demo cũ vẫn được đọc.

## Dùng danh mục cá nhân

Chạy lệnh sau trong thư mục `web/`:

```sh
pnpm dev:private
```

Mở [trang cá nhân](http://127.0.0.1:3001). Khi cơ sở dữ liệu chưa có tài khoản, website sẽ yêu cầu tạo tài khoản quản trị đầu tiên và đăng nhập ngay sau đó. Ghi nhớ email và mật khẩu để đăng nhập trong những lần sau; nếu đã có tài khoản, website mở trang đăng nhập thông thường. Nếu đã có các tệp danh mục riêng trên máy, ứng dụng nhập ảnh chụp khi đăng nhập lần đầu mà không truy cập website khóa học. Nếu chưa có tệp, ứng dụng mở với danh mục trống và hướng dẫn nhập; các bài thực hành vẫn có thể xem ở mục riêng.

Cũng có thể tạo tài khoản đầu tiên bằng `pnpm bootstrap` trong terminal. Trước khi chạy lệnh này, dừng máy chủ cá nhân đang dùng cơ sở dữ liệu: PostgreSQL nhúng chỉ cho một tiến trình mở thư mục dữ liệu tại một thời điểm. Máy chủ demo không mở cơ sở dữ liệu cá nhân.

Để tạo tài khoản thứ hai trên cùng máy, đăng nhập với tài khoản quản trị, mở **Cài đặt tài khoản → Tạo liên kết mời mới**, sao chép liên kết và mở trong cửa sổ trình duyệt riêng. Liên kết chỉ dùng một lần, hết hạn sau 24 giờ. Tiến độ từng tài khoản được lưu riêng.

Nếu đổi tài khoản trong tab khác của cùng trình duyệt, tab cũ sẽ chặn thao tác lưu và yêu cầu tải lại để tránh ghi vào nhầm tài khoản.

Nếu hai tab cùng tài khoản cùng sửa một mục, tab đang giữ trạng thái cũ sẽ báo xung đột và hiển thị trạng thái đã lưu; bạn xem lại rồi tự chọn trạng thái tiếp theo. Sau khi cập nhật ứng dụng, hãy tải lại các tab cá nhân cũ trước khi tiếp tục lưu tiến độ.

Nếu terminal hiển thị đường dẫn khác cổng 3001 do máy đã có dịch vụ chiếm cổng, hãy giải phóng cổng 3001 trước khi dùng `pnpm dev:private`; cấu hình địa chỉ xác thực và địa chỉ trang phải khớp. Nếu trước đó tự đặt `BETTER_AUTH_URL` trong `.env.local`, hãy dùng địa chỉ `http://127.0.0.1:3001` cho phiên dùng thử này.

## Khám phá bài học liên kết

Trong bản cá nhân, chọn **Khám phá bài học liên kết** ở trang tổng quan để mở danh mục Elite. Mở một bài và xem mục **Bài học liên kết**: các gợi ý được nhóm thành nền tảng, bổ trợ và tìm hiểu sâu. Ở bài được gợi ý, mục **Bài liên kết đến đây** cùng nút **Quay lại** giúp bạn lần về bài trước; việc mở bài không tự đánh dấu hoàn thành.

Các liên kết được người soạn đề xuất theo tiêu đề và chủ đề của danh mục đã lưu; chưa xác minh nội dung video. Bài chưa có liên kết vẫn được học bình thường. Demo dùng một mạng nhỏ bằng bài mẫu.

## Ghi lại điều đã thực hành trong Obsidian

Trên trang học hoặc trong bảng hướng dẫn thực hành, chọn **Sao chép ngữ cảnh cho Obsidian / AI**. Nội dung gồm tên và mã bài hoặc thực hành, các liên kết sẵn có và giới hạn bằng chứng. Nếu trình duyệt không cho phép sao chép, chọn nội dung trong ô hiện ra và tự sao chép. Demo chỉ cung cấp dữ liệu mẫu. Ứng dụng không tự gửi ngữ cảnh đi đâu hoặc mở vault của bạn.

Dán ngữ cảnh vào một ghi chú Obsidian, sau đó bổ sung điều bạn đã thử, khó khăn, kết quả và một ý có thể áp dụng lần sau. Bạn có thể tự đưa những thông tin đó cho AI để viết nháp; kiểm tra lại mọi kết luận và liên kết trước khi lưu. Tiêu đề hoặc chữ trên trang bài không chứng minh nội dung video. Ghi chú và sao lưu vault do bạn quản lý.

## Xem video bài học

Trong bản cá nhân, chọn một bài trên lộ trình rồi chọn **Mở trang học** để xem video, mô tả đã đối chiếu và các bài liên quan. Có thể chuyển sang bài trước hoặc bài tiếp theo trong cùng giáo trình. Bảng chi tiết cũng có nút **Xem bài học trên website gốc** để mở trang nguồn trong cửa sổ riêng; cửa sổ dùng phiên đăng nhập và trình phát của website gốc.

### Phát video ngay trong ứng dụng

Để xem video trên trang học riêng, dùng trang **Thu thập liên kết phát** (liên kết ở chân thanh điều hướng):

1. Kéo nút **Thu thập liên kết** vào thanh dấu trang một lần.
2. Mở website gốc khi đã đăng nhập, bấm **Thu thập liên kết tất cả** trên thanh dấu trang và giữ trang mở tới khi hoàn tất. Trình duyệt tải về `lesson-media-tat-ca-khoa.json`. **Đóng DevTools trước khi mở trang khóa học** vì website gốc chặn khi phát hiện DevTools. Có thể dùng nút **Thu riêng chương** để thu lại một chương.
3. Chọn hoặc dán tệp JSON vào trang thu thập.

Ứng dụng chỉ nhận liên kết nhúng `iframe.mediadelivery.net/embed/431650/…` (Bunny Stream) và `youtube-nocookie.com/embed/…` (YouTube), bỏ mọi tham số truy vấn, và lưu riêng theo tài khoản trên máy này. Nhập lại cùng một bài sẽ cập nhật chứ không nhân đôi. Bài đọc hoặc bài chưa có video không có liên kết; khi đó vẫn dùng nút mở website gốc.

Nút thu tất cả đọc lần lượt các chương trong danh mục hiện tại; nếu danh mục thay đổi, hãy kéo lại nút vào thanh dấu trang. Trang thu thập không đọc cookie, không đăng nhập thay bạn và không gửi dữ liệu đi đâu ngoài ứng dụng trên máy.

Với video Bunny đã nhập và có nguồn HLS tương thích, ứng dụng dùng trình phát riêng: phát, tạm dừng, tua 10 giây, chọn vị trí, âm lượng, tốc độ, chất lượng và toàn màn hình. Các nút nằm trên video và tự ẩn khi đang phát; rê chuột hoặc chạm vào video để hiện lại, chọn bánh răng để đổi tốc độ hoặc chất lượng. Phím tắt giống YouTube: K/Space phát–dừng, J/L tua 10 giây, ←/→ tua 5 giây, ↑/↓ âm lượng, M tắt tiếng, F toàn màn hình, 0–9 nhảy tới 0–90%. Trên điện thoại, chạm đúp hai bên video để tua 10 giây. Chỉ những mức chất lượng thực sự có trong video mới xuất hiện; một số video chỉ có một mức. Video không tự phát khi mở bài.

Để giảm thời gian chờ, trình phát tải trước đoạn video đầu tiên khi mở bài và tăng bộ đệm sau khi bấm phát. Vì vậy, việc mở bài có thể dùng dữ liệu mạng dù chưa phát video. Máy chủ nhớ tạm liên kết không có tham số trong tối đa 10 phút; liên kết có tham số không được nhớ tạm.

Nếu nguồn hoặc trình duyệt không hỗ trợ phát trực tiếp, ứng dụng tự chuyển sang trình phát Bunny gốc. Bạn cũng có thể chọn **Dùng trình phát gốc** bất cứ lúc nào để dùng phụ đề hoặc các tính năng khác của nguồn; trong trình phát gốc, tốc độ và chất lượng nằm trong nút cài đặt. Video YouTube dùng trình phát của YouTube. Bộ điều khiển Media Chrome dùng cho video giả lập trong bản demo.

Ứng dụng không đọc hay sao chép thông tin đăng nhập của website khóa học và không lưu tệp video. Khi phát bằng trình phát riêng, các tính năng riêng của trình phát nguồn, như thống kê lượt xem, có thể không hoạt động.

## Dữ liệu và giới hạn

- Danh mục, cơ sở dữ liệu, tệp môi trường và tài liệu khóa học riêng không có trong Git; mỗi người tự chuẩn bị dữ liệu của mình.
- Dữ liệu tài khoản và tiến độ cục bộ nằm trong `web/.data/`; dừng ứng dụng trước khi sao lưu theo [hướng dẫn vận hành local](docs/van-hanh-local.md).
- Mã nguồn có một số tên khóa và ID bài trong các gợi ý được soạn sẵn; chúng không bao gồm tệp video hay thông tin phiên. Cần xem lại mã và quyền đối với tài liệu trước khi chia sẻ.
- Không cần SMTP để đăng nhập hoặc tạo liên kết mời local; xác minh email và đặt lại mật khẩu cần cấu hình thư riêng.

## Cập nhật hoặc thêm danh mục

`pnpm catalog:import` chỉ xem số bài thêm, đổi hoặc vắng; sau khi kiểm tra chênh lệch, dùng `pnpm catalog:import --apply` để lưu ảnh chụp mới. Tiến độ cũ được giữ theo mã bài. Với PGlite cục bộ, dừng máy chủ trước khi chạy lệnh nhập.

Với ảnh chụp cũ từng che tiêu đề, bản cá nhân tạm khôi phục tiêu đề từ tệp nguồn cục bộ nếu khóa, chương, mã bài và URL khớp; ảnh chụp và tiến độ không bị sửa. Nếu không đọc được tệp nguồn, bài vẫn mở được với nhãn cũ; muốn lưu tiêu đề đầy đủ, xem chênh lệch và nhập lại từ nguồn đã chuẩn bị. Bản cá nhân giữ tên và hồ sơ học viên do giảng viên cung cấp cho học viên tham khảo; demo vẫn dùng dữ liệu giả.

Khi thêm khóa, sao chép `catalog-manifest.example.json` thành manifest riêng, thêm mục `slug` và đường dẫn tệp JSON tương đối với thư mục nguồn, rồi đặt `CATALOG_MANIFEST` và nếu cần `CATALOG_SOURCE_ROOT` trong `.env.local`. Ví dụ manifest chỉ minh họa tên tệp; các tệp danh mục không đi kèm mã nguồn. Định dạng dữ liệu được mô tả bằng `RawCourse` trong `src/lib/catalog/normalize.ts`; bộ nhập hiện chỉ chấp nhận cấu trúc URL của nguồn khóa học đã cấu hình trong mã. Chỉ nhập dữ liệu được phép dùng; không nhập cookie, token hoặc URL media có chữ ký.

## Kiểm tra khi phát triển

```sh
pnpm typecheck
pnpm lint
pnpm test
```

Để kiểm tra giao diện demo, chạy máy chủ cục bộ rồi dùng `pnpm exec playwright test tests/e2e/workspace.spec.ts`. Playwright cần trình duyệt Chromium tương thích. Các kiểm thử tài khoản riêng trong `tests/e2e/private.spec.ts` cần một máy chủ và cơ sở dữ liệu thử tách biệt; không trỏ chúng vào dữ liệu đang sử dụng.

Một số kiểm thử đối chiếu riêng được bỏ qua khi bản sao mã nguồn không có danh mục cá nhân. Các kiểm thử với dữ liệu giả vẫn chạy bình thường.

Để kiểm tra image demo không chứa dữ liệu bài học thật, build rồi chạy lại kiểm thử với đúng thư mục output:

```sh
ROADMAP_BUILD_DIR=.next pnpm build
ROADMAP_BUILD_DIR=.next pnpm exec vitest run tests/demo-image.test.ts
```

Kiểm thử này đọc dấu vết build của Next.js để lấy đúng các tệp mà route `/demo` tải (server và client), rồi so tên, mô tả, URL bài thật và mã bài thật. Không có build hoặc không có danh mục riêng thì bài kiểm thử tự bỏ qua.
