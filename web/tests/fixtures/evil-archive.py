#!/usr/bin/env python3
"""Dựng archive tấn công cho tests/local-backup.test.ts.

BSD tar trên macOS tự bỏ dấu `/` đầu tên và từ chối một số tên, nên phải dùng
tarfile để tạo đúng các trường hợp: đường dẫn tuyệt đối, `..`, symlink, hardlink,
thiết bị. Script chỉ ghi vào thư mục đích do người gọi chọn.
"""
import io
import sys
import tarfile


def add(tf, name, data=b"x", kind=tarfile.REGTYPE, link=""):
    info = tarfile.TarInfo(name)
    info.type = kind
    info.linkname = link
    info.size = len(data) if kind == tarfile.REGTYPE else 0
    tf.addfile(info, io.BytesIO(data) if kind == tarfile.REGTYPE else None)


def main():
    out = sys.argv[1]
    case = sys.argv[2]
    with tarfile.open(out, "w:gz") as tf:
        if case == "absolute":
            add(tf, "/etc/passwd")
        elif case == "dotdot":
            add(tf, "postgres/PG_VERSION", b"17\n")
            add(tf, "postgres/../../ngoai.txt")
        elif case == "symlink":
            add(tf, "postgres/PG_VERSION", b"17\n")
            add(tf, "postgres/escape", kind=tarfile.SYMTYPE, link="/etc")
        elif case == "hardlink":
            add(tf, "postgres/PG_VERSION", b"17\n")
            add(tf, "postgres/cung-file", kind=tarfile.LNKTYPE, link="postgres/PG_VERSION")
        elif case == "device":
            add(tf, "postgres/PG_VERSION", b"17\n")
            add(tf, "postgres/null", kind=tarfile.CHRTYPE)
        elif case == "foreign":
            add(tf, "postgres/PG_VERSION", b"17\n")
            add(tf, "ghi-chu.txt", b"khong phai cua ta")
        elif case == "nested-secret":
            add(tf, "auth-secret/ben-trong")
        elif case == "backslash":
            add(tf, "postgres/PG_VERSION", b"17\n")
            add(tf, "postgres\\..\\ngoai")
        elif case == "empty":
            pass
        elif case == "no-db":
            add(tf, "postgres/khong-co-gi.txt")
        else:
            raise SystemExit(f"case không hợp lệ: {case}")


if __name__ == "__main__":
    main()
