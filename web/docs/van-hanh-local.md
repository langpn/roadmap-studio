# Vận hành website trên máy local

Tài liệu này dành cho bản chạy bằng Node.js + PGlite trên máy cá nhân: mở, dừng,
cập nhật, nhập danh mục, chẩn đoán và sao lưu. Đây là phạm vi duy nhất còn lại;
Docker, Coolify, Cloudflare, domain và SMTP thật **không** thuộc phạm vi.

Mọi lệnh chạy trong `web/`. Mặc định dữ liệu thật nằm ở `web/.data/` (đã bị
`.gitignore` chặn), nhưng ứng dụng đọc biến `PGLITE_DATA_DIR` trước. Nếu biến đó
được đặt, thư mục thật là thư mục nó trỏ tới, **không** phải `web/.data`. Dữ liệu
thật **không** được chép vào mã nguồn, chat, log hay ảnh chụp màn hình.

`pnpm local:db` cũng theo đúng quy tắc đó: `--data` mặc định lấy `PGLITE_DATA_DIR`,
không có thì `web/.data`. Nếu bạn chạy ứng dụng với `PGLITE_DATA_DIR` khác, phải
truyền `--data` đúng thư mục, nếu không sẽ sao lưu/đếm sai thư mục (hoặc báo không
thấy database).

## 1. Mở và dừng ứng dụng

```sh
pnpm dev:private      # http://127.0.0.1:3001, PGlite tại web/.data
```

Không dùng `pnpm build && pnpm start` cho bản PGlite: `next start` đặt
`NODE_ENV=production`, và `src/lib/db/index.ts` cố ý chặn PGlite khi ở production
(`Cần cấu hình DATABASE_URL khi triển khai`). Đã thử một lần và thấy lỗi 500 ở
`/`, `/dang-nhap`, `/api/progress`. Bản local dùng chế độ dev; nếu cần bản build,
phải có PostgreSQL ngoài.

`dev:private` đặt `APP_MODE=private`, `BETTER_AUTH_URL=http://127.0.0.1:3001` và
`--port 3001`. Chỉ mở loopback; không publish ra mạng LAN.

Dừng bằng `Ctrl-C` trong đúng terminal đang chạy. Không dùng `kill -9`: PGlite cần
đóng bình thường để ghi xong WAL. Nếu tiến trình treo, kiểm tra trước khi kill:

```sh
lsof -nP -iTCP:3001 -sTCP:LISTEN     # tiến trình đang giữ cổng
lsof -p <PID> | grep '/.data/'       # xác nhận đúng tiến trình đang mở database
```

Nếu cổng 3001 đã có tiến trình khác, **không** chạy thêm một bản nữa: hai tiến
trình cùng mở `web/.data/postgres` sẽ ghi đè lên nhau. Đây là hành vi của PGlite
0.5.15 — thư mục dữ liệu **không** có khóa; đã thử mở hai phiên trên cùng thư mục
và cả hai đều đọc/ghi được. Vì vậy quy tắc "một tiến trình cho một thư mục" phải
do người vận hành giữ, không dựa vào ứng dụng.

**Tự dừng ứng dụng trước, rồi mới sao lưu.** Guard của `pnpm local:db` chỉ là lớp
bổ sung, không phải bảo đảm:

- PGlite ghi pid giả `-42` vào `postmaster.pid` và **không xóa tệp khi tiến trình
  bị kill** (đã gặp khi dừng server thử bằng `kill`), nên không dùng tệp đó để
  đoán.
- Cách kiểm tra là `lsof -nP -t +D <data>/postgres`: `lsof` chỉ thấy **tệp đang
  mở**, nên nó không chứng minh tuyệt đối rằng tiến trình PGlite đã dừng — một
  tiến trình đang khởi động, vừa đóng tệp, hoặc chạy trong môi trường `lsof`
  không quan sát được vẫn có thể còn đó. Thiếu `lsof` hoặc không đọc được kết quả
  thì lệnh **từ chối chạy** thay vì cho qua.
- Có khoảng TOCTOU: sau khi kiểm tra và trước khi `tar` đọc, một tiến trình khác
  có thể mở database. Không có khóa của PGlite để loại bỏ hoàn toàn; chỉ có cách
  tự dừng ứng dụng và không chạy hai bản.
