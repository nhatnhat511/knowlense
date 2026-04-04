export type EducationStandardRecord = {
  id: string;
  frameworkCode: string;
  frameworkLabel: string;
  subjectCode: string;
  subjectLabel: string;
  gradeCode: string;
  gradeLabel: string;
  gradeSort: number;
  groupLabel: string | null;
  domainLabel: string | null;
  standardCode: string;
  statement: string;
  notesText: string | null;
  canonicalText: string;
  source: string;
  datasetVersion: string;
};

export type EducationStandardSearchFilters = {
  framework?: string | null;
  subject?: string | null;
  grade?: string | null;
  query?: string | null;
  limit?: number | null;
};

export type EducationStandardShortlistFilters = {
  frameworks?: string[] | null;
  subjects?: string[] | null;
  grades?: string[] | null;
  limit?: number | null;
};

type EducationStandardRow = {
  id: string;
  framework_code: string;
  framework_label: string;
  subject_code: string;
  subject_label: string;
  grade_code: string;
  grade_label: string;
  grade_sort: number;
  group_label: string | null;
  domain_label: string | null;
  standard_code: string;
  statement: string;
  notes_text: string | null;
  canonical_text: string;
  source: string;
  dataset_version: string;
};

type SummaryRow = {
  framework_code: string;
  subject_code: string;
  standards_count: number;
};

function cleanValue(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeToken(value: string | null | undefined) {
  return cleanValue(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFrameworkCode(value: string | null | undefined) {
  const normalized = normalizeToken(value);

  if (normalized === "ccss") {
    return "CCSS";
  }

  if (normalized === "ngss") {
    return "NGSS";
  }

  if (normalized === "teks") {
    return "TEKS";
  }

  if (normalized === "va sol" || normalized === "vasol") {
    return "VA_SOL";
  }

  return cleanValue(value).toUpperCase().replace(/\s+/g, "_");
}

export function normalizeSubjectCode(value: string | null | undefined) {
  const normalized = normalizeToken(value);

  if (normalized === "ela") {
    return "ELA";
  }

  if (normalized === "math" || normalized === "mathematics") {
    return "MATH";
  }

  if (normalized === "science") {
    return "SCIENCE";
  }

  return cleanValue(value).toUpperCase().replace(/\s+/g, "_");
}

export function normalizeGradeCode(value: string | null | undefined) {
  const cleaned = cleanValue(value);
  const normalized = normalizeToken(cleaned);

  if (!normalized) {
    return "";
  }

  if (normalized === "kindergarten" || normalized === "k") {
    return "K";
  }

  const numeric = Number.parseInt(normalized, 10);
  if (Number.isFinite(numeric)) {
    return String(numeric);
  }

  return cleaned.toUpperCase().replace(/\s+/g, "_");
}

export function computeGradeSort(gradeCode: string) {
  if (gradeCode === "K") {
    return 0;
  }

  const numeric = Number.parseInt(gradeCode, 10);
  if (Number.isFinite(numeric)) {
    return numeric;
  }

  return 999;
}

export function normalizeSearchText(value: string | null | undefined) {
  return normalizeToken(value);
}

function mapEducationStandardRow(row: EducationStandardRow): EducationStandardRecord {
  return {
    id: row.id,
    frameworkCode: row.framework_code,
    frameworkLabel: row.framework_label,
    subjectCode: row.subject_code,
    subjectLabel: row.subject_label,
    gradeCode: row.grade_code,
    gradeLabel: row.grade_label,
    gradeSort: Number(row.grade_sort ?? 0),
    groupLabel: row.group_label,
    domainLabel: row.domain_label,
    standardCode: row.standard_code,
    statement: row.statement,
    notesText: row.notes_text,
    canonicalText: row.canonical_text,
    source: row.source,
    datasetVersion: row.dataset_version
  };
}

export async function searchEducationStandards(
  db: D1Database,
  filters: EducationStandardSearchFilters
): Promise<EducationStandardRecord[]> {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  const frameworkCode = filters.framework ? normalizeFrameworkCode(filters.framework) : "";
  const subjectCode = filters.subject ? normalizeSubjectCode(filters.subject) : "";
  const gradeCode = filters.grade ? normalizeGradeCode(filters.grade) : "";
  const normalizedQuery = filters.query ? normalizeSearchText(filters.query) : "";
  const limit = Math.max(1, Math.min(100, Number(filters.limit ?? 25) || 25));

  if (frameworkCode) {
    clauses.push("framework_code = ?");
    bindings.push(frameworkCode);
  }

  if (subjectCode) {
    clauses.push("subject_code = ?");
    bindings.push(subjectCode);
  }

  if (gradeCode) {
    clauses.push("grade_code = ?");
    bindings.push(gradeCode);
  }

  if (normalizedQuery) {
    clauses.push("(standard_code LIKE ? OR search_text LIKE ?)");
    bindings.push(`%${normalizedQuery.toUpperCase()}%`);
    bindings.push(`%${normalizedQuery}%`);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query = `
    SELECT
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
      source,
      dataset_version
    FROM education_standards
    ${whereClause}
    ORDER BY framework_code ASC, subject_code ASC, grade_sort ASC, standard_code ASC
    LIMIT ?
  `;

  const results = await db
    .prepare(query)
    .bind(...bindings, limit)
    .all<EducationStandardRow>();

  return (results.results ?? []).map(mapEducationStandardRow);
}

export async function listEducationStandardsSummary(db: D1Database) {
  const results = await db
    .prepare(
      `SELECT framework_code, subject_code, COUNT(*) AS standards_count
       FROM education_standards
       GROUP BY framework_code, subject_code
       ORDER BY framework_code ASC, subject_code ASC`
    )
    .all<SummaryRow>();

  return (results.results ?? []).map((row) => ({
    frameworkCode: row.framework_code,
    subjectCode: row.subject_code,
    standardsCount: Number(row.standards_count ?? 0)
  }));
}

export async function shortlistEducationStandards(
  db: D1Database,
  filters: EducationStandardShortlistFilters
): Promise<EducationStandardRecord[]> {
  const frameworks = (filters.frameworks ?? []).map((value) => normalizeFrameworkCode(value)).filter(Boolean);
  const subjects = (filters.subjects ?? []).map((value) => normalizeSubjectCode(value)).filter(Boolean);
  const grades = (filters.grades ?? []).map((value) => normalizeGradeCode(value)).filter(Boolean);
  const clauses: string[] = [];
  const bindings: unknown[] = [];
  const limit = Math.max(1, Math.min(500, Number(filters.limit ?? 150) || 150));

  if (frameworks.length) {
    clauses.push(`framework_code IN (${frameworks.map(() => "?").join(", ")})`);
    bindings.push(...frameworks);
  }

  if (subjects.length) {
    clauses.push(`subject_code IN (${subjects.map(() => "?").join(", ")})`);
    bindings.push(...subjects);
  }

  if (grades.length) {
    clauses.push(`grade_code IN (${grades.map(() => "?").join(", ")})`);
    bindings.push(...grades);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const results = await db
    .prepare(
      `SELECT
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
        source,
        dataset_version
      FROM education_standards
      ${whereClause}
      ORDER BY framework_code ASC, subject_code ASC, grade_sort ASC, standard_code ASC
      LIMIT ?`
    )
    .bind(...bindings, limit)
    .all<EducationStandardRow>();

  return (results.results ?? []).map(mapEducationStandardRow);
}
