import { describe, it, expect } from "vitest";
import { checkMahram } from "../mahram";
import type { FamilyData, Person, ParentChild, Marriage } from "../types";

// ─── Test family ─────────────────────────────────────────────────────────────
//
// Mirrors the user's actual tree (relevant subset):
//
//   Gen 3:  Sibil(M) ─── NenekIbu(F)        DatukBapa(M) ─── NenekBapa(F)
//             │                                     │
//             ├─ Tiajar(F) ─── Mohd(M, ended)       └─ Mohd(M, deceased)
//             │           ╲
//             │            ╲── Rejin(M, active)
//             │                  │
//             ├─ Pakcik(M)       │
//             │     │            │
//             │     └─ Sepupu(F) │
//             │                  │
//   Gen 1:    └──── Yuzi(M) ──── Nisa(F)
//                  Kakak(F, full sib of Yuzi)
//                  Adik(F, Tiajar+Rejin, half sib of Yuzi)

function person(
  id: string,
  firstName: string,
  gender: "male" | "female",
  isAlive = true,
): Person {
  return {
    id,
    firstName,
    gender,
    religion: "Islam",
    isAlive,
    createdAt: "",
    updatedAt: "",
  };
}

const persons: Person[] = [
  person("yuzi", "Yuzi", "male"),
  person("nisa", "Nisa", "female"),
  person("mohd", "Mohd", "male", false),
  person("tiajar", "Tiajar", "female"),
  person("rejin", "Rejin", "male"),
  person("kakak", "Kakak", "female"),
  person("adik", "Adik", "female"),
  person("sibil", "Sibil", "male"),
  person("nenekIbu", "NenekIbu", "female"),
  person("datukBapa", "DatukBapa", "male"),
  person("nenekBapa", "NenekBapa", "female"),
  person("pakcik", "Pakcik", "male"),
  person("sepupu", "Sepupu", "female"),
];

const pc = (id: string, parentId: string, childId: string): ParentChild => ({
  id,
  parentId,
  childId,
  type: "biological",
});

const parentChildren: ParentChild[] = [
  pc("pc1", "mohd", "yuzi"),
  pc("pc2", "tiajar", "yuzi"),
  pc("pc3", "mohd", "kakak"),
  pc("pc4", "tiajar", "kakak"),
  pc("pc5", "tiajar", "adik"),
  pc("pc6", "rejin", "adik"),
  pc("pc7", "sibil", "tiajar"),
  pc("pc8", "nenekIbu", "tiajar"),
  pc("pc9", "sibil", "pakcik"),
  pc("pc10", "nenekIbu", "pakcik"),
  pc("pc11", "datukBapa", "mohd"),
  pc("pc12", "nenekBapa", "mohd"),
  pc("pc13", "pakcik", "sepupu"),
];

const m = (
  id: string,
  husbandId: string,
  wifeId: string,
  isActive: boolean,
): Marriage => ({ id, husbandId, wifeId, isActive });

const marriages: Marriage[] = [
  m("m1", "mohd", "tiajar", false), // ended (Mohd deceased)
  m("m2", "rejin", "tiajar", true),
  m("m3", "sibil", "nenekIbu", true),
  m("m4", "datukBapa", "nenekBapa", true),
  m("m5", "yuzi", "nisa", true),
];

const family: FamilyData = {
  persons,
  marriages,
  parentChildren,
  collaborators: [],
  familyName: "Test",
  createdAt: "",
  updatedAt: "",
};

const get = (id: string) => persons.find((p) => p.id === id)!;

// ─── Tier 1: Spouse ─────────────────────────────────────────────────────────

