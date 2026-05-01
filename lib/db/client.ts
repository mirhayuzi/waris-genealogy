/**
 * SQLite Client untuk Waris Genealogy
 *
 * Lokasi: lib/db/client.ts
 *
 * Tanggungjawab:
 *  - Buka SQLite database (singleton, promise-based untuk concurrent safety)
 *  - Set PRAGMAs (WAL, foreign keys, cache)
 *  - Bootstrap skema (first-time) dengan versioning via `PRAGMA user_version`
 *  - Sediakan `getDatabase()` (Drizzle) dan `getRawDatabase()` (raw SQLite)
 *  - Utility: `rebuildClosure()`, `soundexMalay()`, `resetDatabase()`
 */

import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "../../drizzle/schema-sqlite";

const DB_NAME = "waris.db";
const SCHEMA_VERSION = 1;

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let _dbPromise: Promise<DrizzleDb> | null = null;
let _rawDb: SQLite.SQLiteDatabase | null = null;

/**
 * Dapatkan Drizzle database instance. Singleton, thread-safe untuk concurrent
 * callers (beberapa panggilan parallel akan menunggu Promise yang sama).
 */
export function getDatabase(): Promise<DrizzleDb> {
  if (!_dbPromise) {
    _dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      _rawDb = db;

      // PRAGMAs — mesti outside transaction, run satu-satu
      await db.execAsync("PRAGMA journal_mode = WAL;");
      await db.execAsync("PRAGMA foreign_keys = ON;");
      await db.execAsync("PRAGMA synchronous = NORMAL;");
      await db.execAsync("PRAGMA cache_size = -64000;"); // 64 MB

      await bootstrapSchema(db);
      return drizzle(db, { schema });
    })();
  }
  return _dbPromise;
}

/** Akses raw SQLite untuk query advanced (FTS, recursive CTE, PRAGMA) */
export async function getRawDatabase(): Promise<SQLite.SQLiteDatabase> {
  await getDatabase(); // pastikan dah open
  if (!_rawDb) throw new Error("DB not initialized");
  return _rawDb;
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function bootstrapSchema(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version"
  );
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) return;

  await db.withTransactionAsync(async () => {
    if (current < 1) {
      await db.execAsync(CREATE_TABLES_V1);
      await db.execAsync(CREATE_FTS_AND_TRIGGERS_V1);
    }
    // Migrations masa depan letak sini: if (current < 2) { ... }
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  });
}

// ─── Closure Rebuild ─────────────────────────────────────────────────────────

/**
 * Bina semula closure table dari scratch.
 * Panggil selepas:
 *  - DELETE parent_child edge (trigger tiada)
 *  - Bulk import data besar (lebih cepat berbanding insert satu-satu trigger)
 *  - Repair selepas sync conflict
 *
 * Untuk 2000 ahli ~ 6 generasi, ambil masa <500ms.
 */
export async function rebuildClosure(): Promise<void> {
  const db = await getRawDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync("DELETE FROM person_closure;");

    // Self references
    await db.execAsync(`
      INSERT INTO person_closure (ancestor_id, descendant_id, depth)
      SELECT id, id, 0 FROM persons WHERE deleted_at IS NULL;
    `);

    // Transitive closure
    await db.execAsync(`
      INSERT OR IGNORE INTO person_closure (ancestor_id, descendant_id, depth)
      WITH RECURSIVE chain(ancestor_id, descendant_id, depth) AS (
        SELECT parent_id, child_id, 1 FROM parent_child
        UNION ALL
        SELECT c.ancestor_id, pc.child_id, c.depth + 1
        FROM chain c
        INNER JOIN parent_child pc ON pc.parent_id = c.descendant_id
        WHERE c.depth < 20
      )
      SELECT ancestor_id, descendant_id, MIN(depth)
      FROM chain
      GROUP BY ancestor_id, descendant_id;
    `);
  });
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Soundex untuk nama Melayu (handle variant ejaan biasa).
 * Contoh: "Mohd Ahmad" → "muhammad ahmad" → code yang sama dengan "Muhammad Ahmad"
 *
 * Ini bukan Soundex algoritma piawai — versi yang disesuaikan untuk nama Melayu.
 */
export function soundexMalay(name: string): string {
  if (!name) return "";
  const normalized = name
    .toLowerCase()
    .trim()
    // Normalize common prefixes
    .replace(/^mohd\.?\s+/, "muhammad ")
    .replace(/^muhd\.?\s+/, "muhammad ")
    .replace(/^mohammad\s+/, "muhammad ")
    .replace(/^abd\.?\s+/, "abdul ")
    .replace(/^abdul\s+/, "abdul ")
    // Ahmad/Ahmat variants
    .replace(/\bahmat\b/g, "ahmad")
    .replace(/\bachmad\b/g, "ahmad")
    // Strip non-letters
    .replace(/[^a-z\s]/g, "");

  // Ambil consonants dari setiap word, up to 6 chars
  const code = normalized
    .replace(/[aeiouhwy]/g, "")
    .replace(/\s+/g, "")
    .substring(0, 6);
  return code.padEnd(6, "0");
}

/**
 * RESET DATABASE — untuk testing / troubleshooting sahaja.
 * Hapus semua data dalam SQLite. AsyncStorage tidak tersentuh.
 */
