export function hasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configured = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000";
  try { return origin === new URL(configured).origin; } catch { return false; }
}
