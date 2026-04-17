import { describe, it, expect } from "vitest";
import {
  Person,
  Marriage,
  ParentChild,
  getDisplayName,
  ETHNICITIES,
  RELIGIONS,
  PREFIXES,
} from "../types";

describe("Updated Types and Constants", () => {
  it("should include Bajau in ETHNICITIES", () => {
    expect(ETHNICITIES).toContain("Bajau");
  });

  it("should not include Orang Asli in ETHNICITIES", () => {
    expect(ETHNICITIES).not.toContain("Orang Asli");
  });

  it("should have Bajau after Melayu in ETHNICITIES", () => {
    const melayuIdx = ETHNICITIES.indexOf("Melayu");
    const bajauIdx = ETHNICITIES.indexOf("Bajau");
    expect(melayuIdx).toBeGreaterThanOrEqual(0);
    expect(bajauIdx).toBe(melayuIdx + 1);
  });

  it("should have PREFIXES array with common titles", () => {
    expect(PREFIXES).toContain("Dato'");
    expect(PREFIXES).toContain("Datin");
    expect(PREFIXES).toContain("Haji");
    expect(PREFIXES).toContain("Hajjah");
    expect(PREFIXES).toContain("Tun");
  });

  it("should have RELIGIONS array", () => {
    expect(RELIGIONS).toContain("Islam");
    expect(RELIGIONS).toContain("Buddhism");
    expect(RELIGIONS).toContain("Hinduism");
    expect(RELIGIONS).toContain("Christianity");
  });
});

describe("Person with Photo field", () => {
  it("should support photo field on Person", () => {
    const person: Person = {
      id: "test-1",
      firstName: "Ahmad",
      lastName: "",
      gender: "male",
      religion: "Islam",
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      photoUrl: "file:///path/to/photo.jpg",
    };
    expect(person.photoUrl).toBe("file:///path/to/photo.jpg");
  });

  it("should allow photo to be undefined", () => {
    const person: Person = {
      id: "test-2",
      firstName: "Siti",
      lastName: "",
      gender: "female",
      religion: "Islam",
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(person.photoUrl).toBeUndefined();
  });
});

describe("Search/Filter Logic", () => {
  const persons: Person[] = [
    {
      id: "1",
      firstName: "Ahmad",
      lastName: "Abdullah",
      binBinti: "Abdullah",
      gender: "male",
      isAlive: true,
      race: "Melayu",
      religion: "Islam",
      birthPlace: "Kuala Lumpur",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      firstName: "Siti",
      lastName: "Aminah",
      binBinti: "Ibrahim",
      gender: "female",
      isAlive: true,
      race: "Bajau",
      religion: "Islam",
      birthPlace: "Sabah",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "3",
      firstName: "Wei",
      lastName: "Tan",
      gender: "male",
      isAlive: true,
      race: "Cina",
      religion: "Buddhism",
      birthPlace: "Penang",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  function searchPersons(query: string): Person[] {
    const q = query.toLowerCase();
    return persons.filter(
      (p) =>
        getDisplayName(p).toLowerCase().includes(q) ||
        (p.race && p.race.toLowerCase().includes(q)) ||
        (p.religion && p.religion.toLowerCase().includes(q)) ||
        (p.birthPlace && p.birthPlace.toLowerCase().includes(q))
    );
  }

  it("should find person by first name", () => {
    const results = searchPersons("Ahmad");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("1");
  });

  it("should find person by ethnicity", () => {
    const results = searchPersons("Bajau");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("2");
  });

  it("should find person by religion", () => {
    const results = searchPersons("Buddhism");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("3");
  });

  it("should find person by birth place", () => {
    const results = searchPersons("Sabah");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("2");
  });

  it("should return empty for no match", () => {
    const results = searchPersons("xyz123");
    expect(results).toHaveLength(0);
  });

  it("should be case insensitive", () => {
    const results = searchPersons("melayu");
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("1");
  });
});

describe("getDisplayName", () => {
  it("should format name with prefix", () => {
    const person: Person = {
      id: "1",
      prefix: "Dato'",
      firstName: "Ahmad",
      binBinti: "Abdullah",
      lastName: "Hassan",
      gender: "male",
      religion: "Islam",
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const name = getDisplayName(person);
    expect(name).toContain("Dato'");
    expect(name).toContain("Ahmad");
  });

  it("should format name with bin/binti", () => {
    const person: Person = {
      id: "2",
      firstName: "Siti",
      binBinti: "Ibrahim",
      lastName: "",
      gender: "female",
      religion: "Islam",
      isAlive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const name = getDisplayName(person);
    expect(name).toContain("Siti");
    expect(name).toContain("binti");
    expect(name).toContain("Ibrahim");
  });
});
