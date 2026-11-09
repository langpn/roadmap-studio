"use client";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "64px 20px", color: "#202c46" }}>
      <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Chưa tải được nội dung</h1>
      <p style={{ color: "#56637b", margin: "0 0 24px" }}>
        Lỗi có thể tạm thời. Tiến độ đã lưu vẫn giữ nguyên; hãy thử tải lại phần này.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        style={{ padding: "10px 16px", border: "1px solid #4d57bc", borderRadius: 6, background: "#4d57bc", color: "#fff", fontWeight: 600 }}
      >
        Thử tải lại
      </button>
    </main>
  );
}
