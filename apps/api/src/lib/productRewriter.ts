import { analyzeProductSeoHealth, type ProductSeoAuditSnapshot } from "./seoAuditor";

type RewriteOptions = {
  apiKey: string;
  model?: string;
  snapshot: ProductSeoAuditSnapshot;
  primaryKeyword?: string | null;
  db: D1Database;
  userId: string;
};

type GeminiGenerateContentResponse = {
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

type RawRewriteResponse = {
  titleOptions?: Array<{
    value?: string;
    rationale?: string;
  }>;
  descriptionOptions?: Array<{
    value?: string;
    rationale?: string;
  }>;
};

type RewriteValidation = {
  label: string;
  passed: boolean;
  detail: string;
};

type RewriteCandidate = {
  value: string;
  rationale: string;
  seoHealthScore: number;
  scoreDelta: number;
  validations: RewriteValidation[];
};

export type ProductRewriteResult = {
  primaryKeyword: string | null;
  titleOptions: RewriteCandidate[];
  descriptionOptions: RewriteCandidate[];
  note: string;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePromptValue(value: string | null | undefined) {
  return (value ?? "").trim() || "Not available";
}

function countPhraseOccurrences(text: string, phrase: string) {
  const normalizedText = normalizeText(text);
  const normalizedPhrase = normalizeText(phrase);

  if (!normalizedText || !normalizedPhrase) {
    return 0;
  }

  let count = 0;
  let index = 0;
  while ((index = normalizedText.indexOf(normalizedPhrase, index)) !== -1) {
    const before = index === 0 ? " " : normalizedText[index - 1] ?? " ";
    const afterIndex = index + normalizedPhrase.length;
    const after = afterIndex >= normalizedText.length ? " " : normalizedText[afterIndex] ?? " ";
    const hasBoundaryBefore = before === " " || before === "-";
    const hasBoundaryAfter = after === " " || after === "-";

    if (hasBoundaryBefore && hasBoundaryAfter) {
      count += 1;
    }

    index += normalizedPhrase.length;
  }

  return count;
}

function countWords(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).filter(Boolean).length;
}

function dedupeCandidates(items: Array<{ value?: string; rationale?: string }>, limit: number) {
  const seen = new Set<string>();
  const output: Array<{ value: string; rationale: string }> = [];

  for (const item of items) {
    const value = String(item?.value ?? "").replace(/\s+/g, " ").trim();
    const rationale = String(item?.rationale ?? "").replace(/\s+/g, " ").trim();
    if (!value) {
      continue;
    }

    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push({
      value,
      rationale: rationale || "Generated to better align the product copy with the current SEO Health findings."
    });

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function getCriterionMessage(
  criteria: Awaited<ReturnType<typeof analyzeProductSeoHealth>>["health"]["criteria"],
  id: string,
  fallback: string
) {
  return criteria.find((criterion) => criterion.id === id)?.message ?? fallback;
}

function buildTitleValidations(
  value: string,
  keyword: string | null,
  criteria: Awaited<ReturnType<typeof analyzeProductSeoHealth>>["health"]["criteria"]
) {
  const validations: RewriteValidation[] = [];
  const titleLength = value.trim().length;
  const titleLengthPassed = titleLength >= 60 && titleLength <= 80;

  validations.push({
    label: "Title length",
    passed: titleLengthPassed,
    detail: getCriterionMessage(criteria, "title-length", `The title is ${titleLength} characters long.`)
  });

  if (keyword) {
    const mentions = countPhraseOccurrences(value, keyword);
    validations.push({
      label: "Primary keyword included",
      passed: mentions >= 1,
      detail:
        mentions >= 1
          ? `The title includes "${keyword}" in a direct, searchable way.`
          : `The title does not reference "${keyword}" yet.`
    });
    validations.push({
      label: "No keyword stuffing",
      passed: mentions <= 1,
      detail:
        mentions <= 1
          ? `The title uses "${keyword}" without obvious repetition.`
          : `The title repeats "${keyword}" too often.`
    });
  }

  return validations;
}

function buildDescriptionValidations(
  value: string,
  keyword: string | null,
  criteria: Awaited<ReturnType<typeof analyzeProductSeoHealth>>["health"]["criteria"]
) {
  const validations: RewriteValidation[] = [];
  const wordCount = countWords(value);
  const lengthPassed = wordCount >= 300;

  validations.push({
    label: "Description length",
    passed: lengthPassed,
    detail: getCriterionMessage(criteria, "description-length", `The description is ${wordCount} words long.`)
  });

  if (keyword) {
    const mentions = countPhraseOccurrences(value, keyword);
    validations.push({
      label: "Primary keyword included",
      passed: mentions >= 1,
      detail:
        mentions >= 1
          ? `The description references "${keyword}" naturally.`
          : `The description does not clearly reference "${keyword}" yet.`
    });
  }

  return validations;
}

async function analyzeTitleCandidate(
  snapshot: ProductSeoAuditSnapshot,
  db: D1Database,
  userId: string,
  candidate: { value: string; rationale: string },
  primaryKeyword: string | null,
  baseScore: number
) {
  const analysis = await analyzeProductSeoHealth(
    {
      ...snapshot,
      title: candidate.value
    },
    { db, userId }
  );

  return {
    value: candidate.value,
    rationale: candidate.rationale,
    seoHealthScore: analysis.health.seoHealthScore,
    scoreDelta: analysis.health.seoHealthScore - baseScore,
    validations: buildTitleValidations(candidate.value, primaryKeyword, analysis.health.criteria)
  };
}

async function analyzeDescriptionCandidate(
  snapshot: ProductSeoAuditSnapshot,
  db: D1Database,
  userId: string,
  candidate: { value: string; rationale: string },
  primaryKeyword: string | null,
  baseScore: number
) {
  const analysis = await analyzeProductSeoHealth(
    {
      ...snapshot,
      descriptionText: candidate.value,
      descriptionWordCount: countWords(candidate.value)
    },
    { db, userId }
  );

  return {
    value: candidate.value,
    rationale: candidate.rationale,
    seoHealthScore: analysis.health.seoHealthScore,
    scoreDelta: analysis.health.seoHealthScore - baseScore,
    validations: buildDescriptionValidations(candidate.value, primaryKeyword, analysis.health.criteria)
  };
}

function buildSystemInstruction() {
  return [
    "You are an expert TPT product SEO and conversion copywriter for Knowlense.",
    "Rewrite product titles and descriptions for Teachers Pay Teachers listings.",
    "Follow these rules strictly:",
    "1. Never invent product facts, file types, grade levels, subjects, page counts, bundle inclusion, pricing, preview availability, reviews, discounts, or videos.",
    "2. Keep the copy accurate to the provided product data only.",
    "3. Write for both search discoverability and buyer conversion.",
    "4. For titles, keep them natural, specific, and within Teachers Pay Teachers style expectations.",
    "5. For descriptions, keep them scannable, persuasive, and keyword-aware without sounding stuffed.",
    "6. Return JSON only."
  ].join("\n");
}

function buildUserPrompt(snapshot: ProductSeoAuditSnapshot, primaryKeyword: string | null) {
  const metadata = [
    `Current title: ${escapePromptValue(snapshot.title)}`,
    `Current description: ${escapePromptValue(snapshot.descriptionText)}`,
    `Seller name: ${escapePromptValue(snapshot.sellerName)}`,
    `Primary keyword: ${escapePromptValue(primaryKeyword)}`,
    `Grades: ${snapshot.grades.length ? snapshot.grades.join(", ") : "Not available"}`,
    `Subjects: ${snapshot.subjects?.length ? snapshot.subjects.join(", ") : "Not available"}`,
    `Tags: ${snapshot.tags.length ? snapshot.tags.join(", ") : "Not available"}`,
    `Resource type: ${escapePromptValue(snapshot.resourceType)}`,
    `Pages: ${escapePromptValue(snapshot.pagesValue)}`,
    `Has preview: ${snapshot.hasPreview ? "Yes" : "No"}`,
    `Has video: ${snapshot.media?.hasVideo ? "Yes" : "No"}`,
    `Image count: ${snapshot.media?.imageCount ?? 0}`,
    `Is bundle product: ${snapshot.isBundleProduct ? "Yes" : "No"}`
  ];

  return [
    "Create better product copy for this TPT listing.",
    "Return 3 title options and 2 description options.",
    "Title requirements:",
    "- Aim for 60 to 80 characters.",
    primaryKeyword ? `- Include the exact primary keyword "${primaryKeyword}" once when it fits naturally.` : "- Improve search clarity even without a fixed keyword.",
    "- Avoid keyword stuffing and awkward punctuation.",
    "Description requirements:",
    "- Aim for at least 300 words.",
    primaryKeyword ? `- Include the exact primary keyword "${primaryKeyword}" naturally near the opening.` : "- Keep the opening search-friendly and clear.",
    "- Use a clean structure that helps conversion.",
    "- Do not use markdown, bullets are allowed as plain text lines if helpful.",
    "Product data:",
    ...metadata
  ].join("\n");
}

async function callGemini(options: RewriteOptions) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(options.model || "gemini-2.5-flash")}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": options.apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: buildSystemInstruction()
            }
          ]
        },
        contents: [
          {
            parts: [
              {
                text: buildUserPrompt(options.snapshot, options.primaryKeyword?.trim() || null)
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
          responseJsonSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              titleOptions: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    value: { type: "string" },
                    rationale: { type: "string" }
                  },
                  required: ["value", "rationale"]
                }
              },
              descriptionOptions: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    value: { type: "string" },
                    rationale: { type: "string" }
                  },
                  required: ["value", "rationale"]
                }
              }
            },
            required: ["titleOptions", "descriptionOptions"]
          }
        }
      })
    }
  );

  const payload = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok) {
    throw new Error("Knowlense could not reach Gemini for this rewrite.");
  }

  if (payload?.promptFeedback?.blockReason) {
    throw new Error("Gemini blocked this rewrite request.");
  }

  const rawText = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!rawText) {
    throw new Error("Gemini did not return rewrite content.");
  }

  const parsed = JSON.parse(rawText) as RawRewriteResponse;
  return {
    titleOptions: dedupeCandidates(parsed.titleOptions ?? [], 3),
    descriptionOptions: dedupeCandidates(parsed.descriptionOptions ?? [], 2)
  };
}

export async function generateProductRewrite(options: RewriteOptions): Promise<ProductRewriteResult> {
  const primaryKeyword = options.primaryKeyword?.trim() || null;
  const baselineAnalysis = await analyzeProductSeoHealth(options.snapshot, {
    db: options.db,
    userId: options.userId
  });
  const baselineScore = baselineAnalysis.health.seoHealthScore;
  const rawResponse = await callGemini(options);

  const [titleOptions, descriptionOptions] = await Promise.all([
    Promise.all(
      rawResponse.titleOptions.map((candidate) =>
        analyzeTitleCandidate(options.snapshot, options.db, options.userId, candidate, primaryKeyword, baselineScore)
      )
    ),
    Promise.all(
      rawResponse.descriptionOptions.map((candidate) =>
        analyzeDescriptionCandidate(options.snapshot, options.db, options.userId, candidate, primaryKeyword, baselineScore)
      )
    )
  ]);

  if (!titleOptions.length && !descriptionOptions.length) {
    throw new Error("Knowlense could not build rewrite options from Gemini.");
  }

  return {
    primaryKeyword,
    titleOptions,
    descriptionOptions,
    note: "Knowlense rewrites are generated with Gemini and then checked again against the current SEO Health rules before they are shown in the extension."
  };
}
