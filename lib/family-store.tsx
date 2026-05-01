/**
 * Family Store V2 — SQLite-backed, drop-in replacement
 *
 * Lokasi: lib/family-store.tsx (ganti yang lama)
 *
 * Strategy: "Optimistic local state + async persistence"
 *   - React state adalah single source of truth semasa session
 *   - Pada mount: hydrate dari SQLite
 *   - Pada mutation: update state segera (sync), kemudian persist ke SQLite (async)
 *   - Kalau SQLite write gagal: log error, tapi state React kekal — user tak kehilangan kerja
 *
 * API contract DIPELIHARA 100% — compatible dengan:
 *   - add-member.tsx, edit-member.tsx
 *   - member-profile.tsx, tree.tsx, miller-columns.tsx, faraid-calculator.tsx
 *   - semua skrin lain yang guna `useFamily()`
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useState,
} from "react";
import { eq, or, inArray } from "drizzle-orm";
import {
  FamilyData,
  Person,
  Marriage,
  ParentChild,
  Collaborator,
  generateId,
} from "./types";
import { getDatabase, getRawDatabase, rebuildClosure, soundexMalay } from "./db/client";
import {
  persons as personsTable,
  marriages as marriagesTable,
  parentChild as parentChildTable,
  collaborators as collaboratorsTable,
  familyMeta,
  type DbPerson,
  type DbMarriage,
  type DbParentChild,
} from "../drizzle/schema-sqlite";
import { runMigration, shouldPromptMigration } from "./db/migrate";

// ─── Initial state ───────────────────────────────────────────────────────────

const initialData: FamilyData = {
  persons: [],
  marriages: [],
  parentChildren: [],
  collaborators: [],
  rootPersonId: undefined,
  familyName: "My Family",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Reducer (sama macam sebelum — state lokal sync) ────────────────────────

type Action =
  | { type: "LOAD_DATA"; payload: FamilyData }
  | { type: "SET_FAMILY_NAME"; payload: string }
  | { type: "ADD_PERSON"; payload: Person }
  | { type: "UPDATE_PERSON"; payload: Person }
  | { type: "DELETE_PERSON"; payload: string }
  | { type: "ADD_MARRIAGE"; payload: Marriage }
  | { type: "DELETE_MARRIAGE"; payload: string }
  | { type: "ADD_PARENT_CHILD"; payload: ParentChild }
  | { type: "DELETE_PARENT_CHILD"; payload: string }
  | { type: "SET_ROOT_PERSON"; payload: string }
  | { type: "ADD_COLLABORATOR"; payload: Collaborator }
  | { type: "REMOVE_COLLABORATOR"; payload: string }
  | { type: "RESET_DATA" };

function reducer(state: FamilyData, action: Action): FamilyData {
  const now = new Date().toISOString();
  switch (action.type) {
    case "LOAD_DATA":
      return action.payload;
    case "SET_FAMILY_NAME":
      return { ...state, familyName: action.payload, updatedAt: now };
    case "ADD_PERSON":
      return { ...state, persons: [...state.persons, action.payload], updatedAt: now };
    case "UPDATE_PERSON":
      return {
        ...state,
        persons: state.persons.map((p) =>
          p.id === action.payload.id ? action.payload : p
        ),
        updatedAt: now,
      };
    case "DELETE_PERSON": {
      const pid = action.payload;
      return {
        ...state,
        persons: state.persons.filter((p) => p.id !== pid),
        marriages: state.marriages.filter(
          (m) => m.husbandId !== pid && m.wifeId !== pid
        ),
        parentChildren: state.parentChildren.filter(
          (pc) => pc.parentId !== pid && pc.childId !== pid
        ),
        rootPersonId: state.rootPersonId === pid ? undefined : state.rootPersonId,
        updatedAt: now,
      };
    }
    case "ADD_MARRIAGE":
      return {
        ...state,
        marriages: [...state.marriages, action.payload],
        updatedAt: now,
      };
    case "DELETE_MARRIAGE":
      return {
        ...state,
        marriages: state.marriages.filter((m) => m.id !== action.payload),
        updatedAt: now,
      };
    case "ADD_PARENT_CHILD":
      return {
        ...state,
        parentChildren: [...state.parentChildren, action.payload],
        updatedAt: now,
      };
    case "DELETE_PARENT_CHILD":
      return {
        ...state,
        parentChildren: state.parentChildren.filter(
          (pc) => pc.id !== action.payload
        ),
        updatedAt: now,
      };
    case "SET_ROOT_PERSON":
      return { ...state, rootPersonId: action.payload, updatedAt: now };
    case "ADD_COLLABORATOR":
      return {
        ...state,
        collaborators: [...state.collaborators, action.payload],
        updatedAt: now,
      };
    case "REMOVE_COLLABORATOR":
      return {
        ...state,
        collaborators: state.collaborators.filter((c) => c.id !== action.payload),
        updatedAt: now,
      };
    case "RESET_DATA":
      return { ...initialData, createdAt: now, updatedAt: now };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface FamilyContextType {
  data: FamilyData;
  isLoading: boolean;
  isMigrating: boolean;
  addPerson: (person: Omit<Person, "id" | "createdAt" | "updatedAt">) => Person;
  updatePerson: (person: Person) => void;
  deletePerson: (id: string) => void;
  addMarriage: (marriage: Omit<Marriage, "id">) => void;
  deleteMarriage: (id: string) => void;
  addParentChild: (pc: Omit<ParentChild, "id">) => void;
  deleteParentChild: (id: string) => void;
  setRootPerson: (id: string) => void;
  setFamilyName: (name: string) => void;
  addCollaborator: (
    collab: Omit<Collaborator, "id" | "invitedAt" | "status">
  ) => void;
  removeCollaborator: (id: string) => void;
  getPersonById: (id: string) => Person | undefined;
  getChildren: (personId: string) => Person[];
  getParents: (personId: string) => Person[];
  getSpouses: (personId: string) => Person[];
  getSiblings: (personId: string) => Person[];
  resetData: () => void;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initialData);
  const [isLoading, setIsLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);

  // Bootstrap: migrate kalau perlu, kemudian hydrate dari SQLite
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Step 1: Run migration kalau ada data lama
        if (await shouldPromptMigration()) {
          if (!cancelled) setIsMigrating(true);
          const result = await runMigration();
          if (!cancelled) setIsMigrating(false);

          if (!result.success && result.errors.length > 0) {
            console.error("Migration errors:", result.errors);
          }
        }

        // Step 2: Hydrate dari SQLite
        const loaded = await loadFromSqlite();
        if (!cancelled) {
          dispatch({ type: "LOAD_DATA", payload: loaded });
        }
      } catch (e) {
        console.error("Failed to initialize family store:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Mutations (sync API, async persistence) ──────────────────────────────

  const addPerson = useCallback(
    (personData: Omit<Person, "id" | "createdAt" | "updatedAt">): Person => {
      const now = new Date().toISOString();
      const person: Person = {
        ...personData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: "ADD_PERSON", payload: person });

      // Persist async (fire-and-forget, errors logged)
      persistPersonInsert(person).catch((e) =>
        console.error("SQLite insert person failed:", e)
      );

      return person;
    },
    []
  );

  const updatePerson = useCallback((person: Person) => {
    const updated: Person = { ...person, updatedAt: new Date().toISOString() };
    dispatch({ type: "UPDATE_PERSON", payload: updated });
    persistPersonUpdate(updated).catch((e) =>
      console.error("SQLite update person failed:", e)
    );
  }, []);

  const deletePerson = useCallback((id: string) => {
    dispatch({ type: "DELETE_PERSON", payload: id });
    persistPersonDelete(id).catch((e) =>
      console.error("SQLite delete person failed:", e)
    );
  }, []);

  const addMarriage = useCallback((marriage: Omit<Marriage, "id">) => {
    const full: Marriage = { ...marriage, id: generateId() };
    dispatch({ type: "ADD_MARRIAGE", payload: full });
    persistMarriageInsert(full).catch((e) =>
      console.error("SQLite insert marriage failed:", e)
    );
  }, []);

  const deleteMarriage = useCallback((id: string) => {
    dispatch({ type: "DELETE_MARRIAGE", payload: id });
    persistMarriageDelete(id).catch((e) =>
      console.error("SQLite delete marriage failed:", e)
    );
  }, []);

  const addParentChild = useCallback((pc: Omit<ParentChild, "id">) => {
    const full: ParentChild = { ...pc, id: generateId() };
    dispatch({ type: "ADD_PARENT_CHILD", payload: full });
    persistParentChildInsert(full).catch((e) =>
      console.error("SQLite insert parent-child failed:", e)
    );
  }, []);

  const deleteParentChild = useCallback((id: string) => {
    dispatch({ type: "DELETE_PARENT_CHILD", payload: id });
    persistParentChildDelete(id).catch((e) =>
      console.error("SQLite delete parent-child failed:", e)
    );
  }, []);

  const setRootPerson = useCallback((id: string) => {
    dispatch({ type: "SET_ROOT_PERSON", payload: id });
    persistMeta("rootPersonId", id).catch((e) =>
      console.error("SQLite meta update failed:", e)
    );
  }, []);

  const setFamilyName = useCallback((name: string) => {
    dispatch({ type: "SET_FAMILY_NAME", payload: name });
    persistMeta("familyName", name).catch((e) =>
      console.error("SQLite meta update failed:", e)
    );
  }, []);

  const addCollaborator = useCallback(
    (collab: Omit<Collaborator, "id" | "invitedAt" | "status">) => {
      const full: Collaborator = {
        ...collab,
        id: generateId(),
        invitedAt: new Date().toISOString(),
        status: "pending",
      };
      dispatch({ type: "ADD_COLLABORATOR", payload: full });
      persistCollaboratorInsert(full).catch((e) =>
        console.error("SQLite collaborator insert failed:", e)
      );
    },
    []
  );

  const removeCollaborator = useCallback((id: string) => {
    dispatch({ type: "REMOVE_COLLABORATOR", payload: id });
    persistCollaboratorDelete(id).catch((e) =>
      console.error("SQLite collaborator delete failed:", e)
    );
  }, []);

  const resetData = useCallback(() => {
    dispatch({ type: "RESET_DATA" });
    persistResetAll().catch((e) =>
      console.error("SQLite reset failed:", e)
    );
  }, []);

  // ─── Query helpers (guna state in-memory untuk pantas) ──────────────────

  const getPersonById = useCallback(
    (id: string) => data.persons.find((p) => p.id === id),
    [data.persons]
  );

  const getChildren = useCallback(
    (personId: string) => {
      const childIds = data.parentChildren
        .filter((pc) => pc.parentId === personId)
        .map((pc) => pc.childId);
      return data.persons.filter((p) => childIds.includes(p.id));
    },
    [data.persons, data.parentChildren]
  );

  const getParents = useCallback(
    (personId: string) => {
      const parentIds = data.parentChildren
        .filter((pc) => pc.childId === personId)
        .map((pc) => pc.parentId);
      return data.persons.filter((p) => parentIds.includes(p.id));
    },
    [data.persons, data.parentChildren]
  );

  const getSpouses = useCallback(
    (personId: string) => {
      const spouseIds = data.marriages
        .filter((m) => m.husbandId === personId || m.wifeId === personId)
        .map((m) => (m.husbandId === personId ? m.wifeId : m.husbandId));
      return data.persons.filter((p) => spouseIds.includes(p.id));
    },
    [data.persons, data.marriages]
  );

  const getSiblings = useCallback(
    (personId: string) => {
      const parentIds = data.parentChildren
        .filter((pc) => pc.childId === personId)
        .map((pc) => pc.parentId);
      if (parentIds.length === 0) return [];
      const sibIds = new Set<string>();
      for (const pc of data.parentChildren) {
        if (parentIds.includes(pc.parentId) && pc.childId !== personId) {
          sibIds.add(pc.childId);
        }
      }
      return data.persons.filter((p) => sibIds.has(p.id));
    },
    [data.persons, data.parentChildren]
  );

  return (
    <FamilyContext.Provider
      value={{
        data,
        isLoading,
        isMigrating,
        addPerson,
        updatePerson,
        deletePerson,
        addMarriage,
        deleteMarriage,
        addParentChild,
        deleteParentChild,
        setRootPerson,
        setFamilyName,
        addCollaborator,
        removeCollaborator,
        getPersonById,
        getChildren,
        getParents,
        getSpouses,
        getSiblings,
        resetData,
      }}
    >
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error("useFamily must be used within FamilyProvider");
  return ctx;
}

// ═════════════════════════════════════════════════════════════════════════════
// Persistence layer (private)
// ═════════════════════════════════════════════════════════════════════════════

async function loadFromSqlite(): Promise<FamilyData> {
  const db = await getDatabase();
  const [personRows, marriageRows, pcRows, collabRows, metaRows] =
    await Promise.all([
      db.select().from(personsTable),
      db.select().from(marriagesTable),
      db.select().from(parentChildTable),
      db.select().from(collaboratorsTable),
      db.select().from(familyMeta),
    ]);

  const metaMap = new Map(metaRows.map((m) => [m.key, m.value ?? ""]));

  return {
    persons: personRows
      .filter((r) => !r.deletedAt)
      .map(mapDbPerson),
    marriages: marriageRows.map(mapDbMarriage),
    parentChildren: pcRows.map(mapDbParentChild),
    collaborators: collabRows.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name ?? undefined,
      role: c.role,
      invitedAt: c.invitedAt,
      status: c.status as any,
    })),
    familyName: metaMap.get("familyName") || "My Family",
    rootPersonId: metaMap.get("rootPersonId") || undefined,
    createdAt: metaMap.get("createdAt") || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapDbPerson(r: DbPerson): Person {
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

function mapDbMarriage(r: DbMarriage): Marriage {
  return {
    id: r.id,
    husbandId: r.husbandId,
    wifeId: r.wifeId,
    marriageDate: r.marriageDate ?? undefined,
    marriagePlace: r.marriagePlace ?? undefined,
    divorceDate: r.divorceDate ?? undefined,
    isActive: r.isActive,
    notes: r.notes ?? undefined,
  };
}

function mapDbParentChild(r: DbParentChild): ParentChild {
  return {
    id: r.id,
    parentId: r.parentId,
    childId: r.childId,
    type: r.type as any,
  };
}

// ─── Persist functions ──────────────────────────────────────────────────────

async function persistPersonInsert(p: Person): Promise<void> {
  const db = await getDatabase();
  await db.insert(personsTable).values({
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
    isAlive: p.isAlive,
    race: p.race ?? null,
    religion: p.religion,
    icNumber: p.icNumber ?? null,
    photo: p.photo ?? null,
    bio: p.bio ?? null,
    soundexName: soundexMalay(p.firstName),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
}

async function persistPersonUpdate(p: Person): Promise<void> {
  const db = await getDatabase();
  await db
    .update(personsTable)
    .set({
      prefix: p.prefix ?? null,
      firstName: p.firstName,
      binBinti: p.binBinti ?? null,
      lastName: p.lastName ?? null,
      gender: p.gender,
      birthDate: p.birthDate ?? null,
      birthPlace: p.birthPlace ?? null,
      deathDate: p.deathDate ?? null,
      deathPlace: p.deathPlace ?? null,
      isAlive: p.isAlive,
      race: p.race ?? null,
      religion: p.religion,
      icNumber: p.icNumber ?? null,
      photo: p.photo ?? null,
      bio: p.bio ?? null,
      soundexName: soundexMalay(p.firstName),
      updatedAt: p.updatedAt,
    })
    .where(eq(personsTable.id, p.id));
}

async function persistPersonDelete(id: string): Promise<void> {
  const db = await getDatabase();
  // Cascade: hapus relationships dulu (dalam transaction)
  const rawDb = await getRawDatabase();
  await rawDb.withTransactionAsync(async () => {
    await db
      .delete(parentChildTable)
      .where(
        or(
          eq(parentChildTable.parentId, id),
          eq(parentChildTable.childId, id)
        )
      );
    await db
      .delete(marriagesTable)
      .where(
        or(eq(marriagesTable.husbandId, id), eq(marriagesTable.wifeId, id))
      );
    await db.delete(personsTable).where(eq(personsTable.id, id));
  });
  // Closure table auto-cleaned via FK cascade
  // Tapi untuk safety rebuild — mahal, buat async
  rebuildClosure().catch((e) => console.error("Rebuild closure failed:", e));
}

async function persistMarriageInsert(m: Marriage): Promise<void> {
  const db = await getDatabase();
  await db.insert(marriagesTable).values({
    id: m.id,
    husbandId: m.husbandId,
    wifeId: m.wifeId,
    wifeNumber: 1,
    marriageDate: m.marriageDate ?? null,
    marriagePlace: m.marriagePlace ?? null,
    divorceDate: m.divorceDate ?? null,
    isActive: m.isActive,
    notes: m.notes ?? null,
  });
}

async function persistMarriageDelete(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(marriagesTable).where(eq(marriagesTable.id, id));
}

async function persistParentChildInsert(pc: ParentChild): Promise<void> {
  const db = await getDatabase();
  await db.insert(parentChildTable).values({
    id: pc.id,
    parentId: pc.parentId,
    childId: pc.childId,
    type: pc.type,
  });
  // Trigger auto-update closure table
}

async function persistParentChildDelete(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(parentChildTable).where(eq(parentChildTable.id, id));
  // Closure perlu rebuild — trigger delete susah untuk 100% correct
  await rebuildClosure();
}

async function persistCollaboratorInsert(c: Collaborator): Promise<void> {
  const db = await getDatabase();
  await db.insert(collaboratorsTable).values({
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    role: c.role,
    status: c.status,
    invitedAt: c.invitedAt,
  });
}

async function persistCollaboratorDelete(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(collaboratorsTable).where(eq(collaboratorsTable.id, id));
}

async function persistMeta(key: string, value: string): Promise<void> {
  const rawDb = await getRawDatabase();
  await rawDb.runAsync(
    "INSERT OR REPLACE INTO family_meta (key, value) VALUES (?, ?)",
    [key, value]
  );
}

async function persistResetAll(): Promise<void> {
  const rawDb = await getRawDatabase();
  await rawDb.withTransactionAsync(async () => {
    await rawDb.execAsync("DELETE FROM audit_log;");
    await rawDb.execAsync("DELETE FROM events;");
    await rawDb.execAsync("DELETE FROM person_closure;");
    await rawDb.execAsync("DELETE FROM parent_child;");
    await rawDb.execAsync("DELETE FROM marriages;");
    await rawDb.execAsync("DELETE FROM persons;");
    await rawDb.execAsync("DELETE FROM collaborators;");
    await rawDb.execAsync("DELETE FROM family_meta;");
  });
}