- Tool này dựa vào `lsof` của macOS (và `lsof` trên Linux nếu có cùng hành vi).
  Trên hệ khác, guard sẽ fail closed — bạn phải tự xác nhận ứng dụng đã dừng.

## 2. Cập nhật phiên bản

```sh
# dừng ứng dụng trước
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
pnpm local:db -- backup --out ~/Backups/roadmap   # xem mục 6
pnpm dev:private
```

Migration chạy tự động khi mở database (`src/lib/db/migrate.ts`, chỉ `CREATE TABLE
IF NOT EXISTS`). Chạy lặp không mất dữ liệu; đã kiểm chứng ở
`tests/migration.test.ts` và `tests/local-backup.test.ts`.

Sau khi cập nhật, kiểm tra nhanh:

1. `http://127.0.0.1:3001/dang-nhap` trả trang đăng nhập.
2. Đăng nhập được bằng tài khoản cũ.
3. Một bài đã đánh dấu vẫn giữ trạng thái; bộ đếm không nhảy về 0.
4. `/api/progress` khi chưa đăng nhập trả `401`.

`pnpm dev:private` không tự chạy migration riêng; migration chạy khi mở database.
Nếu vừa đổi schema, mở một trang bất kỳ rồi kiểm tra lại.

## 3. Nhập hoặc cập nhật danh mục

```sh
# dừng ứng dụng (cùng lý do một tiến trình)
pnpm catalog:import             # chỉ xem chênh lệch: thêm/đổi/vắng
pnpm catalog:import --apply     # ghi ảnh chụp mới
pnpm dev:private
```

Tiến độ giữ theo mã bài; bài vắng mặt chỉ không còn trong ảnh chụp mới, không bị
xóa khỏi `lesson_progress`. Thêm khóa mới: sao `catalog-manifest.example.json`,
khai `CATALOG_MANIFEST`/`CATALOG_SOURCE_ROOT` trong `.env.local`. Không nhập
cookie, token hay URL media có chữ ký.

## 4. Chẩn đoán

| Hiện tượng | Kiểm tra |
| --- | --- |
| Không mở được cổng | `lsof -nP -iTCP:3001 -sTCP:LISTEN`; tiến trình cũ còn sống? |
| Trang trắng hoặc lỗi 500 | log terminal; `pnpm typecheck`; nếu nghi output build cũ, đổi `ROADMAP_BUILD_DIR` sang thư mục mới thay vì xóa |
| Đăng nhập sai liên tục | giới hạn 20 lần/phút mỗi tiến trình; chờ một phút |
| Mất khóa phiên | `.data/auth-secret` còn đó? Xóa khóa = mọi phiên cũ mất hiệu lực |
| Số bài về 0 | danh mục đã nhập chưa: `pnpm local:db -- inspect --data .data` |
| Database nghi hỏng | dừng ứng dụng, sao lưu nguyên trạng thư mục, rồi `inspect` bản phục hồi gần nhất |
| `postmaster.pid` còn sau khi kill | thường gặp; không dùng nó để kết luận; xác nhận bằng `lsof -nP -t +D .data/postgres` |

`pnpm local:db -- inspect --data .data` in số tài khoản, quản trị, khóa, bài, bản
ghi tiến độ và liên kết — không in email, mật khẩu hay nội dung bài.

Không chạy `inspect` trên `.data` khi ứng dụng đang mở: dù PGlite cho phép, hai
tiến trình cùng ghi là rủi ro không cần thiết. Đóng ứng dụng trước.

## 5. Bí mật và dữ liệu không được lộ

- `.env.local`, điểm chứa `auth-secret`, `*.dump`, `*.tar.gz` trong thư mục sao
  lưu: quyền `600`, không commit, không dán vào chat.
- Không đưa thư mục sao lưu vào trong repo hoặc trong `web/`.
- Bản sao lưu chứa băm mật khẩu, phiên, tiến độ và danh mục — đối xử như dữ liệu
  cá nhân, không như mã nguồn chia sẻ được.
- Không xuất `DATABASE_URL`, `BETTER_AUTH_SECRET`, `SMTP_PASSWORD` ra log.

### Bí mật nào nằm trong archive

