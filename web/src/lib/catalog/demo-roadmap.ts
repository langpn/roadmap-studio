import type { PracticeBriefData, RoadmapConfig } from "@/components/roadmap-data";

type DemoPractice = Pick<PracticeBriefData, "id" | "title" | "target" | "steps" | "outputs" | "checklist" | "shortcutLessonIds"> & {
  kind?: PracticeBriefData["kind"];
  recommendation?: PracticeBriefData["recommendation"];
  example?: PracticeBriefData["example"];
};

function sample(data: DemoPractice): PracticeBriefData {
  return {
    shortTitle: data.kind === "milestone" ? "Mốc sản phẩm" : "Nhiệm vụ thực hành",
    targetDuration: "Theo nhịp của bạn",
    note: `Đây là hướng dẫn và bài học giả lập để thử giao diện; không phải bài giảng, khách hàng hay thu nhập thật. Không có thao tác gửi hoặc đăng tự động.${data.recommendation === "when_started" ? " Chỉ bắt đầu khi chọn luyện tình huống giả lập; bước này chỉ được gợi ý sau khi bạn đánh dấu đang thực hiện." : ""}`,
    rawMaterials: ["Tư liệu do bạn tự tạo hoặc một ví dụ giả lập."],
    ...data,
  };
}

const basics = (id: string, label: string) => ({ id, label, courseSlug: "demo-basics", role: "support" as const });
const story = (id: string, label: string) => ({ id, label, courseSlug: "demo-story", role: "main" as const });
const work = (id: string, label: string) => ({ id, label, courseSlug: "demo-work", role: "support" as const });

