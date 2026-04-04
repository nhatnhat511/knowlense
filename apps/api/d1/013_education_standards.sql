CREATE TABLE IF NOT EXISTS education_standards (
  id TEXT PRIMARY KEY,
  framework_code TEXT NOT NULL,
  framework_label TEXT NOT NULL,
  subject_code TEXT NOT NULL,
  subject_label TEXT NOT NULL,
  grade_code TEXT NOT NULL,
  grade_label TEXT NOT NULL,
  grade_sort INTEGER NOT NULL,
  group_label TEXT,
  domain_label TEXT,
  standard_code TEXT NOT NULL,
  statement TEXT NOT NULL,
  notes_text TEXT,
  canonical_text TEXT NOT NULL,
  search_text TEXT NOT NULL,
  source TEXT NOT NULL,
  dataset_version TEXT NOT NULL DEFAULT 'tpt-2026-04-04',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (framework_code, subject_code, grade_code, standard_code)
);

CREATE INDEX IF NOT EXISTS idx_education_standards_framework_subject_grade
ON education_standards (framework_code, subject_code, grade_sort, standard_code);

CREATE INDEX IF NOT EXISTS idx_education_standards_standard_code
ON education_standards (standard_code);

CREATE INDEX IF NOT EXISTS idx_education_standards_framework_code
ON education_standards (framework_code, standard_code);

CREATE INDEX IF NOT EXISTS idx_education_standards_subject_grade
ON education_standards (subject_code, grade_sort);
