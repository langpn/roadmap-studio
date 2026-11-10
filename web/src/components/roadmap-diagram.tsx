"use client";

import type { Catalog } from "@/lib/catalog/normalize";
import type { Progress } from "@/lib/progress/store";
import type { RoadmapConfig } from "./roadmap-data";
import { EliteRoadmap } from "./elite-roadmap";

export interface RoadmapDiagramProps {
  catalog: Catalog;
  roadmap: RoadmapConfig;
  progress: Progress;
  onSelectCourse: (courseSlug: string) => void;
  onOpenPractice: (practiceId: string) => void;
  onSelectLessonById: (lessonId: string) => void;
  mode: "private" | "demo";
  recommendedPracticeId?: string | null;
}

export function RoadmapDiagram(props: RoadmapDiagramProps) {
  return <EliteRoadmap {...props} />;
}
