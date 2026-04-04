import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function cleanValue(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFrameworkCode(value) {
  const normalized = normalizeToken(value);

  if (normalized === "ccss") return "CCSS";
  if (normalized === "ngss") return "NGSS";
  if (normalized === "teks") return "TEKS";
  if (normalized === "va sol" || normalized === "vasol") return "VA_SOL";

  return cleanValue(value).toUpperCase().replace(/\s+/g, "_");
}

function normalizeSubjectCode(value) {
  const normalized = normalizeToken(value);

  if (normalized === "ela") return "ELA";
  if (normalized === "math" || normalized === "mathematics") return "MATH";
  if (normalized === "science") return "SCIENCE";

  return cleanValue(value).toUpperCase().replace(/\s+/g, "_");
}

function normalizeGradeCode(value) {
  const cleaned = cleanValue(value);
  const normalized = normalizeToken(cleaned);

  if (normalized === "kindergarten" || normalized === "k") return "K";

  const numeric = Number.parseInt(normalized, 10);
  if (Number.isFinite(numeric)) return String(numeric);

  return cleaned.toUpperCase().replace(/\s+/g, "_");
}

function computeGradeSort(gradeCode) {
  if (gradeCode === "K") return 0;
  const numeric = Number.parseInt(gradeCode, 10);
  return Number.isFinite(numeric) ? numeric : 999;
}

function normalizeSearchText(value) {
  return normalizeToken(value);
}

function makeCanonicalText(row) {
  return [
    `Framework: ${row.frameworkLabel}`,
    `Subject: ${row.subjectLabel}`,
    `Grade: ${row.gradeLabel}`,
    `Group: ${row.groupLabel || "Not specified"}`,
    `Domain: ${row.domainLabel || "Not specified"}`,
    `Code: ${row.standardCode}`,
    `Statement: ${row.statement}`,
    `Notes: ${row.notesText || "None"}`
  ].join("\n");
}

function makeSearchText(row) {
  return normalizeSearchText(
    [
      row.frameworkLabel,
      row.subjectLabel,
      row.gradeLabel,
      row.groupLabel,
      row.domainLabel,
      row.standardCode,
      row.statement,
      row.notesText
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function toSqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function parseCsv(content) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }

      row.push(current);
      current = "";

      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function buildRowId(row) {
  const parts = [
    row.frameworkCode,
    row.subjectCode,
    row.gradeCode,
    row.standardCode
  ];

  return parts
    .join("__")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
}

const inputPath = process.argv[2];
const outputPath =
  process.argv[3] || path.resolve(process.cwd(), "d1", "014_education_standards_seed.sql");

if (!inputPath) {
  console.error("Usage: node ./scripts/build-education-standards-seed.mjs <csv-path> [output-sql-path]");
  process.exit(1);
}

const { readFile } = await import("node:fs/promises");
const csvContent = await readFile(inputPath, "utf8");
const rows = parseCsv(csvContent);

if (rows.length < 2) {
  console.error("CSV does not contain any data rows.");
  process.exit(1);
}

const header = rows[0].map((value) => cleanValue(value));
const dataRows = rows.slice(1);
const expectedHeader = ["framework", "subject", "grade", "group", "standard_code", "statement", "notes", "source"];

if (expectedHeader.some((value, index) => header[index] !== value)) {
  console.error("Unexpected CSV header:", header);
  process.exit(1);
}

const normalizedRows = dataRows
  .map((row) => {
    const frameworkLabel = cleanValue(row[0]);
    const subjectLabel = cleanValue(row[1]);
    const gradeLabel = cleanValue(row[2]);
    const groupLabel = cleanValue(row[3]) || null;
    const standardCode = cleanValue(row[4]);
    const statement = cleanValue(row[5]);
    const notesText = cleanValue(row[6]) || null;
    const source = cleanValue(row[7]) || "TPT";
    const frameworkCode = normalizeFrameworkCode(frameworkLabel);
    const subjectCode = normalizeSubjectCode(subjectLabel);
    const gradeCode = normalizeGradeCode(gradeLabel);
    const gradeSort = computeGradeSort(gradeCode);

    const record = {
      id: "",
      frameworkCode,
      frameworkLabel,
      subjectCode,
      subjectLabel,
      gradeCode,
      gradeLabel,
      gradeSort,
      groupLabel,
      domainLabel: notesText,
      standardCode,
      statement,
      notesText,
      source,
      datasetVersion: "tpt-2026-04-04"
    };

    record.id = buildRowId(record);

    return {
      ...record,
      canonicalText: makeCanonicalText(record),
      searchText: makeSearchText(record)
    };
  })
  .filter((row) => row.frameworkCode && row.subjectCode && row.gradeCode && row.standardCode && row.statement);

const dedupedRows = Array.from(
  new Map(
    normalizedRows.map((row) => [
      `${row.frameworkCode}|${row.subjectCode}|${row.gradeCode}|${row.standardCode}`,
      row
    ])
  ).values()
);

const chunks = [];
for (let i = 0; i < dedupedRows.length; i += 25) {
  chunks.push(dedupedRows.slice(i, i + 25));
}

const statements = [
  "-- Generated from Education Standards TPT.csv",
  "DELETE FROM education_standards;"
];

for (const chunk of chunks) {
  const values = chunk
    .map(
      (row) =>
        `(${[
          row.id,
          row.frameworkCode,
          row.frameworkLabel,
          row.subjectCode,
          row.subjectLabel,
          row.gradeCode,
          row.gradeLabel,
          row.gradeSort,
          row.groupLabel,
          row.domainLabel,
          row.standardCode,
          row.statement,
          row.notesText,
          row.canonicalText,
          row.searchText,
          row.source,
          row.datasetVersion
        ]
          .map(toSqlString)
          .join(", ")})`
    )
    .join(",\n");

  statements.push(
    `INSERT INTO education_standards (
  id,
  framework_code,
  framework_label,
  subject_code,
  subject_label,
  grade_code,
  grade_label,
  grade_sort,
  group_label,
  domain_label,
  standard_code,
  statement,
  notes_text,
  canonical_text,
  search_text,
  source,
  dataset_version
) VALUES
${values};`
  );
}

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${statements.join("\n\n")}\n`, "utf8");

console.log(`Wrote ${dedupedRows.length} education standards to ${outputPath}`);
