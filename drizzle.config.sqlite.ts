/**
 * Drizzle Kit config untuk SQLite schema
 *
 * Lokasi: drizzle.config.sqlite.ts (atau ganti drizzle.config.ts yang sedia ada)
 *
 * Guna untuk generate migrations:
 *   npx drizzle-kit generate --config=drizzle.config.sqlite.ts
 *
 * Nota: Untuk projek anda yang masih ada server MySQL, boleh simpan
 * dua config:
 *   - drizzle.config.ts        → MySQL (server, Fasa 2)
 *   - drizzle.config.sqlite.ts → SQLite (tempatan, Fasa 1)
 */

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./drizzle/schema-sqlite.ts",
  out: "./drizzle/migrations-sqlite",
  dialect: "sqlite",
  verbose: true,
  strict: true,
});
