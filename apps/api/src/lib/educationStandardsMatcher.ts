import { type ProductSeoAuditSnapshot } from "./seoAuditor";
import {
  computeGradeSort,
  normalizeFrameworkCode,
  normalizeGradeCode,
  normalizeSearchText,
  normalizeSubjectCode,
  shortlistEducationStandards,
  type EducationStandardRecord
} from "./educationStandardsStore";
import { GeminiRequestError } from "./productRewriter";

type VertexConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  location: string;
  tokenUri?: string;
};

type MatcherOptions = {
  snapshot: ProductSeoAuditSnapshot;
  db: D1Database;
  userId: string;
  vertex: VertexConfig | null;
  model?: string;
};

type GenerateContentErrorResponse = {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
};

type ProductInferenceResult = {
  framework_candidates: string[];
  subject_candidates: string[];
  grade_candidates: string[];
  skill_terms: string[];
  objective_summary: string;
  resource_type: string | null;
};

type CandidateSelectionResult = {
  selected_codes: string[];
};

export type EducationStandardsMatchResult = {
  inference: {
    frameworks: string[];
    subjects: string[];
    grades: string[];
    skillTerms: string[];
    objectiveSummary: string;
    resourceType: string | null;
  };
  matches: Array<{
    standardCode: string;
    frameworkCode: string;
    subjectCode: string;
    gradeCode: string;
    groupLabel: string | null;
    domainLabel: string | null;
    statement: string;
  }>;
  meta: {
    model: string;
    candidatesConsidered: number;
    shortlistedCandidates: number;
  };
};

function cleanValue(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => cleanValue(value)).filter(Boolean))];
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string) {
  return toBase64Url(new TextEncoder().encode(value));
}

function pemToArrayBuffer(pem: string) {
  const normalized = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(normalized);
  const output = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    output[index] = binary.charCodeAt(index);
  }

  return output.buffer;
}

async function signJwt(privateKey: string, header: Record<string, unknown>, payload: Record<string, unknown>) {
  const encodedHeader = stringToBase64Url(JSON.stringify(header));
  const encodedPayload = stringToBase64Url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKey),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${toBase64Url(new Uint8Array(signature))}`;
}

async function getVertexAccessToken(vertex: VertexConfig) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt(
    vertex.privateKey,
    { alg: "RS256", typ: "JWT" },
    {
      iss: vertex.clientEmail,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: vertex.tokenUri || "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    }
  );

  const response = await fetch(vertex.tokenUri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string;
    error_description?: string;
  } | null;

  if (!response.ok || !payload?.access_token) {
    throw new GeminiRequestError(payload?.error_description || "Vertex AI authentication failed.", response.status || 500);
  }

  return payload.access_token;
}

async function callVertexModel<T>(vertex: VertexConfig, model: string, body: Record<string, unknown>) {
  const accessToken = await getVertexAccessToken(vertex);
  const location = model.startsWith("gemini-2.0-") ? "global" : vertex.location;
  const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
  const endpoint = `https://${host}/v1/projects/${encodeURIComponent(vertex.projectId)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json().catch(() => null)) as GenerateContentErrorResponse | null;
  const message = payload?.error?.message?.trim();

  if (!response.ok) {
    throw new GeminiRequestError(message || "Knowlense could not reach Vertex AI for Education Standards.", response.status);
  }

  if (payload?.promptFeedback?.blockReason) {
    throw new GeminiRequestError("Vertex AI blocked this Education Standards request.", 400);
  }

  const rawText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!rawText) {
    throw new GeminiRequestError("Vertex AI did not return Education Standards content.", 502);
  }

  return JSON.parse(rawText) as T;
}

function buildInferencePrompt(snapshot: ProductSeoAuditSnapshot) {
  return [
    "Analyze this Teachers Pay Teachers product and infer the most likely education-standards metadata.",
    "Return JSON only.",
    `Title: ${cleanValue(snapshot.title) || "Not available"}`,
    `Description: ${cleanValue(snapshot.descriptionText || snapshot.descriptionExcerpt) || "Not available"}`,
    `Grades: ${dedupeStrings(snapshot.grades).join(", ") || "Not available"}`,
    `Subjects: ${dedupeStrings(snapshot.subjects ?? []).join(", ") || "Not available"}`,
    `Tags: ${dedupeStrings(snapshot.tags).join(", ") || "Not available"}`,
    `Resource type: ${cleanValue(snapshot.resourceType) || "Not available"}`
  ].join("\n");
}

