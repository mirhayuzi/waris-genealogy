import { zip as fflateZip, unzip as fflateUnzip, strToU8, strFromU8 } from "fflate";
import type { Zippable, ZipOptions } from "fflate";
import * as FileSystem from "expo-file-system/legacy";
import type { FamilyData } from "./types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function uint8ToBase64(arr: Uint8Array): string {
  let str = "";
  for (let i = 0; i < arr.length; i++) str += String.fromCharCode(arr[i]);
  return btoa(str);
}

// ─── Filename ────────────────────────────────────────────────────────────────

// e.g. Waris-sibil-2026-05-02_09-11.zip
export function makeZipFileName(familyName: string): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const HH = String(now.getHours()).padStart(2, "0");
  const MM = String(now.getMinutes()).padStart(2, "0");
  const safe =
    familyName
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "family";
  return `Waris-${safe}-${yyyy}-${mm}-${dd}_${HH}-${MM}.zip`;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export interface ZipExportResult {
  success: boolean;
  fileName: string;
  tempPath: string;
  message: string;
}

export async function exportToZip(familyData: FamilyData): Promise<ZipExportResult> {
  const fileName = makeZipFileName(familyData.familyName);

  const manifest = {
    format: "waris-zip-v2",
    exportedAt: new Date().toISOString(),
    familyName: familyData.familyName,
    stats: {
      persons: familyData.persons.length,
      marriages: familyData.marriages.length,
      parentChildren: familyData.parentChildren.length,
    },
  };

  const opts9: ZipOptions = { level: 9 };
  const opts0: ZipOptions = { level: 0 }; // JPEG already compressed — store only

  const files: Zippable = {
    "manifest.json": [strToU8(JSON.stringify(manifest, null, 2)), opts9],
    "data.json": [strToU8(JSON.stringify(familyData, null, 2)), opts9],
  };

  // Bundle photos as photos/{personId}.jpg
  for (const person of familyData.persons) {
    if (!person.photo) continue;
    try {
      let bytes: Uint8Array | null = null;

      if (person.photo.startsWith("data:image")) {
        const b64 = person.photo.split(",")[1];
        if (b64) bytes = base64ToUint8(b64);
      } else if (
        person.photo.startsWith("file://") ||
        person.photo.startsWith("/")
      ) {
        const b64 = await FileSystem.readAsStringAsync(person.photo, {
          encoding: FileSystem.EncodingType.Base64,
        });
        bytes = base64ToUint8(b64);
      }

      if (bytes) {
        (files as Record<string, [Uint8Array, ZipOptions]>)[
          `photos/${person.id}.jpg`
        ] = [bytes, opts0];
      }
    } catch (e) {
      console.warn(`exportToZip: skip photo ${person.id}:`, e);
    }
  }

  const zipBytes = await new Promise<Uint8Array>((resolve, reject) => {
    fflateZip(files, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const cacheDir = FileSystem.cacheDirectory ?? "";
  const tempPath = `${cacheDir}${fileName}`;
  await FileSystem.writeAsStringAsync(tempPath, uint8ToBase64(zipBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { success: true, fileName, tempPath, message: "OK" };
}

// ─── Import ──────────────────────────────────────────────────────────────────

export interface ZipImportResult {
  success: boolean;
  data?: FamilyData;
  message: string;
}

export async function importFromZip(fileUri: string): Promise<ZipImportResult> {
  const b64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const zipBytes = base64ToUint8(b64);

  const unzipped = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) => {
      fflateUnzip(zipBytes, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    }
  );

  const dataFile = unzipped["data.json"];
  if (!dataFile) {
    return {
      success: false,
      message: "Fail data.json tidak dijumpai dalam ZIP.",
    };
  }

  let familyData: FamilyData;
  try {
    familyData = JSON.parse(strFromU8(dataFile)) as FamilyData;
  } catch {
    return { success: false, message: "data.json rosak atau format tidak sah." };
  }

  if (!Array.isArray(familyData.persons)) {
    return { success: false, message: "data.json: persons bukan array." };
  }

  // Restore photos: unzip keys are flat "photos/{id}.jpg"
  const docDir = FileSystem.documentDirectory;
  if (docDir) {
    for (const person of familyData.persons) {
      const photoBytes = unzipped[`photos/${person.id}.jpg`];
      if (photoBytes) {
        try {
          const destPath = `${docDir}photo_${person.id}.jpg`;
          await FileSystem.writeAsStringAsync(
            destPath,
            uint8ToBase64(photoBytes),
            { encoding: FileSystem.EncodingType.Base64 }
          );
          person.photo = destPath;
        } catch (e) {
          console.warn(`importFromZip: cannot restore photo ${person.id}:`, e);
          person.photo = undefined;
        }
      } else {
        person.photo = undefined;
      }
    }
  }

  return { success: true, data: familyData, message: "OK" };
}
