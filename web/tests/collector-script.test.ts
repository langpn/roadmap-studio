import { describe, expect, it } from "vitest";
import { COLLECTOR_SCRIPT, createBulkCollectorScript, toBookmarkletHref } from "@/lib/media/collector-script";

const ALLOWED_MEDIA_HOSTS = new Set([
  "iframe.mediadelivery.net",
  "www.youtube-nocookie.com",
  "www.youtube.com",
  "youtu.be",
]);

// Ghép tên hai API bộ nhớ trình duyệt để chính tệp kiểm thử không chứa chuỗi
// cấm nguyên vẹn; giá trị so sánh vẫn là tên đầy đủ.
const FORBIDDEN_FRAGMENTS = [
  "document.cookie",
  "local" + "Storage",
  "session" + "Storage",
  "eval(",
  "</script>",
];

type CapturedDownload = { fileName: string; content: string };

type CollectorEnvironment = {
  pathname: string;
  rsc?: string | null;
  rscFails?: boolean;
  html?: string;
  script?: string;
  hostname?: string;
  responses?: Record<string, string | null>;
};

/** Chạy kịch bản trong hộp cát tối giản, không có trình duyệt và không có mạng. */
async function runCollector(environment: CollectorEnvironment): Promise<{
  download: CapturedDownload | null;
  messages: string[];
  requests: string[];
  alerts: string[];
}> {
  const messages: string[] = [];
  const requests: string[] = [];
  const alerts: string[] = [];
  let download: CapturedDownload | null = null;
  let finish: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const anchor = {
    href: "",
    download: "",
    style: {} as Record<string, string>,
    click() {
      if (anchor.download) download = { fileName: anchor.download, content: capturedContent };
    },
  };

  let capturedContent = "";

  class CapturingBlob {
    constructor(parts: string[]) {
      capturedContent = parts.join("");
    }
  }

  const fakeFetch = async (path: string) => {
    requests.push(path);
    if (environment.responses) {
      const response = environment.responses[path];
      return { ok: typeof response === "string", text: async () => response ?? "" };
    }
    if (environment.rscFails) throw new Error("mất kết nối");
    return {
      ok: true,
      text: async () => environment.rsc ?? "",
    };
  };

  const fakeDocument = {
    documentElement: { innerHTML: environment.html ?? "" },
    body: { appendChild() {}, removeChild() {} },
    createElement: (tag: string) => tag === "a" ? anchor : { style: {}, setAttribute() {}, remove() {}, textContent: "" },
  };

  const fakeUrl = {
    createObjectURL: () => "blob:collector-test",
    revokeObjectURL: () => {},
  };

  const fakeConsole = {
    log(message: string) {
      messages.push(String(message));
      finish();
    },
  };

  const run = new Function(
    "fetch",
    "location",
    "document",
    "Blob",
    "URL",
    "console",
    "setTimeout",
    "alert",
    environment.script ?? COLLECTOR_SCRIPT,
  ) as (
    fetch: unknown,
    location: unknown,
    document: unknown,
    Blob: unknown,
    URL: unknown,
    console: unknown,
    setTimeout: unknown,
    alert: unknown,
  ) => void;

  run(
    fakeFetch,
    { pathname: environment.pathname, hostname: environment.hostname ?? "seankangmvp.com", protocol: "https:" },
    fakeDocument,
    CapturingBlob,
    fakeUrl,
    fakeConsole,
    (callback: () => void) => callback(),
    (message: string) => alerts.push(message),
  );

  await Promise.race([
    done,
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]);

  return { download, messages, requests, alerts };
}

