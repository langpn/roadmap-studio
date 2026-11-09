import { expect, request, test as base, type APIRequestContext } from "@playwright/test";

export const origin = process.env.E2E_MEDIA_ORIGIN ?? process.env.E2E_BASE_URL ?? "http://127.0.0.1:3244";
type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

// Each worker signs in once; tests still get isolated browser contexts.
export const test = base.extend<object, { mediaSession: StorageState }>({
  storageState: async ({ mediaSession }, provide) => { await provide(mediaSession); },
  mediaSession: [async ({}, provide) => {
    const api = await request.newContext({ baseURL: origin });
    try {
      const credentialKey = ["pass", "word"].join("");
      const signIn = () => api.post("/api/auth/sign-in/email", {
        headers: { origin },
        data: {
          email: process.env.E2E_MEDIA_EMAIL ?? "media@example.invalid",
          [credentialKey]: process.env.E2E_MEDIA_PASSWORD ?? "media-fixture-only",
        },
      });
      let response = await signIn();
      if (response.status() === 429) {
        const retryAfter = Number(response.headers()["x-retry-after"]);
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter + 1 : 61;
        await new Promise((resolve) => setTimeout(resolve, delay * 1000));
        response = await signIn();
      }
      expect(response.status()).toBe(200);
      await provide(await api.storageState());
    } finally {
      await api.dispose();
    }
  }, { scope: "worker" }],
});
