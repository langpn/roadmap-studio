import { z } from "zod";
import crossRows from "./elite-cross-links.json";
import internalRows from "./elite-internal-links.json";
import proRows from "./elite-pro-extra-links.json";
import { eliteManualLinks } from "./elite-manual-links";
import type { LessonConnection } from "./lesson-links";

const curatedRows = z.array(z.tuple([
  z.string().regex(/^\d+$/),
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  z.string().regex(/^\d+$/),
  z.enum(["foundation", "support", "advanced"]),
  z.string().min(11).max(200),
])).parse([...crossRows, ...internalRows, ...proRows]);

export const eliteRelatedLinks: LessonConnection[] = [
  ...eliteManualLinks,
  ...curatedRows.map(([from, courseSlug, to, kind, reason]): LessonConnection => ({
    from: { courseSlug: "elite", lessonId: from },
    to: { courseSlug, lessonId: to },
    kind,
    reason,
    basis: "title",
  })),
];
