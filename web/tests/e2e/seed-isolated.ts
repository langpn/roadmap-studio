import { bootstrapFirstAdmin } from "../../src/lib/auth/bootstrap";
import { getAuth, getAuthSecret } from "../../src/lib/auth/server";
import { closeDatabase, getDatabase } from "../../src/lib/db";

// Only used against the temporary test database; no real credentials are involved.
await bootstrapFirstAdmin(await getDatabase(), await getAuth(), await getAuthSecret(), {
  name: "Người thử quản trị",
  email: "owner@example.invalid",
  password: "{{SECRET_a3c4dqu6}}",
});
await closeDatabase();
