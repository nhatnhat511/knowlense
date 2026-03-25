const ANALYZE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ANALYZE_CACHE_VERSION = "v6";
const OPEN_SEARCH_TIMEOUT_MS = 2500;
const SUMMARY_TIMEOUT_MS = 3000;
const MAX_CANDIDATES = 3;
const ENTITY_THRESHOLD = 0.6;

const memoryCache = new Map<string, { expiresAt: number; value: AnalyzeResult }>();

type OpenSearchResponse = [string, string[], string[], string[]];

type WikiSummaryResponse = {
  title?: string;
  description?: string;
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
};

type CandidateScore = {
  candidateTitle: string;
  title: string;
  description: string;
  extract: string;
  url: string;
  entityType: string;
  classificationScore: number;
  intentAlignmentScore: number;
  finalScore: number;
  titleScore: number;
  contextScore: number;
  qualityScore: number;
  penaltyScore: number;
  error?: string;
};

export type AnalyzeResult =
  | {
      type: "entity";
      title: string;
      description: string;
      extract: string;
      url: string;
      debug?: AnalyzeDebugPayload;
    }
  | {
      type: "common_word";
      debug?: AnalyzeDebugPayload;
    };

export type AnalyzeDebugPayload = {
  text: string;
  context: string;
  threshold: number;
  error?: string;
  candidates: Array<{
    candidateTitle: string;
    title: string;
    description: string;
    entityType: string;
    classificationScore: number;
    intentAlignmentScore: number;
    finalScore: number;
    titleScore: number;
    contextScore: number;
    qualityScore: number;
    penaltyScore: number;
    url: string;
    error?: string;
  }>;
};

export async function analyzeEntity(
  input: { text?: string; context?: string },
  kv?: KVNamespace,
  options?: { debug?: boolean }
): Promise<AnalyzeResult> {
  const text = normalizeText(input.text || "");
  const context = normalizeText(input.context || "");
  const debug = Boolean(options?.debug);

  if (!text) {
    return { type: "common_word" };
  }

  const cacheKey = await createCacheKey(text, context);
  if (!debug) {
    const cached = await readCache(cacheKey, kv);

    if (cached) {
      return cached;
    }
  }

  try {
    const titles = await fetchCandidates(text);

    if (titles.length === 0) {
      const result: AnalyzeResult = { type: "common_word" };
      await writeCache(cacheKey, result, kv);
      return result;
    }

    let bestCandidate: CandidateScore | null = null;
    const scoredCandidates: CandidateScore[] = [];

    for (const candidateTitle of titles) {
      try {
        const summary = await fetchCandidateSummary(candidateTitle);

        if (!summary) {
          if (debug) {
            scoredCandidates.push({
              candidateTitle,
              title: candidateTitle,
              description: "",
              extract: "",
              url: "",
              entityType: "unknown",
              classificationScore: 0,
              intentAlignmentScore: 0,
              finalScore: 0,
              titleScore: 0,
              contextScore: 0,
              qualityScore: 0,
              penaltyScore: 0
            });
          }
          continue;
        }

        const scored = computeScore({
          inputText: text,
          context,
          candidateTitle,
          title: summary.title,
          description: summary.description,
          extract: summary.extract,
          url: summary.url
        });
        scoredCandidates.push(scored);

        if (!bestCandidate || scored.finalScore > bestCandidate.finalScore) {
          bestCandidate = scored;
        }
      } catch (error) {
        if (debug) {
          scoredCandidates.push({
            candidateTitle,
            title: candidateTitle,
            description: "",
            extract: "",
            url: "",
            entityType: "error",
            classificationScore: 0,
            intentAlignmentScore: 0,
            finalScore: 0,
            titleScore: 0,
            contextScore: 0,
            qualityScore: 0,
            penaltyScore: 0,
            error: error instanceof Error ? error.message : String(error)
          });
        }
        continue;
      }
    }

    const debugPayload: AnalyzeDebugPayload | undefined = debug
      ? {
          text,
          context,
          threshold: ENTITY_THRESHOLD,
          candidates: scoredCandidates.map((candidate) => ({
            candidateTitle: candidate.candidateTitle,
            title: candidate.title,
            description: candidate.description,
            entityType: candidate.entityType,
            classificationScore: candidate.classificationScore,
            intentAlignmentScore: candidate.intentAlignmentScore,
            finalScore: candidate.finalScore,
            titleScore: candidate.titleScore,
            contextScore: candidate.contextScore,
            qualityScore: candidate.qualityScore,
            penaltyScore: candidate.penaltyScore,
            url: candidate.url
          }))
        }
      : undefined;

    const shouldReturnEntity =
      bestCandidate !== null &&
      bestCandidate.finalScore >= ENTITY_THRESHOLD &&
      !shouldRejectAsCommonWord(text, context, bestCandidate);

    let result: AnalyzeResult;
    if (shouldReturnEntity && bestCandidate) {
      result = {
        type: "entity",
        title: bestCandidate.title,
        description: bestCandidate.description,
        extract: bestCandidate.extract,
        url: bestCandidate.url,
        debug: debugPayload
      };
    } else {
      result = { type: "common_word", debug: debugPayload };
    }

    if (!debug) {
      await writeCache(cacheKey, result, kv);
    }
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("analyzeEntity failed", {
      text,
      error: errorMessage
    });

    const result: AnalyzeResult = debug
      ? {
          type: "common_word",
          debug: {
            text,
            context,
            threshold: ENTITY_THRESHOLD,
            error: errorMessage,
            candidates: []
          }
        }
      : { type: "common_word" };
    if (!debug) {
      await writeCache(cacheKey, result, kv);
    }
    return result;
  }
}

