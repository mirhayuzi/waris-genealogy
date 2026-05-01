-- ============================================================================
-- Waris Genealogy — SQLite FTS5 + Triggers Setup
-- ============================================================================
--
-- Lokasi: drizzle/sqlite-setup.sql
-- Dipanggil dari lib/db/client.ts selepas CREATE TABLE
-- Idempotent (guna IF NOT EXISTS)
-- ============================================================================

-- ─── FTS5 Virtual Table ─────────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS persons_fts USING fts5(
  first_name, nickname, bin_binti, last_name, mother_name,
  birth_place, death_place, bio, occupation, origin_state,
  content='persons', content_rowid='rowid'
);

-- ─── Sync FTS dengan persons ────────────────────────────────────────────────
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

-- ─── Closure: self-reference bila person ditambah ──────────────────────────
CREATE TRIGGER IF NOT EXISTS closure_self_insert AFTER INSERT ON persons
BEGIN
  INSERT OR IGNORE INTO person_closure (ancestor_id, descendant_id, depth)
  VALUES (new.id, new.id, 0);
END;

-- ─── Closure: bila edge parent-child ditambah ──────────────────────────────
CREATE TRIGGER IF NOT EXISTS closure_edge_insert AFTER INSERT ON parent_child
BEGIN
  INSERT OR IGNORE INTO person_closure (ancestor_id, descendant_id, depth)
  SELECT a.ancestor_id, d.descendant_id, a.depth + d.depth + 1
  FROM person_closure a
  CROSS JOIN person_closure d
  WHERE a.descendant_id = new.parent_id
    AND d.ancestor_id = new.child_id;
END;

-- ─── Closure delete: kita guna rebuild di app layer (lib/db/client.ts) ─────
-- Sebab incremental delete trigger susah nak buat betul-betul 100% correct
-- untuk kes ada multiple paths (adopted + bio, dll).
-- rebuildClosure() dipanggil selepas DELETE parent_child di family-store.
