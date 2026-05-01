/**
 * Drizzle SQLite Schema untuk Waris Genealogy
 *
 * Lokasi: drizzle/schema-sqlite.ts
 *
 * Fields dinamakan supaya serasi dengan types.ts sedia ada —
 * contoh `photo` bukan `photoUri`, supaya consumer code tak perlu ubah.
 */

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── PERSONS ─────────────────────────────────────────────────────────────────

export const persons = sqliteTable(
  "persons",
  {
    id: text("id").primaryKey(),
    prefix: text("prefix"),
    firstName: text("first_name").notNull(),
    nickname: text("nickname"),
    binBinti: text("bin_binti"),
    lastName: text("last_name"),
    motherName: text("mother_name"),
    gender: text("gender", { enum: ["male", "female"] }).notNull(),
    birthDate: text("birth_date"),
    birthDateHijri: text("birth_date_hijri"),
    birthPlace: text("birth_place"),
    deathDate: text("death_date"),
    deathPlace: text("death_place"),
    burialPlace: text("burial_place"),
    isAlive: integer("is_alive", { mode: "boolean" }).notNull().default(true),
    race: text("race"),
    religion: text("religion").notNull(),
    icNumber: text("ic_number"),
    occupation: text("occupation"),
    originState: text("origin_state"),
    photo: text("photo"), // file:// URI atau data URI (base64 — eventually migrate)
    bio: text("bio"),
    sourceNotes: text("source_notes"),
    soundexName: text("soundex_name"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    deletedAt: text("deleted_at"),
  },
  (t) => ({
    firstNameIdx: index("idx_persons_first_name").on(t.firstName),
    birthIdx: index("idx_persons_birth_date").on(t.birthDate),
    soundexIdx: index("idx_persons_soundex").on(t.soundexName),
    deletedIdx: index("idx_persons_deleted").on(t.deletedAt),
  })
);

// ─── MARRIAGES ───────────────────────────────────────────────────────────────

export const marriages = sqliteTable(
  "marriages",
  {
    id: text("id").primaryKey(),
    husbandId: text("husband_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    wifeId: text("wife_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    wifeNumber: integer("wife_number").default(1),
    marriageDate: text("marriage_date"),
    marriagePlace: text("marriage_place"),
    divorceDate: text("divorce_date"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    maharAmount: text("mahar_amount"),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    husbandIdx: index("idx_marriages_husband").on(t.husbandId),
    wifeIdx: index("idx_marriages_wife").on(t.wifeId),
    pairIdx: uniqueIndex("idx_marriages_pair").on(t.husbandId, t.wifeId),
  })
);

// ─── PARENT-CHILD ────────────────────────────────────────────────────────────

export const parentChild = sqliteTable(
  "parent_child",
  {
    id: text("id").primaryKey(),
    parentId: text("parent_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    childId: text("child_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    type: text("type", {
      enum: ["biological", "adopted", "susuan", "step"],
    })
      .notNull()
      .default("biological"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    parentIdx: index("idx_pc_parent").on(t.parentId),
    childIdx: index("idx_pc_child").on(t.childId),
    uniqueEdge: uniqueIndex("idx_pc_unique").on(t.parentId, t.childId),
  })
);

// ─── CLOSURE TABLE ───────────────────────────────────────────────────────────

export const personClosure = sqliteTable(
  "person_closure",
  {
    ancestorId: text("ancestor_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    descendantId: text("descendant_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    depth: integer("depth").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.ancestorId, t.descendantId] }),
    descendantIdx: index("idx_closure_descendant").on(t.descendantId),
    depthIdx: index("idx_closure_depth").on(t.depth),
  })
);

// ─── EVENTS (timeline) ───────────────────────────────────────────────────────

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    personId: text("person_id").references(() => persons.id, {
      onDelete: "cascade",
    }),
    eventType: text("event_type").notNull(),
    eventDate: text("event_date"),
    eventPlace: text("event_place"),
    description: text("description"),
    relatedPersonId: text("related_person_id"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    personIdx: index("idx_events_person").on(t.personId),
    dateIdx: index("idx_events_date").on(t.eventDate),
  })
);

// ─── COLLABORATORS ───────────────────────────────────────────────────────────

export const collaborators = sqliteTable("collaborators", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role", { enum: ["admin", "editor", "viewer"] })
    .notNull()
    .default("viewer"),
  status: text("status", { enum: ["pending", "accepted", "revoked"] })
    .notNull()
    .default("pending"),
  invitedAt: text("invited_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  acceptedAt: text("accepted_at"),
});

// ─── AUDIT LOG ───────────────────────────────────────────────────────────────

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
    changedBy: text("changed_by"),
    changesJson: text("changes_json"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (t) => ({
    entityIdx: index("idx_audit_entity").on(t.entityType, t.entityId),
    dateIdx: index("idx_audit_date").on(t.createdAt),
  })
);

// ─── FAMILY METADATA ─────────────────────────────────────────────────────────

export const familyMeta = sqliteTable("family_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
});

// ─── SYNC STATE ──────────────────────────────────────────────────────────────

export const syncState = sqliteTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// ─── Types ──────────────────────────────────────────────────────────────────

export type DbPerson = typeof persons.$inferSelect;
export type DbInsertPerson = typeof persons.$inferInsert;
export type DbMarriage = typeof marriages.$inferSelect;
export type DbParentChild = typeof parentChild.$inferSelect;
