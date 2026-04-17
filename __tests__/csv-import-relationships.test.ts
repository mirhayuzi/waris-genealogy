import { describe, it, expect } from "vitest";
import { parseMembersCSV, parseMarriagesCSV, parseParentChildCSV, buildFamilyDataFromCSV } from "../lib/csv-import";

describe("CSV Import - Relationships", () => {
  it("should import members CSV with photoUrl correctly", () => {
    const csv = `ID,First Name,Last Name,Prefix/Title,Bin/Binti,Gender,Date of Birth,Place of Birth,Date of Death,Status,Ethnicity/Race,Religion,Photo URL,Biography
p1,Ahmad,Abdullah,Dato',bin,male,1980-01-15,Kuala Lumpur,,Living,Melayu,Islam,photos/p1.jpg,Family elder
p2,Siti,Abdullah,,binti,female,1985-03-20,Selangor,,Living,Melayu,Islam,,Homemaker`;

    const persons = parseMembersCSV(csv);
    expect(persons).toHaveLength(2);
    expect(persons[0].photoUrl).toBe("photos/p1.jpg");
    expect(persons[1].photoUrl).toBeUndefined();
  });

  it("should import marriages CSV correctly", () => {
    const csv = `Marriage ID,Husband ID,Wife ID,Marriage Date,Marriage Place,Divorce Date,Status,Notes
m1,p1,p2,1980-06-15,Kuala Lumpur,,Active,Traditional ceremony`;

    const marriages = parseMarriagesCSV(csv);
    expect(marriages).toHaveLength(1);
    expect(marriages[0].husbandId).toBe("p1");
    expect(marriages[0].wifeId).toBe("p2");
    expect(marriages[0].isActive).toBe(true);
  });

  it("should import parent-child CSV correctly", () => {
    const csv = `Relationship ID,Parent ID,Child ID,Relationship Type
pc1,p1,p3,biological
pc2,p2,p3,biological`;

    const parentChildren = parseParentChildCSV(csv);
    expect(parentChildren).toHaveLength(2);
    expect(parentChildren[0].parentId).toBe("p1");
    expect(parentChildren[0].childId).toBe("p3");
    expect(parentChildren[0].type).toBe("biological");
  });

  it("should build complete FamilyData from all CSV data", () => {
    const membersCsv = `ID,First Name,Last Name,Prefix/Title,Bin/Binti,Gender,Date of Birth,Place of Birth,Date of Death,Status,Ethnicity/Race,Religion,Photo URL,Biography
p1,Ahmad,Abdullah,Dato',bin,male,1980-01-15,Kuala Lumpur,,Living,Melayu,Islam,photos/p1.jpg,Family elder
p2,Siti,Abdullah,,binti,female,1985-03-20,Selangor,,Living,Melayu,Islam,,Homemaker
p3,Fatimah,Ahmad,,binti,female,2010-05-10,Kuala Lumpur,,Living,Melayu,Islam,,Student`;

    const marriagesCsv = `Marriage ID,Husband ID,Wife ID,Marriage Date,Marriage Place,Divorce Date,Status,Notes
m1,p1,p2,1980-06-15,Kuala Lumpur,,Active,Traditional ceremony`;

    const parentChildCsv = `Relationship ID,Parent ID,Child ID,Relationship Type
pc1,p1,p3,biological
pc2,p2,p3,biological`;

    const persons = parseMembersCSV(membersCsv);
    const marriages = parseMarriagesCSV(marriagesCsv);
    const parentChildren = parseParentChildCSV(parentChildCsv);

    const familyData = buildFamilyDataFromCSV(persons, marriages, parentChildren, "Abdullah Family", "p1");

    expect(familyData.persons).toHaveLength(3);
    expect(familyData.marriages).toHaveLength(1);
    expect(familyData.parentChildren).toHaveLength(2);
    expect(familyData.familyName).toBe("Abdullah Family");
    expect(familyData.rootPersonId).toBe("p1");

    // Verify relationships are intact
    expect(familyData.marriages[0].husbandId).toBe("p1");
    expect(familyData.marriages[0].wifeId).toBe("p2");
    expect(familyData.parentChildren.filter((pc) => pc.childId === "p3")).toHaveLength(2);
  });

  it("should handle backward compatibility with 'Photo File' header", () => {
    const csv = `ID,First Name,Last Name,Prefix/Title,Bin/Binti,Gender,Date of Birth,Place of Birth,Date of Death,Status,Ethnicity/Race,Religion,Photo File,Biography
p1,Ahmad,Abdullah,Dato',bin,male,1980-01-15,Kuala Lumpur,,Living,Melayu,Islam,photos/p1.jpg,Family elder`;

    const persons = parseMembersCSV(csv);
    expect(persons).toHaveLength(1);
    expect(persons[0].photoUrl).toBe("photos/p1.jpg");
  });

  it("should parse divorced marriages correctly", () => {
    const csv = `Marriage ID,Husband ID,Wife ID,Marriage Date,Marriage Place,Divorce Date,Status,Notes
m1,p1,p2,1980-06-15,Kuala Lumpur,2000-01-01,Divorced,Divorced after 20 years`;

    const marriages = parseMarriagesCSV(csv);
    expect(marriages).toHaveLength(1);
    expect(marriages[0].isActive).toBe(false);
    expect(marriages[0].divorceDate).toBe("2000-01-01");
  });

  it("should parse adopted and susuan relationships", () => {
    const csv = `Relationship ID,Parent ID,Child ID,Relationship Type
pc1,p1,p3,adopted
pc2,p2,p4,susuan`;

    const parentChildren = parseParentChildCSV(csv);
    expect(parentChildren).toHaveLength(2);
    expect(parentChildren[0].type).toBe("adopted");
    expect(parentChildren[1].type).toBe("susuan");
  });
});
