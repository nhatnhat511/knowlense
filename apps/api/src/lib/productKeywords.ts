export type ProductKeywordSnapshot = {
  productId?: string | null;
  productUrl: string;
  title: string;
  descriptionExcerpt: string;
  grades: string[];
  tags: string[];
  resourceType?: string | null;
  subjects?: string[];
};

type Candidate = {
  phrase: string;
  score: number;
  sources: Set<string>;
};

export type RankedKeyword = {
  keyword: string;
  score: number;
  sourceCount: number;
  sources: string[];
  rankPosition: number | null;
  resultPage: number | null;
  status: "ranked" | "not_found";
  searchUrl: string;
};

export type ProductKeywordAnalysis = {
  product: {
    id: string | null;
    url: string;
    title: string;
  };
  summary: {
    generatedKeywords: number;
    rankedKeywords: number;
    bestRank: number | null;
    analyzedAt: string;
  };
  keywords: RankedKeyword[];
};

const TPT_BASE_URL = "https://www.teacherspayteachers.com";
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

function addCandidate(map: Map<string, Candidate>, rawPhrase: string, score: number, source: string) {
  const phrase = normalizeText(rawPhrase);
  if (!phrase || phrase.length < 4) {
    return;
  }

  const tokens = phrase.split(" ");
  if (tokens.length < 2 || tokens.length > 5) {
    return;
  }

  if (tokens.every((token) => token.length < 3)) {
    return;
  }

  const current = map.get(phrase);
  if (!current) {
    map.set(phrase, {
      phrase,
      score,
      sources: new Set([source])
    });
    return;
  }

  current.score += score;
  current.sources.add(source);
}

function buildNgrams(tokens: string[], minSize: number, maxSize: number) {
  const phrases: string[] = [];

  for (let start = 0; start < tokens.length; start += 1) {
    for (let size = minSize; size <= maxSize; size += 1) {
      const slice = tokens.slice(start, start + size);
      if (slice.length === size) {
        phrases.push(slice.join(" "));
      }
    }
  }

  return phrases;
}

function extractProductId(value: string) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

function generateKeywordCandidates(snapshot: ProductKeywordSnapshot) {
  const candidates = new Map<string, Candidate>();
  const titleTokens = tokenize(snapshot.title);
  const descriptionTokens = tokenize(snapshot.descriptionExcerpt).slice(0, 40);
  const gradeTokens = snapshot.grades.flatMap((item) => tokenize(item));
  const subjectTokens = (snapshot.subjects ?? []).flatMap((item) => tokenize(item));
  const resourceTokens = snapshot.resourceType ? tokenize(snapshot.resourceType) : [];

  if (titleTokens.length >= 2) {
    addCandidate(candidates, titleTokens.join(" "), 40, "title-full");
  }

  buildNgrams(titleTokens, 2, 5).forEach((phrase) => addCandidate(candidates, phrase, phrase.split(" ").length >= 3 ? 20 : 16, "title-gram"));
  buildNgrams(descriptionTokens, 2, 4).forEach((phrase) => addCandidate(candidates, phrase, 8, "description"));
  snapshot.tags.forEach((tag) => addCandidate(candidates, tag, 22, "tag"));

  const topicalPhrases = [...new Set([...snapshot.tags.map(normalizeText), ...buildNgrams(titleTokens, 2, 3)].filter(Boolean))].slice(0, 10);
  const gradePhrases = [...new Set(snapshot.grades.map(normalizeText).filter(Boolean))];
  const subjectPhrases = [...new Set((snapshot.subjects ?? []).map(normalizeText).filter(Boolean))];

  topicalPhrases.forEach((phrase) => {
    gradePhrases.forEach((grade) => addCandidate(candidates, `${phrase} ${grade}`, 18, "grade-combo"));
    subjectPhrases.forEach((subject) => addCandidate(candidates, `${subject} ${phrase}`, 14, "subject-combo"));
    if (snapshot.resourceType) {
      addCandidate(candidates, `${phrase} ${snapshot.resourceType}`, 14, "resource-combo");
    }
  });

  if (resourceTokens.length) {
    buildNgrams(resourceTokens, 1, 3).forEach((phrase) => addCandidate(candidates, phrase, 10, "resource"));
  }

  if (subjectTokens.length) {
    buildNgrams(subjectTokens, 1, 3).forEach((phrase) => addCandidate(candidates, phrase, 9, "subject"));
  }

  if (gradeTokens.length) {
    buildNgrams(gradeTokens, 1, 3).forEach((phrase) => addCandidate(candidates, phrase, 7, "grade"));
  }

  return [...candidates.values()]
    .map((candidate) => {
      const tokenCount = candidate.phrase.split(" ").length;
      const specificityBonus = tokenCount === 2 ? 10 : tokenCount <= 4 ? 16 : 6;
      const sourceBonus = candidate.sources.size * 8;
      const broadPenalty = tokenCount === 1 ? 20 : 0;

      return {
        keyword: candidate.phrase,
        score: Math.max(candidate.score + specificityBonus + sourceBonus - broadPenalty, 0),
        sources: [...candidate.sources]
      };
    })
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, items) => {
      const duplicate = items.findIndex((item) => item.keyword === candidate.keyword);
      return duplicate === index;
    })
    .slice(0, 20);
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

async function lookupKeywordRank(keyword: string, productId: string | null) {
  const searchUrl = `${TPT_BASE_URL}/browse?search=${encodeURIComponent(keyword)}`;

  if (!productId) {
    return {
      rankPosition: null,
      resultPage: null,
      status: "not_found" as const,
      searchUrl
    };
  }

  for (let page = 1; page <= 3; page += 1) {
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
        return {
          rankPosition: (page - 1) * urls.length + index + 1,
          resultPage: page,
          status: "ranked" as const,
          searchUrl
        };
      }
    }
  }

  return {
    rankPosition: null,
    resultPage: null,
    status: "not_found" as const,
    searchUrl
  };
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

export async function analyzeProductKeywords(snapshot: ProductKeywordSnapshot): Promise<ProductKeywordAnalysis> {
  const productId = snapshot.productId ?? extractProductId(snapshot.productUrl);
  const candidates = generateKeywordCandidates(snapshot);
  const ranked = await mapWithConcurrency(candidates, 4, async (candidate) => {
    const rank = await lookupKeywordRank(candidate.keyword, productId);

    return {
      keyword: titleCaseKeyword(candidate.keyword),
      score: candidate.score,
      sourceCount: candidate.sources.length,
      sources: candidate.sources,
      rankPosition: rank.rankPosition,
      resultPage: rank.resultPage,
      status: rank.status,
      searchUrl: rank.searchUrl
    } satisfies RankedKeyword;
  });

  ranked.sort((left, right) => {
    if (left.rankPosition == null && right.rankPosition == null) {
      return right.score - left.score;
    }

    if (left.rankPosition == null) {
      return 1;
    }

    if (right.rankPosition == null) {
      return -1;
    }

    return left.rankPosition - right.rankPosition || right.score - left.score;
  });

  const found = ranked.filter((item) => item.rankPosition != null);

  return {
    product: {
      id: productId,
      url: snapshot.productUrl,
      title: snapshot.title
    },
    summary: {
      generatedKeywords: ranked.length,
      rankedKeywords: found.length,
      bestRank: found[0]?.rankPosition ?? null,
      analyzedAt: new Date().toISOString()
    },
    keywords: ranked
  };
}
