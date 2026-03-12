import { describe, it, expect } from "vitest";
import { getDisplayName, generateId, Person } from "../types";

describe("getDisplayName", () => {
  it("should return first name only when no other fields", () => {
    const person: Person = {
      id: "1", firstName: "Ahmad", gender: "male", religion: "Islam",
      isAlive: true, createdAt: "", updatedAt: "",
    };
    expect(getDisplayName(person)).toBe("Ahmad");
  });

  it("should include bin for male with binBinti", () => {
    const person: Person = {
      id: "2", firstName: "Ahmad", binBinti: "Yusof", gender: "male",
      religion: "Islam", isAlive: true, createdAt: "", updatedAt: "",
    };
    expect(getDisplayName(person)).toBe("Ahmad bin Yusof");
  });

  it("should include binti for female with binBinti", () => {
    const person: Person = {
      id: "3", firstName: "Siti", binBinti: "Yusof", gender: "female",
      religion: "Islam", isAlive: true, createdAt: "", updatedAt: "",
    };
    expect(getDisplayName(person)).toBe("Siti binti Yusof");
  });

  it("should include prefix when provided", () => {
    const person: Person = {
      id: "4", prefix: "Dato'", firstName: "Ahmad", binBinti: "Yusof",
      gender: "male", religion: "Islam", isAlive: true, createdAt: "", updatedAt: "",
    };
    expect(getDisplayName(person)).toBe("Dato' Ahmad bin Yusof");
  });

  it("should include lastName when provided", () => {
    const person: Person = {
      id: "5", firstName: "Wei Liang", lastName: "Tan", gender: "male",
      religion: "Buddhism", isAlive: true, createdAt: "", updatedAt: "",
    };
    expect(getDisplayName(person)).toBe("Wei Liang Tan");
  });

  it("should handle full name with all fields", () => {
    const person: Person = {
      id: "6", prefix: "Syed", firstName: "Ahmad", binBinti: "Yusof",
      lastName: "Al-Attas", gender: "male", religion: "Islam",
      isAlive: true, createdAt: "", updatedAt: "",
    };
    expect(getDisplayName(person)).toBe("Syed Ahmad bin Yusof Al-Attas");
  });
});

describe("generateId", () => {
  it("should generate unique IDs", () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
  });

  it("should return a non-empty string", () => {
    const id = generateId();
    expect(id.length).toBeGreaterThan(0);
  });
});
