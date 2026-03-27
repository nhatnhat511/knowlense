export type ProductSeoAuditSnapshot = {
  productId?: string | null;
  productUrl: string;
  sellerName?: string | null;
  auditKeyword: string;
  title: string;
  descriptionExcerpt: string;
  grades: string[];
  tags: string[];
  subjects?: string[];
  resourceType?: string | null;
  pagesValue?: string | null;
  media?: {
    imageCount: number;
    hasVideo: boolean;
    hasReviewSection: boolean;
  };
  discountOfferVisible?: boolean;
  bundleOfferVisible?: boolean;
  descriptionProductLinks?: string[];
  unansweredQuestions?: number;
};

export type ProductSeoAudit = {
  product: {
    id: string | null;
    url: string;
    sellerName: string | null;
    title: string;
  };
  audit: {
    keyword: string;
    seoScore: number;
    rank: {
      status: "ranked" | "beyond_page_3";
      position: number;
      resultPage: number | null;
      searchUrl: string;
    };
    checks: {
      titleContainsKeyword: boolean;
      descriptionContainsKeyword: boolean;
      titleLengthOk: boolean;
      titleKeywordRepeated: boolean;
      descriptionKeywordOverused: boolean;
      subjectsComplete: boolean;
      tagsComplete: boolean;
      pagesFilled: boolean;
      mediaComplete: boolean;
      discountEnabled: boolean;
      bundleEnabled: boolean;
      hasInternalProductLink: boolean;
      unansweredQuestions: number;
    };
    counts: {
      titleLength: number;
      titleKeywordMentions: number;
      descriptionKeywordMentions: number;
      subjectsCount: number;
      tagsCount: number;
      imageCount: number;
      hasVideo: boolean;
      hasReviewSection: boolean;
    };
    actionItems: string[];
    analyzedAt: string;
    note: string;
  };
};

type AuditOptions = {
  db: D1Database;
  userId: string;
};

type StoredAuditRow = {
  id: string;
  product_id: string | null;
  product_url: string;
  title_text: string;
  primary_keyword: string | null;
  audit_json: string;
  created_at: string;
};

