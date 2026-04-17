import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Family Tree Tables
 * Graph-based relationship model for flexible genealogy support
 * Design follows ChatGPT's recommendation for handling complex genealogies
 */

export const persons = mysqlTable(
  "persons",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    firstName: varchar("firstName", { length: 255 }).notNull(),
    lastName: varchar("lastName", { length: 255 }),
    binBinti: varchar("binBinti", { length: 255 }),
    prefix: varchar("prefix", { length: 100 }),
    gender: mysqlEnum("gender", ["male", "female"]).notNull(),
    birthDate: timestamp("birthDate"),
    birthPlace: varchar("birthPlace", { length: 255 }),
    deathDate: timestamp("deathDate"),
    deathPlace: varchar("deathPlace", { length: 255 }),
    religion: varchar("religion", { length: 100 }),
    race: varchar("race", { length: 100 }),
    photoUrl: varchar("photoUrl", { length: 512 }), // File URL or S3 URL instead of base64
    bio: text("bio"),
    isAlive: boolean("isAlive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    // Indexes for faster queries
    createdAtIdx: index("idx_persons_createdAt").on(table.createdAt),
    isAliveIdx: index("idx_persons_isAlive").on(table.isAlive),
  })
);

export type Person = typeof persons.$inferSelect;
export type InsertPerson = typeof persons.$inferInsert;

export const marriages = mysqlTable(
  "marriages",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    husbandId: varchar("husbandId", { length: 36 }).notNull(),
    wifeId: varchar("wifeId", { length: 36 }).notNull(),
    marriageDate: timestamp("marriageDate"),
    marriagePlace: varchar("marriagePlace", { length: 255 }),
    divorceDate: timestamp("divorceDate"),
    isActive: boolean("isActive").default(true).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for faster queries on relationship lookups
    husbandIdIdx: index("idx_marriages_husbandId").on(table.husbandId),
    wifeIdIdx: index("idx_marriages_wifeId").on(table.wifeId),
  })
);

export type Marriage = typeof marriages.$inferSelect;
export type InsertMarriage = typeof marriages.$inferInsert;

export const parentChildren = mysqlTable(
  "parentChildren",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    parentId: varchar("parentId", { length: 36 }).notNull(),
    childId: varchar("childId", { length: 36 }).notNull(),
    type: mysqlEnum("type", ["biological", "adopted", "susuan"]).default("biological").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    // Indexes for faster tree traversal queries
    parentIdIdx: index("idx_parentChildren_parentId").on(table.parentId),
    childIdIdx: index("idx_parentChildren_childId").on(table.childId),
  })
);

export type ParentChild = typeof parentChildren.$inferSelect;
export type InsertParentChild = typeof parentChildren.$inferInsert;

/**
 * Inheritance/Faraid Tables
 * Supports Islamic inheritance calculations
 */

export const inheritanceCases = mysqlTable(
  "inheritanceCases",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    deceasedId: varchar("deceasedId", { length: 36 }).notNull(),
    totalAsset: text("totalAsset"), // Stored as string to preserve precision
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    deceasedIdIdx: index("idx_inheritanceCases_deceasedId").on(table.deceasedId),
  })
);

export type InheritanceCase = typeof inheritanceCases.$inferSelect;
export type InsertInheritanceCase = typeof inheritanceCases.$inferInsert;

export const heirs = mysqlTable(
  "heirs",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    caseId: varchar("caseId", { length: 36 }).notNull(),
    personId: varchar("personId", { length: 36 }).notNull(),
    relationType: varchar("relationType", { length: 100 }).notNull(),
    share: text("share"), // Stored as string to preserve precision (fractions)
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    caseIdIdx: index("idx_heirs_caseId").on(table.caseId),
    personIdIdx: index("idx_heirs_personId").on(table.personId),
  })
);

export type Heir = typeof heirs.$inferSelect;
export type InsertHeir = typeof heirs.$inferInsert;
