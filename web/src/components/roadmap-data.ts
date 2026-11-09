import { additionalPractices } from "./roadmap-practices";
import type { LessonConnection } from "@/lib/catalog/lesson-links";
import { eliteRelatedLinks } from "@/lib/catalog/elite-related-links";

export interface PracticeBriefData {
  id: string;
  shortTitle: string;
  title: string;
  targetDuration: string;
  target: string;
  note: string;
  rawMaterials: string[];
  steps?: string[];
  outputs: string[];
  checklist: string[];
  kind?: "practice" | "milestone";
  /** Việc phụ thuộc phản hồi bên ngoài chỉ được gợi ý sau khi người học chủ động bắt đầu. */
  recommendation?: "when_started";
  example?: { label: string; text: string };
  shortcutLessonIds: { id: string; label: string; courseSlug: string; role?: "main" | "support"; purpose?: string }[];
}

export interface RoadmapStageData {
  id: string;
  stageNumber: number;
  title: string;
  timeframe: string;
  description: string;
  primaryCourseSlugs: string[];
  milestonePracticeId: string | null;
  practiceIds: string[];
  keyAction: string;
  /** Nhánh tự chọn không tự được gợi ý khi chưa bắt đầu. */
  optional?: boolean;
}

export interface RoadmapConfig {
  courseOrder: string[];
  courseRoles: Record<string, { role: string; verificationNote: string }>;
  practices: PracticeBriefData[];
  stages: RoadmapStageData[];
  lessonConnections?: LessonConnection[];
}

export const ROADMAP_COURSE_ORDER: string[] = [
  "elite",
  "baby-resolve",
  "freelance-mvp",
  "upwork-mvp",
  "keyframe-animation",
  "fusion-101",
  "speed-ramping",
  "capcut-a-z",
  "elite-pro",
];

export const COURSE_ROLES: Record<string, { role: string; verificationNote: string }> = {
  "baby-resolve": {
    role: "Nhánh nền tảng bổ trợ: tạo project, cắt thô, text cơ bản và xuất file khi cần.",
    verificationNote: "Chương Edit Page và Deliver Page có các bài lối tắt đã đối chiếu phần chữ.",
  },
  "elite": {
    role: "Trục thực hành: cắt RAW, bố cục, âm thanh và hoàn thiện sản phẩm theo dự án.",
    verificationNote: "Mở một bài để xem các gợi ý nền tảng, bổ trợ và học sâu khi có; liên kết được chọn theo tiêu đề.",
  },
  "freelance-mvp": {
    role: "Nhánh tự chọn về tìm việc và trao đổi với khách khi bạn muốn tìm hiểu.",
    verificationNote: "Không bắt buộc để tiếp tục luyện kỹ năng dựng.",
  },
  "upwork-mvp": {
    role: "Kênh nhận việc từ xa: cách tìm việc, viết proposal, giao tiếp và nhận tiền.",
    verificationNote: "Bổ sung nhánh tìm việc; các bài 2110, 2113, 2114, 2117 đã đối chiếu chữ.",
  },
  "keyframe-animation": {
    role: "Kỹ năng chuyển động: điều khiển keyframe, tạo chữ và đồ họa động mượt mà.",
    verificationNote: "Nhánh mở rộng tự chọn; bài 3003 giới thiệu phạm vi khóa.",
  },
  "fusion-101": {
    role: "Compositing & kỹ xảo: tìm hiểu node-based Fusion sau khi vững Edit Page.",
    verificationNote: "Chưa bắt buộc cho clip đầu; bài 2920 giới thiệu phạm vi khóa.",
  },
  "speed-ramping": {
    role: "Chuyển tốc độ: điều khiển nhịp điệu video và đồng bộ âm thanh chuyển cảnh.",
    verificationNote: "Bài 4046 có danh sách tài nguyên và phím tắt đã đối chiếu chữ.",
  },
  "capcut-a-z": {
    role: "Công cụ bổ trợ: nhánh tùy chọn nếu brief đòi hỏi CapCut.",
    verificationNote: "Resolve vẫn là công cụ ưu tiên chính hiện tại.",
  },
  "elite-pro": {
    role: "Thư viện tra cứu: tình huống thực chiến và kho feedback học viên.",
    verificationNote: "Thư viện 1.160 bài, gồm Feedback và hồ sơ do giảng viên đưa cho học viên tham khảo; chưa xác minh nội dung video.",
  },
};

