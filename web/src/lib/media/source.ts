/** Allow only the lesson page already represented by this catalog entry. */
export function validatedLessonPageUrl(value: string, lessonId: string): string | null {
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/courses\/[^/]+\/chapters\/\d+\/lessons\/(\d+)$/);
    if (url.protocol !== "https:" || url.hostname !== "seankangmvp.com" || url.port
      || url.username || url.password || url.search || url.hash || !match || match[1] !== lessonId) return null;
    return url.href;
  } catch {
    return null;
  }
}
