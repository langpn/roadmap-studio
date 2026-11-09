import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export const lessonProgress = pgTable("lesson_progress", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  state: text("state").notNull().default("not_updated"),
  openedAt: timestamp("opened_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.lessonId] })]);

export const practiceProgress = pgTable("practice_progress", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  practiceId: text("practice_id").notNull(),
  state: text("state").notNull().default("not_updated"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.practiceId] })]);

export const invitation = pgTable("invitation", {
  hash: text("hash").primaryKey(),
  createdBy: text("created_by").notNull().references(() => user.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const setupGuard = pgTable("setup_guard", {
  id: text("id").primaryKey(),
});

export const catalogSnapshot = pgTable("catalog_snapshot", {
  id: text("id").primaryKey(),
  content: text("content").notNull(),
  digest: text("digest").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});

export const catalogHistory = pgTable("catalog_history", {
  digest: text("digest").primaryKey(),
  content: text("content").notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
});

/** Liên kết phát do chính người học thu thập từ tài khoản của họ. */
export const lessonMedia = pgTable("lesson_media", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  kind: text("kind").notNull(),
  videoId: text("video_id").notNull(),
  embedUrl: text("embed_url").notNull(),
  collectedAt: timestamp("collected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.lessonId] })]);