| Nguồn | Có trong archive? |
| --- | --- |
| `<data>/auth-secret` (khóa Better Auth ứng dụng tự sinh) | **Có**, nếu tệp tồn tại |
| `<data>/postgres/**` (tài khoản, băm mật khẩu, phiên, tiến độ, danh mục) | **Có** |
| `BETTER_AUTH_SECRET` đặt qua biến môi trường | **Không** — không bao giờ đọc hay ghi |
| `DATABASE_URL`, `SMTP_*`, nội dung `.env*` | **Không** |
| Khóa/tệp riêng trong vault Obsidian, `courses/`, `review/` | **Không** |

Vì `BETTER_AUTH_SECRET` không nằm trong archive, bản phục hồi chỉ giữ được phiên
cũ khi môi trường thử dùng **đúng** secret đó. Nếu bạn đặt `BETTER_AUTH_SECRET`
mới (hoặc dùng `auth-secret` khác), các phiên cũ trong bản phục hồi sẽ không dùng
được. Tài khoản và mật khẩu vẫn còn: người học đăng nhập lại là được, không mất
tiến độ. Ngược lại, nếu ứng dụng thật đang dùng `BETTER_AUTH_SECRET` từ môi
trường thì archive **không** chứa khóa đó, và bạn không nên tạo bản thử dùng
chung secret thật.

## 6. Sao lưu khi database đã đóng

Script: `scripts/local-db.ts` (lệnh `pnpm local:db`). Sao lưu = `tar.gz` thư mục
`postgres` + `auth-secret` (nếu có) + checksum SHA-256; **không ghi đè** bản cũ.

```sh
# 1. TỰ dừng ứng dụng (Ctrl-C) và kiểm tra cổng đã trống. Guard của script chỉ là
#    lớp bổ sung, không chứng minh được tiến trình PGlite đã dừng.

# 2. Sao lưu ra thư mục ngoài repo. Truyền --data đúng thư mục ứng dụng đang dùng
#    (mặc định theo PGLITE_DATA_DIR, không có thì .data):
pnpm local:db -- backup --data .data --out ~/Backups/roadmap

# Kết quả: roadmap-pglite-<UTC>.tar.gz + .tar.gz.sha256, quyền 600
```

Điều kiện script tự kiểm tra:

- Có tiến trình đang mở tệp trong `postgres/` (theo `lsof`) → từ chối.
- Không có `lsof`, `lsof` lỗi, hoặc không thấy chính tiến trình hiện tại trong
  kết quả → từ chối (fail closed), vì không chứng minh được database đã đóng.
- Thiếu `PG_VERSION` → không phải thư mục PGlite.
- `--out` trùng, nằm trong, hoặc là thư mục cha của dữ liệu thật (kể cả qua
  symlink) → từ chối.
- Trùng tên tệp → từ chối, không ghi đè (copy độc quyền, không `rename` đè).
- Ghi vào một thư mục tạm riêng do `mkdtemp` tạo, kiểm tra khác rỗng, `chmod 600`,
  xuất bản không ghi đè, rồi xóa đúng thư mục tạm đó. Checksum cũng được ghi độc
  quyền; nếu lỗi thì cả cặp tệp bị gỡ, không để lại `.tar.gz` thiếu checksum.

Checksum kiểm tra lại bất cứ lúc nào:

```sh
cd ~/Backups/roadmap && shasum -a 256 -c roadmap-pglite-<UTC>.tar.gz.sha256
```

`restore` **bắt buộc** có `<archive>.sha256` và checksum phải khớp. Thiếu tệp
checksum là từ chối, không được coi là "đã kiểm tra".

## 7. Phục hồi vào database thử (không ghi đè dữ liệu thật)

`--to` phải là đường dẫn **chưa tồn tại**; thư mục cha phải có sẵn. Script
không tạo, không dọn và không xóa thư mục có sẵn (kể cả thư mục rỗng của bạn).

```sh
pnpm local:db -- restore \
  --archive ~/Backups/roadmap/roadmap-pglite-<UTC>.tar.gz \
  --to /tmp/roadmap-restore-thu-1 \
  --live-data .data

# Kiểm tra trên bản thử, không phải bản thật:
pnpm local:db -- inspect --data /tmp/roadmap-restore-thu-1 --migrate
```