export async function resetDatabase(): Promise<void> {
  if (_rawDb) {
    await _rawDb.closeAsync();
    _rawDb = null;
  }
  _dbPromise = null;
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

// ─── Inline Schema SQL ───────────────────────────────────────────────────────
// (Sebagai alternatif kepada load dari .sql file; React Native tak ada FS
// untuk baca fail dalam bundle dengan mudah.)

const CREATE_TABLES_V1 = `
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY NOT NULL,
  prefix TEXT,
  first_name TEXT NOT NULL,
  nickname TEXT,
  bin_binti TEXT,
  last_name TEXT,
  mother_name TEXT,
  gender TEXT NOT NULL,
  birth_date TEXT,
  birth_date_hijri TEXT,
  birth_place TEXT,
  death_date TEXT,
  death_place TEXT,
  burial_place TEXT,
  is_alive INTEGER NOT NULL DEFAULT 1,
  race TEXT,
  religion TEXT NOT NULL,
  ic_number TEXT,
  occupation TEXT,
  origin_state TEXT,
  photo TEXT,
  bio TEXT,
  source_notes TEXT,
  soundex_name TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT,
  updated_by TEXT,
  deleted_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_persons_first_name ON persons(first_name);
CREATE INDEX IF NOT EXISTS idx_persons_birth_date ON persons(birth_date);
CREATE INDEX IF NOT EXISTS idx_persons_soundex ON persons(soundex_name);
CREATE INDEX IF NOT EXISTS idx_persons_deleted ON persons(deleted_at);

CREATE TABLE IF NOT EXISTS marriages (
  id TEXT PRIMARY KEY NOT NULL,
  husband_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  wife_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  wife_number INTEGER DEFAULT 1,
  marriage_date TEXT,
  marriage_place TEXT,
  divorce_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  mahar_amount TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_marriages_husband ON marriages(husband_id);
CREATE INDEX IF NOT EXISTS idx_marriages_wife ON marriages(wife_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marriages_pair ON marriages(husband_id, wife_id);

CREATE TABLE IF NOT EXISTS parent_child (
  id TEXT PRIMARY KEY NOT NULL,
  parent_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  child_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'biological',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pc_parent ON parent_child(parent_id);
CREATE INDEX IF NOT EXISTS idx_pc_child ON parent_child(child_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pc_unique ON parent_child(parent_id, child_id);

CREATE TABLE IF NOT EXISTS person_closure (
  ancestor_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  descendant_id TEXT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);
CREATE INDEX IF NOT EXISTS idx_closure_descendant ON person_closure(descendant_id);
CREATE INDEX IF NOT EXISTS idx_closure_depth ON person_closure(depth);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY NOT NULL,
  person_id TEXT REFERENCES persons(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TEXT,
  event_place TEXT,
  description TEXT,
  related_person_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);

CREATE TABLE IF NOT EXISTS collaborators (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  changed_by TEXT,
  changes_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS family_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

const CREATE_FTS_AND_TRIGGERS_V1 = `
CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(
  first_name, nickname, bin_binti, last_name, mother_name,
  birth_place, death_place, bio, occupation, origin_state,
  content='persons', content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS persons_fts_ai AFTER INSERT ON persons BEGIN
  INSERT INTO persons_fts(rowid, first_name, nickname, bin_binti, last_name,
    mother_name, birth_place, death_place, bio, occupation, origin_state)
  VALUES (new.rowid, new.first_name, new.nickname, new.bin_binti,
    new.last_name, new.mother_name, new.birth_place, new.death_place,
    new.bio, new.occupation, new.origin_state);
END;

CREATE TRIGGER IF NOT EXISTS persons_fts_ad AFTER DELETE ON persons BEGIN
  INSERT INTO persons_fts(persons_fts, rowid, first_name, nickname, bin_binti,
    last_name, mother_name, birth_place, death_place, bio, occupation, origin_state)
  VALUES ('delete', old.rowid, old.first_name, old.nickname, old.bin_binti,
    old.last_name, old.mother_name, old.birth_place, old.death_place,
    old.bio, old.occupation, old.origin_state);
END;

CREATE TRIGGER IF NOT EXISTS persons_fts_au AFTER UPDATE ON persons BEGIN
  INSERT INTO persons_fts(persons_fts, rowid, first_name, nickname, bin_binti,
    last_name, mother_name, birth_place, death_place, bio, occupation, origin_state)
  VALUES ('delete', old.rowid, old.first_name, old.nickname, old.bin_binti,
    old.last_name, old.mother_name, old.birth_place, old.death_place,
    old.bio, old.occupation, old.origin_state);
  INSERT INTO persons_fts(rowid, first_name, nickname, bin_binti, last_name,
    mother_name, birth_place, death_place, bio, occupation, origin_state)
  VALUES (new.rowid, new.first_name, new.nickname, new.bin_binti,
    new.last_name, new.mother_name, new.birth_place, new.death_place,
    new.bio, new.occupation, new.origin_state);
END;

CREATE TRIGGER IF NOT EXISTS closure_self_insert AFTER INSERT ON persons
BEGIN
  INSERT OR IGNORE INTO person_closure (ancestor_id, descendant_id, depth)
  VALUES (new.id, new.id, 0);
END;

CREATE TRIGGER IF NOT EXISTS closure_edge_insert AFTER INSERT ON parent_child
BEGIN
  INSERT OR IGNORE INTO person_closure (ancestor_id, descendant_id, depth)
  SELECT a.ancestor_id, d.descendant_id, a.depth + d.depth + 1
  FROM person_closure a
  CROSS JOIN person_closure d
  WHERE a.descendant_id = new.parent_id
    AND d.ancestor_id = new.child_id;
END;
`;
