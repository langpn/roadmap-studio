import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { bootstrapFirstAdmin } from "../src/lib/auth/bootstrap";
import { getAuth, getAuthSecret } from "../src/lib/auth/server";
import { closeDatabase, getDatabase } from "../src/lib/db";

async function askPassword(): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("Hãy chạy lệnh trong terminal tương tác để nhập mật khẩu an toàn.");
  stdout.write("Mật khẩu (ít nhất 10 ký tự): ");
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") { cleanup(); reject(new Error("Đã hủy thiết lập.")); return; }
        if (character === "\r" || character === "\n") { cleanup(); stdout.write("\n"); resolve(value); return; }
        if (character === "\u007f" || character === "\b") { value = value.slice(0, -1); continue; }
        if (character >= " ") value += character;
      }
    };
    const cleanup = () => { stdin.off("data", onData); stdin.setRawMode(false); stdin.pause(); };
    stdin.on("data", onData);
  });
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("Cần terminal tương tác để khởi tạo quản trị viên.");
  const rl = createInterface({ input: stdin, output: stdout });
  const name = (await rl.question("Tên hiển thị: ")).trim();
  const email = (await rl.question("Email đăng nhập: ")).trim().toLowerCase();
  rl.close();
  const password = await askPassword();
  if (!name || !email || password.length < 10) throw new Error("Tên, email và mật khẩu tối thiểu 10 ký tự là bắt buộc.");
  await bootstrapFirstAdmin(await getDatabase(), await getAuth(), await getAuthSecret(), { name, email, password });
  stdout.write("Đã tạo quản trị viên. Bạn có thể đăng nhập trên website.\n");
}

main().catch((error: unknown) => {
  stdout.write(`Không thể thiết lập: ${error instanceof Error ? error.message : "lỗi không xác định"}\n`);
  process.exitCode = 1;
}).finally(async () => { await closeDatabase(); });