const TPT_BASE_URL = "https://www.teacherspayteachers.com";
const MAX_SEARCH_PAGES = 3;
const NOT_FOUND_RANK = 74;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countPhraseOccurrences(text: string, phrase: string) {
  const normalizedText = normalizeText(text);
  const normalizedPhrase = normalizeText(phrase);

  if (!normalizedText || !normalizedPhrase) {
    return 0;
  }

  const matches = normalizedText.match(new RegExp(`\\b${normalizedPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"));
  return matches?.length ?? 0;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractProductId(value: string) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
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

async function lookupKeywordRank(productId: string | null, keyword: string) {
  const searchUrl = `${TPT_BASE_URL}/browse?search=${encodeURIComponent(keyword)}`;

  if (!productId) {
    return {
      status: "beyond_page_3" as const,
      position: NOT_FOUND_RANK,
      resultPage: null,
      searchUrl
    };
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
        return {
          status: "ranked" as const,
          position: (page - 1) * urls.length + index + 1,
          resultPage: page,
          searchUrl
        };
      }
    }
  }

  return {
    status: "beyond_page_3" as const,
    position: NOT_FOUND_RANK,
    resultPage: null,
    searchUrl
  };
}

function buildActionItems(input: {
  keyword: string;
  checks: ProductSeoAudit["audit"]["checks"];
  counts: ProductSeoAudit["audit"]["counts"];
  rankStatus: "ranked" | "beyond_page_3";
}) {
  const issues: Array<{ weight: number; text: string }> = [];

  if (input.rankStatus !== "ranked") {
    issues.push({ weight: 18, text: `This product is not in the first 3 TPT search pages for "${input.keyword}". Tighten the listing around that keyword.` });
  }

  if (!input.checks.titleContainsKeyword) {
    issues.push({ weight: 18, text: `Add "${input.keyword}" to the title at least once.` });
  }

  if (!input.checks.descriptionContainsKeyword) {
    issues.push({ weight: 16, text: `Mention "${input.keyword}" in the first 300 words of the description.` });
  }

  if (!input.checks.titleLengthOk) {
    issues.push({ weight: 12, text: `Expand the title. It is only ${input.counts.titleLength} characters, while TPT allows up to 75.` });
  }

  if (input.checks.titleKeywordRepeated) {
    issues.push({ weight: 12, text: `Reduce title repetition. "${input.keyword}" should appear only once in the title.` });
  }

  if (input.checks.descriptionKeywordOverused) {
    issues.push({ weight: 10, text: `Reduce keyword stuffing. "${input.keyword}" appears more than 3 times in the first 300 words.` });
  }

  if (!input.checks.subjectsComplete) {
    issues.push({ weight: 9, text: `Fill all 3 Subjects to improve discoverability.` });
  }

  if (!input.checks.tagsComplete) {
    issues.push({ weight: 9, text: `Fill all 6 Tags to maximize filtering and search coverage.` });
  }

  if (!input.checks.pagesFilled) {
    issues.push({ weight: 8, text: `Add the Pages count to the listing.` });
  }

  if (!input.checks.mediaComplete) {
    issues.push({ weight: 8, text: `Add at least 4 product images, a review section, and 1 video if possible.` });
  }

  if (!input.checks.discountEnabled) {
    issues.push({ weight: 5, text: `Turn on the new-user 10% seller discount if it fits your pricing strategy.` });
  }

  if (!input.checks.bundleEnabled) {
    issues.push({ weight: 5, text: `Consider adding this product into a bundle so the listing can show bundle savings.` });
  }

  if (!input.checks.hasInternalProductLink) {
    issues.push({ weight: 5, text: `Add a link in the description to another relevant product or bundle in your store.` });
  }

  if (input.checks.unansweredQuestions > 0) {
    issues.push({ weight: 7, text: `Reply to ${input.checks.unansweredQuestions} unanswered Q&A item(s).` });
  }

  if (issues.length < 5) {
    issues.push({ weight: 1, text: `Keep "${input.keyword}" aligned across title, description, preview, and tags.` });
  }

  return issues
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5)
    .map((item) => item.text);
}

export async function findRecentSeoAudit() {
  return null;
}

export async function analyzeProductSeoAudit(snapshot: ProductSeoAuditSnapshot, options: AuditOptions): Promise<ProductSeoAudit> {
  void options;

  const productId = snapshot.productId ?? extractProductId(snapshot.productUrl);
  const keyword = normalizeText(snapshot.auditKeyword);
  const titleLength = snapshot.title.trim().length;
  const titleKeywordMentions = countPhraseOccurrences(snapshot.title, keyword);
  const descriptionKeywordMentions = countPhraseOccurrences(snapshot.descriptionExcerpt, keyword);
  const rank = await lookupKeywordRank(productId, keyword);
  const checks = {
    titleContainsKeyword: titleKeywordMentions >= 1,
    descriptionContainsKeyword: descriptionKeywordMentions >= 1,
    titleLengthOk: titleLength >= 55 && titleLength <= 75,
    titleKeywordRepeated: titleKeywordMentions >= 2,
    descriptionKeywordOverused: descriptionKeywordMentions > 3,
    subjectsComplete: (snapshot.subjects?.length ?? 0) >= 3,
    tagsComplete: snapshot.tags.length >= 6,
    pagesFilled: Boolean((snapshot.pagesValue ?? "").trim() && !/n\/a/i.test(snapshot.pagesValue ?? "")),
    mediaComplete:
      (snapshot.media?.imageCount ?? 0) >= 4 &&
      Boolean(snapshot.media?.hasReviewSection) &&
      Boolean(snapshot.media?.hasVideo),
    discountEnabled: Boolean(snapshot.discountOfferVisible),
    bundleEnabled: Boolean(snapshot.bundleOfferVisible),
    hasInternalProductLink: (snapshot.descriptionProductLinks?.length ?? 0) > 0,
    unansweredQuestions: snapshot.unansweredQuestions ?? 0
  };

  const counts = {
    titleLength,
    titleKeywordMentions,
    descriptionKeywordMentions,
    subjectsCount: snapshot.subjects?.length ?? 0,
    tagsCount: snapshot.tags.length,
    imageCount: snapshot.media?.imageCount ?? 0,
    hasVideo: Boolean(snapshot.media?.hasVideo),
    hasReviewSection: Boolean(snapshot.media?.hasReviewSection)
  };

  let score = 100;
  if (rank.status !== "ranked") score -= 18;
  if (!checks.titleContainsKeyword) score -= 18;
  if (!checks.descriptionContainsKeyword) score -= 16;
  if (!checks.titleLengthOk) score -= 12;
  if (checks.titleKeywordRepeated) score -= 12;
  if (checks.descriptionKeywordOverused) score -= 10;
  if (!checks.subjectsComplete) score -= 9;
  if (!checks.tagsComplete) score -= 9;
  if (!checks.pagesFilled) score -= 8;
  if (!checks.mediaComplete) score -= 8;
  if (!checks.discountEnabled) score -= 5;
  if (!checks.bundleEnabled) score -= 5;
  if (!checks.hasInternalProductLink) score -= 5;
  if (checks.unansweredQuestions > 0) score -= 7;

  return {
    product: {
      id: productId,
      url: snapshot.productUrl,
      sellerName: snapshot.sellerName ?? null,
      title: snapshot.title
    },
    audit: {
      keyword: snapshot.auditKeyword.trim(),
      seoScore: Math.max(0, Math.min(100, score)),
      rank,
      checks,
      counts,
      actionItems: buildActionItems({
        keyword: snapshot.auditKeyword.trim(),
        checks,
        counts,
        rankStatus: rank.status
      }),
      analyzedAt: new Date().toISOString(),
      note: "This audit checks one user-provided keyword against TPT listing SEO basics and the first 3 TPT search pages."
    }
  };
}
