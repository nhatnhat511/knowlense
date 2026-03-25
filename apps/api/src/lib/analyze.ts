const ANALYZE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ANALYZE_CACHE_VERSION = "v2";
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
  title: string;
  description: string;
  extract: string;
  url: string;
  finalScore: number;
  titleScore: number;
  contextScore: number;
  qualityScore: number;
};

export type AnalyzeResult =
  | {
      type: "entity";
      title: string;
      description: string;
      extract: string;
      url: string;
    }
  | {
      type: "common_word";
    };

export async function analyzeEntity(
  input: { text?: string; context?: string },
  kv?: KVNamespace
): Promise<AnalyzeResult> {
  const text = normalizeText(input.text || "");
  const context = normalizeText(input.context || "");

  if (!text) {
    return { type: "common_word" };
  }

  const cacheKey = await createCacheKey(text, context);
  const cached = await readCache(cacheKey, kv);

  if (cached) {
    return cached;
  }

  try {
    const titles = await fetchCandidates(text);

    if (titles.length === 0) {
      const result: AnalyzeResult = { type: "common_word" };
      await writeCache(cacheKey, result, kv);
      return result;
    }

    let bestCandidate: CandidateScore | null = null;

    for (const title of titles) {
      const summary = await fetchCandidateSummary(title);

      if (!summary) {
        continue;
      }

      const scored = computeScore({
        inputText: text,
        context,
        title: summary.title,
        description: summary.description,
        extract: summary.extract,
        url: summary.url
      });

      if (!bestCandidate || scored.finalScore > bestCandidate.finalScore) {
        bestCandidate = scored;
      }
    }

    const result: AnalyzeResult =
      bestCandidate && bestCandidate.finalScore >= ENTITY_THRESHOLD
        ? {
            type: "entity",
            title: bestCandidate.title,
            description: bestCandidate.description,
            extract: bestCandidate.extract,
            url: bestCandidate.url
          }
        : { type: "common_word" };

    await writeCache(cacheKey, result, kv);
    return result;
  } catch (error) {
    console.error("analyzeEntity failed", {
      text,
      error: error instanceof Error ? error.message : String(error)
    });

    const result: AnalyzeResult = { type: "common_word" };
    await writeCache(cacheKey, result, kv);
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
  title: string;
  description: string;
  extract: string;
  url: string;
}): CandidateScore {
  const titleScore = computeTitleScore(input.inputText, input.title);
  const contextScore = computeContextScore(input.context, input.title, input.description, input.extract);

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

  let finalScore = titleScore * 0.4 + contextScore * 0.4 + qualityScore * 0.2;

  if (/\(disambiguation\)/i.test(input.title)) {
    finalScore -= 0.45;
  }

  finalScore = Math.max(0, Math.min(1, finalScore));

  return {
    title: input.title,
    description: input.description,
    extract: input.extract,
    url: input.url,
    finalScore,
    titleScore,
    contextScore,
    qualityScore
  };
}

export async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
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
    throw new Error(`OpenSearch request failed with ${response.status}`);
  }

  const data = (await response.json()) as OpenSearchResponse;
  return Array.isArray(data?.[1]) ? data[1].slice(0, MAX_CANDIDATES).filter(Boolean) : [];
}

async function fetchCandidateSummary(title: string) {
  const url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + encodeURIComponent(title);
  const response = await fetchWithTimeout(url, SUMMARY_TIMEOUT_MS);

  if (!response.ok) {
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

function computeTitleScore(inputText: string, title: string): number {
  const normalizedInput = normalizeForMatch(inputText);
  const normalizedTitle = normalizeForMatch(title);
  const simplifiedTitle = simplifyEntityTitle(title);
  const normalizedSimplifiedTitle = normalizeForMatch(simplifiedTitle);
  const titleAcronym = extractAcronym(title);
  const inputAcronym = extractAcronym(inputText);

  let score = Math.max(
    levenshteinSimilarity(normalizedInput, normalizedTitle),
    levenshteinSimilarity(normalizedInput, normalizedSimplifiedTitle)
  );

  if (normalizedInput && normalizedInput === normalizedTitle) {
    score = Math.max(score, 1);
  }

  if (normalizedInput && normalizedInput === normalizedSimplifiedTitle) {
    score = Math.max(score, 0.97);
  }

  if (normalizedTitle.startsWith(`${normalizedInput} `) || normalizedTitle.includes(` ${normalizedInput} `)) {
    score = Math.max(score, 0.92);
  }

  if (titleAcronym && normalizedInput === titleAcronym) {
    score = Math.max(score, 0.98);
  }

  if (titleAcronym && inputAcronym && titleAcronym === inputAcronym) {
    score = Math.max(score, 0.96);
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
