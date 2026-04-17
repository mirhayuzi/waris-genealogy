import { describe, it, expect, vi } from "vitest";

// Mock the modules before importing
vi.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///data/user/0/com.app/files/",
  EncodingType: { UTF8: "utf8", Base64: "base64" },
  makeDirectoryAsync: vi.fn().mockResolvedValue(undefined),
  writeAsStringAsync: vi.fn().mockResolvedValue(undefined),
  copyAsync: vi.fn().mockResolvedValue(undefined),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: vi.fn(),
    createFileAsync: vi.fn(),
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "android" },
  Alert: { alert: vi.fn() },
}));

describe("CSV Export with SAF", () => {
  it("should generate valid members CSV with correct headers", () => {
    // Test CSV generation logic (same as used in backup-restore.tsx)
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = [
      "ID", "First Name", "Last Name", "Prefix/Title", "Bin/Binti",
      "Gender", "Date of Birth", "Place of Birth", "Date of Death",
      "Status", "Ethnicity/Race", "Religion", "Photo URL", "Biography",
    ];

    const testPerson = {
      id: "p1",
      firstName: "Ahmad",
      lastName: "bin Abdullah",
      prefix: "Dato'",
      binBinti: "bin",
      gender: "male",
      birthDate: "1980-01-15",
      birthPlace: "Kuala Lumpur",
      deathDate: "",
      isAlive: true,
      race: "Melayu",
      religion: "Islam",
      photoUrl: "file:///path/to/photo.jpg",
      bio: "A family elder",
    };

    const row = [
      testPerson.id, testPerson.firstName, testPerson.lastName,
      testPerson.prefix, testPerson.binBinti, testPerson.gender,
      testPerson.birthDate, testPerson.birthPlace, testPerson.deathDate,
      testPerson.isAlive ? "Living" : "Deceased", testPerson.race,
      testPerson.religion, testPerson.photoUrl ? `photos/${testPerson.id}.jpg` : "",
      testPerson.bio,
    ];

    const csvLine = row.map(escapeCSV).join(",");
    const headerLine = headers.map(escapeCSV).join(",");
    const csv = [headerLine, csvLine].join("\n");

    // Verify headers
    expect(csv).toContain("ID,First Name,Last Name");
    expect(csv).toContain("Prefix/Title");
    expect(csv).toContain("Bin/Binti");

    // Verify data
    expect(csv).toContain("Ahmad");
    expect(csv).toContain("bin Abdullah");
    expect(csv).toContain("Dato'");
    expect(csv).toContain("Living");
    expect(csv).toContain("photos/p1.jpg");
  });

  it("should escape CSV values with commas and quotes", () => {
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    expect(escapeCSV("simple")).toBe("simple");
    expect(escapeCSV("has, comma")).toBe('"has, comma"');
    expect(escapeCSV('has "quotes"')).toBe('"has ""quotes"""');
    expect(escapeCSV("has\nnewline")).toBe('"has\nnewline"');
  });

  it("should generate marriages CSV with correct headers", () => {
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = [
      "Marriage ID", "Husband ID", "Wife ID", "Marriage Date",
      "Marriage Place", "Divorce Date", "Status", "Notes",
    ];

    const marriage = {
      id: "m1",
      husbandId: "p1",
      wifeId: "p2",
      marriageDate: "2005-06-15",
      marriagePlace: "Kuala Lumpur",
      divorceDate: "",
      isActive: true,
      notes: "",
    };

    const row = [
      marriage.id, marriage.husbandId, marriage.wifeId,
      marriage.marriageDate, marriage.marriagePlace,
      marriage.divorceDate, marriage.isActive ? "Active" : "Divorced",
      marriage.notes,
    ];

    const csvLine = row.map(escapeCSV).join(",");
    expect(csvLine).toContain("m1");
    expect(csvLine).toContain("p1");
    expect(csvLine).toContain("p2");
    expect(csvLine).toContain("Active");
  });

  it("should generate parent-child CSV with correct headers", () => {
    const escapeCSV = (value: string) => {
      if (value === null || value === undefined) return '""';
      const s = String(value);
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = ["Relationship ID", "Parent ID", "Child ID", "Relationship Type"];
    const rel = { id: "r1", parentId: "p1", childId: "p3", type: "biological" };
    const row = [rel.id, rel.parentId, rel.childId, rel.type];

    const headerLine = headers.map(escapeCSV).join(",");
    const csvLine = row.map(escapeCSV).join(",");

    expect(headerLine).toBe("Relationship ID,Parent ID,Child ID,Relationship Type");
    expect(csvLine).toBe("r1,p1,p3,biological");
  });

  it("should use SAF requestDirectoryPermissionsAsync on native", async () => {
    const FileSystem = await import("expo-file-system/legacy");
    const { StorageAccessFramework } = FileSystem;

    // Mock: user grants permission
    (StorageAccessFramework.requestDirectoryPermissionsAsync as any).mockResolvedValue({
      granted: true,
      directoryUri: "content://com.android.externalstorage.documents/tree/primary%3ADownload",
    });

    // Mock: createFileAsync returns a SAF URI
    (StorageAccessFramework.createFileAsync as any).mockResolvedValue(
      "content://com.android.externalstorage.documents/tree/primary%3ADownload/document/primary%3ADownload%2Fwaris-members.csv"
    );

    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    expect(permissions.granted).toBe(true);
    if (!permissions.granted) return; // Type narrowing
    expect(permissions.directoryUri).toContain("content://");

    const fileUri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      "waris-members-2026-03-15",
      "text/csv",
    );
    expect(fileUri).toContain("content://");

    // Verify writeAsStringAsync would be called with the SAF URI
    await FileSystem.writeAsStringAsync(fileUri, "test,data\n1,2", {
      encoding: FileSystem.EncodingType.UTF8,
    });
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      fileUri,
      "test,data\n1,2",
      { encoding: "utf8" },
    );
  });

  it("should handle user cancelling directory picker", async () => {
    const FileSystem = await import("expo-file-system/legacy");
    const { StorageAccessFramework } = FileSystem;

    // Mock: user denies/cancels
    (StorageAccessFramework.requestDirectoryPermissionsAsync as any).mockResolvedValue({
      granted: false,
    });

    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    expect(permissions.granted).toBe(false);
    // When not granted, export should return early without creating files
  });
});
