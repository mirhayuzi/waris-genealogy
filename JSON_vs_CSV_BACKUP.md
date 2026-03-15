# Why JSON Backup Instead of CSV? - Technical Explanation

## Quick Answer

**JSON** is used for Waris Genealogy backups instead of CSV because:

1. **Preserves relationships** - Family connections (spouse, children, parents) are maintained
2. **Stores photos** - Photo data encoded as base64 is included in backup
3. **Handles complex data** - Nested structures for multiple relationships per person
4. **No data loss** - All fields preserved exactly as stored
5. **Easier to restore** - One file restores everything perfectly
6. **Future-proof** - Supports new features without breaking old backups

---

## Detailed Comparison

### CSV (Comma-Separated Values)

**What is CSV?**
- Simple text format with rows and columns
- Each row = one record, each column = one field
- Example:

```csv
FirstName,LastName,Gender,DateOfBirth,Ethnicity,Religion
Muhammad,Abdullah,Male,1980-05-15,Melayu,Islam
Fatimah,Abdullah,Female,1985-03-20,Melayu,Islam
Ahmad,Muhammad,Male,2010-07-10,Melayu,Islam
```

**CSV Limitations for Family Trees:**

1. **Cannot store relationships** ❌
   - CSV has no way to link "Ahmad" as child of "Muhammad"
   - Would need separate columns like "ParentID" or "SpouseID"
   - But then you need multiple CSV files (one for members, one for relationships)
   - Becomes messy and error-prone

2. **Cannot store photos** ❌
   - CSV is text-only format
   - Photos would need to be stored separately
   - Backup becomes multiple files instead of one
   - Risk of losing photos if one file is deleted

3. **Cannot store nested data** ❌
   - Example: A person with 3 spouses and 5 children
   - CSV would need many columns or repeated rows
   - Data becomes redundant and hard to parse

4. **Data type issues** ❌
   - Dates might be interpreted as text or numbers
   - Boolean values (true/false) become text
   - Decimal numbers might lose precision
   - Commas in names break CSV parsing

5. **Difficult to restore** ❌
   - Restoring from CSV requires parsing and validating each row
   - Risk of data corruption during import
   - Relationships must be manually reconstructed
   - Photos must be re-linked manually

6. **Not suitable for complex structures** ❌
   - Family trees have variable numbers of relationships
   - Some people have 1 child, others have 10
   - CSV cannot handle this variability elegantly

**Example of CSV Problems:**

If you try to store a family tree in CSV, you'd need something like:

```csv
ID,FirstName,LastName,Gender,DateOfBirth,Ethnicity,Religion,SpouseID,ParentID,ChildID1,ChildID2,ChildID3,Photo
1,Muhammad,Abdullah,Male,1980-05-15,Melayu,Islam,2,,3,4,,
2,Fatimah,Abdullah,Female,1985-03-20,Melayu,Islam,1,,3,4,,
3,Ahmad,Muhammad,Male,2010-07-10,Melayu,Islam,,,,,
4,Nur,Muhammad,Female,2012-09-22,Melayu,Islam,,,,,
```

**Problems:**
- Lots of empty columns (wasted space)
- Hard to add more children (need more columns)
- Photo column is empty (photos stored separately)
- Relationships are just IDs, hard to understand
- Difficult to parse and validate

---

### JSON (JavaScript Object Notation)

**What is JSON?**
- Structured text format with objects and arrays
- Preserves data types (strings, numbers, booleans, objects, arrays)
- Hierarchical and nested
- Example:

```json
{
  "familyMembers": [
    {
      "id": "1",
      "firstName": "Muhammad",
      "lastName": "Abdullah",
      "gender": "Male",
      "dateOfBirth": "1980-05-15",
      "ethnicity": "Melayu",
      "religion": "Islam",
      "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
      "relationships": {
        "spouse": "2",
        "children": ["3", "4"]
      }
    },
    {
      "id": "2",
      "firstName": "Fatimah",
      "lastName": "Abdullah",
      "gender": "Female",
      "dateOfBirth": "1985-03-20",
      "ethnicity": "Melayu",
      "religion": "Islam",
      "photo": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA...",
      "relationships": {
        "spouse": "1",
        "children": ["3", "4"]
      }
    },
    {
      "id": "3",
      "firstName": "Ahmad",
      "lastName": "Muhammad",
      "gender": "Male",
      "dateOfBirth": "2010-07-10",
      "ethnicity": "Melayu",
      "religion": "Islam",
      "photo": null,
      "relationships": {
        "parents": ["1", "2"]
      }
    }
  ]
}
```

**JSON Advantages for Family Trees:**

1. **Preserves relationships** ✅
   - Each person has a "relationships" object
   - Can store multiple spouses, children, parents
   - Relationships are explicit and clear
   - Easy to reconstruct the tree

2. **Stores photos** ✅
   - Photos encoded as base64 strings
   - Entire backup is one file
   - No risk of losing photos
   - Photos restored automatically

3. **Handles complex data** ✅
   - Nested objects for relationships
   - Arrays for multiple children/spouses
   - Variable number of relationships per person
   - Scales to any family size

