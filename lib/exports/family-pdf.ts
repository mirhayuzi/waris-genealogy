import * as Print from "expo-print";
import type { FamilyData, Marriage, Person } from "@/lib/types";
import { getDisplayName } from "@/lib/types";

function todayBM(): string {
  const months = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function spouseSuffix(marriage: Marriage, spouse: Person): string {
  if (marriage.isActive) return "";
  return spouse.isAlive ? " (bercerai)" : " (meninggal)";
}

function sortByBirth(persons: Person[]): Person[] {
  return [...persons].sort((a, b) => {
    if (!a.birthDate && !b.birthDate) return 0;
    if (!a.birthDate) return 1;
    if (!b.birthDate) return -1;
    return a.birthDate.localeCompare(b.birthDate);
  });
}

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

  const subjectName = getDisplayName(subject);
  const birthYear = subject.birthDate?.slice(0, 4) ?? "";
  const deathYear = !subject.isAlive && subject.deathDate ? subject.deathDate.slice(0, 4) : "";
  const yearRange = birthYear
    ? `${birthYear} – ${deathYear || "sekarang"}`
    : "";

  // Spouses section
  const spousePairs = spousesOf(subject.id);
  const spousesHTML = spousePairs.length > 0
    ? `<h2>Pasangan</h2><ul>${spousePairs
        .map(({ spouse, marriage }) => `<li>${getDisplayName(spouse)}${spouseSuffix(marriage, spouse)}</li>`)
        .join("")}</ul>`
    : "";

  // Children + grandchildren section
  const children = sortByBirth(childrenOf(subject.id));
  let childrenHTML = "";
  if (children.length > 0) {
    const rows = children.map((child) => {
      const grandchildren = sortByBirth(childrenOf(child.id));
      const gcHTML = grandchildren.length > 0
        ? `<ul class="gc">${grandchildren.map((gc) => `<li>${getDisplayName(gc)}</li>`).join("")}</ul>`
        : "";
      return `<li class="child"><span class="cname">${getDisplayName(child)}</span>${gcHTML}</li>`;
    }).join("");
    childrenHTML = `<h2>Anak</h2><ul class="children">${rows}</ul>`;
  }

  const noContent = spousePairs.length === 0 && children.length === 0
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
    h2 { font-size: 13pt; font-weight: bold; border-bottom: 1px solid #ccc;
         padding-bottom: 4px; margin: 28px 0 10px; }
    ul { margin: 0; padding-left: 22px; }
    li { margin: 4px 0; font-size: 11pt; }
    ul.children { padding-left: 0; list-style: none; }
    li.child { margin-bottom: 12px; }
    .cname { font-weight: bold; }
    ul.gc { padding-left: 24px; list-style: disc; margin-top: 4px; }
    ul.gc li { font-size: 10pt; color: #333; }
    .empty { color: #888; font-style: italic; margin-top: 20px; }
    .footer { margin-top: 48px; border-top: 1px solid #ddd; padding-top: 8px;
               font-size: 8pt; color: #bbb; text-align: center; }
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

export async function generateFamilyPdf(subjectId: string, family: FamilyData): Promise<void> {
  const html = buildHTML(subjectId, family);
  await Print.printAsync({ html });
}