describe("checkMahram — Spouse (Tier 1)", () => {
  it("active spouse → spouse verdict", () => {
    const v = checkMahram(get("yuzi"), get("nisa"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("spouse");
    expect(v.subtype).toBe("spouse");
    expect(v.labelBm).toBe("Isteri");
    expect(v.reasonBm).toContain("Nisa adalah isteri kepada Yuzi");
  });

  it("active spouse — reverse direction", () => {
    const v = checkMahram(get("nisa"), get("yuzi"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("spouse");
    expect(v.labelBm).toBe("Suami");
  });

  it("ended marriage between A and B → NOT spouse-mahram", () => {
    // Mohd ↔ Tiajar marriage is ended. They are not Mahram to each other.
    const v = checkMahram(get("mohd"), get("tiajar"), family);
    expect(v.isMahram).toBe(false);
    expect(v.tier).toBe("none");
  });
});

// ─── Tier 2: Nasab ──────────────────────────────────────────────────────────

describe("checkMahram — Nasab: Usul (ancestors)", () => {
  it("Yuzi ↔ Sibil → maternal grandfather (BUG REGRESSION)", () => {
    const v = checkMahram(get("yuzi"), get("sibil"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("usul");
    expect(v.side).toBe("ibu");
    expect(v.labelBm).toBe("Datuk sebelah ibu");
    expect(v.reasonBm).toContain("Sibil adalah datuk sebelah ibu kepada Yuzi");
    expect(v.reasonBm).toContain("bapa kepada Tiajar");
    // The bug we are fixing: must NOT contain "Same gender" / "jantina sama"
    expect(v.reasonBm.toLowerCase()).not.toContain("jantina");
    expect(v.reasonBm.toLowerCase()).not.toContain("same gender");
  });

  it("Yuzi ↔ DatukBapa → paternal grandfather", () => {
    const v = checkMahram(get("yuzi"), get("datukBapa"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("usul");
    expect(v.side).toBe("bapa");
    expect(v.labelBm).toBe("Datuk sebelah bapa");
  });

  it("Yuzi ↔ Tiajar → mother", () => {
    const v = checkMahram(get("yuzi"), get("tiajar"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("usul");
    expect(v.labelBm).toContain("Ibu");
  });

  it("Yuzi ↔ Mohd → father", () => {
    const v = checkMahram(get("yuzi"), get("mohd"), family);
    expect(v.isMahram).toBe(true);
    expect(v.subtype).toBe("usul");
    expect(v.labelBm).toContain("Bapa");
  });

  it("Yuzi ↔ NenekIbu → maternal grandmother", () => {
    const v = checkMahram(get("yuzi"), get("nenekIbu"), family);
    expect(v.isMahram).toBe(true);
    expect(v.subtype).toBe("usul");
    expect(v.side).toBe("ibu");
    expect(v.labelBm).toBe("Nenek sebelah ibu");
  });
});

describe("checkMahram — Nasab: Furu' (descendants)", () => {
  it("Sibil ↔ Yuzi → grandchild", () => {
    const v = checkMahram(get("sibil"), get("yuzi"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("furu");
    expect(v.labelBm).toBe("Cucu");
    expect(v.reasonBm).toContain("cucu kepada Sibil");
  });

  it("Tiajar ↔ Yuzi → child", () => {
    const v = checkMahram(get("tiajar"), get("yuzi"), family);
    expect(v.isMahram).toBe(true);
    expect(v.subtype).toBe("furu");
    expect(v.labelBm).toBe("Anak");
  });
});

describe("checkMahram — Nasab: Siblings", () => {
  it("Yuzi ↔ Kakak → full sibling (share both parents)", () => {
    const v = checkMahram(get("yuzi"), get("kakak"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("sibling_full");
    expect(v.labelBm).toBe("Adik-beradik kandung");
  });

  it("Yuzi ↔ Adik → half-sibling seibu (share Tiajar only)", () => {
    const v = checkMahram(get("yuzi"), get("adik"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("sibling_half_seibu");
    expect(v.labelBm).toBe("Adik-beradik seibu");
    expect(v.reasonBm).toContain("Tiajar");
  });
});

describe("checkMahram — Nasab: Aunts/Uncles & Nieces/Nephews", () => {
  it("Yuzi ↔ Pakcik → maternal uncle", () => {
    const v = checkMahram(get("yuzi"), get("pakcik"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("aunt_uncle");
    expect(v.side).toBe("ibu");
    expect(v.labelBm).toBe("Pakcik sebelah ibu");
  });

  it("Pakcik ↔ Yuzi → niece/nephew direction", () => {
    const v = checkMahram(get("pakcik"), get("yuzi"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("nasab");
    expect(v.subtype).toBe("niece_nephew");
    expect(v.labelBm.toLowerCase()).toContain("anak saudara");
  });
});

describe("checkMahram — Nasab: Cousins are NOT Mahram", () => {
  it("Yuzi ↔ Sepupu → not Mahram (first cousins)", () => {
    const v = checkMahram(get("yuzi"), get("sepupu"), family);
    expect(v.isMahram).toBe(false);
    expect(v.tier).toBe("none");
    expect(v.labelBm).toBe("Bukan Mahram");
  });
});

// ─── Tier 3: Musaharah ──────────────────────────────────────────────────────

describe("checkMahram — Musaharah: Step-parent / Step-child", () => {
  it("Yuzi ↔ Rejin → stepfather (Rejin married Tiajar)", () => {
    const v = checkMahram(get("yuzi"), get("rejin"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("step_parent");
    expect(v.labelBm).toBe("Bapa tiri");
    expect(v.reasonBm).toContain("Tiajar");
  });

  it("Rejin ↔ Yuzi → stepson (reverse direction)", () => {
    const v = checkMahram(get("rejin"), get("yuzi"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("step_child");
    expect(v.labelBm.toLowerCase()).toContain("anak tiri");
  });

  it("Mohd ↔ Adik → stepdaughter (Mohd was Tiajar's spouse, Adik is Tiajar's bio daughter)", () => {
    const v = checkMahram(get("mohd"), get("adik"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("step_child");
  });
});

describe("checkMahram — Musaharah: In-laws", () => {
  it("Nisa ↔ Mohd → father-in-law (deceased — still Mahram)", () => {
    const v = checkMahram(get("nisa"), get("mohd"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("in_law_ascendant");
    expect(v.labelBm).toBe("Bapa mertua");
  });

  it("Nisa ↔ Sibil → grandfather-in-law", () => {
    const v = checkMahram(get("nisa"), get("sibil"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("in_law_ascendant");
    expect(v.labelBm).toContain("mertua");
  });

  it("Sibil ↔ Nisa → grandson's wife (in-law descendant)", () => {
    const v = checkMahram(get("sibil"), get("nisa"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("in_law_descendant");
  });

  it("Mohd ↔ Nisa → daughter-in-law's father side (mirror of Nisa↔Mohd)", () => {
    const v = checkMahram(get("mohd"), get("nisa"), family);
    expect(v.isMahram).toBe(true);
    expect(v.tier).toBe("musaharah");
    expect(v.subtype).toBe("in_law_descendant");
    expect(v.labelBm).toBe("Menantu perempuan");
  });
});

describe("checkMahram — NOT Mahram cases", () => {
  it("Pakcik ↔ Mohd → NOT Mahram (brothers-in-law via Tiajar)", () => {
    // Pakcik is Tiajar's brother. Mohd was Tiajar's husband. Sibling-in-law is
    // not Mahram in fiqh — they could in principle be unrelated except for
    // the marriage tie, which doesn't transfer Mahram between siblings.
    const v = checkMahram(get("pakcik"), get("mohd"), family);
    expect(v.isMahram).toBe(false);
    expect(v.tier).toBe("none");
  });

  it("Sepupu ↔ Yuzi → NOT Mahram (cousin)", () => {
    const v = checkMahram(get("sepupu"), get("yuzi"), family);
    expect(v.isMahram).toBe(false);
  });

  it("same person → notApplicable", () => {
    const v = checkMahram(get("yuzi"), get("yuzi"), family);
    expect(v.isMahram).toBe(false);
    expect(v.labelBm).toBe("Orang yang sama");
  });
});

// ─── Adopted-children safety ────────────────────────────────────────────────

describe("checkMahram — Adoption (Nasab does NOT apply)", () => {
  it("adopted parent_child row does NOT create Nasab Mahram", () => {
    // Add an adopted child to Yuzi: should NOT be Mahram via Nasab.
    const adopted = person("anak_angkat", "AnakAngkat", "female");
    const adoptedFamily: FamilyData = {
      ...family,
      persons: [...persons, adopted],
      parentChildren: [
        ...parentChildren,
        { id: "pc_adopt", parentId: "yuzi", childId: "anak_angkat", type: "adopted" as const },
      ],
    };
    const v = checkMahram(get("yuzi"), adopted, adoptedFamily);
    // No blood, no marriage → not Mahram
    expect(v.isMahram).toBe(false);
    expect(v.tier).toBe("none");
  });
});
