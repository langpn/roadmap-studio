import Link from "next/link";

export default function NotFound() {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 20px", color: "#202c46" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Không tìm thấy bài học này</h1>
      <p style={{ color: "#56637b", margin: "0 0 24px" }}>
        Bài có thể đã bị đổi mã hoặc không còn trong danh mục đã nhập. Tiến độ đã lưu của bạn không bị xóa.
      </p>
      <Link href="/" style={{ fontWeight: 600, color: "#4d57bc" }}>Về lộ trình</Link>
    </main>
  );
}
