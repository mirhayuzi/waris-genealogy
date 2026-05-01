/**
 * Migrasi data dari AsyncStorage → SQLite
 *
 * Lokasi: lib/db/migrate.ts
 *
 * Proses:
 *  1. Baca JSON lama dari AsyncStorage (`@waris_family_data`)
 *  2. Insert ke SQLite dalam transaction (atomic)
 *  3. Rebuild closure table (untuk memastikan semua generation dikira)
 *  4. Tandakan migration complete dalam AsyncStorage
 *
 * Data LAMA tidak dipadam — boleh rollback dengan padam key migration state.
 * Idempotent: safe untuk panggil berulang kali.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDatabase, getRawDatabase, rebuildClosure, soundexMalay } from "./client";
import {
  persons as personsTable,
  marriages as marriagesTable,
  parentChild as parentChildTable,
  collaborators as collaboratorsTable,
  familyMeta,
} from "../../drizzle/schema-sqlite";
import type { Person, Marriage, ParentChild, Collaborator, FamilyData } from "../types";

const OLD_STORAGE_KEY = "@waris_family_data";
const MIGRATION_STATE_KEY = "@waris_migration_state_v1";

// ─── Types ───────────────────────────────────────────────────────────────────

export type MigrationStatus =
  | { status: "not_needed" }
  | { status: "pending"; estimatedPersons: number }
  | { status: "in_progress" }
  | { status: "complete"; migratedAt: string; personsCount: number }
  | { status: "failed"; error: string; failedAt: string };

export interface MigrationResult {
  success: boolean;
  personsImported: number;
  marriagesImported: number;
  parentChildImported: number;
  collaboratorsImported: number;
  familyName?: string;
  errors: string[];
  durationMs: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function checkMigrationStatus(): Promise<MigrationStatus> {
  // Dah pernah migrate?
  const raw = await AsyncStorage.getItem(MIGRATION_STATE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.status === "complete" || parsed.status === "failed") {
        return parsed;
      }
    } catch {}
  }

  // Ada data lama?
  const oldRaw = await AsyncStorage.getItem(OLD_STORAGE_KEY);
  if (!oldRaw) return { status: "not_needed" };

  try {
    const data = JSON.parse(oldRaw) as FamilyData;
    if (!data.persons?.length) return { status: "not_needed" };
    return { status: "pending", estimatedPersons: data.persons.length };
  } catch {
    return { status: "not_needed" };
  }
}

/**
 * Jalankan migrasi. Idempotent — akan skip kalau dah complete.
 * Tidak throw — semua error diletak dalam result.errors.
 */