Script từ chối khi: đích đã tồn tại (kể cả rỗng); đích trùng, nằm trong, hoặc là
thư mục cha của dữ liệu thật (kể cả qua symlink); thư mục cha thiếu hoặc không
phải thư mục; thiếu tệp checksum; checksum sai; tệp nén chứa đường dẫn tuyệt đối,
`..`, dấu `\`, symlink/hardlink/thiết bị, hoặc mục ngoài `postgres/` và
`auth-secret`; tệp nén rỗng hoặc không có `postgres/PG_VERSION`.

Thứ tự là: kiểm tra đích và checksum → đọc **danh sách** archive bằng `tar -t/-tv`
(chưa ghi gì) → giải nén vào thư mục tạm riêng → kiểm `PG_VERSION` → `mkdir` đích
(không recursive) → chuyển `postgres` và `auth-secret` sang. Nếu `mkdir` thất bại
vì ai đó vừa tạo đích, script dừng và không xóa gì. Nó chỉ xóa thư mục đích khi
chính lời gọi đó vừa tạo thành công. Nhờ vậy một archive hỏng không để lại đích
dở dang và không xóa dữ liệu của người khác.

### Mở bản phục hồi bằng giao diện (tùy chọn)

Ba biến phải đặt, và cả ba đều phải **riêng cho bản thử**:

```sh
PGLITE_DATA_DIR=/tmp/roadmap-restore-thu-1 \
BETTER_AUTH_SECRET='<chuỗi ngẫu nhiên riêng, >=32 ký tự>' \
BETTER_AUTH_URL=http://127.0.0.1:3002 APP_MODE=private \
  pnpm exec next dev --hostname 127.0.0.1 --port 3002
