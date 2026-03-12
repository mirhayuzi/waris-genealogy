import { describe, it, expect } from "vitest";

// Test i18n translations
describe("i18n translations", () => {
  // Simulate the translations object
  const en: Record<string, string> = {
    home: "Home",
    tree: "Tree",
    tools: "Tools",
    settings: "Settings",
    addMember: "Add Family Member",
    familyTimeline: "Family Timeline",
    millerColumns: "Miller View",
    backupRestore: "Backup & Restore",
    language: "Language",
    currentLanguage: "English",
    switchLanguage: "Tap to switch to Bahasa Malaysia",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    search: "Search",
    members: "members",
    viewTree: "View Tree",
    faraidCalculator: "Faraid Calculator",
    mahramChecker: "Mahram Checker",
  };

  const bm: Record<string, string> = {
    home: "Utama",
    tree: "Salasilah",
    tools: "Alatan",
    settings: "Tetapan",
    addMember: "Tambah Ahli Keluarga",
    familyTimeline: "Garis Masa Keluarga",
    millerColumns: "Paparan Miller",
    backupRestore: "Sandaran & Pulihkan",
    language: "Bahasa",
    currentLanguage: "Bahasa Malaysia",
    switchLanguage: "Ketik untuk tukar ke English",
    save: "Simpan",
    cancel: "Batal",
    delete: "Padam",
    search: "Cari",
    members: "ahli",
    viewTree: "Lihat Salasilah",
    faraidCalculator: "Kalkulator Faraid",
    mahramChecker: "Semak Mahram",
  };

  it("should have all required English translation keys", () => {
    const requiredKeys = [
      "home", "tree", "tools", "settings", "addMember",
      "familyTimeline", "millerColumns", "backupRestore",
      "language", "save", "cancel", "delete", "search",
    ];
    for (const key of requiredKeys) {
      expect(en[key]).toBeDefined();
      expect(en[key].length).toBeGreaterThan(0);
    }
  });

  it("should have all required BM translation keys", () => {
    const requiredKeys = [
      "home", "tree", "tools", "settings", "addMember",
      "familyTimeline", "millerColumns", "backupRestore",
      "language", "save", "cancel", "delete", "search",
    ];
    for (const key of requiredKeys) {
      expect(bm[key]).toBeDefined();
      expect(bm[key].length).toBeGreaterThan(0);
    }
  });

  it("should have matching keys between EN and BM", () => {
    const enKeys = Object.keys(en).sort();
    const bmKeys = Object.keys(bm).sort();
    expect(enKeys).toEqual(bmKeys);
  });

  it("should have different values for EN and BM", () => {
    expect(en.home).not.toEqual(bm.home);
    expect(en.settings).not.toEqual(bm.settings);
    expect(en.save).not.toEqual(bm.save);
  });
});

// Test Timeline event generation
describe("Timeline event generation", () => {
  interface TimelineEvent {
    date: string;
    type: "birth" | "death" | "marriage";
    label: string;
  }

  function generateEvents(persons: any[], marriages: any[]): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const p of persons) {
      if (p.birthDate) {
        events.push({
          date: p.birthDate,
          type: "birth",
          label: `${p.firstName} was born`,
        });
      }
      if (p.deathDate) {
        events.push({
          date: p.deathDate,
          type: "death",
          label: `${p.firstName} passed away`,
        });
      }
    }

    for (const m of marriages) {
      const husband = persons.find((p: any) => p.id === m.husbandId);
      const wife = persons.find((p: any) => p.id === m.wifeId);
      if (husband && wife && m.marriageDate) {
        events.push({
          date: m.marriageDate,
          type: "marriage",
          label: `${husband.firstName} & ${wife.firstName} married`,
        });
      }
    }

    return events.sort((a, b) => b.date.localeCompare(a.date));
  }

  it("should generate birth events from persons", () => {
    const persons = [
      { id: "1", firstName: "Ahmad", birthDate: "1980-01-15" },
      { id: "2", firstName: "Siti", birthDate: "1985-06-20" },
    ];
    const events = generateEvents(persons, []);
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe("birth");
    expect(events[0].label).toContain("Siti");
  });

  it("should generate death events", () => {
    const persons = [
      { id: "1", firstName: "Yusof", birthDate: "1950-01-01", deathDate: "2020-12-01" },
    ];
    const events = generateEvents(persons, []);
    expect(events).toHaveLength(2);
    const deathEvent = events.find((e) => e.type === "death");
    expect(deathEvent).toBeDefined();
    expect(deathEvent!.label).toContain("Yusof");
  });

  it("should sort events by date descending", () => {
    const persons = [
      { id: "1", firstName: "A", birthDate: "1980-01-01" },
      { id: "2", firstName: "B", birthDate: "2000-01-01" },
      { id: "3", firstName: "C", birthDate: "1960-01-01" },
    ];
    const events = generateEvents(persons, []);
    expect(events[0].date).toBe("2000-01-01");
    expect(events[2].date).toBe("1960-01-01");
  });

  it("should skip persons without dates", () => {
    const persons = [
      { id: "1", firstName: "NoDate" },
    ];
    const events = generateEvents(persons, []);
    expect(events).toHaveLength(0);
  });
});