4. **Preserves data types** ✅
   - Dates stay as strings (ISO format)
   - Numbers stay as numbers
   - Booleans stay as booleans
   - No ambiguity or conversion errors

5. **Easy to restore** ✅
   - Parse JSON once, get complete data structure
   - All relationships already linked
   - Photos already embedded
   - One-click restore, no manual work

6. **Extensible** ✅
   - Easy to add new fields (notes, addresses, etc.)
   - Old backups still work with new app versions
   - Can add new features without breaking compatibility
   - Future-proof format

---

## File Size Comparison

**Example: Family of 10 people with photos**

| Format | File Size | Notes |
|--------|-----------|-------|
| CSV | 2-5 KB | Text only, no photos |
| CSV + Photos | 5-10 MB | Photos stored separately, multiple files |
| JSON | 8-12 MB | Everything in one file, photos embedded |

**Conclusion:** JSON is slightly larger but includes photos, making it more complete and practical.

---

## Could We Use Both?

**Possible approach:**
- **JSON for backup/restore** (primary method)
- **CSV for export to spreadsheet** (optional feature)

**Advantages:**
- Users can export family data to Excel/Sheets for analysis
- Useful for genealogy research and documentation
- Doesn't replace JSON backup (which is more reliable)

**Current Waris Implementation:**
- ✅ JSON backup/restore (primary)
- ❌ CSV export (not yet implemented)

**Future Enhancement:**
- Could add "Export to CSV" feature in Tools tab
- Users could open CSV in Excel for further analysis
- But CSV would be for reference only, not for backup

---

## Other Backup Formats Considered

### XML
- Similar to JSON but more verbose
- Larger file size
- Less common for mobile apps
- Not as easy to parse

### SQLite Database
- Binary format (not human-readable)
- Difficult to inspect or edit manually
- Requires database tools to restore
- Overkill for simple backup

### Plain Text
- Human-readable but unstructured
- Difficult to parse programmatically
- No way to store relationships or photos
- Not suitable for complex data

### Protocol Buffers (Protobuf)
- Compact binary format
- Difficult to inspect or debug
- Requires schema definition
- Overkill for genealogy app

---

## Best Practices for JSON Backups

### For Users:
1. **Create regular backups** - Weekly or monthly
2. **Store in multiple locations** - Google Drive + local storage
3. **Keep old backups** - Don't overwrite, keep version history
4. **Test restore** - Verify backup works before deleting original
5. **Share with family** - Email backup to trusted family members

### For Developers:
1. **Version the JSON schema** - Track format changes
2. **Validate on import** - Check data integrity
3. **Handle old formats** - Support older backup versions
4. **Encrypt sensitive data** - Consider encryption for photos
5. **Compress large backups** - ZIP files for easier sharing

---

## Conclusion

**JSON is the best choice for Waris Genealogy backups because:**

| Requirement | JSON | CSV |
|-------------|------|-----|
| Preserve relationships | ✅ | ❌ |
| Store photos | ✅ | ❌ |
| Handle complex data | ✅ | ❌ |
| One-file backup | ✅ | ❌ |
| Easy restore | ✅ | ❌ |
| Future-proof | ✅ | ❌ |
| Human-readable | ✅ | ✅ |
| Compact size | ❌ | ✅ |
| Compatible with Excel | ❌ | ✅ |

**Recommendation:** Use JSON for backup/restore (primary), and optionally add CSV export for data analysis.

---

## Technical Details for Developers

### JSON Schema for Waris Backup

```json
{
  "version": "1.0.0",
  "exportDate": "2026-03-13T11:35:00Z",
  "familyName": "Abdullah Family",
  "familyMembers": [
    {
      "id": "uuid",
      "firstName": "string",
      "lastName": "string",
      "prefix": "string | null",
      "bin": "string | null",
      "gender": "Male | Female",
      "dateOfBirth": "YYYY-MM-DD | null",
      "ethnicity": "string",
      "religion": "string",
      "placeOfBirth": "string | null",
      "status": "Living | Deceased",
      "photo": "data:image/jpeg;base64,... | null",
      "relationships": {
        "spouse": ["uuid", ...],
        "children": ["uuid", ...],
        "parents": ["uuid", ...]
      },
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ],
  "collaborators": [
    {
      "email": "string",
      "role": "Admin | Editor | Viewer",
      "joinedAt": "ISO8601"
    }
  ]
}
```

### Parsing JSON in React Native

```typescript
// Export backup as JSON
const backupData = {
  version: "1.0.0",
  exportDate: new Date().toISOString(),
  familyMembers: familyStore.members,
  collaborators: familyStore.collaborators
};

const jsonString = JSON.stringify(backupData, null, 2);
await FileSystem.writeAsStringAsync(backupPath, jsonString);

// Import backup from JSON
const jsonString = await FileSystem.readAsStringAsync(backupPath);
const backupData = JSON.parse(jsonString);

// Validate and restore
if (backupData.version === "1.0.0") {
  familyStore.setMembers(backupData.familyMembers);
  familyStore.setCollaborators(backupData.collaborators);
}
```

---

**Questions?** Contact support@waris-genealogy.my