```

Lý do phải đặt `BETTER_AUTH_SECRET`:

- `src/lib/auth/server.ts` → `getAuthSecret()` **luôn** đọc `web/.data/auth-secret`
  khi biến môi trường không được đặt. Nó **không** theo `PGLITE_DATA_DIR`. Nếu bỏ
  qua biến này, server thử sẽ đọc khóa phiên thật của bạn (chỉ đọc, nhưng không
  cần thiết và dễ gây nhầm lẫn).
- Đặt secret riêng cũng có nghĩa phiên trong archive không dùng lại được trên
  bản thử. Đó là hành vi mong muốn: tài khoản vẫn đăng nhập lại bằng mật khẩu đã
  có trong archive, tiến độ giữ nguyên. Không bao giờ đặt bản thử chạy chung
  secret với ứng dụng thật.

Đăng nhập bằng tài khoản đã có trong bản sao lưu, mở một bài đã đánh dấu và một
liên kết media, đối chiếu với `inspect`. Đây là bản thử: không sửa dữ liệu thật,
không dùng cổng 3001 (đang là bản thật). Dừng ngay sau khi kiểm tra.

Chỉ khi bản thử đạt mới cân nhắc thay dữ liệu thật — và theo cách không xóa bản
cũ: dừng ứng dụng, đổi tên thư mục dữ liệu thật thành tên có ngày, phục hồi bản
sao vào một đường dẫn mới, mở lại và kiểm tra. Giữ bản cũ ít nhất một tuần.

## 8. Đã kiểm tra gì (và chưa kiểm tra gì)

Đã kiểm tra tự động trong `tests/local-backup.test.ts` — toàn bộ dùng thư mục tạm,
không đọc/ghi `web/.data`:

- Tiến trình con ghi dữ liệu (tài khoản quản trị, danh mục giả, tiến độ bài và
  thực hành, liên kết media), thoát; tiến trình mới mở cùng thư mục và đăng nhập
  lại, đọc đủ dữ liệu. Đây là mô phỏng khởi động lại ở tầng database.
- Từ chối sao lưu và `inspect` khi còn tiến trình thật đang mở database (kiểm tra
  bằng `lsof`, dùng một tiến trình con giữ PGlite mở); fail closed khi không có
  `lsof`; vẫn sao lưu được khi chỉ còn `postmaster.pid` sót lại, và tệp đó không
  nằm trong archive.
- Từ chối đích trùng/nằm trong/là cha của dữ liệu thật, kể cả qua symlink, cho cả
  backup và restore.
- Sao lưu tạo `.tar.gz` + `.sha256`, quyền `600`, có checksum đúng; không ghi đè
  khi trùng tên; không để lại thư mục tạm.
- Archive tấn công bị chặn trước khi giải nén: đường dẫn tuyệt đối, `..`, dấu `\`,
  symlink, hardlink, thiết bị, mục lạ, mục con dưới `auth-secret`, archive rỗng,
  thiếu `PG_VERSION`, thiếu checksum, checksum sai.
- Phục hồi vào thư mục trống rồi đăng nhập lại và đọc tiến độ; từ chối đích là dữ
  liệu thật, đích không trống, checksum sai.
- `inspect` cho cùng kết quả trước và sau khi chạy migration trên bản phục hồi
  (tài khoản, quyền quản trị, danh mục, tiến độ, liên kết) — đây là bằng chứng cho
  mục 12.3.
- Máy chủ đang chạy tại `127.0.0.1:3001`: chỉ kiểm tra đọc — trang đăng nhập `200`,
  `/` chuyển hướng `307`, `/api/progress` không phiên trả `401`, và `lsof` xác nhận
  chỉ nghe loopback.
- Luồng HTTP đầy đủ trên máy chủ **tạm** cổng 3002 (đã dừng ngay sau khi kiểm tra,
  không đụng 3001) với dữ liệu fixture: đăng nhập `200`, `/api/progress` trả đúng
  `90000: completed`, `clip-first: in_progress`, `lastOpenedLessonId=90000`,
  `/api/lesson-media` trả đúng một liên kết; **khởi động lại tiến trình** rồi đăng
  nhập lại cho cùng kết quả. Đây là bằng chứng cho 6.1 ở tầng ứng dụng.

**Chưa kiểm tra / không bảo đảm:**

- Chưa khởi động lại chính máy chủ 3001 đang chạy (không được phép dừng tiến trình
  của người học); việc giữ dữ liệu qua khởi động lại chỉ được chứng minh trên
  server tạm 3002 với fixture và ở tầng PGlite, không phải trên `.data` thật.
- Guard "database đã đóng" chỉ dựa vào `lsof`. Nó là lớp bổ sung: `lsof` chỉ thấy
  tệp đang mở và có khoảng TOCTOU giữa lúc kiểm tra và lúc `tar` đọc. Không có
  bảo đảm tuyệt đối; bắt buộc tự dừng ứng dụng trước.
- Chưa thử `lsof` trên Linux hay trong container; nếu hành vi khác macOS, guard
  sẽ từ chối (fail closed) và bạn phải tự xác nhận.
- Chưa thử backup khi thư mục đích nằm trên ổ mạng hoặc dịch vụ đồng bộ (có thể
  tự tạo thư mục, đổi quyền, hoặc không hỗ trợ sao chép độc quyền).
- Chưa mở `/bai-hoc/<id>` sau phục hồi để xem giao diện; mới kiểm tra qua API.
- Chưa thử với danh mục thật 1.622 bài hay dữ liệu cá nhân thật.
- Chưa thử đĩa đầy, tắt máy giữa lúc sao lưu, `tar` lỗi giữa chừng.
- Chưa có lịch tự động (launchd/cron) và chưa mã hóa bản sao lưu.
- Chưa thử phục hồi xong rồi chạy Playwright trên bản thử.
- Chưa thử archive lớn hơn giới hạn 200.000 mục, hoặc tên tệp có ký tự Unicode
  lạ; các trường hợp đó bị từ chối theo thiết kế, chưa có dữ liệu thực để đo.

## 9. Câu hỏi cần người học quyết

1. Thư mục sao lưu cụ thể (ổ ngoài hay dịch vụ đồng bộ đã mã hóa)?
2. Nhịp sao lưu: hằng ngày, hay trước mỗi lần cập nhật/nhập danh mục?
3. Có cần mã hóa bản sao lưu trước khi đồng bộ không?
4. Giữ bao nhiêu bản và ai xóa bản cũ?

## 10. Mã nguồn liên quan

| Việc | Tệp |
| --- | --- |
| Mở database, đường dẫn PGlite | `src/lib/db/index.ts` |
| Schema/migration khi mở | `src/lib/db/migrate.ts` |
| Khóa phiên cục bộ | `src/lib/auth/server.ts` |
| Sao lưu, phục hồi, đếm dữ liệu | `src/lib/ops/local-backup.ts`, `scripts/local-db.ts` |
| Giữ database mở để kiểm thử | `tests/fixtures/hold-database.ts` |
| Ghi/đọc fixture qua tiến trình con | `tests/fixtures/local-database.ts` |
| Kiểm thử quy trình | `tests/local-backup.test.ts`, `tests/migration.test.ts` |