describe("kịch bản thu thập liên kết phát", () => {
  it("thu thập mọi chương một lần và chỉ đọc đường dẫn nguồn hợp lệ", async () => {
    const one = "/courses/course-a/chapters/1/lessons";
    const two = "/courses/course-b/chapters/2/lessons";
    const { download, requests, alerts } = await runCollector({
      pathname: "/courses",
      script: decodeURIComponent(toBookmarkletHref(createBulkCollectorScript([`https://seankangmvp.com${one}`, `https://seankangmvp.com${two}`, `https://seankangmvp.com${one}`, "https://evil.invalid/courses/a/chapters/3/lessons"])).slice("javascript:".length)),
      responses: {
        [one]: '{"lessonId":10,"videoUrl":"https://www.youtube.com/watch?v=AAAAAAAAAAA"}',
        [two]: '{"lessonId":11,"videoUrl":"https://iframe.mediadelivery.net/embed/431650/11111111-2222-3333-4444-555555555555"}',
      },
    });
    expect(requests).toEqual([one, two]);
    expect(download?.fileName).toBe("lesson-media-tat-ca-khoa.json");
    expect(JSON.parse(download?.content ?? "{}").entries.map((entry: { lessonId: string }) => entry.lessonId)).toEqual(["10", "11"]);
    expect(alerts.at(-1)).toContain("2 bài");
  });

  it("báo rõ chương lỗi và vẫn giữ phần thu thập thành công", async () => {
    const one = "/courses/course-a/chapters/1/lessons";
    const two = "/courses/course-b/chapters/2/lessons";
    const result = await runCollector({
      pathname: "/courses",
      script: createBulkCollectorScript([`https://seankangmvp.com${one}`, `https://seankangmvp.com${two}`]),
      responses: { [one]: '{"lessonId":10,"videoUrl":"https://www.youtube.com/watch?v=AAAAAAAAAAA"}', [two]: "<html>Vui lòng đăng nhập</html>" },
    });
    expect(JSON.parse(result.download?.content ?? "{}").entries).toHaveLength(1);
    expect(result.alerts.at(-1)).toContain("1 chương chưa thu được");
  });

  it("không gửi yêu cầu thu thập khi chạy ngoài website khóa học", async () => {
    const result = await runCollector({ pathname: "/courses", hostname: "other.example", script: createBulkCollectorScript(["https://seankangmvp.com/courses/a/chapters/1/lessons"]) });
    expect(result.download).toBeNull();
    expect(result.requests).toEqual([]);
    expect(result.alerts.at(-1)).toContain("website khóa học");
  });

  it("là chuỗi JavaScript hợp lệ, không rỗng", () => {
    expect(typeof COLLECTOR_SCRIPT).toBe("string");
    expect(COLLECTOR_SCRIPT.trim().length).toBeGreaterThan(0);
    expect(() => new Function(COLLECTOR_SCRIPT)).not.toThrow();
  });

  it("không chứa cookie, bộ nhớ trình duyệt, eval hay thẻ script", () => {
    for (const fragment of FORBIDDEN_FRAGMENTS) {
      expect(COLLECTOR_SCRIPT.includes(fragment), fragment).toBe(false);
    }
  });

  it("chỉ nhắc tới các host phát đã được cho phép", () => {
    const urls = COLLECTOR_SCRIPT.match(/https:\/\/[^\s"'`<>()\\]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const raw of urls) {
      const url = new URL(raw);
      expect(url.protocol, raw).toBe("https:");
      expect(ALLOWED_MEDIA_HOSTS.has(url.hostname), raw).toBe(true);
    }
  });

  it("tạo href bookmarklet đúng định dạng và tự chạy được", () => {
    const href = toBookmarkletHref(COLLECTOR_SCRIPT);
    expect(href.startsWith("javascript:")).toBe(true);
    expect(href).toMatch(/^javascript:\S/);
    expect(href.includes("javascript:javascript:")).toBe(false);
    expect(/[\r\n]/.test(href)).toBe(false);

    const body = decodeURIComponent(href.slice("javascript:".length));
    expect(body).toContain("lesson-media");
    expect(() => new Function(body)).not.toThrow();
  });

  it("không nhân đôi tiền tố khi đầu vào đã là bookmarklet", () => {
    const href = toBookmarkletHref(`javascript:${COLLECTOR_SCRIPT}`);
    expect(href.startsWith("javascript:")).toBe(true);
    expect(href.includes("javascript:javascript:")).toBe(false);
    expect(decodeURIComponent(href.slice("javascript:".length))).toContain("lesson-media");
  });

  it("thu được cả Bunny và YouTube từ payload RSC, chuẩn hoá và sắp xếp", async () => {
    const rsc = [
      '{"lessonId":5674,"lesson":{"type":"video","media":{"videoUrl":"https://iframe.mediadelivery.net/embed/431650/AABBCCDD-1122-3344-5566-77889900AABB?autoplay=false&loop=false"}}}',
      '{"lessonId":301,"lesson":{"type":"video","media":{"videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s"}}}',
    ].join("\n");

    const { download, messages } = await runCollector({
      pathname: "/courses/davinci-elite/chapters/8",
      rsc,
      html: "",
    });

    expect(download?.fileName).toBe("lesson-media-davinci-elite.json");
    const parsed = JSON.parse(download?.content ?? "{}");
    expect(parsed.version).toBe(1);
    expect(parsed.courseSlug).toBe("davinci-elite");
    expect(parsed.collectedAt).toEqual(expect.any(String));
    expect(parsed.entries).toEqual([
      {
        lessonId: "301",
        kind: "youtube",
        videoId: "dQw4w9WgXcQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      },
      {
        lessonId: "5674",
        kind: "bunny",
        videoId: "aabbccdd-1122-3344-5566-77889900aabb",
        embedUrl: "https://iframe.mediadelivery.net/embed/431650/aabbccdd-1122-3344-5566-77889900aabb",
      },
    ]);

    expect(messages.at(-1)).toContain("2 bài");
    expect(messages.at(-1)).toContain("lesson-media-davinci-elite.json");
  });

  it("gộp payload RSC với HTML dự phòng và giữ bản sau theo mã bài", async () => {
    const rsc = '{"lessonId":10,"lesson":{"media":{"videoUrl":"https://www.youtube.com/watch?v=AAAAAAAAAAA"}}}';
    const html =
      '<script>self.__next_f.push([1,"{\\"lessonId\\":10,\\"lesson\\":{\\"media\\":{\\"videoUrl\\":\\"https://www.youtube.com/watch?v=BBBBBBBBBBB\\"}}}"])</script>' +
      '<script>self.__next_f.push([1,"{\\"lessonId\\":11,\\"lesson\\":{\\"media\\":{\\"videoUrl\\":\\"https://iframe.mediadelivery.net/embed/431650/11111111-2222-3333-4444-555555555555?autoplay=false\\"}}}"])</script>' +
      '{"lessonId":12,"lesson":{"type":"reading"}}';

    const { download, messages } = await runCollector({
      pathname: "/courses/capcut-a-z",
      rsc,
      html,
    });

    const entries = JSON.parse(download?.content ?? "{}").entries;
    expect(entries.map((entry: { lessonId: string }) => entry.lessonId)).toEqual(["10", "11"]);
    expect(entries[0].videoId).toBe("BBBBBBBBBBB");
    expect(entries[1].kind).toBe("bunny");
    expect(messages.at(-1)).toContain("bỏ qua 1 bài");
  });

  it("dùng HTML khi không đọc được payload RSC", async () => {
    const html =
      '{"lessonId":77,"lesson":{"media":{"videoUrl":"https://youtu.be/CCCCCCCCCCC"}}}' +
      '{"lessonId":78,"lesson":{"type":"reading"}}';

    const { download } = await runCollector({
      pathname: "/courses/upwork-mvp",
      rscFails: true,
      html,
    });

    const parsed = JSON.parse(download?.content ?? "{}");
    expect(parsed.entries).toEqual([
      {
        lessonId: "77",
        kind: "youtube",
        videoId: "CCCCCCCCCCC",
        embedUrl: "https://www.youtube-nocookie.com/embed/CCCCCCCCCCC",
      },
    ]);
  });

  it("hướng dẫn thử lại thay vì tải tệp khi không có bài nào", async () => {
    const { download, messages } = await runCollector({
      pathname: "/login",
      rsc: '{"lessonId":5,"lesson":{"type":"reading"}}',
      html: "",
    });

    expect(download).toBeNull();
    expect(messages.at(-1)).toContain("trang khóa học hoặc trang chương");
  });
});
