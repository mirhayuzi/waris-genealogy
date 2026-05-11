/**
 * Mahram Detection — Mazhab Syafi'e
 *
 * Pure logic module. No database, no async, no React, no i18n. Operates
 * purely on the in-memory `FamilyData` snapshot.
 *
 * Three tiers, checked in order:
 *   1. Spouse — current (active) marriage between A and B
 *   2. Nasab — blood relations via `parent_child` rows where type='biological'
 *      Subtypes: usul (ancestor), furu' (descendant), sibling (full / half),
 *                niece-nephew (sibling's descendant), aunt-uncle (parent's
 *                sibling-line ancestor)
 *   3. Musaharah — relations via marriage:
 *        - in-law ascendant (mother/father-in-law and beyond)
 *        - in-law descendant (son/daughter-in-law and beyond)
 *        - step-parent (non-blood spouse of A's blood parent)
 *        - step-child (non-blood child of A's spouse)
 *
 * Tier 4 (Radha'ah / breastfeeding) is intentionally out of scope.
 *
 * Religious notes (Mazhab Syafi'e):
 *   - Adopted children are NOT Mahram by Nasab. parent_child rows with
 *     type !== 'biological' are excluded from blood-line walks.
 *   - In-law (Musaharah) relations persist after divorce / spouse's death.
 *   - Stepchildren are technically Mahram only after consummation. Lacking a
 *     consummation flag in the schema, this tool assumes any recorded
 *     marriage is consummated.
 *   - Cousins (both depths >= 2 from the lowest common ancestor) are NOT
 *     Mahram and may marry under Islamic law.
 *   - A divorced couple are NOT Mahram to each other (they may remarry).
 *     Only the *currently active* marriage produces a 'spouse' verdict.
 */

import type { FamilyData, Person, ParentChild } from "./types";

// ─── Public types ────────────────────────────────────────────────────────────

export type MahramTier = "spouse" | "nasab" | "musaharah" | "none";

export type MahramSubtype =
  | "spouse"
  | "usul"
  | "furu"
  | "sibling_full"
  | "sibling_half_seibu"
  | "sibling_half_sebapa"
  | "niece_nephew"
  | "aunt_uncle"
  | "in_law_ascendant"
  | "in_law_descendant"
  | "step_parent"
  | "step_child"
  | "none";

