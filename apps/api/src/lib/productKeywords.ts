export type ProductKeywordSnapshot = {
  productId?: string | null;
  productUrl: string;
  title: string;
  descriptionExcerpt: string;
  grades: string[];
  tags: string[];
  resourceType?: string | null;
  subjects?: string[];
  seedKeywords?: string[];
  suggestedKeywords?: string[];
};

type RankCacheRow = {
  product_id: string;
  keyword_text: string;
  rank_position: number | null;
  result_page: number | null;
  status: "ranked" | "beyond_page_3";
  confidence: "high" | "medium" | "low";
  search_url: string;
  checked_at: string;
  expires_at: string;
};

type Candidate = {
  keyword: string;
  score: number;
  source: "seed" | "suggestion";
};

export type RankedKeyword = {
  keyword: string;
  score: number;
  source: "seed" | "suggestion";
  rankPosition: number;
  resultPage: number | null;
  status: "ranked" | "beyond_page_3";
  confidence: "high" | "medium" | "low";
  searchUrl: string;
  checkedAt: string;
};

export type ProductKeywordAnalysis = {
  product: {
    id: string | null;
    url: string;
    title: string;
  };
  summary: {
    generatedKeywords: number;
    checkedKeywords: number;
    rankedKeywords: number;
    bestRank: number;
    analyzedAt: string;
    cooldownMinutes: number;
    cacheHitCount: number;
    note: string;
  };
  keywords: RankedKeyword[];
};

type AnalyzeOptions = {
  db: D1Database;
  cooldownMinutes?: number;
  cacheHours?: number;
};

