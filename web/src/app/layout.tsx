import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Đường dựng | Lộ trình học dựng video",
  description: "Không gian học, thực hành và theo dõi tiến độ dựng video cá nhân.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Tiện ích trình duyệt có thể thêm thuộc tính vào hai thẻ gốc trước khi React chạy.
  return <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning><body suppressHydrationWarning>{children}</body></html>;
}