export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function levenshteinSimilarity(a: string, b: string): number {
  const left = normalizeText(a).toLowerCase();
  const right = normalizeText(b).toLowerCase();

  if (!left && !right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j < cols; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[rows - 1][cols - 1];
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 1 : 1 - distance / longest;
}

export function keywordOverlapScore(context: string, extract: string): number {
  const contextTokens = tokenize(context);
  const extractTokens = tokenize(extract);

  if (contextTokens.size === 0 || extractTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of contextTokens) {
    if (extractTokens.has(token)) {
      overlap += 1;
    }
  }

  return Math.min(1, overlap / Math.max(1, contextTokens.size));
}

export function computeScore(input: {
  inputText: string;
  context: string;
  candidateTitle: string;
  title: string;
  description: string;
  extract: string;
  url: string;
}): CandidateScore {
  const intent = assessQueryIntent(input.inputText, input.context);
  const classification = classifyCandidateType(input.title, input.description, input.extract);
  const intentAlignmentScore = computeIntentAlignmentScore(intent, classification.type);
  const titleScore = computeTitleScore(input.inputText, input.candidateTitle, input.title);
  const contextScore = computeContextScore(input.context, input.title, input.description, input.extract);
  const penaltyScore = computePenaltyScore(
    input.inputText,
    input.context,
    input.candidateTitle,
    input.title,
    input.description,
    input.extract
  );

  let qualityScore = 0;
  if (input.extract.length > 100) {
    qualityScore += 0.6;
  } else if (input.extract.length > 50) {
    qualityScore += 0.35;
  }

  if (input.title.split(/\s+/).length > 1) {
    qualityScore += 0.4;
  } else {
    qualityScore += 0.15;
  }

  qualityScore = Math.min(1, qualityScore);

  let finalScore =
    titleScore * 0.28 +
    contextScore * 0.27 +
    qualityScore * 0.15 +
    classification.score * 0.2 +
    intentAlignmentScore * 0.2 -
    penaltyScore;

  if (
    isExactAliasMatch(input.inputText, input.candidateTitle) &&
    contextScore >= 0.2 &&
    qualityScore >= 0.35 &&
    canUseExactAliasBoost(input.inputText, input.context, input.candidateTitle, input.title, input.description)
  ) {
    finalScore = Math.max(finalScore, 0.8);
  }

  if (/\(disambiguation\)/i.test(input.title)) {
    finalScore -= 0.45;
  }

  if (!classification.allowed || intentAlignmentScore < 0.25) {
    finalScore = Math.min(finalScore, 0.49);
  }

  finalScore = Math.max(0, Math.min(1, finalScore));

  return {
    candidateTitle: input.candidateTitle,
    title: input.title,
    description: input.description,
    extract: input.extract,
    url: input.url,
    entityType: classification.type,
    classificationScore: classification.score,
    intentAlignmentScore,
    finalScore,
    titleScore,
    contextScore,
    qualityScore,
    penaltyScore
  };
}

export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Api-User-Agent": "Knowlense/1.0 (https://knowlense.com)",
        "User-Agent": "Knowlense/1.0 (https://knowlense.com)"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCandidates(text: string): Promise<string[]> {
  const url =
    "https://en.wikipedia.org/w/api.php?action=opensearch&format=json&limit=3&search=" +
    encodeURIComponent(text);
  const response = await fetchWithTimeout(url, OPEN_SEARCH_TIMEOUT_MS);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`OpenSearch request failed with ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenSearchResponse;
  return Array.isArray(data?.[1]) ? data[1].slice(0, MAX_CANDIDATES).filter(Boolean) : [];
}

async function fetchCandidateSummary(title: string) {
  const primary = await fetchRestSummary(title);
  if (primary) {
    return primary;
  }

  return fetchQuerySummary(title);
}

function normalizeSummary(text: string): string {
  const normalized = normalizeText(text).replace(/\.\.\.+$/g, "").trim();

  if (!normalized) {
    return "";
  }

  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "with"
  ]);

  return new Set(
    normalizeText(text)
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !stopWords.has(token))
  );
}

async function createCacheKey(text: string, context: string): Promise<string> {
  const payload = `${ANALYZE_CACHE_VERSION}::${text}::${context}`;
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `analyze:${hash}`;
}

async function readCache(key: string, kv?: KVNamespace): Promise<AnalyzeResult | null> {
  const memoryEntry = memoryCache.get(key);

  if (memoryEntry && memoryEntry.expiresAt > Date.now()) {
    return memoryEntry.value;
  }

  if (memoryEntry) {
    memoryCache.delete(key);
  }

  if (!kv) {
    return null;
  }

  const cached = await kv.get(key, "json");

  if (!cached || typeof cached !== "object" || !("type" in cached)) {
    return null;
  }

  const value = cached as AnalyzeResult;
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ANALYZE_CACHE_TTL_MS
  });

  return value;
}

async function writeCache(key: string, value: AnalyzeResult, kv?: KVNamespace) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ANALYZE_CACHE_TTL_MS
  });

  if (!kv) {
    return;
  }

  await kv.put(key, JSON.stringify(value), {
    expirationTtl: ANALYZE_CACHE_TTL_MS / 1000
  });
}

function computeTitleScore(inputText: string, candidateTitle: string, title: string): number {
  const normalizedInput = normalizeForMatch(inputText);
  const normalizedCandidateTitle = normalizeForMatch(candidateTitle);
  const normalizedTitle = normalizeForMatch(title);
  const simplifiedTitle = simplifyEntityTitle(title);
  const normalizedSimplifiedTitle = normalizeForMatch(simplifiedTitle);
  const simplifiedCandidateTitle = simplifyEntityTitle(candidateTitle);
  const normalizedSimplifiedCandidateTitle = normalizeForMatch(simplifiedCandidateTitle);
  const titleAcronym = extractAcronym(title);
  const candidateAcronym = extractAcronym(candidateTitle);
  const inputAcronym = extractAcronym(inputText);

  let score = Math.max(
    levenshteinSimilarity(normalizedInput, normalizedCandidateTitle),
    levenshteinSimilarity(normalizedInput, normalizedSimplifiedCandidateTitle),
    levenshteinSimilarity(normalizedInput, normalizedTitle),
    levenshteinSimilarity(normalizedInput, normalizedSimplifiedTitle)
  );

  if (normalizedInput && normalizedInput === normalizedCandidateTitle) {
    score = Math.max(score, 1);
  }

  if (normalizedInput && normalizedInput === normalizedSimplifiedCandidateTitle) {
    score = Math.max(score, 0.98);
  }

  if (normalizedInput && normalizedInput === normalizedTitle) {
    score = Math.max(score, 1);
  }

  if (normalizedInput && normalizedInput === normalizedSimplifiedTitle) {
    score = Math.max(score, 0.97);
  }

  if (normalizedTitle.startsWith(`${normalizedInput} `) || normalizedTitle.includes(` ${normalizedInput} `)) {
    score = Math.max(score, 0.92);
  }

  if (
    normalizedCandidateTitle.startsWith(`${normalizedInput} `) ||
    normalizedCandidateTitle.includes(` ${normalizedInput} `)
  ) {
    score = Math.max(score, 0.95);
  }

  if (titleAcronym && normalizedInput === titleAcronym) {
    score = Math.max(score, 0.98);
  }

  if (candidateAcronym && normalizedInput === candidateAcronym) {
    score = Math.max(score, 1);
  }

  if (titleAcronym && inputAcronym && titleAcronym === inputAcronym) {
    score = Math.max(score, 0.96);
  }

  if (candidateAcronym && inputAcronym && candidateAcronym === inputAcronym) {
    score = Math.max(score, 0.98);
  }

  return Math.min(1, score);
}

function computeContextScore(context: string, title: string, description: string, extract: string): number {
  const haystack = `${title} ${description} ${extract}`;
  const baseScore = keywordOverlapScore(context, haystack);
  const contextTokens = tokenize(context);
  const haystackTokens = tokenize(haystack);

  let score = baseScore;

  const titleTokens = normalizeForMatch(simplifyEntityTitle(title))
    .split(/\s+/)
    .filter(Boolean);

  if (titleTokens.some((token) => contextTokens.has(token))) {
    score += 0.15;
  }

  const contextHints = [
    "macbook",
    "iphone",
    "ipad",
    "ios",
    "software",
    "browser",
    "startup",
    "subscription",
    "product",
    "released",
    "launch",
    "technology",
    "tech",
    "platform",
    "cloud"
  ];

  const entityHints = [
    "company",
    "software",
    "service",
    "technology",
    "business",
    "corporation",
    "brand",
    "platform",
    "concept",
    "term"
  ];

  const hasContextHint = contextHints.some((hint) => contextTokens.has(hint));
  const hasEntityHint = entityHints.some((hint) => haystackTokens.has(hint));

  if (hasContextHint && hasEntityHint) {
    score += 0.22;
  }

  const titleAcronym = extractAcronym(title);
  const contextNormalized = normalizeForMatch(context);
  if (titleAcronym && contextNormalized.includes(titleAcronym)) {
    score += 0.12;
  }

  return Math.min(1, score);
}

function normalizeForMatch(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function simplifyEntityTitle(text: string): string {
  return normalizeText(text)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAcronym(text: string): string {
  const words = normalizeText(text)
    .split(/[\s-]+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);

  if (words.length === 1) {
    const value = words[0];
    return /^[A-Z0-9]{2,}$/i.test(value) && value.length <= 6 ? value.toLowerCase() : "";
  }

  return words
    .filter((word) => word.length > 0)
    .map((word) => word[0])
    .join("")
    .toLowerCase();
}

function isExactAliasMatch(inputText: string, candidateTitle: string): boolean {
  const normalizedInput = normalizeForMatch(inputText);
  const aliases = [
    normalizeForMatch(candidateTitle),
    normalizeForMatch(simplifyEntityTitle(candidateTitle)),
    extractAcronym(candidateTitle)
  ].filter(Boolean);

  return aliases.includes(normalizedInput);
}

function computePenaltyScore(
  inputText: string,
  context: string,
  candidateTitle: string,
  resolvedTitle: string,
  description = "",
  extract = ""
): number {
  const normalizedInput = normalizeForMatch(inputText);
  const normalizedCandidate = normalizeForMatch(candidateTitle);
  const normalizedResolved = normalizeForMatch(resolvedTitle);
  const normalizedContext = normalizeForMatch(context);
  let penalty = 0;

  const candidateRemainder = getTitleRemainder(normalizedInput, normalizedCandidate);
  const resolvedRemainder = getTitleRemainder(normalizedInput, normalizedResolved);
  const remainder = candidateRemainder || resolvedRemainder;

  if (normalizedInput && remainder) {
    penalty += 0.16;

    const remainderTokens = remainder.split(/\s+/).filter(Boolean);
    const contextMentionsRemainder = remainderTokens.some(
      (token) => token.length > 2 && normalizedContext.includes(token)
    );

    if (!contextMentionsRemainder) {
      penalty += 0.1;
    }
  }

  if (/\b(v|versus)\b/.test(normalizedCandidate) || /\b(case|lawsuit|litigation)\b/.test(normalizedResolved)) {
    penalty += 0.12;
  }

  if (/\b(advertising|campaign|history|discography|filmography|list)\b/.test(normalizedCandidate)) {
    penalty += 0.12;
  }

  const singleWordInput = isSingleWord(normalizedInput);
  const singleWordTitle = isSingleWord(normalizedResolved) || isSingleWord(normalizedCandidate);
  const genericDescription = /topics referred to by the same term|may refer to|concept in/i.test(description) ||
    /\bmay refer to:\b/i.test(extract);
  const weakContext = !hasStrongEntityContext(context);

  if (singleWordInput && singleWordTitle && isMostlyLowercase(inputText) && weakContext) {
    penalty += 0.22;
  }

  if (genericDescription) {
    penalty += 0.28;
  }

  if (/^concept in\b/i.test(description) && weakContext) {
    penalty += 0.18;
  }

  return Math.min(0.45, penalty);
}

function getTitleRemainder(inputText: string, titleText: string): string {
  if (!inputText || !titleText || inputText === titleText) {
    return "";
  }

  if (titleText.startsWith(`${inputText} `)) {
    return titleText.slice(inputText.length).trim();
  }

  return "";
}

function canUseExactAliasBoost(
  inputText: string,
  context: string,
  candidateTitle: string,
  resolvedTitle: string,
  description: string
): boolean {
  if (!isMostlyLowercase(inputText)) {
    return true;
  }

  if (!isSingleWord(normalizeForMatch(inputText))) {
    return true;
  }

  if (!isSingleWord(normalizeForMatch(candidateTitle)) || !isSingleWord(normalizeForMatch(resolvedTitle))) {
    return true;
  }

  if (extractAcronym(candidateTitle) === normalizeForMatch(inputText)) {
    return true;
  }

  if (hasStrongEntityContext(context)) {
    return true;
  }

  if (/technology|company|country|city|programming language|software|framework|library/i.test(description)) {
    return true;
  }

  return false;
}

function hasStrongEntityContext(context: string): boolean {
  const normalizedContext = normalizeForMatch(context);
  const tokens = tokenize(context);

  const entityHints = [
    "released",
    "founded",
    "capital",
    "country",
    "city",
    "company",
    "corporation",
    "technology",
    "software",
    "framework",
    "library",
    "programming",
    "language",
    "scientist",
    "president",
    "ceo",
    "iphone",
    "macbook",
    "android",
    "aws",
    "cloud",
    "subscription",
    "browser"
  ];

  if (entityHints.some((hint) => tokens.has(hint) || normalizedContext.includes(hint))) {
    return true;
  }

  return /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(context);
}

type QueryIntent = {
  likelyEntity: boolean;
  isAcronym: boolean;
  isCapitalized: boolean;
  domains: Set<string>;
};

function assessQueryIntent(inputText: string, context: string): QueryIntent {
  const normalizedInput = normalizeText(inputText);
  const contextTokens = tokenize(context);
  const normalizedContext = normalizeForMatch(context);
  const compactInput = normalizedInput.replace(/[^A-Za-z0-9]/g, "");
  const isAcronym = /^[A-Z0-9]{2,6}$/.test(compactInput);
  const isCapitalized = /^[A-Z][\p{L}\p{N}.'-]*(?:\s+[A-Z][\p{L}\p{N}.'-]*)*$/u.test(normalizedInput);
  const domains = new Set<string>();

  const techBusinessHints = [
    "iphone",
    "ipad",
    "ios",
    "mac",
    "macbook",
    "podcast",
    "software",
    "startup",
    "platform",
    "cloud",
    "aws",
    "release",
    "released",
    "launch",
    "update",
    "company",
    "business",
    "revenue"
  ];
  const geographyHints = ["country", "city", "capital", "province", "state", "located", "border"];
  const personHints = ["born", "died", "actor", "scientist", "president", "ceo", "founder", "writer"];
  const technicalHints = ["framework", "library", "programming", "language", "protocol", "algorithm", "subscription"];

  if (techBusinessHints.some((hint) => contextTokens.has(hint) || normalizedContext.includes(hint))) {
    domains.add("tech");
    domains.add("business");
  }

  if (geographyHints.some((hint) => contextTokens.has(hint) || normalizedContext.includes(hint))) {
    domains.add("place");
  }

  if (personHints.some((hint) => contextTokens.has(hint) || normalizedContext.includes(hint))) {
    domains.add("person");
  }

  if (technicalHints.some((hint) => contextTokens.has(hint) || normalizedContext.includes(hint))) {
    domains.add("technical");
  }

  const likelyEntity =
    isAcronym ||
    isCapitalized ||
    domains.size > 0 ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/.test(context);

  return {
    likelyEntity,
    isAcronym,
    isCapitalized,
    domains
  };
}

function isSingleWord(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length === 1;
}

function isMostlyLowercase(text: string): boolean {
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (!letters) {
    return false;
  }

  return letters === letters.toLowerCase();
}

async function fetchRestSummary(title: string) {
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
  const response = await fetchWithTimeout(url, SUMMARY_TIMEOUT_MS).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const data = (await response.json()) as WikiSummaryResponse;
  const extract = normalizeSummary(data.extract || "");
  const resolvedTitle = normalizeText(data.title || title);
  const description = normalizeText(data.description || "");
  const pageUrl = data.content_urls?.desktop?.page || "";

  if (!resolvedTitle || !extract) {
    return null;
  }

  return {
    title: resolvedTitle,
    description,
    extract,
    url: pageUrl
  };
}

async function fetchQuerySummary(title: string) {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts|info&inprop=url&exintro=1&explaintext=1&redirects=1&titles=" +
    encodeURIComponent(title);
  const response = await fetchWithTimeout(url, SUMMARY_TIMEOUT_MS).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          extract?: string;
          fullurl?: string;
        }
      >;
    };
  };

  const page = Object.values(data.query?.pages || {}).find((entry) => entry?.title && entry?.extract);
  if (!page) {
    return null;
  }

  const extract = normalizeSummary(page.extract || "");
  const resolvedTitle = normalizeText(page.title || title);

  if (!resolvedTitle || !extract) {
    return null;
  }

  return {
    title: resolvedTitle,
    description: "",
    extract,
    url: page.fullurl || ""
  };
}

function shouldRejectAsCommonWord(inputText: string, context: string, candidate: CandidateScore): boolean {
  const normalizedInput = normalizeForMatch(inputText);
  const normalizedTitle = normalizeForMatch(candidate.title);
  const normalizedCandidateTitle = normalizeForMatch(candidate.candidateTitle);
  const normalizedSimplifiedTitle = normalizeForMatch(simplifyEntityTitle(candidate.title));
  const normalizedSimplifiedCandidateTitle = normalizeForMatch(simplifyEntityTitle(candidate.candidateTitle));
  const lowerCaseSingleWordInput = isSingleWord(normalizedInput) && isMostlyLowercase(inputText);
  const weakContext = !hasStrongEntityContext(context);
  const genericDescription = /topics referred to by the same term|may refer to|concept in/i.test(candidate.description);
  const genericExtract = /\bmay refer to:\b/i.test(candidate.extract);
  const singleWordTitle = isSingleWord(normalizedTitle);
  const acronymMatch = extractAcronym(candidate.title) === normalizedInput;
  const exactCandidateMatch =
    normalizedInput === normalizedTitle ||
    normalizedInput === normalizedCandidateTitle ||
    normalizedInput === normalizedSimplifiedTitle ||
    normalizedInput === normalizedSimplifiedCandidateTitle;
  const abstractOrDictionaryLike =
    /concept in|virtue|ethics|philosophy|moral|religion|quality|opposite of evil/i.test(candidate.description) ||
    /\bin most contexts\b|\bdenotes\b|\bthe concept of\b|\bopposite of evil\b|\bright and wrong\b/i.test(candidate.extract);
  const clearlyTypedEntity =
    /technology company|company|corporation|business|country|city|capital|programming language|software|framework|library|scientist|physicist|mathematician|actor|writer|device|operating system|browser|application|protocol|algorithm|service model/i.test(
      candidate.description
    );

  if (!lowerCaseSingleWordInput) {
    return candidate.classificationScore < 0.35;
  }

  if (acronymMatch) {
    return false;
  }

  if (weakContext && !exactCandidateMatch) {
    return true;
  }

  if (candidate.classificationScore < 0.45) {
    return true;
  }

  if (genericDescription || genericExtract) {
    return true;
  }

  if (weakContext && singleWordTitle && abstractOrDictionaryLike) {
    return true;
  }

  if (singleWordTitle && weakContext && candidate.contextScore < 0.65) {
    return true;
  }

  if (weakContext && singleWordTitle && !clearlyTypedEntity) {
    return true;
  }

  return false;
}

function classifyCandidateType(title: string, description: string, extract: string): {
  type: string;
  allowed: boolean;
  score: number;
} {
  const haystack = `${title} ${description} ${extract}`.toLowerCase();

  const denyPatterns: Array<{ type: string; regex: RegExp; score: number }> = [
    { type: "disambiguation", regex: /topics referred to by the same term|may refer to/i, score: 0.05 },
    {
      type: "generic_concept",
      regex: /concept in|virtue|ethics|philosophy|moral|religion|quality|opposite of evil|right and wrong/i,
      score: 0.05
    },
    {
      type: "common_noun",
      regex: /piece of furniture|verb|adjective|common noun|grammatical|word expressing|round, edible fruit|fruit of the apple tree|fruit tree|genus|cultivated worldwide/i,
      score: 0.05
    },
    { type: "list_or_history", regex: /history of|list of|discography|filmography|campaign|advertising/i, score: 0.2 }
  ];

  for (const pattern of denyPatterns) {
    if (pattern.regex.test(haystack)) {
      return {
        type: pattern.type,
        allowed: false,
        score: pattern.score
      };
    }
  }

  const allowPatterns: Array<{ type: string; regex: RegExp; score: number }> = [
    { type: "company", regex: /technology company|multinational technology company|company|corporation|business/i, score: 0.95 },
    { type: "software", regex: /software|programming language|framework|library|web framework|javascript library/i, score: 0.92 },
    { type: "place", regex: /country|city|capital|municipality|state|province|region/i, score: 0.9 },
    { type: "person", regex: /scientist|physicist|mathematician|artist|actor|writer|philosopher|person/i, score: 0.9 },
    { type: "product", regex: /device|smartphone|computer|product|operating system|browser|application/i, score: 0.86 },
    { type: "technical_term", regex: /cloud computing|protocol|algorithm|service model|technical term|engineering/i, score: 0.82 }
  ];

  for (const pattern of allowPatterns) {
    if (pattern.regex.test(haystack)) {
      return {
        type: pattern.type,
        allowed: true,
        score: pattern.score
      };
    }
  }

  if (extractAcronym(title)) {
    return {
      type: "acronym_candidate",
      allowed: true,
      score: 0.72
    };
  }

  if (!isSingleWord(normalizeForMatch(title))) {
    return {
      type: "named_entity_candidate",
      allowed: true,
      score: 0.68
    };
  }

  return {
    type: "generic_unknown",
    allowed: false,
    score: 0.25
  };
}

function computeIntentAlignmentScore(intent: QueryIntent, candidateType: string): number {
  if (!intent.likelyEntity) {
    return candidateType === "company" ||
      candidateType === "software" ||
      candidateType === "place" ||
      candidateType === "person" ||
      candidateType === "product" ||
      candidateType === "technical_term"
      ? 0.55
      : 0.15;
  }

  if (intent.isAcronym && (candidateType === "technical_term" || candidateType === "software")) {
    return 1;
  }

  if (intent.domains.has("tech") || intent.domains.has("business")) {
    if (candidateType === "company" || candidateType === "software" || candidateType === "product" || candidateType === "technical_term") {
      return 1;
    }

    if (candidateType === "person") {
      return 0.55;
    }

    return 0.05;
  }

  if (intent.domains.has("place")) {
    return candidateType === "place" ? 1 : 0.1;
  }

  if (intent.domains.has("person")) {
    return candidateType === "person" ? 1 : 0.15;
  }

  if (intent.domains.has("technical")) {
    return candidateType === "software" || candidateType === "technical_term" || candidateType === "product" ? 0.95 : 0.1;
  }

  if (intent.isCapitalized) {
    if (candidateType === "company" || candidateType === "place" || candidateType === "person" || candidateType === "product") {
      return 0.85;
    }

    if (candidateType === "software" || candidateType === "technical_term") {
      return 0.75;
    }
  }

  return candidateType === "generic_unknown" || candidateType === "common_noun" || candidateType === "generic_concept" ? 0.1 : 0.45;
}