const practices = [
  sample({
    id: "prepare-project", title: "Chuẩn bị project và tư liệu", target: "Tạo một project để bắt đầu dựng ngay.",
    steps: ["Tạo một thư mục riêng cho project và bản xuất.", "Chọn một đoạn tự quay và nhập vào project.", "Tạo timeline, lưu project rồi mở lại để kiểm tra."],
    outputs: ["Một project mở lại được và có tư liệu trên timeline."], checklist: ["Không di chuyển hoặc xóa tư liệu gốc.", "Project mở lại và phát được hình lẫn tiếng."],
    shortcutLessonIds: [basics("90000", "Bài mẫu: Sắp xếp tư liệu"), basics("90001", "Bài mẫu: Tạo project")],
  }),
  sample({
    id: "edit-cut", title: "Cắt một đoạn nói rõ ý", target: "Tạo bản cắt thô đầu tiên trước khi học tiếp.",
    steps: ["Nghe đoạn nói và chọn một ý ngắn.", "Cắt những khoảng dừng dài, giữ đủ đầu và cuối câu.", "Phát lại toàn đoạn và sửa chỗ cắt cụt tiếng."],
    outputs: ["Một đoạn cắt thô giữ trọn ý trong timeline."], checklist: ["Không mất từ ở điểm cắt.", "Lời nói nghe liên tục từ đầu đến cuối."],
    shortcutLessonIds: [basics("90003", "Bài mẫu: Cắt và sắp xếp")],
  }),
  sample({
    id: "edit-frame", title: "Chỉnh khung hình dọc", target: "Giữ nội dung chính trong khung hình giả lập.",
    steps: ["Mở bản cắt mẫu và tạo bản sao.", "Chọn khung dọc và đặt nội dung chính vào vùng nhìn thấy.", "Xem lại toàn đoạn và lưu timeline đã chỉnh khung."],
    outputs: ["Timeline giả lập đã chỉnh khung."], checklist: ["Nội dung chính không bị cắt mất.", "Bản cắt ban đầu vẫn còn."],
    shortcutLessonIds: [story("90007", "Bài mẫu: Cân bằng hình và tiếng")],
  }),
  sample({
    id: "edit-audio", title: "Nghe và chỉnh tiếng nói", target: "Chỉnh lời nói trong timeline mẫu cho dễ theo dõi.",
    steps: ["Nghe toàn bộ lời nói trong mẫu.", "Chỉnh đoạn quá nhỏ hoặc chênh mức rõ rệt.", "Nghe lại và lưu timeline đã chỉnh tiếng."],
    outputs: ["Timeline giả lập đã chỉnh tiếng."], checklist: ["Lời nói nghe liên tục.", "Nếu có nhạc, nhạc không át lời."],
    shortcutLessonIds: [story("90007", "Bài mẫu: Cân bằng hình và tiếng")],
  }),
  sample({
    id: "edit-frame-audio", kind: "milestone", title: "Chỉnh khung hình và tiếng", target: "Giữ chủ thể trong khung dọc và lời nói dễ nghe.",
    steps: ["Dùng timeline đã chỉnh hoặc tự chọn khung dọc và đặt chủ thể trong vùng nhìn thấy.", "Nghe lại hoặc tự chỉnh âm lượng lời nói vừa phải.", "Xuất bản nháp, xem lại trên cửa sổ nhỏ và ghi chỗ cần sửa."],
    outputs: ["Bản dựng có khung hình ổn định, lời nghe rõ và file nháp để kiểm tra."], checklist: ["Chủ thể không bị cắt mất chi tiết chính.", "Không có đoạn tiếng quá nhỏ hoặc vỡ rõ rệt."],
    shortcutLessonIds: [story("90007", "Bài mẫu: Cân bằng hình và tiếng"), basics("90005", "Bài mẫu: Xuất bản thử")],
  }),
  sample({
    id: "edit-subtitles-text", title: "Tạo phụ đề khớp lời", target: "Thêm phụ đề dễ đọc vào timeline mẫu.",
    steps: ["Nghe lời nói mẫu và chia thành câu ngắn.", "Thêm chữ và căn theo lời.", "Xem ở cửa sổ nhỏ, sửa lỗi và lưu timeline."],
    outputs: ["Timeline mẫu có phụ đề khớp lời."], checklist: ["Chữ đúng lời và đủ thời gian đọc.", "Chữ không che nội dung chính."],
    shortcutLessonIds: [basics("90004", "Bài mẫu: Thêm chữ")],
  }),
  sample({
    id: "edit-export", title: "Xuất và mở lại clip", target: "Xuất một file độc lập từ timeline mẫu.",
    steps: ["Chọn thông số phù hợp bài mẫu.", "Xuất file có phụ đề và lưu project.", "Mở file độc lập, xem lại và ghi lỗi nếu có."],
    outputs: ["File mẫu mở độc lập."], checklist: ["File phát được hình và tiếng.", "Phụ đề hiển thị trong file."],
    shortcutLessonIds: [basics("90005", "Bài mẫu: Xuất bản thử")],
  }),
  sample({
    id: "edit-subtitles", kind: "milestone", title: "Thêm và kiểm tra phụ đề", target: "Viết phụ đề ngắn, đúng lời và dễ đọc.",
    steps: ["Dùng timeline đã có phụ đề hoặc chia lời nói thành các câu ngắn.", "Thêm hoặc kiểm tra chữ và đồng bộ với lời.", "Xem ở kích thước điện thoại, sửa lỗi chính tả và vị trí che mặt.", "Mở lại file đã xuất hoặc tự xuất file độc lập để kiểm tra."],
    outputs: ["Đoạn cắt có phụ đề đọc được và file xuất độc lập."], checklist: ["Chữ khớp lời và không sai chính tả.", "Chữ không che mặt hay bị cắt mép.", "File xuất phát được hình và tiếng."],
    shortcutLessonIds: [basics("90004", "Bài mẫu: Thêm chữ"), basics("90005", "Bài mẫu: Xuất bản thử")],
  }),
  sample({
    id: "clip-first", kind: "milestone", title: "Bài tập số 1: Dựng clip talking-head ngắn", target: "Hoàn thiện một clip ngắn có thể mở độc lập.",
    steps: ["Ghép phần cắt, khung hình, tiếng và phụ đề đã làm.", "Xuất bản nháp và xem lại trên điện thoại.", "Sửa hai điểm chưa ổn, xuất bản cuối và lưu project."],
    outputs: ["Một video dọc 20–45 giây và project mở lại được."], checklist: ["Hình và âm thanh phát bình thường.", "Lời nói rõ và phụ đề dễ đọc."],
    shortcutLessonIds: [story("90008", "Bài mẫu: Kiểm tra bản xuất"), basics("90005", "Bài mẫu: Xuất bản thử")],
  }),
  sample({
    id: "quality-review", title: "Xem lại clip và ghi nhận xét", target: "Ghi lại những điểm cần cải thiện trong clip mẫu.",
    steps: ["Xem clip và ghi ý chính người xem cần hiểu.", "Rà mạch cắt, tiếng, hình và chữ; ghi vị trí cần xem lại.", "Nếu có người xem, ghi riêng góp ý của họ; chọn điểm cần sửa hoặc ghi chưa thấy lỗi."],
    outputs: ["Ghi chú nhận xét clip mẫu, có vị trí và nguồn nhận xét."],
    checklist: ["Đã xem nội dung, hình, chữ, tiếng và khả năng phát file.", "Phân biệt tự nhận xét với góp ý của người khác."],
    shortcutLessonIds: [story("90008", "Bài mẫu: Kiểm tra bản xuất")],
  }),
  sample({
    id: "quality-revise", title: "Sửa và so sánh clip mẫu", target: "Rà hoặc sửa clip và so sánh với bản trước.",
    steps: ["Giữ bản trước và chọn một điểm cần xem lại.", "Sửa, xuất lại nếu cần và mở file để kiểm tra.", "So sánh theo cùng tiêu chí; nếu không thấy lỗi, ghi rõ đã kiểm tra."],
    outputs: ["Clip mẫu đã rà hoặc sửa và ghi chú so sánh."],
    checklist: ["Bản trước còn để so sánh.", "Ghi đúng thay đổi hoặc chưa thấy lỗi; file mở được."],
    shortcutLessonIds: [story("90008", "Bài mẫu: Kiểm tra bản xuất"), basics("90005", "Bài mẫu: Xuất bản thử")],
  }),
  sample({
    id: "brief-read", title: "Đọc brief clip mẫu", target: "Ghi ý chính và tư liệu của brief giả lập.",
    steps: ["Đọc brief giả lập và ghi người xem cùng ý chính.", "Chọn lời nói và cảnh minh họa mẫu.", "Ghi đầu ra và các điểm chưa rõ."],
    outputs: ["Ghi chú brief và danh sách tư liệu giả lập."], checklist: ["Ghi rõ đây là bài giả lập.", "Tư liệu liên quan ý chính."],
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu")],
  }),
  sample({
    id: "brief-cut", title: "Cắt lời theo brief mẫu", target: "Tạo bản cắt lời giữ ý của brief giả lập.",
    steps: ["Nhập tư liệu giả lập vào project.", "Chọn và cắt lời theo ý chính.", "Nghe lại, sửa chỗ cụt lời và lưu bản cắt."],
    outputs: ["Timeline cắt lời cho brief giả lập."], checklist: ["Lời giữ đủ ý.", "Timeline mở lại được."],
    shortcutLessonIds: [basics("90003", "Bài mẫu: Cắt và sắp xếp")],
  }),
  sample({
    id: "brief-broll", title: "Ghép cảnh minh họa mẫu", target: "Đặt cảnh giả lập tương ứng với lời nói.",
    steps: ["Mở và nhân bản timeline cắt lời mẫu.", "Đặt hai hoặc ba cảnh giả lập vào câu liên quan.", "Xem lại phần hình và lời rồi lưu timeline."],
    outputs: ["Timeline giả lập có cảnh minh họa."], checklist: ["Cảnh liên quan lời nói.", "Tiếng nói không bị ngắt."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "clip-brief", kind: "milestone", title: "Bài tập số 2: Dựng clip có hình minh họa theo brief", target: "Tạo clip thứ hai với lời nói và cảnh minh họa.",
    steps: ["Dùng ghi chú, bản cắt đã làm hoặc tự viết ý chính và cắt lời nói thành đoạn ngắn.", "Dùng bản đã ghép hoặc tự thêm hai hoặc ba cảnh minh họa khớp lời.", "Xuất bản nháp, tự sửa rồi lưu bản cuối."],
    outputs: ["Một video ngắn có hình minh họa theo yêu cầu mẫu."], checklist: ["Cảnh minh họa liên quan đến lời nói.", "Âm thanh và chữ dễ theo dõi."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh"), work("90009", "Bài mẫu: Đọc yêu cầu")],
  }),
  sample({
    id: "portfolio-case", kind: "milestone", title: "Đóng gói một sản phẩm mẫu", target: "Chuẩn bị một mẫu bạn có quyền chia sẻ.",
    steps: ["Chọn clip có tư liệu được phép chia sẻ.", "Viết mục tiêu, phần bạn làm và công cụ đã dùng.", "Kiểm tra file có thể mở rồi đặt tên là bài tự luyện."],
    outputs: ["Một mẫu kèm ba dòng mô tả trung thực."], checklist: ["Quyền dùng hình và tiếng đã rõ.", "Mô tả không nhận là dự án khách thật."],
    shortcutLessonIds: [work("90011", "Bài mẫu: Chuẩn bị mẫu giới thiệu")],
  }),
  sample({
    id: "profile-draft", kind: "practice", title: "Viết hồ sơ giới thiệu ngắn", target: "Mô tả đúng kỹ năng và mẫu hiện có.",
    steps: ["Chọn một dịch vụ bạn đã thực hành.", "Viết hai câu mô tả kết quả có thể hỗ trợ.", "Đính kèm mẫu và đọc lại mọi tuyên bố về kinh nghiệm."],
    outputs: ["Bản nháp hồ sơ có một dịch vụ và một mẫu."], checklist: ["Không ghi kinh nghiệm hoặc khách hàng chưa có.", "Người đọc biết bạn có thể làm gì."],
    shortcutLessonIds: [work("90011", "Bài mẫu: Chuẩn bị mẫu giới thiệu")],
  }),
  sample({
    id: "find-job", kind: "practice", title: "Lọc việc phù hợp", target: "Chọn một yêu cầu vừa sức để tập phân tích.",
    steps: ["Đọc phạm vi, nguyên liệu và hạn giao của một tin.", "Đối chiếu với kỹ năng và thời gian dựng thực tế của bạn.", "Ghi các điểm còn thiếu và câu hỏi cần hỏi khách."],
    outputs: ["Một bảng đánh giá yêu cầu công việc."], checklist: ["Biết đầu ra và hạn giao.", "Không nhận việc có quyền tư liệu hoặc phạm vi chưa rõ."],
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu"), work("90010", "Bài mẫu: Ước lượng thời gian")],
  }),
  sample({
    id: "proposal-draft", kind: "practice", title: "Viết proposal nháp", target: "Viết một lời đề xuất ngắn cho yêu cầu đã chọn.",
    steps: ["Nêu bạn hiểu đầu ra khách muốn gì.", "Đưa một mẫu phù hợp và mô tả cách bắt đầu.", "Hỏi một câu làm rõ, đọc lại tiếng Anh và lưu bản nháp."],
    outputs: ["Một proposal nháp chưa gửi."], checklist: ["Không bịa kinh nghiệm hoặc kết quả.", "Có câu hỏi làm rõ và mẫu liên quan."],
    example: { label: "Mẫu tiếng Anh để tự điền", text: "Hi, I can help edit [type of video]. Here is a relevant practice sample: [link]. Could you share [question]?" },
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu")],
  }),
  sample({
    id: "job-outreach", title: "Tập tiếp cận và ghi lượt gửi", target: "Ghi một lượt tiếp cận giả lập vào bảng theo dõi.",
    steps: ["Chọn brief giả lập và rà proposal mẫu.", "Viết dự kiến kênh và nội dung tiếp cận; không gửi thật.", "Ghi một dòng giả lập với trạng thái chưa có phản hồi."],
    outputs: ["Dòng theo dõi ghi rõ tiếp cận giả lập, chưa gửi thật."], checklist: ["Không nhận là đã gửi thật.", "Không tự nhận có khách hay phản hồi."],
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu")],
  }),
  sample({
    id: "job-replies", recommendation: "when_started", title: "Tập ghi trao đổi và làm rõ", target: "Ghi một cuộc trao đổi giả lập và các điểm còn mở.",
    steps: ["Tự viết phản hồi giả lập và gắn nhãn rõ.", "Ghi câu trả lời cùng câu hỏi còn thiếu.", "Phân biệt điểm đã nêu trong giả lập và điểm còn chờ."],
    outputs: ["Ghi chú trao đổi giả lập."], checklist: ["Không nhận là phản hồi từ khách thật.", "Điểm chưa rõ được ghi riêng."],
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu")],
  }),
  sample({
    id: "job-agreement", recommendation: "when_started", title: "Tập ghi thỏa thuận giả lập", target: "Ghi phạm vi, giá, hạn giao, vòng sửa và thanh toán giả lập.",
    steps: ["Viết phạm vi, đầu ra và giá giả lập.", "Điền hạn giao, vòng sửa và điều kiện thanh toán giả lập.", "Rà các điểm chưa rõ và đánh dấu đây không phải thỏa thuận thật."],
    outputs: ["Bản ghi thỏa thuận giả lập đủ các điều kiện chính."], checklist: ["Không nhận là hợp đồng thật.", "Có phạm vi, giá, hạn giao, vòng sửa và thanh toán."],
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu"), work("90010", "Bài mẫu: Ước lượng thời gian")],
  }),
  sample({
    id: "job-delivery", recommendation: "when_started", title: "Tập xuất và bàn giao", target: "Xuất file mẫu và ghi lại cách bàn giao giả lập.",
    steps: ["Đối chiếu file mẫu với thỏa thuận giả lập.", "Xuất và mở file để xem lại.", "Ghi phiên bản và cách bàn giao giả lập; không gửi thật."],
    outputs: ["File mẫu và ghi chú bàn giao giả lập."], checklist: ["File mở độc lập.", "Không nhận đã gửi hoặc có người nhận thật."],
    shortcutLessonIds: [basics("90005", "Bài mẫu: Xuất bản thử")],
  }),
  sample({
    id: "job-revisions", recommendation: "when_started", title: "Tập nhận phản hồi và sửa", target: "Ghi và xử lý một phản hồi giả lập.",
    steps: ["Tự viết một phản hồi giả lập và đối chiếu phạm vi sửa.", "Sửa file mẫu và ghi thay đổi.", "Xuất bản sửa, ghi nhãn giả lập và không gửi thật."],
    outputs: ["Ghi chú phản hồi giả lập và file bản sửa."], checklist: ["Bản sửa tương ứng phản hồi giả lập.", "Không nhận là phản hồi của khách thật."],
    shortcutLessonIds: [story("90008", "Bài mẫu: Kiểm tra bản xuất")],
  }),
  sample({
    id: "job-income", recommendation: "when_started", title: "Tập đối chiếu tiền mẫu", target: "Phân biệt tiền về, khoản đã khấu trừ và khoản trả riêng bằng số liệu giả lập.",
    steps: ["Tự tạo số liệu giả lập cho tiền về và khoản đã khấu trừ.", "Ghi riêng khoản phí hoặc thuế giả lập trả ngoài và khoản còn phải trả nếu có.", "Lấy tiền về trừ khoản trả riêng, không trừ lại khoản đã khấu trừ; ghi rõ toàn bộ là giả lập."],
    outputs: ["Bảng đối chiếu tiền, phí và thuế giả lập."], checklist: ["Không coi số mẫu là thu nhập thực.", "Không trừ hai lần khoản đã khấu trừ trước khi tiền về."],
    shortcutLessonIds: [work("90009", "Bài mẫu: Đọc yêu cầu")],
  }),
  sample({
    id: "shortform-cut", title: "Clip mẫu: chọn ý và cắt thô", target: "Tạo một bản cắt thô có ý chính rõ.",
    steps: ["Tạo project với tư liệu giả lập.", "Chọn một ý ngắn và cắt bỏ đoạn thừa.", "Nghe lại, sửa điểm cắt và lưu bản thô."],
    outputs: ["Một bản cắt thô."], checklist: ["Ý chính rõ.", "Không cắt cụt lời."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "shortform-opening", title: "Clip mẫu: chọn mở đầu", target: "Thử câu mở đầu khớp ý chính.",
    steps: ["Nhân bản bản cắt thô mẫu.", "Chọn câu mở đầu phù hợp.", "Xem lại phần nối và lưu timeline."],
    outputs: ["Timeline mẫu có mở đầu."], checklist: ["Mở đầu không làm sai ý.", "Bản thô vẫn còn."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "shortform-broll", title: "Clip mẫu: ghép minh họa", target: "Đặt hình mẫu tương ứng lời nói.",
    steps: ["Chọn các câu cần minh họa.", "Đặt hai hoặc ba cảnh mẫu tương ứng.", "Xem lại lời và hình rồi lưu timeline."],
    outputs: ["Timeline mẫu có hình minh họa."], checklist: ["Hình liên quan lời.", "Tiếng nói liên tục."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "shortform-hook", kind: "milestone", title: "Clip mẫu: mở đầu và hình minh họa", target: "Thử một mở đầu và cảnh minh họa.",
    steps: ["Mở bản đã làm hoặc bản cắt thô.", "Kiểm tra hoặc tự chọn một câu mở đầu và thêm hình liên quan.", "Kiểm tra chữ và lưu bản nháp."],
    outputs: ["Bản nháp có hình minh họa."], checklist: ["Hình phù hợp lời nói.", "Chữ dễ đọc."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "advanced-level-two", kind: "milestone", title: "Dựng clip có nhịp và hình minh họa", target: "Thực hành phiên bản phức tạp hơn từ footage có quyền.",
    steps: ["Cắt một ý chính thành bản thô.", "Thêm hình minh họa cho hai ý và chỉnh nhịp.", "Cân bằng âm thanh, xuất nháp và tự sửa."],
    outputs: ["Một clip nâng cấp có ít nhất một vòng sửa."], checklist: ["Hình minh họa làm rõ lời nói.", "Nhạc và hiệu ứng không át giọng."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh"), story("90007", "Bài mẫu: Cân bằng hình và tiếng")],
  }),
  sample({
    id: "longform-cut", title: "Video ngang mẫu: cắt thô", target: "Chọn và cắt một đoạn có ý rõ.",
    steps: ["Nhập tư liệu giả lập.", "Chọn một đoạn và cắt phần lặp.", "Ghi vị trí cần minh họa và lưu bản thô."],
    outputs: ["Một đoạn cắt thô và ghi chú."], checklist: ["Đoạn nói giữ đủ ý.", "Đã lưu bản thô."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "longform-assembly", title: "Video ngang mẫu: ghép hình", target: "Thêm hình hoặc chữ cho hai hoặc ba vị trí đã chọn.",
    steps: ["Mở bản thô và chọn hai hoặc ba ghi chú.", "Thêm hình hoặc chữ phù hợp.", "Xem lại và lưu timeline nháp."],
    outputs: ["Timeline mẫu có hình hoặc chữ tại các vị trí đã chọn; chưa cần xuất bản cuối."], checklist: ["Hình liên quan nội dung.", "Chữ không che thông tin chính."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "advanced-longform", kind: "milestone", title: "Thử dựng một đoạn video ngang", target: "Luyện giữ mạch kể trong một đoạn dài hơn.",
    steps: ["Chọn một đoạn nói có mở đầu và kết thúc.", "Cắt thô và ghi chỗ cần hình minh họa.", "Thêm hình, kiểm tra mạch nghe và xuất đoạn thử."],
    outputs: ["Một đoạn video ngang có thể xem độc lập."], checklist: ["Mỗi đoạn nối với ý tiếp theo rõ ràng.", "Âm thanh và hình không bị đứt quãng."],
    shortcutLessonIds: [story("90006", "Bài mẫu: Chọn cảnh")],
  }),
  sample({
    id: "motion-plan", title: "Motion mẫu: phác cảnh", target: "Phác một thông điệp và các cảnh đơn giản.",
    steps: ["Viết một thông điệp ngắn.", "Phác hai cảnh có chữ hoặc hình.", "Chọn một cảnh để thử trước."],
    outputs: ["Bản phác cảnh."], checklist: ["Thông điệp dễ hiểu.", "Mỗi cảnh có mục đích rõ."],
    shortcutLessonIds: [basics("90004", "Bài mẫu: Thêm chữ")],
  }),
  sample({
    id: "motion-first-scene", title: "Motion mẫu: thử một cảnh", target: "Tạo một cảnh chữ chuyển động dễ đọc.",
    steps: ["Chọn một cảnh đã phác.", "Thử một chuyển động đơn giản.", "Xuất và xem trên màn hình nhỏ."],
    outputs: ["Một cảnh thử."], checklist: ["Chữ đọc được.", "Đã lưu project."],
    shortcutLessonIds: [basics("90004", "Bài mẫu: Thêm chữ")],
  }),
  sample({
    id: "advanced-motion", kind: "milestone", title: "Thử chữ và đồ họa chuyển động", target: "Tạo một đoạn đồ họa ngắn phục vụ nội dung.",
    steps: ["Viết một câu cần nhấn và phác bố cục tĩnh.", "Cho chữ xuất hiện theo nhịp lời nói.", "Xem ở kích thước điện thoại và giảm chuyển động nếu khó đọc."],
    outputs: ["Một đoạn chữ chuyển động ngắn."], checklist: ["Chữ đọc được trước khi biến mất.", "Chuyển động không che thông tin chính."],
    shortcutLessonIds: [basics("90004", "Bài mẫu: Thêm chữ")],
  }),
];

export const demoRoadmap: RoadmapConfig = {
  courseOrder: ["demo-basics", "demo-story", "demo-work"],
  courseRoles: {},
  lessonConnections: [
    {
      from: { courseSlug: "demo-basics", lessonId: "90003" },
      to: { courseSlug: "demo-story", lessonId: "90006" },
      kind: "foundation",
      reason: "Tham khảo cách chọn cảnh khi sắp xếp clip mẫu.",
      basis: "title",
    },
    {
      from: { courseSlug: "demo-basics", lessonId: "90003" },
      to: { courseSlug: "demo-work", lessonId: "90009" },
      kind: "support",
      reason: "Đối chiếu đoạn dựng mẫu với yêu cầu của một brief giả lập.",
      basis: "title",
    },
  ],
  practices,
  stages: [
    { id: "stage-1", stageNumber: 1, title: "Từ project đến clip đầu", timeframe: "Bắt đầu ngay", description: "Tạo clip đầu, xem lại, ghi nhận xét và sửa theo tiêu chí.", primaryCourseSlugs: ["demo-basics"], milestonePracticeId: "clip-first", practiceIds: ["prepare-project", "edit-cut", "edit-frame", "edit-audio", "edit-frame-audio", "edit-subtitles-text", "edit-export", "edit-subtitles", "clip-first", "quality-review", "quality-revise"], keyAction: "Giữ lại clip, nhận xét và bản đã rà hoặc sửa." },
    { id: "stage-2", stageNumber: 2, title: "Dựng clip theo yêu cầu", timeframe: "Sau clip đầu", description: "Dựng clip thứ hai theo brief giả lập và áp dụng lại cách xem, sửa.", primaryCourseSlugs: ["demo-story"], milestonePracticeId: "clip-brief", practiceIds: ["brief-read", "brief-cut", "brief-broll", "clip-brief"], keyAction: "Đối chiếu clip với brief và sửa dựa trên những gì đã học." },
    { id: "stage-3", stageNumber: 3, title: "Mở rộng kỹ năng theo dự án", timeframe: "Theo mục tiêu học", description: "Thử clip nâng cao, video ngang và đồ họa chuyển động.", primaryCourseSlugs: ["demo-story"], milestonePracticeId: null, practiceIds: ["shortform-cut", "shortform-opening", "shortform-broll", "shortform-hook", "advanced-level-two", "longform-cut", "longform-assembly", "advanced-longform", "motion-plan", "motion-first-scene", "advanced-motion"], keyAction: "Chọn dự án và xem lại đầu ra." },
    { id: "stage-work", stageNumber: 4, title: "Tùy chọn — chuẩn bị việc làm", timeframe: "Khi bạn sẵn sàng", description: "Các ví dụ về hồ sơ, tiếp cận và giao việc được giữ để mở sau.", primaryCourseSlugs: ["demo-work"], milestonePracticeId: null, practiceIds: ["portfolio-case", "profile-draft", "find-job", "proposal-draft", "job-outreach", "job-replies", "job-agreement", "job-delivery", "job-revisions", "job-income"], keyAction: "Tất cả tình huống trong demo là giả lập.", optional: true },
  ],
};