const TPT_BASE_URL = "https://www.teacherspayteachers.com";
const MAX_SEARCH_PAGES = 3;
const MAX_KEYWORDS = 20;
const DEFAULT_COOLDOWN_MINUTES = 30;
const DEFAULT_CACHE_HOURS = 24;
const NOT_FOUND_RANK = 74;
const STOP_WORDS = new Set([
  "a",
  "about",
  "all",
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
  "into",
  "is",
  "it",
  "its",
  "my",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
  "your"
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularize(token: string) {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }

  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 3) {
    return token.slice(0, -1);
  }

  return token;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => singularize(token.trim()))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function titleCaseKeyword(value: string) {
  return value
    .split(" ")
    .map((part) => (part.length <= 2 ? part.toUpperCase() : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
    .join(" ");
}

function isoFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function extractProductId(value: string) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

function buildSeedKeywords(snapshot: ProductKeywordSnapshot) {
  const titleTokens = tokenize(snapshot.title);
  const gradePhrases = snapshot.grades.map(normalizeText).filter(Boolean).slice(0, 4);
  const tagPhrases = snapshot.tags.map(normalizeText).filter(Boolean).slice(0, 6);
  const seeds = new Set<string>();

  for (let start = 0; start < titleTokens.length; start += 1) {
    for (let size = 1; size <= 4; size += 1) {
      const slice = titleTokens.slice(start, start + size);
      if (!slice.length) {
        continue;
      }

      const phrase = slice.join(" ");
      if (slice.length === size && phrase.length >= 4) {
        seeds.add(phrase);
      }
    }
  }

  const titleSeeds = [...seeds].slice(0, 10);
  titleSeeds.forEach((seed) => {
    gradePhrases.forEach((grade) => seeds.add(`${seed} ${grade}`));
    tagPhrases.forEach((tag) => seeds.add(`${seed} ${tag}`));
  });

  return [...seeds].slice(0, 26);
}

function buildCandidates(snapshot: ProductKeywordSnapshot) {
  const candidates = new Map<string, Candidate>();
  const seeds = (snapshot.seedKeywords?.length ? snapshot.seedKeywords : buildSeedKeywords(snapshot))
    .map(normalizeText)
    .filter(Boolean);
  const suggestions = (snapshot.suggestedKeywords ?? []).map(normalizeText).filter(Boolean);

  seeds.forEach((keyword, index) => {
    candidates.set(keyword, {
      keyword,
      score: Math.max(40 - index, 10),
      source: "seed"
    });
  });

  suggestions.forEach((keyword, index) => {
    const existing = candidates.get(keyword);
    const nextScore = Math.max(100 - index, 50);
    if (existing) {
      existing.score = Math.max(existing.score, nextScore);
      existing.source = "suggestion";
      return;
    }

    candidates.set(keyword, {
      keyword,
      score: nextScore,
      source: "suggestion"
    });
  });

  return [...candidates.values()]
    .sort((left, right) => {
      if (left.source !== right.source) {
        return left.source === "suggestion" ? -1 : 1;
      }

      return right.score - left.score;
    })
    .slice(0, MAX_KEYWORDS);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractProductUrlsFromSearchHtml(html: string) {
  const matches = [...html.matchAll(/href="([^"]*\/Product\/[^"]+)"/g)];
  const seen = new Set<string>();
  const urls: string[] = [];

  matches.forEach((match) => {
    const decoded = decodeHtmlEntities(match[1] ?? "");
    if (!decoded) {
      return;
    }

    const href = new URL(decoded, TPT_BASE_URL).toString();
    if (!seen.has(href)) {
      seen.add(href);
      urls.push(href);
    }
  });

  return urls;
}

async function readRankCache(db: D1Database, productId: string, keyword: string) {
  return db
    .prepare(
      `SELECT product_id, keyword_text, rank_position, result_page, status, confidence, search_url, checked_at, expires_at
       FROM product_keyword_rank_cache
       WHERE product_id = ?1
         AND keyword_text = ?2
         AND datetime(expires_at) > datetime('now')
       LIMIT 1`
    )
    .bind(productId, keyword)
    .first<RankCacheRow>();
}

async function persistRankCache(db: D1Database, productId: string, keyword: string, result: RankedKeyword, cacheHours: number) {
  await db
    .prepare(
      `INSERT INTO product_keyword_rank_cache (
         product_id,
         keyword_text,
         rank_position,
         result_page,
         status,
         confidence,
         search_url,
         checked_at,
         expires_at
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(product_id, keyword_text) DO UPDATE SET
         rank_position = excluded.rank_position,
         result_page = excluded.result_page,
         status = excluded.status,
         confidence = excluded.confidence,
         search_url = excluded.search_url,
         checked_at = excluded.checked_at,
         expires_at = excluded.expires_at`
    )
    .bind(
      productId,
      keyword,
      result.rankPosition,
      result.resultPage,
      result.status,
      result.confidence,
      result.searchUrl,
      result.checkedAt,
      isoFromNow(cacheHours * 60)
    )
    .run();
}

function buildSearchResult(payload: {
  keyword: string;
  score: number;
  source: "seed" | "suggestion";
  searchUrl: string;
  rankPosition: number;
  resultPage: number | null;
  status: "ranked" | "beyond_page_3";
  confidence: "high" | "medium" | "low";
  checkedAt: string;
}): RankedKeyword {
  return {
    keyword: titleCaseKeyword(payload.keyword),
    score: payload.score,
    source: payload.source,
    rankPosition: payload.rankPosition,
    resultPage: payload.resultPage,
    status: payload.status,
    confidence: payload.confidence,
    searchUrl: payload.searchUrl,
    checkedAt: payload.checkedAt
  };
}

async function lookupKeywordRank(
  db: D1Database,
  productId: string | null,
  candidate: Candidate,
  cacheHours: number
) {
  const searchUrl = `${TPT_BASE_URL}/browse?search=${encodeURIComponent(candidate.keyword)}`;

  if (!productId) {
    return buildSearchResult({
      keyword: candidate.keyword,
      score: candidate.score,
      source: candidate.source,
      searchUrl,
      rankPosition: NOT_FOUND_RANK,
      resultPage: null,
      status: "beyond_page_3",
      confidence: "low",
      checkedAt: new Date().toISOString()
    });
  }

  const cached = await readRankCache(db, productId, candidate.keyword);
  if (cached) {
    return buildSearchResult({
      keyword: candidate.keyword,
      score: candidate.score,
      source: candidate.source,
      searchUrl: cached.search_url,
      rankPosition: cached.rank_position ?? NOT_FOUND_RANK,
      resultPage: cached.result_page,
      status: cached.status,
      confidence: cached.confidence,
      checkedAt: cached.checked_at
    });
  }

  for (let page = 1; page <= MAX_SEARCH_PAGES; page += 1) {
    const pageUrl = page === 1 ? searchUrl : `${searchUrl}&page=${page}`;
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent": "KnowlenseBot/0.1"
      }
    });

    if (!response.ok) {
      continue;
    }

    const html = await response.text();
    const urls = extractProductUrlsFromSearchHtml(html);

    for (let index = 0; index < urls.length; index += 1) {
      if (extractProductId(urls[index]) === productId) {
        const ranked = buildSearchResult({
          keyword: candidate.keyword,
          score: candidate.score,
          source: candidate.source,
          searchUrl,
          rankPosition: (page - 1) * urls.length + index + 1,
          resultPage: page,
          status: "ranked",
          confidence: page === 1 ? "high" : "medium",
          checkedAt: new Date().toISOString()
        });

        await persistRankCache(db, productId, candidate.keyword, ranked, cacheHours);
        return ranked;
      }
    }
  }

  const missing = buildSearchResult({
    keyword: candidate.keyword,
    score: candidate.score,
    source: candidate.source,
    searchUrl,
    rankPosition: NOT_FOUND_RANK,
    resultPage: null,
    status: "beyond_page_3",
    confidence: "low",
    checkedAt: new Date().toISOString()
  });
  await persistRankCache(db, productId, candidate.keyword, missing, cacheHours);
  return missing;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function findRecentProductRun(db: D1Database, userId: string, productId: string | null, productUrl: string, cooldownMinutes = DEFAULT_COOLDOWN_MINUTES) {
  const row = await db
    .prepare(
      `SELECT id, product_id, product_url, title_text, summary_json, keywords_json, created_at
       FROM product_keyword_runs
       WHERE user_id = ?1
         AND (
           (?2 IS NOT NULL AND product_id = ?2)
           OR product_url = ?3
         )
         AND datetime(created_at) >= datetime('now', ?4)
       ORDER BY datetime(created_at) DESC
       LIMIT 1`
    )
    .bind(userId, productId, productUrl, `-${cooldownMinutes} minutes`)
    .first<{
      id: string;
      product_id: string | null;
      product_url: string;
      title_text: string;
      summary_json: string;
      keywords_json: string;
      created_at: string;
    }>();

  if (!row) {
    return null;
  }

  return {
    runId: row.id,
    analysis: {
      product: {
        id: row.product_id,
        url: row.product_url,
        title: row.title_text
      },
      summary: JSON.parse(row.summary_json),
      keywords: JSON.parse(row.keywords_json)
    } satisfies ProductKeywordAnalysis,
    createdAt: row.created_at
  };
}

export async function analyzeProductKeywords(snapshot: ProductKeywordSnapshot, options: AnalyzeOptions): Promise<ProductKeywordAnalysis> {
  const cooldownMinutes = options.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const cacheHours = options.cacheHours ?? DEFAULT_CACHE_HOURS;
  const productId = snapshot.productId ?? extractProductId(snapshot.productUrl);
  const candidates = buildCandidates(snapshot);
  let cacheHitCount = 0;

  const ranked = await mapWithConcurrency(candidates, 3, async (candidate) => {
    const cached = productId ? await readRankCache(options.db, productId, candidate.keyword) : null;

    if (cached) {
      cacheHitCount += 1;
      return buildSearchResult({
        keyword: candidate.keyword,
        score: candidate.score,
        source: candidate.source,
        searchUrl: cached.search_url,
        rankPosition: cached.rank_position ?? NOT_FOUND_RANK,
        resultPage: cached.result_page,
        status: cached.status,
        confidence: cached.confidence,
        checkedAt: cached.checked_at
      });
    }

    return lookupKeywordRank(options.db, productId, candidate, cacheHours);
  });

  ranked.sort((left, right) => left.rankPosition - right.rankPosition || (left.source === "suggestion" && right.source === "seed" ? -1 : 1));

  const found = ranked.filter((item) => item.status === "ranked");

  return {
    product: {
      id: productId,
      url: snapshot.productUrl,
      title: snapshot.title
    },
    summary: {
      generatedKeywords: candidates.length,
      checkedKeywords: ranked.length,
      rankedKeywords: found.length,
      bestRank: found[0]?.rankPosition ?? NOT_FOUND_RANK,
      analyzedAt: new Date().toISOString(),
      cooldownMinutes,
      cacheHitCount,
      note: "Keyword sources come from TPT autocomplete when available. Exact rank is checked only in the first 3 result pages; anything deeper is shown as >73."
    },
    keywords: ranked
  };
}
