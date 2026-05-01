/**
 * Relationship Query Helpers
 *
 * Lokasi: lib/db/relationships.ts
 *
 * Semua function ni guna closure table untuk performance —
 * query O(log n) bukan O(n) walaupun tree ada 2000+ ahli.
 *
 * USAGE:
 *   import { findRelationship, getCousins, searchPersons } from "@/lib/db/relationships";
 *   const r = await findRelationship("ahmad-id", "siti-id");
 *   console.log(r?.label); // "Sepupu 1 kali"
 */

import { sql, inArray, eq, and, or, ne } from "drizzle-orm";
import { getDatabase } from "./client";
import {
  persons as personsTable,
  parentChild as pcTable,
  marriages as marriagesTable,
  type DbPerson,
} from "../../drizzle/schema-sqlite";
import type { Person } from "../types";

// ─── Row mapper: DbPerson (snake_case) → Person (camelCase) ─────────────────

function toPerson(r: DbPerson): Person {
  return {
    id: r.id,
    prefix: r.prefix ?? undefined,
    firstName: r.firstName,
    binBinti: r.binBinti ?? undefined,
    lastName: r.lastName ?? undefined,
    gender: r.gender,
    birthDate: r.birthDate ?? undefined,
    birthPlace: r.birthPlace ?? undefined,
    deathDate: r.deathDate ?? undefined,
    deathPlace: r.deathPlace ?? undefined,
    race: r.race ?? undefined,
    religion: r.religion as any,
    icNumber: r.icNumber ?? undefined,
    photo: r.photo ?? undefined,
    bio: r.bio ?? undefined,
    isAlive: r.isAlive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// ─── Descendants & Ancestors ─────────────────────────────────────────────────

/** Semua keturunan seseorang, dengan `generationsBelow` (1 = anak, 2 = cucu, ...) */
export async function getAllDescendants(
  personId: string
): Promise<Array<Person & { generationsBelow: number }>> {
  const db = await getDatabase();
  const rows = await db.all<any>(sql`
    SELECT p.*, c.depth AS generations_below
    FROM person_closure c
    INNER JOIN persons p ON p.id = c.descendant_id
    WHERE c.ancestor_id = ${personId}
      AND c.depth > 0
      AND p.deleted_at IS NULL
    ORDER BY c.depth, p.first_name
  `);

  return rows.map((r) => ({
    ...toPerson({
      id: r.id,
      prefix: r.prefix,
      firstName: r.first_name,
      nickname: r.nickname,
      binBinti: r.bin_binti,
      lastName: r.last_name,
      motherName: r.mother_name,
      gender: r.gender,
      birthDate: r.birth_date,
      birthDateHijri: r.birth_date_hijri,
      birthPlace: r.birth_place,
      deathDate: r.death_date,
      deathPlace: r.death_place,
      burialPlace: r.burial_place,
      isAlive: !!r.is_alive,
      race: r.race,
      religion: r.religion,
      icNumber: r.ic_number,
      occupation: r.occupation,
      originState: r.origin_state,
      photo: r.photo,
      bio: r.bio,
      sourceNotes: r.source_notes,
      soundexName: r.soundex_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      deletedAt: r.deleted_at,
    } as DbPerson),
    generationsBelow: r.generations_below,
  }));
}

/** Semua nenek moyang (ibu bapa, datuk/nenek, moyang...) */
export async function getAllAncestors(
  personId: string
): Promise<Array<Person & { generationsAbove: number }>> {
  const db = await getDatabase();
  const rows = await db.all<any>(sql`
    SELECT p.*, c.depth AS generations_above
    FROM person_closure c
    INNER JOIN persons p ON p.id = c.ancestor_id
    WHERE c.descendant_id = ${personId}
      AND c.depth > 0
      AND p.deleted_at IS NULL
    ORDER BY c.depth, p.first_name
  `);

  return rows.map((r) => ({
    ...toPerson({
      id: r.id,
      prefix: r.prefix,
      firstName: r.first_name,
      nickname: r.nickname,
      binBinti: r.bin_binti,
      lastName: r.last_name,
      motherName: r.mother_name,
      gender: r.gender,
      birthDate: r.birth_date,
      birthDateHijri: r.birth_date_hijri,
      birthPlace: r.birth_place,
      deathDate: r.death_date,
      deathPlace: r.death_place,
      burialPlace: r.burial_place,
      isAlive: !!r.is_alive,
      race: r.race,
      religion: r.religion,
      icNumber: r.ic_number,
      occupation: r.occupation,
      originState: r.origin_state,
      photo: r.photo,
      bio: r.bio,
      sourceNotes: r.source_notes,
      soundexName: r.soundex_name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      createdBy: r.created_by,
      updatedBy: r.updated_by,
      deletedAt: r.deleted_at,
    } as DbPerson),
    generationsAbove: r.generations_above,
  }));
}

// ─── Cousins ─────────────────────────────────────────────────────────────────

/**
 * Sepupu pada tahap tertentu.
 *  - degree=1: sepupu pertama (first cousin) — share datuk/nenek
 *  - degree=2: sepupu kedua — share moyang
 *  - degree=3: sepupu ketiga
 */
export async function getCousins(
  personId: string,
  degree: number = 1
): Promise<Person[]> {
  const db = await getDatabase();
  const depth = degree + 1;

  // Ambil IDs dari closure, kemudian fetch rows via query builder
  const idRows = await db.all<{ id: string }>(sql`
    SELECT DISTINCT cousin.id
    FROM person_closure c1
    INNER JOIN person_closure c2 ON c1.ancestor_id = c2.ancestor_id
    INNER JOIN persons cousin ON cousin.id = c2.descendant_id
    WHERE c1.descendant_id = ${personId}
      AND c1.depth = ${depth}
      AND c2.depth = ${depth}
      AND cousin.id != ${personId}
      AND cousin.deleted_at IS NULL
  `);

  if (idRows.length === 0) return [];
  const ids = idRows.map((r) => r.id);
  const rows = await db
    .select()
    .from(personsTable)
    .where(inArray(personsTable.id, ids));
  return rows.map(toPerson);
}

// ─── Aunts/Uncles & Nieces/Nephews ───────────────────────────────────────────

export async function getAuntsUncles(personId: string): Promise<Person[]> {
  const db = await getDatabase();
  const idRows = await db.all<{ id: string }>(sql`
    SELECT DISTINCT sibling.id
    FROM parent_child my_parent
    INNER JOIN parent_child grandparent ON grandparent.child_id = my_parent.parent_id
    INNER JOIN parent_child uncle_edge ON uncle_edge.parent_id = grandparent.parent_id
    INNER JOIN persons sibling ON sibling.id = uncle_edge.child_id
    WHERE my_parent.child_id = ${personId}
      AND sibling.id != my_parent.parent_id
      AND sibling.deleted_at IS NULL
  `);

  if (idRows.length === 0) return [];
  const rows = await db
    .select()
    .from(personsTable)
    .where(inArray(personsTable.id, idRows.map((r) => r.id)));
  return rows.map(toPerson);
}

export async function getNiecesNephews(personId: string): Promise<Person[]> {
  const db = await getDatabase();
  const idRows = await db.all<{ id: string }>(sql`
    SELECT DISTINCT niece.id
    FROM parent_child my_parent_edge
    INNER JOIN parent_child sibling_edge
      ON sibling_edge.parent_id = my_parent_edge.parent_id
      AND sibling_edge.child_id != ${personId}
    INNER JOIN parent_child niece_edge ON niece_edge.parent_id = sibling_edge.child_id
    INNER JOIN persons niece ON niece.id = niece_edge.child_id
    WHERE my_parent_edge.child_id = ${personId}
      AND niece.deleted_at IS NULL
  `);

  if (idRows.length === 0) return [];
  const rows = await db
    .select()
    .from(personsTable)
    .where(inArray(personsTable.id, idRows.map((r) => r.id)));
  return rows.map(toPerson);
}

// ─── Relationship Finder (LCA-based) ─────────────────────────────────────────

export interface RelationshipResult {
  commonAncestorId: string;
  aDepth: number;
  bDepth: number;
  label: string;
  labelEn: string;
}

/**
 * Cari hubungan antara dua orang via lowest common ancestor (LCA).
 * Pulangkan null jika tiada hubungan keluarga.
 */
export async function findRelationship(
  personAId: string,
  personBId: string
): Promise<RelationshipResult | null> {
  if (personAId === personBId) {
    return {
      commonAncestorId: personAId,
      aDepth: 0,
      bDepth: 0,
      label: "Orang yang sama",
      labelEn: "Same person",
    };
  }

  const db = await getDatabase();
  const rows = await db.all<{
    ancestor_id: string;
    a_depth: number;
    b_depth: number;
  }>(sql`
    SELECT c1.ancestor_id, c1.depth AS a_depth, c2.depth AS b_depth
    FROM person_closure c1
    INNER JOIN person_closure c2 ON c1.ancestor_id = c2.ancestor_id
    WHERE c1.descendant_id = ${personAId}
      AND c2.descendant_id = ${personBId}
    ORDER BY (c1.depth + c2.depth) ASC
    LIMIT 1
  `);

  if (rows.length === 0) return null;
  const r = rows[0];

  const { label, labelEn } = describeRelationship(r.a_depth, r.b_depth);
  return {
    commonAncestorId: r.ancestor_id,
    aDepth: r.a_depth,
    bDepth: r.b_depth,
    label,
    labelEn,
  };
}

/**
 * Terjemah (aDepth, bDepth) kepada label hubungan dalam BM + English.
 *
 *   a = generasi A dari common ancestor
 *   b = generasi B dari common ancestor
 *
 * Contoh:
 *   (1, 1) → Adik-beradik / Siblings
 *   (2, 2) → Sepupu 1 kali / First cousin
 *   (2, 1) → Pakcik/Makcik atau Anak saudara (depending on direction)
 */
export function describeRelationship(
  aDepth: number,
  bDepth: number
): { label: string; labelEn: string } {
  // Direct lineage
  if (aDepth === 0) {
    if (bDepth === 1) return { label: "Anak", labelEn: "Child" };
    if (bDepth === 2) return { label: "Cucu", labelEn: "Grandchild" };
    if (bDepth === 3) return { label: "Cicit", labelEn: "Great-grandchild" };
    return { label: `Keturunan ${bDepth} generasi`, labelEn: `${bDepth}-gen descendant` };
  }
  if (bDepth === 0) {
    if (aDepth === 1) return { label: "Ibu/Bapa", labelEn: "Parent" };
    if (aDepth === 2) return { label: "Datuk/Nenek", labelEn: "Grandparent" };
    if (aDepth === 3) return { label: "Moyang", labelEn: "Great-grandparent" };
    return { label: `Moyang ${aDepth} generasi`, labelEn: `${aDepth}-gen ancestor` };
  }

  // Siblings
  if (aDepth === 1 && bDepth === 1) {
    return { label: "Adik-beradik", labelEn: "Siblings" };
  }

  // Aunt/Uncle ↔ Niece/Nephew
  if (aDepth === 1 && bDepth === 2) {
    return { label: "Anak saudara", labelEn: "Niece/Nephew" };
  }
  if (aDepth === 2 && bDepth === 1) {
    return { label: "Pakcik/Makcik", labelEn: "Uncle/Aunt" };
  }

  // Grand-aunt/uncle ↔ grand-niece/nephew
  if (aDepth === 1 && bDepth === 3) {
    return { label: "Cucu saudara", labelEn: "Grandniece/nephew" };
  }
  if (aDepth === 3 && bDepth === 1) {
    return { label: "Datuk/Nenek saudara", labelEn: "Great-uncle/aunt" };
  }

  // Cousins
  const cousinDegree = Math.min(aDepth, bDepth) - 1;
  const removed = Math.abs(aDepth - bDepth);

  if (cousinDegree >= 1) {
    const base = `Sepupu ${cousinDegree} kali`;
    const baseEn = `${ordinal(cousinDegree)} cousin`;
    if (removed === 0) {
      return { label: base, labelEn: baseEn };
    }
    return {
      label: `${base} (${removed} generasi terpisah)`,
      labelEn: `${baseEn} ${removed}x removed`,
    };
  }

  return { label: "Hubungan keluarga jauh", labelEn: "Distant relative" };
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// ─── Search ──────────────────────────────────────────────────────────────────

/** Full-text search guna FTS5 + soundex fallback */
export async function searchPersons(
  query: string,
  limit: number = 50
): Promise<Person[]> {
  const q = query.trim();
  if (!q) return [];

  const db = await getDatabase();

  // FTS5 MATCH syntax: "ahmad*" untuk prefix match
  const ftsQuery = q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `${sanitizeFtsToken(t)}*`)
    .join(" OR ");

  if (!ftsQuery) return [];

  try {
    const idRows = await db.all<{ id: string }>(sql`
      SELECT p.id
      FROM persons_fts fts
      INNER JOIN persons p ON p.rowid = fts.rowid
      WHERE persons_fts MATCH ${ftsQuery}
        AND p.deleted_at IS NULL
      ORDER BY rank
      LIMIT ${limit}
    `);

    if (idRows.length > 0) {
      const rows = await db
        .select()
        .from(personsTable)
        .where(inArray(personsTable.id, idRows.map((r) => r.id)));
      return rows.map(toPerson);
    }

    // Fallback: soundex
    const soundex = soundexOf(q);
    if (soundex) {
      const sxRows = await db
        .select()
        .from(personsTable)
        .where(eq(personsTable.soundexName, soundex))
        .limit(limit);
      return sxRows.map(toPerson);
    }

    return [];
  } catch (e) {
    console.warn("FTS search failed, falling back to LIKE:", e);
    // Ultimate fallback: LIKE search
    const likePattern = `%${q}%`;
    const rows = await db.all<DbPerson>(sql`
      SELECT * FROM persons
      WHERE deleted_at IS NULL
        AND (first_name LIKE ${likePattern}
             OR bin_binti LIKE ${likePattern}
             OR last_name LIKE ${likePattern}
             OR nickname LIKE ${likePattern})
      LIMIT ${limit}
    `);
    return rows.map((r: any) => toPerson({
      ...r,
      firstName: r.first_name,
      binBinti: r.bin_binti,
      lastName: r.last_name,
      isAlive: !!r.is_alive,
      birthDate: r.birth_date,
      birthPlace: r.birth_place,
      deathDate: r.death_date,
      deathPlace: r.death_place,
      icNumber: r.ic_number,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }
}

function sanitizeFtsToken(token: string): string {
  // FTS5 tak suka special chars. Keep alphanumeric + underscore.
  return token.replace(/[^\w]/g, "");
}

function soundexOf(query: string): string {
  // Lightweight import-free soundex — enough for fallback
  const cleaned = query
    .toLowerCase()
    .replace(/^mohd\.?\s+/, "muhammad ")
    .replace(/^abd\.?\s+/, "abdul ")
    .replace(/[^a-z\s]/g, "");
  const code = cleaned.replace(/[aeiouhwy]/g, "").replace(/\s+/g, "").substring(0, 6);
  return code.padEnd(6, "0");
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

/**
 * Cari calon duplicate. Guna bila user tambah ahli baru.
 *  - Nama pertama sama + bin/binti sama + jantina sama = high confidence
 *  - Tambah tarikh lahir sama tahun = very high confidence
 */
export async function findPossibleDuplicates(
  firstName: string,
  binBinti: string | undefined,
  gender: "male" | "female",
  birthDate?: string
): Promise<Person[]> {
  const db = await getDatabase();

  const whereConditions = [
    eq(personsTable.firstName, firstName),
    eq(personsTable.gender, gender),
  ];
  if (binBinti) {
    whereConditions.push(eq(personsTable.binBinti, binBinti));
  }

  const candidates = await db
    .select()
    .from(personsTable)
    .where(and(...whereConditions));

  if (!birthDate) return candidates.map(toPerson);

  const year = birthDate.substring(0, 4);
  return candidates
    .filter((c) => !c.birthDate || c.birthDate.substring(0, 4) === year)
    .map(toPerson);
}

// ─── Statistics ──────────────────────────────────────────────────────────────

export interface FamilyStats {
  totalPersons: number;
  livingPersons: number;
  deceasedPersons: number;
  muslimPersons: number;
  activeMarriages: number;
  generationsDeep: number;
}

export async function getFamilyStats(): Promise<FamilyStats> {
  const db = await getDatabase();
  const [stats] = await db.all<{
    total: number;
    living: number;
    deceased: number;
    muslim: number;
    marriages: number;
    max_depth: number | null;
  }>(sql`
    SELECT
      (SELECT COUNT(*) FROM persons WHERE deleted_at IS NULL) AS total,
      (SELECT COUNT(*) FROM persons WHERE deleted_at IS NULL AND is_alive = 1) AS living,
      (SELECT COUNT(*) FROM persons WHERE deleted_at IS NULL AND is_alive = 0) AS deceased,
      (SELECT COUNT(*) FROM persons WHERE deleted_at IS NULL AND religion = 'Islam') AS muslim,
      (SELECT COUNT(*) FROM marriages WHERE is_active = 1) AS marriages,
      (SELECT MAX(depth) FROM person_closure) AS max_depth
  `);

  return {
    totalPersons: stats.total,
    livingPersons: stats.living,
    deceasedPersons: stats.deceased,
    muslimPersons: stats.muslim,
    activeMarriages: stats.marriages,
    generationsDeep: (stats.max_depth ?? 0) + 1,
  };
}