function buildInferenceRequest(snapshot: ProductSeoAuditSnapshot) {
  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: buildInferencePrompt(snapshot)
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          framework_candidates: {
            type: "ARRAY",
            maxItems: 3,
            items: { type: "STRING" }
          },
          subject_candidates: {
            type: "ARRAY",
            maxItems: 3,
            items: { type: "STRING" }
          },
          grade_candidates: {
            type: "ARRAY",
            maxItems: 4,
            items: { type: "STRING" }
          },
          skill_terms: {
            type: "ARRAY",
            maxItems: 10,
            items: { type: "STRING" }
          },
          objective_summary: {
            type: "STRING"
          },
          resource_type: {
            type: "STRING",
            nullable: true
          }
        },
        required: ["framework_candidates", "subject_candidates", "grade_candidates", "skill_terms", "objective_summary", "resource_type"]
      }
    }
  };
}

function buildSelectionRequest(
  snapshot: ProductSeoAuditSnapshot,
  inference: ProductInferenceResult,
  candidates: EducationStandardRecord[]
) {
  const compactCandidates = candidates.map((candidate) => ({
    code: candidate.standardCode,
    statement: candidate.statement
  }));

  return {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: [
              "Choose the education standards whose statements best match this product.",
              "The candidates already match the likely framework, subject, and grade.",
              "Use statement meaning as the main selection criterion.",
              "Return JSON only.",
              `Title: ${cleanValue(snapshot.title) || "Not available"}`,
              `Description: ${cleanValue(snapshot.descriptionText || snapshot.descriptionExcerpt) || "Not available"}`,
              `Objective summary: ${cleanValue(inference.objective_summary) || "Not available"}`,
              `Skill terms: ${dedupeStrings(inference.skill_terms).join(", ") || "Not available"}`,
              `Candidates: ${JSON.stringify(compactCandidates)}`
            ].join("\n")
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          selected_codes: {
            type: "ARRAY",
            maxItems: 5,
            items: {
              type: "STRING"
            }
          }
        },
        required: ["selected_codes"]
      }
    }
  };
}

function scoreCandidate(
  candidate: EducationStandardRecord,
  inference: ProductInferenceResult,
  snapshot: ProductSeoAuditSnapshot
) {
  const haystack = normalizeSearchText(
    [
      candidate.standardCode,
      candidate.statement,
      candidate.groupLabel,
      candidate.domainLabel,
      candidate.notesText
    ]
      .filter(Boolean)
      .join(" ")
  );

  let score = 0;
  const skillTerms = dedupeStrings(inference.skill_terms).map((value) => normalizeSearchText(value));
  const tags = dedupeStrings(snapshot.tags).map((value) => normalizeSearchText(value));
  const subjects = dedupeStrings(snapshot.subjects ?? []).map((value) => normalizeSearchText(value));

  for (const term of [...skillTerms, ...tags, ...subjects]) {
    if (term && haystack.includes(term)) {
      score += term.length >= 10 ? 4 : 2;
    }
  }

  const objectiveSummary = normalizeSearchText(inference.objective_summary);
  if (objectiveSummary) {
    const objectiveTokens = objectiveSummary.split(" ").filter((token) => token.length >= 4);
    for (const token of objectiveTokens) {
      if (haystack.includes(token)) {
        score += 1;
      }
    }
  }

  const inferredGrades = dedupeStrings(inference.grade_candidates).map((value) => normalizeGradeCode(value));
  if (inferredGrades.includes(candidate.gradeCode)) {
    score += 5;
  } else {
    const candidateSort = computeGradeSort(candidate.gradeCode);
    const nearby = inferredGrades.some((value) => Math.abs(computeGradeSort(value) - candidateSort) <= 1);
    if (nearby) {
      score += 2;
    }
  }

  return score;
}

