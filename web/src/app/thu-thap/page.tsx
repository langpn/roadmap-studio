import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LessonMediaImport from "@/components/lesson-media-import";
import { getAuth } from "@/lib/auth/server";
import { COLLECTOR_SCRIPT, createBulkCollectorScript, toBookmarkletHref } from "@/lib/media/collector-script";
import { getActiveCatalog } from "@/lib/catalog/active";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Thu thập liên kết phát bài học | Đường dựng",
  description: "Nhập bảng ánh xạ bài học sang liên kết phát do chính bạn thu thập từ website gốc.",
};

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default async function ThuThapPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/dang-nhap");

  const catalog = await getActiveCatalog();
  const chapterUrls = catalog.courses.flatMap((course) => course.chapters.map((chapter) => chapter.url));
  // React 19 vô hiệu hoá href javascript:, nên chèn HTML sau khi escape thuộc tính.
  const bookmarkletMarkup = `<a draggable="true" href="${escapeHtmlAttribute(
    toBookmarkletHref(createBulkCollectorScript(chapterUrls)),
  )}" title="Kéo nút này vào thanh dấu trang để thu thập tất cả chương.">Thu thập liên kết tất cả</a>
  <a draggable="true" href="${escapeHtmlAttribute(toBookmarkletHref(COLLECTOR_SCRIPT))}" title="Thu thập riêng trang khóa học hoặc chương đang mở.">Thu riêng chương</a>`;

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link className={styles.backLink} href="/">
            ← Về lộ trình
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Thu thập liên kết phát bài học</h1>
          <p className={styles.lead}>
            Phần dữ liệu này do chính bạn thu thập từ tài khoản học của bạn trên website gốc. Ứng dụng
            không đọc cookie, không đăng nhập thay bạn và không tải video về máy.
          </p>
        </div>

        <section aria-labelledby="cach-thu-thap" className={styles.card}>
          <h2 className={styles.cardTitle} id="cach-thu-thap">
            Ba bước thu thập
          </h2>

          <ol className={styles.steps}>
            <li className={styles.step}>
              <span aria-hidden="true" className={styles.stepNumber}>
                1
              </span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>Lưu nút thu thập vào thanh dấu trang</p>
                <p className={styles.stepText}>
                  Kéo nút &ldquo;Thu thập liên kết tất cả&rdquo; vào thanh dấu trang của trình duyệt.
                  Nếu danh mục thay đổi, hãy kéo lại nút để cập nhật danh sách chương.
                </p>
                <div className={styles.bookmarkletRow}>
                  <div
                    className={styles.bookmarkletHost}
                    dangerouslySetInnerHTML={{ __html: bookmarkletMarkup }}
                  />
                </div>
                <p className={styles.smallNote}>
                  Nếu trình duyệt chặn kéo-thả: bấm chuột phải vào nút, chọn &ldquo;Thêm vào dấu
                  trang&rdquo; (hoặc &ldquo;Bookmark this link&rdquo;), rồi sửa địa chỉ của dấu trang
                  nếu cần.
                </p>
              </div>
            </li>

            <li className={styles.step}>
              <span aria-hidden="true" className={styles.stepNumber}>
                2
              </span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>Mở website khóa học và thu thập</p>
                <p className={styles.stepText}>
                  Đăng nhập vào website gốc, mở trang khóa học, rồi bấm nút vừa lưu. Nút sẽ đọc lần
                  lượt các chương trong danh mục và tải về một tệp JSON. Giữ trang mở đến khi có thông báo.
                </p>
              </div>
            </li>

            <li className={styles.step}>
              <span aria-hidden="true" className={styles.stepNumber}>
                3
              </span>
              <div className={styles.stepBody}>
                <p className={styles.stepTitle}>Nhập tệp JSON vào ứng dụng</p>
                <p className={styles.stepText}>
                  Kéo tệp JSON vừa tải vào ô bên dưới, hoặc bấm &ldquo;Chọn tệp JSON&rdquo;. Ứng dụng
                  sẽ kiểm tra dữ liệu trước khi lưu.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section aria-labelledby="luu-y-quan-trong" className={styles.card}>
          <h2 className={styles.cardTitle} id="luu-y-quan-trong">
            Lưu ý quan trọng
          </h2>

          <ul className={styles.noteList}>
            <li className={`${styles.noteItem} ${styles.noteWarning}`}>
              <strong>Phải đóng DevTools trước khi mở trang khóa học.</strong> Website gốc chặn truy cập
              khi phát hiện DevTools đang mở; hãy đóng bảng công cụ dành cho nhà phát triển rồi tải lại
              trang.
            </li>
            <li className={styles.noteItem}>
              <strong>Nút thu tất cả chỉ đọc các chương trong danh mục hiện tại.</strong> Nếu một số
              chương không thu được, bạn có thể chạy lại hoặc dùng nút &ldquo;Thu riêng chương&rdquo;.
            </li>
            <li className={styles.noteItem}>
              Chỉ bấm nút khi đang ở đúng trang của website gốc. Tệp thu được chỉ chứa liên kết nhúng
              công khai, không chứa token, cookie hay thông tin phiên đăng nhập của bạn.
            </li>
          </ul>
        </section>

        <section aria-labelledby="nhap-du-lieu" className={styles.card}>
          <h2 className={styles.cardTitle} id="nhap-du-lieu">
            Nhập tệp đã thu thập
          </h2>
          <p className={styles.cardLead}>
            Dữ liệu được kiểm tra ngay trên trình duyệt rồi mới gửi tới tài khoản của bạn. Liên kết chỉ
            dùng để phát bài học trong ứng dụng.
          </p>
          <LessonMediaImport />
        </section>

        <p className={styles.footerNote}>
          Bạn có thể quay lại bước này bất cứ lúc nào để bổ sung liên kết cho các khóa còn thiếu.{" "}
          <Link className={styles.footerLink} href="/">
            Về lộ trình
          </Link>
        </p>
      </main>
    </div>
  );
}