export interface MahramVerdict {
  isMahram: boolean;
  tier: MahramTier;
  subtype: MahramSubtype;
  /**
   * Person IDs forming the connection. Convention: pathIds[0] is the
   * "subject" (B) being described, pathIds[last] is the reference (A).
   * Intermediate IDs are the relatives bridging the two.
   */
  pathIds: string[];
  /** "ibu" or "bapa" for ascendant/uncle/aunt labels. Undefined otherwise. */
  side?: "ibu" | "bapa";
  labelBm: string;
  labelEn: string;
  reasonBm: string;
  reasonEn: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Determine the Mahram verdict for the pair (A, B).
 * The verdict is symmetric (Mahram is a mutual relation) but the labels are
 * worded as "B is X to A" — so swapping A and B produces a verdict from the
 * opposite perspective.
 */
export function checkMahram(
  personA: Person,
  personB: Person,
  family: FamilyData,
): MahramVerdict {
  if (personA.id === personB.id) return notApplicable();

  const spouseV = checkSpouse(personA, personB, family);
  if (spouseV) return spouseV;

  const nasabV = checkNasab(personA, personB, family);
  if (nasabV) return nasabV;

  const musaharahV = checkMusaharah(personA, personB, family);
  if (musaharahV) return musaharahV;

  return notMahram(personA, personB);
}

// ─── Tier 1: Spouse (active marriage) ────────────────────────────────────────

function checkSpouse(
  a: Person,
  b: Person,
  family: FamilyData,
): MahramVerdict | null {
  const m = family.marriages.find(
    (mar) =>
      mar.isActive &&
      ((mar.husbandId === a.id && mar.wifeId === b.id) ||
        (mar.wifeId === a.id && mar.husbandId === b.id)),
  );
  if (!m) return null;

  const labelBm = b.gender === "male" ? "Suami" : "Isteri";
  const labelEn = b.gender === "male" ? "Husband" : "Wife";
  return {
    isMahram: true,
    tier: "spouse",
    subtype: "spouse",
    pathIds: [b.id, a.id],
    labelBm,
    labelEn,
    reasonBm: `${b.firstName} adalah ${labelBm.toLowerCase()} kepada ${a.firstName}.`,
    reasonEn: `${b.firstName} is the ${labelEn.toLowerCase()} of ${a.firstName}.`,
  };
}

// ─── Tier 2: Nasab (Blood) ───────────────────────────────────────────────────

function checkNasab(
  a: Person,
  b: Person,
  family: FamilyData,
): MahramVerdict | null {
  const ancA = bioAncestorDepths(a.id, family);
  const ancB = bioAncestorDepths(b.id, family);

  // B is A's blood ancestor → Usul
  const aToB = ancA.get(b.id);
  if (aToB !== undefined && aToB > 0) {
    return buildUsulVerdict(a, b, aToB, family);
  }

  // A is B's blood ancestor → B is A's descendant → Furu'
  const bToA = ancB.get(a.id);
  if (bToA !== undefined && bToA > 0) {
    return buildFuruVerdict(a, b, bToA, family);
  }

  // Lowest common ancestor — pick smallest combined depth
  let bestLca: { id: string; aDepth: number; bDepth: number } | null = null;
  for (const [ancestorId, aDepth] of ancA) {
    if (aDepth === 0) continue;
    const bDepth = ancB.get(ancestorId);
    if (bDepth === undefined || bDepth === 0) continue;
    if (
      bestLca === null ||
      aDepth + bDepth < bestLca.aDepth + bestLca.bDepth
    ) {
      bestLca = { id: ancestorId, aDepth, bDepth };
    }
  }
  if (!bestLca) return null;

  const { aDepth, bDepth } = bestLca;

  // Cousins (or beyond) — NOT Mahram in Mazhab Syafi'e
  if (aDepth >= 2 && bDepth >= 2) return null;

  // Siblings (full or half)
  if (aDepth === 1 && bDepth === 1) {
    return buildSiblingVerdict(a, b, ancA, ancB, family);
  }

  // B is descendant of A's sibling — niece/nephew/grand-niece/...
  if (aDepth === 1 && bDepth >= 2) {
    return buildNieceNephewVerdict(a, b, bestLca, family);
  }

  // B is sibling-line of A's ancestor — pakcik/makcik/grand-pakcik/...
  if (aDepth >= 2 && bDepth === 1) {
    return buildAuntUncleVerdict(a, b, bestLca, family);
  }

  return null;
}

// ─── Tier 3: Musaharah (Marriage) ────────────────────────────────────────────

function checkMusaharah(
  a: Person,
  b: Person,
  family: FamilyData,
): MahramVerdict | null {
  // (1) B is blood ancestor of any spouse-ever of A → in-law ascendant
  for (const sp of everSpousesOf(a.id, family)) {
    const spAnc = bioAncestorDepths(sp.id, family);
    const depth = spAnc.get(b.id);
    if (depth !== undefined && depth > 0) {
      return buildInLawAscendantVerdict(a, b, sp, depth);
    }
  }

  // (2) A is blood ancestor of any spouse-ever of B → B is married to A's
  //     descendant → in-law descendant (menantu / pasangan cucu / ...)
  for (const sp of everSpousesOf(b.id, family)) {
    const spAnc = bioAncestorDepths(sp.id, family);
    const depth = spAnc.get(a.id);
    if (depth !== undefined && depth > 0) {
      return buildInLawDescendantVerdict(a, b, sp, depth);
    }
  }

  // (3) Step-parent: B is non-blood spouse-ever of one of A's blood parents
  const aBioParents = bioParentsOf(a.id, family);
  const aBioParentIds = new Set(aBioParents.map((p) => p.id));
  for (const parent of aBioParents) {
    const parentSpouses = everSpousesOf(parent.id, family);
    for (const ps of parentSpouses) {
      if (ps.id === b.id && !aBioParentIds.has(b.id)) {
        return buildStepParentVerdict(a, b, parent);
      }
    }
  }

  // (4) Step-child: B is non-blood child of one of A's spouses-ever
  const aBioChildIds = new Set(bioChildrenOf(a.id, family).map((p) => p.id));
  for (const sp of everSpousesOf(a.id, family)) {
    const spChildren = bioChildrenOf(sp.id, family);
    for (const c of spChildren) {
      if (c.id === b.id && !aBioChildIds.has(b.id)) {
        return buildStepChildVerdict(a, b, sp);
      }
    }
  }

  // Symmetric of (3): B's bio parent's spouse is A → A is B's step-parent →
  // B is A's step-child. Already covered by (4) when called as
  // checkMahram(parent, child, ...) — but this module is called with a
  // specific (A, B) order from the screen. We need to also catch the case
  // where A IS the step-parent of B (caller selected the older person as A):
  const bBioParents = bioParentsOf(b.id, family);
  const bBioParentIds = new Set(bBioParents.map((p) => p.id));
  for (const parent of bBioParents) {
    const parentSpouses = everSpousesOf(parent.id, family);
    for (const ps of parentSpouses) {
      if (ps.id === a.id && !bBioParentIds.has(a.id)) {
        // A is B's step-parent → from A's perspective, B is A's step-child
        return buildStepChildVerdict(a, b, parent);
      }
    }
  }

  // Symmetric of (4): A is bio child of B's spouse → B is A's step-parent
  const bBioChildIds = new Set(bioChildrenOf(b.id, family).map((p) => p.id));
  for (const sp of everSpousesOf(b.id, family)) {
    const spChildren = bioChildrenOf(sp.id, family);
    for (const c of spChildren) {
      if (c.id === a.id && !bBioChildIds.has(a.id)) {
        return buildStepParentVerdict(a, b, sp);
      }
    }
  }

  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * BFS over biological parent_child edges. Returns Map<ancestorId, depth>
 * including the start (depth 0).
 */
function bioAncestorDepths(
  personId: string,
  family: FamilyData,
): Map<string, number> {
  const map = new Map<string, number>();
  map.set(personId, 0);
  const queue: Array<[string, number]> = [[personId, 0]];
  while (queue.length > 0) {
    const [id, d] = queue.shift()!;
    for (const pc of family.parentChildren) {
      if (pc.type !== "biological") continue;
      if (pc.childId !== id) continue;
      if (map.has(pc.parentId)) continue;
      map.set(pc.parentId, d + 1);
      queue.push([pc.parentId, d + 1]);
    }
  }
  return map;
}

function bioParentsOf(personId: string, family: FamilyData): Person[] {
  const ids = family.parentChildren
    .filter((pc) => pc.type === "biological" && pc.childId === personId)
    .map((pc) => pc.parentId);
  return family.persons.filter((p) => ids.includes(p.id));
}

function bioChildrenOf(personId: string, family: FamilyData): Person[] {
  const ids = family.parentChildren
    .filter((pc) => pc.type === "biological" && pc.parentId === personId)
    .map((pc) => pc.childId);
  return family.persons.filter((p) => ids.includes(p.id));
}

/** All marriages of `personId`, regardless of `isActive`. */
function everSpousesOf(personId: string, family: FamilyData): Person[] {
  const ids = family.marriages
    .filter((m) => m.husbandId === personId || m.wifeId === personId)
    .map((m) => (m.husbandId === personId ? m.wifeId : m.husbandId));
  return family.persons.filter((p) => ids.includes(p.id));
}

/**
 * Walk biological parent edges from `fromId` upward to find shortest path to
 * `targetId`. Returns inclusive chain [from, ..., target], or null if no
 * blood path exists. Assumes target is a known ancestor of from.
 */
function pathToBioAncestor(
  fromId: string,
  targetId: string,
  family: FamilyData,
): string[] | null {
  if (fromId === targetId) return [fromId];
  const queue: Array<{ id: string; path: string[] }> = [
    { id: fromId, path: [fromId] },
  ];
  const visited = new Set<string>([fromId]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const pc of family.parentChildren) {
      if (pc.type !== "biological") continue;
      if (pc.childId !== cur.id) continue;
      if (visited.has(pc.parentId)) continue;
      visited.add(pc.parentId);
      const newPath = [...cur.path, pc.parentId];
      if (pc.parentId === targetId) return newPath;
      queue.push({ id: pc.parentId, path: newPath });
    }
  }
  return null;
}

/**
 * From a path that walks A → ... → ancestor, infer whether the maternal or
 * paternal side is being traversed (based on A's first parent in the path).
 */
function inferSide(
  path: string[],
  family: FamilyData,
): "ibu" | "bapa" | undefined {
  if (path.length < 2) return undefined;
  const firstParent = family.persons.find((p) => p.id === path[1]);
  if (!firstParent) return undefined;
  return firstParent.gender === "female" ? "ibu" : "bapa";
}

function nameOf(personId: string, family: FamilyData): string {
  return (
    family.persons.find((p) => p.id === personId)?.firstName ?? personId
  );
}

// ─── Verdict builders ────────────────────────────────────────────────────────

function notApplicable(): MahramVerdict {
  return {
    isMahram: false,
    tier: "none",
    subtype: "none",
    pathIds: [],
    labelBm: "Orang yang sama",
    labelEn: "Same person",
    reasonBm: "Tidak boleh menyemak Mahram pada orang yang sama.",
    reasonEn: "Cannot check Mahram against the same person.",
  };
}

function notMahram(a: Person, b: Person): MahramVerdict {
  return {
    isMahram: false,
    tier: "none",
    subtype: "none",
    pathIds: [],
    labelBm: "Bukan Mahram",
    labelEn: "Not Mahram",
    reasonBm:
      `${b.firstName} bukan Mahram kepada ${a.firstName}. ` +
      `Tiada hubungan Nasab (darah) atau Musaharah (perkahwinan) yang menjadikan mereka Mahram.`,
    reasonEn:
      `${b.firstName} is not Mahram to ${a.firstName}. ` +
      `No qualifying blood (Nasab) or marriage (Musaharah) relation.`,
  };
}

function ascendantBaseLabel(
  depth: number,
  gender: "male" | "female",
): { bm: string; en: string } {
  if (depth === 1)
    return {
      bm: gender === "male" ? "Bapa" : "Ibu",
      en: gender === "male" ? "Father" : "Mother",
    };
  if (depth === 2)
    return {
      bm: gender === "male" ? "Datuk" : "Nenek",
      en: gender === "male" ? "Grandfather" : "Grandmother",
    };
  if (depth === 3)
    return {
      bm: "Moyang",
      en: gender === "male" ? "Great-grandfather" : "Great-grandmother",
    };
  return {
    bm: `Moyang (${depth} generasi)`,
    en: `${depth}-generation ancestor`,
  };
}

function descendantBaseLabel(depth: number): { bm: string; en: string } {
  if (depth === 1) return { bm: "Anak", en: "Child" };
  if (depth === 2) return { bm: "Cucu", en: "Grandchild" };
  if (depth === 3) return { bm: "Cicit", en: "Great-grandchild" };
  return {
    bm: `Keturunan (${depth} generasi)`,
    en: `${depth}-generation descendant`,
  };
}

function buildUsulVerdict(
  a: Person,
  b: Person,
  depth: number,
  family: FamilyData,
): MahramVerdict {
  const path = pathToBioAncestor(a.id, b.id, family) ?? [a.id, b.id];
  const side = inferSide(path, family);
  const base = ascendantBaseLabel(depth, b.gender);
  const labelBm = side ? `${base.bm} sebelah ${side}` : base.bm;
  const labelEn =
    side === "ibu"
      ? `Maternal ${base.en.toLowerCase()}`
      : side === "bapa"
        ? `Paternal ${base.en.toLowerCase()}`
        : base.en;

  // Trace via the immediate intermediate (the first generation toward B)
  const intermediates = path.slice(1, -1);
  const lastInter = intermediates[intermediates.length - 1];
  const interName = lastInter ? nameOf(lastInter, family) : null;

  let reasonBm = `${b.firstName} adalah ${labelBm.toLowerCase()} kepada ${a.firstName}`;
  let reasonEn = `${b.firstName} is the ${labelEn.toLowerCase()} of ${a.firstName}`;
  if (interName) {
    const role = b.gender === "male" ? "bapa" : "ibu";
    const roleEn = b.gender === "male" ? "father" : "mother";
    reasonBm += ` (${b.firstName} adalah ${role} kepada ${interName}).`;
    reasonEn += ` (${b.firstName} is the ${roleEn} of ${interName}).`;
  } else {
    reasonBm += ".";
    reasonEn += ".";
  }

  return {
    isMahram: true,
    tier: "nasab",
    subtype: "usul",
    pathIds: [...path].reverse(),
    side,
    labelBm,
    labelEn,
    reasonBm,
    reasonEn,
  };
}

function buildFuruVerdict(
  a: Person,
  b: Person,
  depth: number,
  family: FamilyData,
): MahramVerdict {
  // path walks B up to A; pathIds keeps that direction (B → ... → A)
  const path = pathToBioAncestor(b.id, a.id, family) ?? [b.id, a.id];
  const base = descendantBaseLabel(depth);
  const intermediates = path.slice(1, -1);
  const firstInter = intermediates[0];
  const interName = firstInter ? nameOf(firstInter, family) : null;

  let reasonBm = `${b.firstName} adalah ${base.bm.toLowerCase()} kepada ${a.firstName}`;
  let reasonEn = `${b.firstName} is the ${base.en.toLowerCase()} of ${a.firstName}`;
  if (interName) {
    reasonBm += ` (melalui ${interName}).`;
    reasonEn += ` (through ${interName}).`;
  } else {
    reasonBm += ".";
    reasonEn += ".";
  }

  return {
    isMahram: true,
    tier: "nasab",
    subtype: "furu",
    pathIds: [...path],
    labelBm: base.bm,
    labelEn: base.en,
    reasonBm,
    reasonEn,
  };
}

function buildSiblingVerdict(
  a: Person,
  b: Person,
  ancA: Map<string, number>,
  ancB: Map<string, number>,
  family: FamilyData,
): MahramVerdict {
  const sharedParentIds: string[] = [];
  for (const [id, d] of ancA) {
    if (d === 1 && ancB.get(id) === 1) sharedParentIds.push(id);
  }

  if (sharedParentIds.length >= 2) {
    return {
      isMahram: true,
      tier: "nasab",
      subtype: "sibling_full",
      pathIds: [b.id, ...sharedParentIds, a.id],
      labelBm: "Adik-beradik kandung",
      labelEn: "Full sibling",
      reasonBm: `${b.firstName} dan ${a.firstName} adalah adik-beradik kandung — kongsi kedua-dua ibu bapa.`,
      reasonEn: `${b.firstName} and ${a.firstName} are full siblings — sharing both parents.`,
    };
  }

  const sharedParentId = sharedParentIds[0];
  const sharedParent = family.persons.find((p) => p.id === sharedParentId);
  const isSeibu = sharedParent?.gender === "female";
  const sharedName = sharedParent?.firstName ?? "ibu/bapa kongsi";

  return {
    isMahram: true,
    tier: "nasab",
    subtype: isSeibu ? "sibling_half_seibu" : "sibling_half_sebapa",
    pathIds: [b.id, sharedParentId, a.id],
    labelBm: isSeibu ? "Adik-beradik seibu" : "Adik-beradik sebapa",
    labelEn: isSeibu
      ? "Half-sibling (same mother)"
      : "Half-sibling (same father)",
    reasonBm:
      `${b.firstName} dan ${a.firstName} adalah adik-beradik ${isSeibu ? "seibu" : "sebapa"} ` +
      `(kongsi ${isSeibu ? "ibu" : "bapa"} sahaja: ${sharedName}). ` +
      `Saudara seibu/sebapa adalah Mahram melalui Nasab.`,
    reasonEn:
      `${b.firstName} and ${a.firstName} are half-siblings sharing only their ` +
      `${isSeibu ? "mother" : "father"} (${sharedName}). Half-siblings are Mahram via Nasab.`,
  };
}

function buildNieceNephewVerdict(
  a: Person,
  b: Person,
  lca: { id: string; aDepth: number; bDepth: number },
  family: FamilyData,
): MahramVerdict {
  const lcaName = nameOf(lca.id, family);
  const bToLca = pathToBioAncestor(b.id, lca.id, family) ?? [b.id, lca.id];
  const aToLca = pathToBioAncestor(a.id, lca.id, family) ?? [a.id, lca.id];
  // path: B → ... → LCA → ... → A
  const path = [...bToLca, ...[...aToLca].reverse().slice(1)];

  let labelBm: string;
  let labelEn: string;
  if (lca.bDepth === 2) {
    labelBm = b.gender === "male" ? "Anak saudara lelaki" : "Anak saudara perempuan";
    labelEn = b.gender === "male" ? "Nephew" : "Niece";
  } else if (lca.bDepth === 3) {
    labelBm = "Cucu saudara";
    labelEn = b.gender === "male" ? "Grandnephew" : "Grandniece";
  } else {
    labelBm = `Keturunan adik-beradik (${lca.bDepth - 1} generasi)`;
    labelEn = `${lca.bDepth - 2}x grand-${b.gender === "male" ? "nephew" : "niece"}`;
  }

  return {
    isMahram: true,
    tier: "nasab",
    subtype: "niece_nephew",
    pathIds: path,
    labelBm,
    labelEn,
    reasonBm:
      `${b.firstName} adalah ${labelBm.toLowerCase()} kepada ${a.firstName} ` +
      `(keturunan adik-beradik ${a.firstName} melalui ${lcaName}).`,
    reasonEn:
      `${b.firstName} is the ${labelEn.toLowerCase()} of ${a.firstName} ` +
      `(descendant of ${a.firstName}'s sibling via ${lcaName}).`,
  };
}

function buildAuntUncleVerdict(
  a: Person,
  b: Person,
  lca: { id: string; aDepth: number; bDepth: number },
  family: FamilyData,
): MahramVerdict {
  const lcaName = nameOf(lca.id, family);
  const aToLca = pathToBioAncestor(a.id, lca.id, family) ?? [a.id, lca.id];
  const bToLca = pathToBioAncestor(b.id, lca.id, family) ?? [b.id, lca.id];
  // path: B → LCA → ... → A
  const path = [...bToLca, ...[...aToLca].reverse().slice(1)];
  const side = inferSide(aToLca, family);

  let baseBm: string;
  let baseEn: string;
  if (lca.aDepth === 2) {
    baseBm = b.gender === "male" ? "Pakcik" : "Makcik";
    baseEn = b.gender === "male" ? "Uncle" : "Aunt";
  } else if (lca.aDepth === 3) {
    baseBm =
      b.gender === "male" ? "Pakcik moyang" : "Makcik moyang";
    baseEn = b.gender === "male" ? "Granduncle" : "Grandaunt";
  } else {
    baseBm = `${b.gender === "male" ? "Pakcik" : "Makcik"} (${lca.aDepth - 1} generasi)`;
    baseEn = `${lca.aDepth - 2}x great-${b.gender === "male" ? "uncle" : "aunt"}`;
  }
  const labelBm = side ? `${baseBm} sebelah ${side}` : baseBm;
  const labelEn = side
    ? `${side === "ibu" ? "Maternal" : "Paternal"} ${baseEn.toLowerCase()}`
    : baseEn;

  return {
    isMahram: true,
    tier: "nasab",
    subtype: "aunt_uncle",
    pathIds: path,
    side,
    labelBm,
    labelEn,
    reasonBm:
      `${b.firstName} adalah adik-beradik kepada ${lcaName} ` +
      `(${a.firstName} memanggil ${lcaName} sebagai ` +
      `${ascendantBaseLabel(lca.aDepth, "male").bm.toLowerCase()}/` +
      `${ascendantBaseLabel(lca.aDepth, "female").bm.toLowerCase()}` +
      `${side ? ` sebelah ${side}` : ""}). Mahram melalui Nasab.`,
    reasonEn:
      `${b.firstName} is a sibling of ${lcaName}, who is ${a.firstName}'s ` +
      `${ascendantBaseLabel(lca.aDepth, b.gender).en.toLowerCase()}. Mahram via Nasab.`,
  };
}

function buildInLawAscendantVerdict(
  a: Person,
  b: Person,
  spouse: Person,
  depth: number,
): MahramVerdict {
  const base = ascendantBaseLabel(depth, b.gender);
  const labelBm =
    depth === 1
      ? b.gender === "male"
        ? "Bapa mertua"
        : "Ibu mertua"
      : `${base.bm} mertua`;
  const labelEn =
    depth === 1
      ? `${b.gender === "male" ? "Father" : "Mother"}-in-law`
      : `${base.en}-in-law`;

  return {
    isMahram: true,
    tier: "musaharah",
    subtype: "in_law_ascendant",
    pathIds: [b.id, spouse.id, a.id],
    labelBm,
    labelEn,
    reasonBm:
      `${b.firstName} adalah ${base.bm.toLowerCase()} kepada ${spouse.firstName}, ` +
      `pasangan ${a.firstName}. Mahram melalui Musaharah.`,
    reasonEn:
      `${b.firstName} is the ${base.en.toLowerCase()} of ${spouse.firstName}, ` +
      `who is married to ${a.firstName}. Mahram via Musaharah.`,
  };
}

function buildInLawDescendantVerdict(
  a: Person,
  b: Person,
  bSpouse: Person,
  depth: number,
): MahramVerdict {
  const base = descendantBaseLabel(depth);
  const labelBm =
    depth === 1
      ? b.gender === "male"
        ? "Menantu lelaki"
        : "Menantu perempuan"
      : `Pasangan ${base.bm.toLowerCase()}`;
  const labelEn =
    depth === 1
      ? b.gender === "male"
        ? "Son-in-law"
        : "Daughter-in-law"
      : `Spouse of ${base.en.toLowerCase()}`;

  return {
    isMahram: true,
    tier: "musaharah",
    subtype: "in_law_descendant",
    pathIds: [b.id, bSpouse.id, a.id],
    labelBm,
    labelEn,
    reasonBm:
      `${b.firstName} adalah pasangan kepada ${bSpouse.firstName}, ` +
      `${base.bm.toLowerCase()} ${a.firstName}. Mahram melalui Musaharah.`,
    reasonEn:
      `${b.firstName} is married to ${bSpouse.firstName}, the ` +
      `${base.en.toLowerCase()} of ${a.firstName}. Mahram via Musaharah.`,
  };
}

function buildStepParentVerdict(
  a: Person,
  b: Person,
  bioParent: Person,
): MahramVerdict {
  const labelBm = b.gender === "male" ? "Bapa tiri" : "Ibu tiri";
  const labelEn = b.gender === "male" ? "Stepfather" : "Stepmother";
  return {
    isMahram: true,
    tier: "musaharah",
    subtype: "step_parent",
    pathIds: [b.id, bioParent.id, a.id],
    labelBm,
    labelEn,
    reasonBm:
      `${b.firstName} adalah pasangan kepada ${bioParent.firstName}, ` +
      `${bioParent.gender === "female" ? "ibu" : "bapa"} kandung ${a.firstName}. ` +
      `Mahram melalui Musaharah.`,
    reasonEn:
      `${b.firstName} is the spouse of ${bioParent.firstName}, ` +
      `${a.firstName}'s biological ${bioParent.gender === "female" ? "mother" : "father"}. ` +
      `Mahram via Musaharah.`,
  };
}

function buildStepChildVerdict(
  a: Person,
  b: Person,
  bridge: Person,
): MahramVerdict {
  // `bridge` is the person linking A and B: either A's spouse who is B's
  // bio parent, OR B's bio parent whose spouse is A. Either way, the bridge
  // is B's blood parent and A's spouse-ever.
  const labelBm = b.gender === "male" ? "Anak tiri lelaki" : "Anak tiri perempuan";
  const labelEn = "Stepchild";
  return {
    isMahram: true,
    tier: "musaharah",
    subtype: "step_child",
    pathIds: [b.id, bridge.id, a.id],
    labelBm,
    labelEn,
    reasonBm:
      `${b.firstName} adalah anak kandung ${bridge.firstName}, ` +
      `pasangan ${a.firstName}. Mahram melalui Musaharah.`,
    reasonEn:
      `${b.firstName} is the biological child of ${bridge.firstName}, ` +
      `who is married to ${a.firstName}. Mahram via Musaharah.`,
  };
}

// ─── Internal exports for testing ────────────────────────────────────────────

export const __test__ = {
  bioAncestorDepths,
  pathToBioAncestor,
  inferSide,
  bioParentsOf,
  bioChildrenOf,
  everSpousesOf,
};