function mergeFrameworkCandidates(inference: ProductInferenceResult, snapshot: ProductSeoAuditSnapshot) {
  const explicit = dedupeStrings([...(snapshot.subjects ?? []), snapshot.resourceType])
    .map(() => null)
    .filter(Boolean);
  void explicit;
  return dedupeStrings(inference.framework_candidates).map((value) => normalizeFrameworkCode(value)).filter(Boolean);
}

function mergeSubjectCandidates(inference: ProductInferenceResult, snapshot: ProductSeoAuditSnapshot) {
  return dedupeStrings([...(snapshot.subjects ?? []), ...inference.subject_candidates])
    .map((value) => normalizeSubjectCode(value))
    .filter(Boolean);
}

function mergeGradeCandidates(inference: ProductInferenceResult, snapshot: ProductSeoAuditSnapshot) {
  const inferred = dedupeStrings([...snapshot.grades, ...inference.grade_candidates])
    .map((value) => normalizeGradeCode(value))
    .filter(Boolean);

  const expanded = new Set<string>();
  inferred.forEach((gradeCode) => {
    expanded.add(gradeCode);
    const sort = computeGradeSort(gradeCode);
    if (sort !== 999) {
      if (sort > 0) {
        expanded.add(sort === 1 ? "K" : String(sort - 1));
      }
      if (sort < 12) {
        expanded.add(String(sort + 1));
      }
    }
  });

  return [...expanded];
}

export async function matchEducationStandards(options: MatcherOptions): Promise<EducationStandardsMatchResult> {
  if (!options.vertex) {
    throw new GeminiRequestError("Vertex AI is not configured for Education Standards.", 503);
  }

  const model = options.model || "gemini-2.0-flash-001";
  const inference = await callVertexModel<ProductInferenceResult>(
    options.vertex,
    model,
    buildInferenceRequest(options.snapshot)
  );

  const frameworks = mergeFrameworkCandidates(inference, options.snapshot);
  const subjects = mergeSubjectCandidates(inference, options.snapshot);
  const grades = mergeGradeCandidates(inference, options.snapshot);

  const broadCandidates = await shortlistEducationStandards(options.db, {
    frameworks: frameworks.length ? frameworks : null,
    subjects: subjects.length ? subjects : null,
    grades: grades.length ? grades : null,
    limit: 250
  });

  const scoredCandidates = broadCandidates
    .map((candidate) => ({
      candidate,
      score: scoreCandidate(candidate, inference, options.snapshot)
    }))
    .sort((left, right) => right.score - left.score || left.candidate.standardCode.localeCompare(right.candidate.standardCode));

  const candidates = scoredCandidates.slice(0, 40).map((item) => item.candidate);

  if (!candidates.length) {
    return {
      inference: {
        frameworks,
        subjects,
        grades,
        skillTerms: dedupeStrings(inference.skill_terms),
        objectiveSummary: cleanValue(inference.objective_summary),
        resourceType: cleanValue(inference.resource_type) || null
      },
      matches: [],
      meta: {
        model,
        candidatesConsidered: broadCandidates.length,
        shortlistedCandidates: 0
      }
    };
  }

  const selected = await callVertexModel<CandidateSelectionResult>(
    options.vertex,
    model,
    buildSelectionRequest(options.snapshot, inference, candidates)
  );

  const allowedCodes = new Set(candidates.map((candidate) => candidate.standardCode));
  const selectedCodes = dedupeStrings(selected.selected_codes).filter((code) => allowedCodes.has(code));
  const selectedMatches = candidates
    .filter((candidate) => selectedCodes.includes(candidate.standardCode))
    .slice(0, 5)
    .map((candidate) => ({
      standardCode: candidate.standardCode,
      frameworkCode: candidate.frameworkCode,
      subjectCode: candidate.subjectCode,
      gradeCode: candidate.gradeCode,
      groupLabel: candidate.groupLabel,
      domainLabel: candidate.domainLabel,
      statement: candidate.statement
    }));

  return {
    inference: {
      frameworks,
      subjects,
      grades,
      skillTerms: dedupeStrings(inference.skill_terms),
      objectiveSummary: cleanValue(inference.objective_summary),
      resourceType: cleanValue(inference.resource_type) || null
    },
    matches: selectedMatches,
    meta: {
      model,
      candidatesConsidered: broadCandidates.length,
      shortlistedCandidates: candidates.length
    }
  };
}
