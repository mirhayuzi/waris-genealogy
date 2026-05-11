import * as Print from "expo-print";
import type { FamilyData, Marriage, Person } from "@/lib/types";
import { getDisplayName } from "@/lib/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayBM(): string {
  const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Determine the display suffix for a spouse on the PDF.
 * Priority: if the spouse is deceased, always mark (meninggal) regardless
 * of whether the marriage record has been marked inactive — many users
 * leave isActive=true even after a spouse dies.
 */
function spouseSuffix(marriage: Marriage, spouse: Person): string {
  if (!spouse.isAlive) return " (meninggal)";
  if (!marriage.isActive) return " (bercerai)";
  return "";
}

function sortByBirth(persons: Person[]): Person[] {
  return [...persons].sort((a, b) => {
    if (!a.birthDate && !b.birthDate) return 0;
    if (!a.birthDate) return 1;
    if (!b.birthDate) return -1;
    return a.birthDate.localeCompare(b.birthDate);
  });
}

// ── HTML builder ─────────────────────────────────────────────────────────────

function buildHTML(subjectId: string, data: FamilyData): string {
  const { persons, marriages, parentChildren } = data;
  const subject = persons.find((p) => p.id === subjectId);
  if (!subject) return "<html><body>Ahli tidak dijumpai.</body></html>";

  const spousesOf = (personId: string): { spouse: Person; marriage: Marriage }[] =>
    marriages
      .filter((m) => m.husbandId === personId || m.wifeId === personId)
      .flatMap((m) => {
        const spouseId = m.husbandId === personId ? m.wifeId : m.husbandId;
        const spouse = persons.find((p) => p.id === spouseId);
        return spouse ? [{ spouse, marriage: m }] : [];
      });

  const childrenOf = (personId: string): Person[] => {
    const ids = parentChildren.filter((pc) => pc.parentId === personId).map((pc) => pc.childId);
    return persons.filter((p) => ids.includes(p.id));
  };

  const parentsOf = (personId: string): string[] =>
    parentChildren.filter((pc) => pc.childId === personId).map((pc) => pc.parentId);

  // ── Subject header ──
  const subjectName = getDisplayName(subject);
  const birthYear = subject.birthDate?.slice(0, 4) ?? "";
  const deathYear = !subject.isAlive && subject.deathDate ? subject.deathDate.slice(0, 4) : "";
  const yearRange = birthYear ? `${birthYear} – ${deathYear || "sekarang"}` : "";

  // ── Spouses ──
  const spousePairs = spousesOf(subject.id);
  const spousesHTML = spousePairs.length > 0
    ? `<h2>Pasangan</h2><ul>${spousePairs
        .map(({ spouse, marriage }) => `<li>${getDisplayName(spouse)}${spouseSuffix(marriage, spouse)}</li>`)
        .join("")}</ul>`
    : "";

  // ── Children grouped by marriage ──
  const allChildren = sortByBirth(childrenOf(subject.id));

  let childrenHTML = "";
  if (allChildren.length > 0) {
    // Map spouseId → children who share that spouse as a co-parent
    const groups: { label: string; children: Person[] }[] = [];
    const assigned = new Set<string>();

    for (const { spouse, marriage } of spousePairs) {
      const shared = allChildren.filter((child) => {
        const childParents = parentsOf(child.id);
        return childParents.includes(spouse.id);
      });
      if (shared.length > 0) {
        const suffix = spouseSuffix(marriage, spouse);
        groups.push({ label: `Dengan ${getDisplayName(spouse)}${suffix}`, children: shared });
        shared.forEach((c) => assigned.add(c.id));
      }
    }

    // Children with unknown / non-spouse co-parent
    const unassigned = allChildren.filter((c) => !assigned.has(c.id));
    if (unassigned.length > 0) {
      groups.push({ label: spousePairs.length > 0 ? "Lain-lain" : "", children: unassigned });
    }

    const groupRows = groups.map(({ label, children }) => {
      const childItems = children.map((child) => {
        const grandchildren = sortByBirth(childrenOf(child.id));
        const gcHTML = grandchildren.length > 0
          ? `<ul class="gc">${grandchildren.map((gc) => `<li>${getDisplayName(gc)}</li>`).join("")}</ul>`
          : "";
        return `<li class="child"><span class="cname">${getDisplayName(child)}</span>${gcHTML}</li>`;
      }).join("");

      const labelHTML = label
        ? `<h3>${label}</h3>`
        : "";
      return `${labelHTML}<ul class="children">${childItems}</ul>`;
    }).join("");

    childrenHTML = `<h2>Anak</h2>${groupRows}`;
  }

  const noContent = spousePairs.length === 0 && allChildren.length === 0
    ? `<p class="empty">Tiada rekod keluarga</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #111; font-size: 12pt; line-height: 1.65; }
    h1 { font-size: 22pt; margin: 0 0 4px; }
    .sub { font-size: 11pt; color: #555; margin: 0 0 2px; }
    .brand { font-size: 9pt; color: #aaa; margin: 0 0 28px; }
    h2 { font-size: 13pt; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin: 28px 0 10px; }
    h3 { font-size: 11pt; font-weight: bold; color: #444; margin: 14px 0 6px; font-style: italic; }
    ul { margin: 0; padding-left: 22px; }
    li { margin: 4px 0; font-size: 11pt; }
    ul.children { padding-left: 0; list-style: none; }
    li.child { margin-bottom: 12px; }
    .cname { font-weight: bold; }
    ul.gc { padding-left: 24px; list-style: disc; margin-top: 4px; }
    ul.gc li { font-size: 10pt; color: #333; }
    .empty { color: #888; font-style: italic; margin-top: 20px; }
    .footer { margin-top: 48px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 8pt; color: #bbb; text-align: center; }
  </style>
</head>
<body>
  <h1>Keluarga ${subjectName}</h1>
  ${yearRange ? `<p class="sub">${yearRange}</p>` : ""}
  <p class="brand">Waris Genealogy</p>
  ${spousesHTML}
  ${childrenHTML}
  ${noContent}
  <div class="footer">Dijana oleh Waris Genealogy &bull; ${todayBM()}</div>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateFamilyPdf(subjectId: string, family: FamilyData): Promise<void> {
  const html = buildHTML(subjectId, family);
  // width/height in points enforce A4 (595 × 842 pt) over Android's Letter default
  await Print.printAsync({ html, width: 595, height: 842 });
}
