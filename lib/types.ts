export type Gender = "male" | "female";
export type RelationshipType = "biological" | "adopted" | "susuan";
export type UserRole = "admin" | "editor" | "viewer";
export type Religion = "Islam" | "Buddhism" | "Hinduism" | "Christianity" | "Sikhism" | "Others";

export const PREFIXES = [
  "Syed", "Sharifah", "Wan", "Nik", "Raja", "Tengku",
  "Haji", "Hajjah", "Dr", "Prof", "Dato'", "Datin",
  "Tun", "Tan Sri", "Puan Sri", "Daeng", "Andi",
] as const;

export const ETHNICITIES = [
  "Melayu", "Jawa", "Bugis", "Arab", "Banjar", "Minangkabau",
  "Chinese", "Indian", "Iban", "Kadazan", "Bidayuh", "Orang Asli", "Others",
] as const;

export interface Person {
  id: string;
  prefix?: string;
  firstName: string;
  binBinti?: string;
  lastName?: string;
  gender: Gender;
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  race?: string;
  religion: Religion;
  icNumber?: string;
  photo?: string;
  bio?: string;
  isAlive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Marriage {
  id: string;
  husbandId: string;
  wifeId: string;
  marriageDate?: string;
  marriagePlace?: string;
  divorceDate?: string;
  isActive: boolean;
  notes?: string;
}

export interface ParentChild {
  id: string;
  parentId: string;
  childId: string;
  type: RelationshipType;
}

export interface Collaborator {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  invitedAt: string;
  status: "pending" | "accepted";
}

export interface FamilyData {
  persons: Person[];
  marriages: Marriage[];
  parentChildren: ParentChild[];
  collaborators: Collaborator[];
  rootPersonId?: string;
  familyName: string;
  createdAt: string;
  updatedAt: string;
}

export function getDisplayName(person: Person): string {
  const parts: string[] = [];
  if (person.prefix) parts.push(person.prefix);
  parts.push(person.firstName);
  if (person.binBinti) {
    parts.push(person.gender === "male" ? "bin" : "binti");
    parts.push(person.binBinti);
  }
  if (person.lastName) parts.push(person.lastName);
  return parts.join(" ");
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}