export async function runMigration(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    personsImported: 0,
    marriagesImported: 0,
    parentChildImported: 0,
    collaboratorsImported: 0,
    errors: [],
    durationMs: 0,
  };

  const status = await checkMigrationStatus();

  if (status.status === "complete") {
    result.success = true;
    result.personsImported = status.personsCount;
    result.durationMs = Date.now() - startTime;
    return result;
  }

  if (status.status === "not_needed") {
    result.success = true;
    await setState({ status: "complete", migratedAt: new Date().toISOString(), personsCount: 0 });
    result.durationMs = Date.now() - startTime;
    return result;
  }

  await setState({ status: "in_progress" });

  const oldRaw = await AsyncStorage.getItem(OLD_STORAGE_KEY);
  if (!oldRaw) {
    await setState({ status: "complete", migratedAt: new Date().toISOString(), personsCount: 0 });
    result.success = true;
    result.durationMs = Date.now() - startTime;
    return result;
  }

  let old: FamilyData;
  try {
    old = JSON.parse(oldRaw);
  } catch (e) {
    const errMsg = `Failed to parse old data: ${String(e)}`;
    result.errors.push(errMsg);
    await setState({ status: "failed", error: errMsg, failedAt: new Date().toISOString() });
    result.durationMs = Date.now() - startTime;
    return result;
  }

  try {
    const db = await getDatabase();
    const rawDb = await getRawDatabase();

    await rawDb.withTransactionAsync(async () => {
      // 1. Family metadata — guna INSERT OR REPLACE via raw SQL (reliable)
      if (old.familyName) {
        await rawDb.runAsync(
          "INSERT OR REPLACE INTO family_meta (key, value) VALUES (?, ?)",
          ["familyName", old.familyName]
        );
        result.familyName = old.familyName;
      }
      if (old.rootPersonId) {
        await rawDb.runAsync(
          "INSERT OR REPLACE INTO family_meta (key, value) VALUES (?, ?)",
          ["rootPersonId", old.rootPersonId]
        );
      }
      await rawDb.runAsync(
        "INSERT OR REPLACE INTO family_meta (key, value) VALUES (?, ?)",
        ["migratedFromAsyncStorage", new Date().toISOString()]
      );

      // 2. Persons — batch insert untuk prestasi
      const personRows = (old.persons ?? []).map((p) => ({
        id: p.id,
        prefix: p.prefix ?? null,
        firstName: p.firstName,
        binBinti: p.binBinti ?? null,
        lastName: p.lastName ?? null,
        gender: p.gender,
        birthDate: p.birthDate ?? null,
        birthPlace: p.birthPlace ?? null,
        deathDate: p.deathDate ?? null,
        deathPlace: p.deathPlace ?? null,
        isAlive: p.isAlive ?? true,
        race: p.race ?? null,
        religion: p.religion,
        icNumber: p.icNumber ?? null,
        photo: p.photo ?? null,
        bio: p.bio ?? null,
        soundexName: soundexMalay(p.firstName),
        createdAt: p.createdAt ?? new Date().toISOString(),
        updatedAt: p.updatedAt ?? new Date().toISOString(),
      }));

      const BATCH = 50;
      for (let i = 0; i < personRows.length; i += BATCH) {
        const slice = personRows.slice(i, i + BATCH);
        try {
          await db.insert(personsTable).values(slice).onConflictDoNothing();
          result.personsImported += slice.length;
        } catch (e) {
          result.errors.push(`Persons batch ${i}: ${String(e)}`);
          // Continue dengan baki batch — jangan biar satu row rosakkan semua
          for (const row of slice) {
            try {
              await db.insert(personsTable).values(row).onConflictDoNothing();
              result.personsImported++;
            } catch (e2) {
              result.errors.push(`Person ${row.id}: ${String(e2)}`);
            }
          }
        }
      }

      // 3. Marriages
      for (const m of old.marriages ?? []) {
        try {
          await db.insert(marriagesTable).values({
            id: m.id,
            husbandId: m.husbandId,
            wifeId: m.wifeId,
            wifeNumber: 1,
            marriageDate: m.marriageDate ?? null,
            marriagePlace: m.marriagePlace ?? null,
            divorceDate: m.divorceDate ?? null,
            isActive: m.isActive ?? true,
            notes: m.notes ?? null,
          }).onConflictDoNothing();
          result.marriagesImported++;
        } catch (e) {
          result.errors.push(`Marriage ${m.id}: ${String(e)}`);
        }
      }

      // 4. Parent-Child
      for (const pc of old.parentChildren ?? []) {
        try {
          await db.insert(parentChildTable).values({
            id: pc.id,
            parentId: pc.parentId,
            childId: pc.childId,
            type: pc.type,
          }).onConflictDoNothing();
          result.parentChildImported++;
        } catch (e) {
          result.errors.push(`ParentChild ${pc.id}: ${String(e)}`);
        }
      }

      // 5. Collaborators
      for (const c of old.collaborators ?? []) {
        try {
          await db.insert(collaboratorsTable).values({
            id: c.id,
            email: c.email,
            name: c.name ?? null,
            role: c.role,
            status: c.status,
            invitedAt: c.invitedAt,
          }).onConflictDoNothing();
          result.collaboratorsImported++;
        } catch (e) {
          result.errors.push(`Collaborator ${c.id}: ${String(e)}`);
        }
      }
    });

    // Rebuild closure untuk kes edge-cases di mana trigger tak cover
    await rebuildClosure();

    await setState({
      status: "complete",
      migratedAt: new Date().toISOString(),
      personsCount: result.personsImported,
    });
    result.success = true;
  } catch (e) {
    const errMsg = `Transaction failed: ${String(e)}`;
    result.errors.push(errMsg);
    await setState({ status: "failed", error: errMsg, failedAt: new Date().toISOString() });
  }

  result.durationMs = Date.now() - startTime;
  return result;
}

/**
 * Rollback: padam migration flag supaya app guna AsyncStorage semula.
 * TIDAK padam SQLite data (untuk audit). Panggil `resetDatabase()` kalau nak clean slate.
 */
export async function rollbackMigration(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_STATE_KEY);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function setState(state: MigrationStatus): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
}

export async function shouldPromptMigration(): Promise<boolean> {
  const s = await checkMigrationStatus();
  return s.status === "pending";
}
