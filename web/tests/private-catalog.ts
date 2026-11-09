import { existsSync } from "node:fs";
import path from "node:path";

// The private catalog is intentionally excluded from the shareable source tree.
const root = path.resolve(process.cwd(), "..");
const files = [
  "courses/baby-resolve/danh-muc.json", "courses/elite/danh-muc.json",
  "courses/freelance-mvp/danh-muc.json", "courses/elite-pro/danh-muc.json",
  "review/khoa-khac-20261106/speed-ramping.json", "review/khoa-khac-20261106/upwork-mvp.json",
  "review/khoa-khac-20261106/capcut-a-z.json", "review/khoa-khac-20261106/fusion-101.json",
  "review/khoa-khac-20261106/keyframe-animation.json",
];

export const hasPrivateCatalog = !process.env.CATALOG_MANIFEST && !process.env.CATALOG_SOURCE_ROOT
  && files.every((file) => existsSync(path.join(root, file)));