// Test Backup/Restore JSON format
describe("Backup/Restore JSON format", () => {
  it("should serialize family data to valid JSON", () => {
    const familyData = {
      persons: [
        { id: "1", firstName: "Ahmad", gender: "male", religion: "Islam", isAlive: true },
      ],
      marriages: [],
      parentChildren: [],
      collaborators: [],
      rootPersonId: "1",
      familyName: "Ahmad Family",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    const json = JSON.stringify(familyData);
    expect(json).toBeTruthy();

    const parsed = JSON.parse(json);
    expect(parsed.familyName).toBe("Ahmad Family");
    expect(parsed.persons).toHaveLength(1);
    expect(parsed.persons[0].firstName).toBe("Ahmad");
  });

  it("should preserve all relationship data in backup", () => {
    const familyData = {
      persons: [
        { id: "1", firstName: "Father" },
        { id: "2", firstName: "Mother" },
        { id: "3", firstName: "Child" },
      ],
      marriages: [{ id: "m1", husbandId: "1", wifeId: "2", isActive: true }],
      parentChildren: [
        { id: "pc1", parentId: "1", childId: "3", type: "biological" },
        { id: "pc2", parentId: "2", childId: "3", type: "biological" },
      ],
      collaborators: [],
      rootPersonId: "1",
      familyName: "Test Family",
    };

    const json = JSON.stringify(familyData);
    const restored = JSON.parse(json);

    expect(restored.marriages).toHaveLength(1);
    expect(restored.parentChildren).toHaveLength(2);
    expect(restored.marriages[0].husbandId).toBe("1");
    expect(restored.parentChildren[0].parentId).toBe("1");
  });

  it("should validate backup data has required fields", () => {
    const requiredFields = ["persons", "marriages", "parentChildren", "familyName"];
    const backup = {
      persons: [],
      marriages: [],
      parentChildren: [],
      familyName: "Test",
    };

    for (const field of requiredFields) {
      expect(backup).toHaveProperty(field);
    }
  });
});

// Test Miller Columns navigation logic
describe("Miller Columns navigation", () => {
  function getChildren(personId: string, parentChildren: any[], persons: any[]) {
    const childIds = parentChildren
      .filter((pc: any) => pc.parentId === personId)
      .map((pc: any) => pc.childId);
    return persons.filter((p: any) => childIds.includes(p.id));
  }

  function getSpouses(personId: string, marriages: any[], persons: any[]) {
    const spouseIds = marriages
      .filter((m: any) => m.husbandId === personId || m.wifeId === personId)
      .map((m: any) => m.husbandId === personId ? m.wifeId : m.husbandId);
    return persons.filter((p: any) => spouseIds.includes(p.id));
  }

  const persons = [
    { id: "1", firstName: "Grandfather" },
    { id: "2", firstName: "Grandmother" },
    { id: "3", firstName: "Father" },
    { id: "4", firstName: "Mother" },
    { id: "5", firstName: "Child1" },
    { id: "6", firstName: "Child2" },
  ];

  const parentChildren = [
    { id: "pc1", parentId: "1", childId: "3" },
    { id: "pc2", parentId: "2", childId: "3" },
    { id: "pc3", parentId: "3", childId: "5" },
    { id: "pc4", parentId: "3", childId: "6" },
    { id: "pc5", parentId: "4", childId: "5" },
    { id: "pc6", parentId: "4", childId: "6" },
  ];

  const marriages = [
    { id: "m1", husbandId: "1", wifeId: "2" },
    { id: "m2", husbandId: "3", wifeId: "4" },
  ];

  it("should find children of a person", () => {
    const children = getChildren("3", parentChildren, persons);
    expect(children).toHaveLength(2);
    expect(children.map((c: any) => c.firstName)).toContain("Child1");
    expect(children.map((c: any) => c.firstName)).toContain("Child2");
  });

  it("should find spouses of a person", () => {
    const spouses = getSpouses("3", marriages, persons);
    expect(spouses).toHaveLength(1);
    expect(spouses[0].firstName).toBe("Mother");
  });

  it("should return empty for person with no children", () => {
    const children = getChildren("5", parentChildren, persons);
    expect(children).toHaveLength(0);
  });

  it("should return empty for person with no spouse", () => {
    const spouses = getSpouses("5", marriages, persons);
    expect(spouses).toHaveLength(0);
  });
});

// Test zoom functionality bounds
describe("Zoom functionality", () => {
  it("should clamp zoom between min and max", () => {
    const MIN_ZOOM = 0.3;
    const MAX_ZOOM = 3.0;
    const clamp = (val: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, val));

    expect(clamp(0.1)).toBe(MIN_ZOOM);
    expect(clamp(5.0)).toBe(MAX_ZOOM);
    expect(clamp(1.0)).toBe(1.0);
    expect(clamp(0.3)).toBe(0.3);
    expect(clamp(3.0)).toBe(3.0);
  });

  it("should zoom in by 0.2 increments", () => {
    let zoom = 1.0;
    zoom = Math.min(3.0, zoom + 0.2);
    expect(zoom).toBeCloseTo(1.2);
    zoom = Math.min(3.0, zoom + 0.2);
    expect(zoom).toBeCloseTo(1.4);
  });

  it("should zoom out by 0.2 increments", () => {
    let zoom = 1.0;
    zoom = Math.max(0.3, zoom - 0.2);
    expect(zoom).toBeCloseTo(0.8);
    zoom = Math.max(0.3, zoom - 0.2);
    expect(zoom).toBeCloseTo(0.6);
  });
});