export const PRACTICES: PracticeBriefData[] = [
  {
    id: "clip-first",
    kind: "milestone",
    shortTitle: "Bài tập 1: Talking-head ngắn (20–45s)",
    title: "Bài tập số 1: Dựng clip talking-head ngắn",
    targetDuration: "Video dài 20–45 giây",
    target: "Tự làm video dọc 20–45s để luyện thao tác cơ bản và hướng tới mẫu portfolio đầu tiên.",
    note: "Đây là brief giả lập để tự luyện, không phải công việc khách thật. Hãy ghi rõ là bài thực hành khi chia sẻ.",
    rawMaterials: [
      "Tự quay hoặc ghi âm 1–3 phút footage bản thân, bàn tay hoặc thao tác màn hình.",
      "Lời thoại mẫu: 'Bạn thường mất nhiều thời gian để bắt đầu buổi sáng? Hãy thử chuẩn bị ba việc từ tối hôm trước: chọn sẵn quần áo, viết một việc quan trọng nhất cho ngày mai, và để điện thoại xa giường...'",
      "Không bắt buộc nhạc, logo hay B-roll phức tạp để hoàn thành bài đầu.",
    ],
    steps: [
      "Mở lại đoạn cắt thô đã lưu, chọn phần lời truyền đạt một ý và kiểm tra không mất từ ở điểm cắt.",
      "Chỉnh bố cục dọc và âm lượng lời nói; thêm phụ đề ngắn theo từng câu đã nghe.",
      "Xuất một bản MP4, xem lại trên điện thoại hoặc cửa sổ nhỏ, ghi các điểm cần sửa hoặc ghi rõ chưa thấy lỗi.",
      "Sửa những điểm cần thiết, xuất bản cuối và lưu project cùng footage gốc để có thể mở lại.",
    ],
    outputs: [
      "Project DaVinci Resolve riêng biệt, footage gốc lưu trữ an toàn.",
      "Bản xuất MP4 dọc 1080 × 1920 (nếu cấu hình cho phép), thời lượng 20–45 giây.",
      "Lời thoại rõ ràng, các câu giữ đủ ý, chữ phụ đề dễ đọc trên điện thoại.",
    ],
    checklist: [
      "Mở được file xuất riêng biệt; hình dọc và tiếng phát bình thường từ đầu đến cuối.",
      "Độ dài khoảng 20–45 giây; không có khoảng đen, câu lặp hoặc đoạn im thừa rõ rệt.",
      "Các câu giữ đủ ý, không cụt âm hoặc mất lời ở các điểm cắt.",
      "Chữ không sai nội dung, dễ đọc trên điện thoại và không che vùng mặt hoặc chi tiết chính.",
      "Giọng nghe rõ, không vỡ tiếng; nhạc (nếu có) không át lời và có quyền sử dụng.",
      "Ghi lại tổng thời gian thực làm, nguồn footage và điểm muốn cải thiện ở bản sau.",
    ],
    shortcutLessonIds: [
      { id: "5864", label: "Elite — Hoàn thiện Reel 1", courseSlug: "elite", role: "support", purpose: "Nếu cần, đối chiếu thêm một ví dụ hoàn thiện." },
      { id: "2207", label: "Baby Resolve — Edit Page (Nhập footage)", courseSlug: "baby-resolve" },
      { id: "5860", label: "Elite — Cắt RAW (Chọn câu rõ nhất, cắt khoảng dừng)", courseSlug: "elite" },
      { id: "5861", label: "Elite — Bố cục & âm thanh (Khung dọc, giọng dễ nghe)", courseSlug: "elite" },
      { id: "2220", label: "Baby Resolve — Text (Tiêu đề ngắn & phụ đề thủ công)", courseSlug: "baby-resolve" },
      { id: "2262", label: "Baby Resolve — Deliver (Xuất MP4 dọc)", courseSlug: "baby-resolve" },
    ],
  },
  {
    id: "clip-brief",
    kind: "milestone",
    shortTitle: "Bài tập 2: Clip có hình minh họa (20–35s)",
    title: "Bài tập số 2: Dựng clip có hình minh họa theo brief",
    targetDuration: "Video dài 20–35 giây",
    target: "Mẫu portfolio thứ hai từ brief giả lập: video dọc 20–35s có lời nói, chữ và 2–3 cảnh minh họa liên quan.",
    note: "Đây là brief giả lập để tự luyện. Tập trung vào lời rõ, cắt đủ ý và chữ đọc được; sau khi hoàn thành, áp dụng lại cách xem, nhận phản hồi và sửa đã luyện với clip đầu.",
    rawMaterials: [
      "1–3 phút footage lời nói tự quay hoặc có điều khoản cho phép luyện tập, cùng 2–3 cảnh minh họa tự tạo hoặc có quyền sử dụng.",
      "Lời thoại mẫu tiếng Việt: 'Bạn không cần làm hết mọi việc hôm nay. Hãy chọn một việc nhỏ và dành mười phút cho nó. Đặt điện thoại sang một bên và bắt đầu từ bước đầu tiên...'",
      "Lựa chọn tiếng Anh (không bắt buộc, chỉ dùng nếu có người kiểm tra phát âm và chữ): 'You don't need to finish everything today. Pick one small task and give it ten minutes...'",
      "Có thể dùng ghi chú, bản cắt lời và timeline ghép minh họa đã làm ở các bước trước; cũng có thể tự làm trực tiếp từ footage.",
    ],
    steps: [
      "Dùng ghi chú và bản cắt lời nếu đã có; nếu chưa, viết một câu mô tả người xem và ý chính, cắt lời nói thành đoạn 20–35 giây giữ đủ ý.",
      "Dùng bản đã ghép minh họa nếu có hoặc chọn 2–3 cảnh có quyền dùng, đặt vào đúng câu tương ứng và giữ tiếng nói liên tục.",
      "Thêm chữ, điều chỉnh âm thanh rồi xuất bản nháp; xem trên điện thoại, ghi các điểm cần sửa hoặc chưa thấy lỗi.",
      "Sửa nếu cần, xuất bản cuối và lưu cả phiên bản nháp lẫn project; chỉ chia sẻ công khai khi quyền từng tư liệu đã rõ.",
    ],
    outputs: [
      "File MP4 dọc 1080 × 1920 mở được độc lập trên điện thoại và máy tính.",
      "Cảnh minh họa chèn khéo léo trong lúc lời nói tiếp tục nghe rõ, không che nội dung chính.",
      "Đã ghi thay đổi sau vòng xem lại hoặc ghi rõ chưa phát hiện lỗi, cùng tổng thời gian làm.",
    ],
    checklist: [
      "Có file MP4 mở được từ đầu đến cuối; hình dọc và lời nói không bị ngắt quãng.",
      "Clip giữ đủ ý, điểm cắt tự nhiên; cảnh minh họa liên quan trực tiếp đến lời đang nói.",
      "Tiêu đề và phụ đề đúng ngôn ngữ, đủ lớn để đọc trên màn hình điện thoại.",
      "Tiếng nói nghe rõ, âm lượng cân đối, không có đoạn vỡ tiếng rõ rệt.",
      "Đã xem lại theo mục tiêu, sửa điểm cần thiết hoặc ghi rõ chưa phát hiện lỗi.",
      "Xác nhận quyền sử dụng hình ảnh, âm thanh trước khi đưa vào portfolio công khai.",
    ],
    shortcutLessonIds: [
      { id: "5865", label: "Elite — Hoàn thiện Reel 2", courseSlug: "elite", role: "support", purpose: "Nếu cần, tham khảo thêm một ví dụ hoàn thiện." },
      { id: "2207", label: "Baby Resolve — Edit Page (Tổ chức tư liệu)", courseSlug: "baby-resolve" },
      { id: "5860", label: "Elite — Cắt RAW (Cắt gọn kịch bản)", courseSlug: "elite" },
      { id: "5861", label: "Elite — Bố cục & âm thanh (Cân bằng tiếng nói và minh họa)", courseSlug: "elite" },
      { id: "2220", label: "Baby Resolve — Text (Căn chỉnh phụ đề)", courseSlug: "baby-resolve" },
      { id: "5862", label: "Elite — Phụ đề & căn chỉnh", courseSlug: "elite" },
      { id: "2262", label: "Baby Resolve — Deliver (Xuất bản cuối)", courseSlug: "baby-resolve" },
      { id: "2113", label: "Upwork MVP — Lọc tin (Đối chiếu yêu cầu brief thật)", courseSlug: "upwork-mvp" },
    ],
  },
];

