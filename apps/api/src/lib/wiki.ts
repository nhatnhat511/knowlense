const WIKIPEDIA_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/";

type WikiResult = {
  term: string;
  extract: string;
  pageurl: string;
};

type WikipediaSummaryResponse = {
  extract?: string;
  content_urls?: {
    desktop?: {
      page?: string;
    };
    mobile?: {
      page?: string;
    };
  };
};

const usageMemory = new Map<string, number>();
const SUMMARY_CHARACTER_LIMIT = 420;

export async function getWikiSummary(term: string, cache?: KVNamespace) {
  const normalizedTerm = String(term || "").trim();

  if (!normalizedTerm) {
    throw new Error("The term query parameter is required.");
  }

  const cacheKey = `wiki:${normalizedTerm.toLowerCase()}`;

  if (cache) {
    const cached = await cache.get<WikiResult>(cacheKey, "json");
    if (cached) {
      return cached;
    }
  }

  const response = await fetch(`${WIKIPEDIA_SUMMARY_URL}${encodeURIComponent(normalizedTerm)}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (response.status === 404) {
    throw new Error(`No Wikipedia result found for "${normalizedTerm}".`);
  }

  if (!response.ok) {
    throw new Error(`Wikipedia request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as WikipediaSummaryResponse;
  const extract = buildCompleteSummary(data.extract || "", SUMMARY_CHARACTER_LIMIT);

  if (!extract) {
    throw new Error(`No summary is available for "${normalizedTerm}".`);
  }

  const result: WikiResult = {
    term: normalizedTerm,
    extract,
    pageurl: data.content_urls?.desktop?.page || ""
  };

  if (cache) {
    await cache.put(cacheKey, JSON.stringify(result), {
      expirationTtl: 60 * 60 * 24
    });
  }

  return result;
}

export function trimToTwoSentences(text: string) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const sentences = normalized.match(/[^.!?]+[.!?]+/g) || [normalized];
  return sentences.slice(0, 2).join(" ").trim();
}

export function buildCompleteSummary(text: string, limit = SUMMARY_CHARACTER_LIMIT) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "";
  }

  const twoSentenceSummary = trimToTwoSentences(normalized);
  if (twoSentenceSummary.length <= limit) {
    return cleanSentenceEnding(twoSentenceSummary);
  }

  const candidate = twoSentenceSummary.slice(0, limit);
  const lastSentenceBoundary = Math.max(
    candidate.lastIndexOf("."),
    candidate.lastIndexOf("!"),
    candidate.lastIndexOf("?")
  );

  if (lastSentenceBoundary > Math.floor(limit * 0.45)) {
    return cleanSentenceEnding(candidate.slice(0, lastSentenceBoundary + 1));
  }

  const lastWordBoundary = candidate.lastIndexOf(" ");
  const safeSlice = lastWordBoundary > 0 ? candidate.slice(0, lastWordBoundary) : candidate;

  return cleanSentenceEnding(safeSlice);
}

function cleanSentenceEnding(text: string) {
  let cleaned = String(text || "").replace(/\s+/g, " ").trim();
  cleaned = cleaned.replace(/\.{3,}\s*$/, "");
  cleaned = cleaned.replace(/[,;:]\s*$/, "");

  if (!cleaned) {
    return "";
  }

  if (!/[.!?]$/.test(cleaned)) {
    cleaned += ".";
  }

  return cleaned;
}

export async function incrementDailyUsage(userId: string, key: string, cache?: KVNamespace) {
  if (cache) {
    const current = Number((await cache.get(key)) || "0");
    const next = current + 1;
    await cache.put(key, String(next), {
      expirationTtl: 60 * 60 * 24
    });
    return next;
  }

  const current = usageMemory.get(key) || 0;
  const next = current + 1;
  usageMemory.set(key, next);
  return next;
}
