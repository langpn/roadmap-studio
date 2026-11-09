import type { ProgressState } from "./store";

// Giữ nguyên quy tắc gợi ý đã có cho 19 ID cũ.
const legacyLaterMilestone: Readonly<Record<string, string>> = {
  "shortform-cut": "advanced-level-two",
  "shortform-hook": "advanced-level-two",
  "longform-cut": "advanced-longform",
  "longform-assembly": "advanced-longform",
  "motion-plan": "advanced-motion",
  "motion-first-scene": "advanced-motion",
};

// Bước mới chưa bắt đầu không chen trước mốc cũ đã bắt đầu hoặc đã xong.
const newStepMilestones: Readonly<Record<string, readonly string[]>> = {
  "edit-frame": ["edit-frame-audio", "edit-subtitles", "clip-first"],
  "edit-audio": ["edit-frame-audio", "edit-subtitles", "clip-first"],
  "edit-subtitles-text": ["edit-subtitles", "clip-first"],
  "edit-export": ["edit-subtitles", "clip-first"],
  "brief-read": ["clip-brief"],
  "brief-cut": ["clip-brief"],
  "brief-broll": ["clip-brief"],
  "shortform-opening": ["shortform-hook", "advanced-level-two"],
  "shortform-broll": ["shortform-hook", "advanced-level-two"],
};

/** Không thay đổi tiến độ: chỉ bỏ qua việc chờ điều kiện và bước chưa bắt đầu trước mốc đã xong. */
export function recommendNextPractice(
  stages: readonly { practiceIds: readonly string[]; optional?: boolean }[],
  practices: readonly { id: string; recommendation?: "when_started" }[],
  progress: Readonly<Record<string, ProgressState>>,
): string | null {
  const available = new Map(practices.map((practice) => [practice.id, practice]));
  const orderedIds = stages.filter((stage) => !stage.optional).flatMap((stage) => stage.practiceIds);
  const learning = orderedIds
    .find((id) => {
      const practice = available.get(id);
      if (!practice || progress[id] === "completed") return false;
      if (progress[id] === "in_progress") return true;
      if (practice.recommendation === "when_started") return false;
      const legacyMilestone = legacyLaterMilestone[id];
      if (legacyMilestone && progress[legacyMilestone] === "completed") return false;
      return !newStepMilestones[id]?.some((milestone) =>
        progress[milestone] === "in_progress" || progress[milestone] === "completed",
      );
    });
  if (learning) return learning;
  // Nhánh tùy chọn không ngắt việc học; chỉ gợi ý khi đã chủ động bắt đầu.
  return stages.filter((stage) => stage.optional).flatMap((stage) => stage.practiceIds)
    .find((id) => available.has(id) && progress[id] === "in_progress") ?? null;
}

/** Phân biệt hết việc được gợi ý với hoàn thành tất cả các bước trên lộ trình. */
export function hasUnfinishedPractices(
  stages: readonly { practiceIds: readonly string[] }[],
  practices: readonly { id: string }[],
  progress: Readonly<Record<string, ProgressState>>,
): boolean {
  const available = new Set(practices.map((practice) => practice.id));
  return stages.some((stage) => stage.practiceIds.some((id) => available.has(id) && progress[id] !== "completed"));
}
