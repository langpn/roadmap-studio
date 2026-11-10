import { PGlite } from "@electric-sql/pglite";
import path from "node:path";

// Giữ database mở để kiểm thử việc từ chối sao lưu khi còn tiến trình dùng dữ liệu.
// Phải nằm trong dự án để phân giải được @electric-sql/pglite.

const dataDir = process.env.PGLITE_DATA_DIR;
if (!dataDir) throw new Error("Thiếu PGLITE_DATA_DIR.");
const client = new PGlite(path.join(dataDir, "postgres"));
await client.query("select 1");
console.log("holding");

// Tự đóng sau 15 giây để không treo tiến trình nếu kiểm thử cha thoát bất thường.
setTimeout(() => { void client.close(); }, 15_000);