export const ROADMAP_STAGES: RoadmapStageData[] = [
  {
    id: "stage-1",
    stageNumber: 1,
    title: "Chặng 1: Nền tảng dựng cắt & Clip đầu tiên",
    timeframe: "Theo nhịp của bạn",
    description: "Từ project đến clip đầu: cắt, chỉnh hình và tiếng, thêm chữ, xuất file rồi xem lại và sửa có mục đích.",
    primaryCourseSlugs: ["elite", "baby-resolve"],
    milestonePracticeId: "clip-first",
    practiceIds: ["prepare-project", "edit-cut", "edit-frame", "edit-audio", "edit-frame-audio", "edit-subtitles-text", "edit-export", "edit-subtitles", "clip-first", "quality-review", "quality-revise"],
    keyAction: "Có clip đầu, ghi nhận xét theo tiêu chí và lưu bản sửa để so sánh.",
  },
  {
    id: "stage-2",
    stageNumber: 2,
    title: "Chặng 2: Dựng clip theo yêu cầu",
    timeframe: "Sau clip đầu",
    description: "Dựng clip thứ hai theo brief giả lập và áp dụng lại cách đánh giá, sửa đã luyện.",
    primaryCourseSlugs: ["elite", "baby-resolve"],
    milestonePracticeId: "clip-brief",
    practiceIds: ["brief-read", "brief-cut", "brief-broll", "clip-brief"],
    keyAction: "Hoàn thiện clip theo brief, đối chiếu và sửa dựa trên những gì đã học.",
  },
  {
    id: "stage-3",
    stageNumber: 3,
    title: "Chặng 3: Mở rộng kỹ năng theo dự án",
    timeframe: "Theo mục tiêu học của bạn",
    description: "Luyện clip ngắn, video ngang và chuyển động; so sánh bản nháp với bản đã sửa ở mỗi dự án.",
    primaryCourseSlugs: ["elite", "keyframe-animation", "fusion-101", "speed-ramping", "capcut-a-z", "elite-pro"],
    milestonePracticeId: null,
    practiceIds: ["shortform-cut", "shortform-opening", "shortform-broll", "shortform-hook", "advanced-level-two", "longform-cut", "longform-assembly", "advanced-longform", "motion-plan", "motion-first-scene", "advanced-motion"],
    keyAction: "Chọn dự án phù hợp, luyện với tư liệu có quyền và xem lại đầu ra.",
  },
  {
    id: "stage-work",
    stageNumber: 4,
    title: "Chặng 4: Tùy chọn — chuẩn bị việc làm",
    timeframe: "Khi bạn sẵn sàng",
    description: "Lưu lại portfolio, hồ sơ, proposal và quy trình giao việc để tự chọn tìm hiểu sau.",
    primaryCourseSlugs: ["freelance-mvp", "upwork-mvp"],
    milestonePracticeId: null,
    practiceIds: ["portfolio-case", "profile-draft", "find-job", "proposal-draft", "job-outreach", "job-replies", "job-agreement", "job-delivery", "job-revisions", "job-income"],
    keyAction: "Mở nhánh này khi bạn muốn; tiến độ đã lưu vẫn được giữ.",
    optional: true,
  },
];

const allPractices = [...PRACTICES, ...additionalPractices];

export const privateRoadmap: RoadmapConfig = {
  courseOrder: ROADMAP_COURSE_ORDER,
  courseRoles: COURSE_ROLES,
  lessonConnections: eliteRelatedLinks,
  practices: ROADMAP_STAGES.flatMap((stage) => stage.practiceIds)
    .map((id) => allPractices.find((practice) => practice.id === id))
    .filter((practice): practice is PracticeBriefData => Boolean(practice)),
  stages: ROADMAP_STAGES,
};
