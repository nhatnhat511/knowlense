export type ProductSeoAuditSnapshot = {
  productId?: string | null;
  productUrl: string;
  sellerName?: string | null;
  sellerStorePath?: string | null;
  auditKeyword: string;
  title: string;
  descriptionExcerpt?: string;
  descriptionText?: string;
  descriptionWordCount?: number;
  grades: string[];
  tags: string[];
  subjects?: string[];
  resourceType?: string | null;
  pagesValue?: string | null;
  currentPrice?: number | null;
  media?: {
    imageCount: number;
    hasVideo: boolean;
    hasReviewSection: boolean;
  };
  hasPreview?: boolean;
  reviewData?: {
    average: number | null;
    count: number;
    recentDates?: string[];
  };
  isBundleProduct?: boolean;
  discountOfferVisible?: boolean;
  discountOfferHasFirstPurchase?: boolean;
  discountOfferHasFollower?: boolean;
  bundleOfferVisible?: boolean;
  descriptionProductLinks?: string[];
  descriptionLinkDetails?: Array<{
    url: string;
    type: "store" | "product" | "external";
    resolvedStorePath?: string | null;
  }>;
  serpTitles?: string[];
  liveRank?: {
    status: "ranked" | "beyond_page_3";
    resultPage: number | null;
    pagePosition: number | null;
  };
  descriptionAudit?: {
    mentionCount: number;
    status: "good" | "missing" | "stuffed";
    containsKeyword: boolean;
    overused: boolean;
    message: string;
  };
};

export type ProductSeoHealth = {
  product: {
    id: string | null;
    url: string;
    sellerName: string | null;
    title: string;
    isBundleProduct: boolean;
  };
  health: {
    seoHealthScore: number;
    criteria: Array<{
      id: string;
      label: string;
      passed: boolean;
      status?: "pass" | "warning" | "fail" | "na";
      group?: "search_visibility" | "product_completeness" | "media_buyer_experience" | "conversion_store_growth";
      message: string;
      weight: number;
    }>;
    analyzedAt: string;
    note: string;
  };
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
    relatedSuggestions: string[];
    titlePlacement: {
      mentionCount: number;
      status: "good" | "missing" | "stuffed";
      message: string;
    };
    descriptionPlacement: {
      mentionCount: number;
      status: "good" | "missing" | "stuffed";
      message: string;
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

type SeoHealthGroupId =
  | "search_visibility"
  | "product_completeness"
  | "media_buyer_experience"
  | "conversion_store_growth";

type SeoHealthCriterionStatus = "pass" | "warning" | "fail" | "na";

type SeoHealthCriterion = ProductSeoHealth["health"]["criteria"][number];

type StoredAuditRow = {
  id: string;
  product_id: string | null;
  product_url: string;
  title_text: string;
  primary_keyword: string | null;
  audit_json: string;
  created_at: string;
};

const NOISE_WORDS = new Set([
  "activity",
  "activities",
  "worksheet",
  "worksheets",
  "printable",
  "printables",
  "resource",
  "resources",
  "for",
  "with",
  "and",
  "the",
  "a",
  "an",
  "of",
  "grade",
  "grades",
  "prek",
  "pre-k",
  "kindergarten"
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStorePath(value: string) {
  try {
    const url = new URL(value, "https://www.teacherspayteachers.com");
    const match = url.pathname.match(/^\/store\/[^/?#]+/i);
    return match ? match[0].toLowerCase() : "";
  } catch {
    return "";
  }
}

function parseTptUrl(value: string) {
  try {
    return new URL(value, "https://www.teacherspayteachers.com");
  } catch {
    return null;
  }
}

function isTptHost(hostname: string) {
  return /(^|\.)teacherspayteachers\.com$/i.test(hostname);
}

function isTptProductLink(value: string) {
  const url = parseTptUrl(value);
  return Boolean(url && isTptHost(url.hostname) && /^\/Product\/[^/?#]+/i.test(url.pathname));
}

function isCurrentStoreLink(value: string, currentStorePath: string) {
  if (!currentStorePath) {
    return false;
  }

  return extractStorePath(value) === currentStorePath;
}

type DescriptionLinkSummary = {
  sameStoreProductLinks: number;
  currentStoreLinks: number;
  otherStoreProductLinks: number;
  externalLinks: number;
};

async function summarizeDescriptionLinks(
  descriptionLinks: string[],
  currentStorePath: string,
  descriptionLinkDetails?: Array<{
    url: string;
    type: "store" | "product" | "external";
    resolvedStorePath?: string | null;
  }>
): Promise<DescriptionLinkSummary> {
  const summary: DescriptionLinkSummary = {
    sameStoreProductLinks: 0,
    currentStoreLinks: 0,
    otherStoreProductLinks: 0,
    externalLinks: 0
  };

  if (Array.isArray(descriptionLinkDetails) && descriptionLinkDetails.length > 0) {
    for (const detail of descriptionLinkDetails) {
      const resolvedStorePath = extractStorePath(detail.resolvedStorePath ?? "");

      if (detail.type === "store") {
        if (resolvedStorePath && resolvedStorePath === currentStorePath) {
          summary.currentStoreLinks += 1;
        } else {
          summary.externalLinks += 1;
        }
        continue;
      }

      if (detail.type === "external") {
        summary.externalLinks += 1;
        continue;
      }

      if (detail.type === "product") {
        if (resolvedStorePath && resolvedStorePath === currentStorePath) {
          summary.sameStoreProductLinks += 1;
        } else if (resolvedStorePath) {
          summary.otherStoreProductLinks += 1;
        } else {
          summary.externalLinks += 1;
        }
        continue;
      }
    }

    return summary;
  }

  for (const link of descriptionLinks) {
    if (isCurrentStoreLink(link, currentStorePath)) {
      summary.currentStoreLinks += 1;
      continue;
    }

    if (!isTptProductLink(link)) {
      summary.externalLinks += 1;
      continue;
    }

    if (!currentStorePath) {
      summary.externalLinks += 1;
      continue;
    }

    try {
      const response = await fetch(link);
      const html = await response.text();
      const linkedStorePath = extractStorePath(html.match(/href=["'](\/store\/[^"'?#]+)["']/i)?.[1] ?? "");

      if (linkedStorePath && linkedStorePath === currentStorePath) {
        summary.sameStoreProductLinks += 1;
      } else if (linkedStorePath) {
        summary.otherStoreProductLinks += 1;
      } else {
        summary.externalLinks += 1;
      }
    } catch {
      summary.externalLinks += 1;
    }
  }

  return summary;
}

function formatLinkCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatLinkVolume(count: number, singular: string, plural: string) {
  if (count <= 1) {
    return `a ${singular}`;
  }

  return `multiple ${plural}`;
}

function buildInternalLinksMessage(counts: {
  sameStoreProductLinks: number;
  currentStoreLinks: number;
  otherStoreProductLinks: number;
  externalLinks: number;
}) {
  const flags = {
    sameStoreProduct: counts.sameStoreProductLinks > 0,
    currentStore: counts.currentStoreLinks > 0,
    otherStoreProduct: counts.otherStoreProductLinks > 0,
    external: counts.externalLinks > 0
  };
  const key = [
    flags.sameStoreProduct ? "1" : "0",
    flags.currentStore ? "1" : "0",
    flags.otherStoreProduct ? "1" : "0",
    flags.external ? "1" : "0"
  ].join("");

  const sameStoreProductText = formatLinkVolume(
    counts.sameStoreProductLinks,
    "current-store product link",
    "current-store product links"
  );
  const currentStoreText = formatLinkVolume(
    counts.currentStoreLinks,
    "current store page link",
    "current store page links"
  );
  const otherStoreProductText = formatLinkVolume(
    counts.otherStoreProductLinks,
    "product link from another store",
    "product links from another store"
  );
  const externalText = formatLinkVolume(
    counts.externalLinks,
    "external or unsupported link",
    "external or unsupported links"
  );

  const messages: Record<string, string> = {
    "0000": "No links were found in the product description. Add at least one link to a relevant product or your store page to strengthen internal discovery.",
    "1000": `The description includes ${sameStoreProductText} and no unrelated links. This supports a clean internal linking structure.`,
    "0100": `The description includes ${currentStoreText} and no unrelated links. To strengthen internal linking further, add at least one product link from the current store as well.`,
    "1100": `The description includes ${currentStoreText} and ${sameStoreProductText}, with no unrelated links present. This creates a strong internal linking structure.`,
    "0010": `The description includes ${otherStoreProductText}. Replace ${counts.otherStoreProductLinks === 1 ? "it" : "them"} with links to the current store page or products from the current store.`,
    "0001": `The description includes ${externalText}. Keep this section focused on links to the current store page or products from the current store.`,
    "0011": `The description includes ${otherStoreProductText} and ${externalText}. Replace them with links to the current store page or products from the current store.`,
    "1010": `The description includes ${sameStoreProductText}, but it also includes ${otherStoreProductText}. Remove the unrelated product ${counts.otherStoreProductLinks === 1 ? "link" : "links"} to keep the internal linking focused.`,
    "1001": `The description includes ${sameStoreProductText}, but it also includes ${externalText}. Remove the unrelated ${counts.externalLinks === 1 ? "link" : "links"} to keep the description fully aligned with your store.`,
    "0110": `The description includes ${currentStoreText}, but it also includes ${otherStoreProductText}. Keep only links that point back to the current store.`,
    "0101": `The description includes ${currentStoreText}, but it also includes ${externalText}. Remove the unrelated ${counts.externalLinks === 1 ? "link" : "links"} so the description stays focused on your own store ecosystem.`,
    "1110": `The description includes ${currentStoreText} and ${sameStoreProductText}, but it also includes ${otherStoreProductText}. Keep only links to the current store page and current-store products.`,
    "1101": `The description includes ${currentStoreText} and ${sameStoreProductText}, but it also includes ${externalText}. Remove the unrelated ${counts.externalLinks === 1 ? "link" : "links"} to preserve a clean internal linking profile.`,
    "1011": `The description includes ${sameStoreProductText}, but it also mixes in ${otherStoreProductText} and ${externalText}. Keep only links that support the current store.`,
    "0111": `The description includes ${currentStoreText}, but it also mixes in ${otherStoreProductText} and ${externalText}. Remove the unrelated links and keep the description focused on the current store.`,
    "1111": `The description includes ${currentStoreText} and ${sameStoreProductText}, but it also contains ${otherStoreProductText} and ${externalText}. Keep only links to the current store page and current-store products.`
  };

  return messages[key];
}

function buildRecentReviewsCriterion(reviewDates: string[]) {
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const parsedDates = reviewDates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  if (!parsedDates.length) {
    return {
      id: "recent-reviews",
      label: "Recent reviews",
      passed: false,
      message: "Knowlense could not verify recent review dates from the latest visible product reviews."
    };
  }

  const hasRecentReview = now - parsedDates[0].getTime() <= ninetyDaysMs;

  return {
    id: "recent-reviews",
    label: "Recent reviews",
    passed: hasRecentReview,
    message: hasRecentReview
      ? "The latest visible product reviews include recent buyer activity, which supports listing freshness and buyer confidence."
      : "No recent buyer reviews were found in the latest visible product review sample, which may weaken freshness and buyer confidence."
  };
}

function buildRecentReviewFrequencyCriterion(reviewDates: string[]) {
  const parsedDates = reviewDates
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  if (parsedDates.length < 3) {
    return {
      id: "recent-review-frequency",
      label: "Recent review frequency",
      passed: false,
      message: "Knowlense could not find enough visible product reviews to evaluate recent review frequency reliably."
    };
  }

  const newest = parsedDates[0].getTime();
  const oldest = parsedDates[parsedDates.length - 1].getTime();
  const spanDays = Math.round((newest - oldest) / (24 * 60 * 60 * 1000));
  const hasHealthyCadence = spanDays <= 180;

  return {
    id: "recent-review-frequency",
    label: "Recent review frequency",
    passed: hasHealthyCadence,
    message: hasHealthyCadence
      ? "The latest visible product reviews suggest a steady recent review cadence, which is a healthy trust signal for the product."
      : "The latest visible product reviews appear too spread out over time, which suggests a slower recent review cadence."
  };
}

function extractPageCountForPricing(pagesValue: string | null | undefined) {
  const matchedNumber = String(pagesValue || "").match(/(\d+)/);
  if (!matchedNumber) {
    return null;
  }

  const value = Number.parseInt(matchedNumber[1], 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function buildProductPricingCriterion(input: { pagesValue?: string | null; currentPrice?: number | null }) {
  const pageCount = extractPageCountForPricing(input.pagesValue);
  const currentPrice = Number(input.currentPrice);

  if (!pageCount || !Number.isFinite(currentPrice)) {
    return {
      id: "product-pricing",
      label: "Product pricing",
      passed: false,
      message:
        "Knowlense could not estimate a pricing recommendation because the product does not include a usable page count. Add an accurate Pages value so pricing guidance can be calculated reliably."
    };
  }

  const rawBasePrice = pageCount * 0.13;
  const recommendedPrice = Math.max(rawBasePrice, 1);
  const roundedCurrentPrice = Number(currentPrice.toFixed(2));
  const roundedRecommendedPrice = Number(recommendedPrice.toFixed(2));
  const difference = roundedCurrentPrice - roundedRecommendedPrice;

  if (Math.abs(difference) < 0.3) {
    return {
      id: "product-pricing",
      label: "Product pricing",
      passed: true,
      message: `The current price of $${roundedCurrentPrice.toFixed(2)} looks aligned with the expected market range for a ${pageCount}-page product.`
    };
  }

  if (difference >= 0.3) {
    if (rawBasePrice < 1) {
      return {
        id: "product-pricing",
        label: "Product pricing",
        passed: false,
        message: `The current price of $${roundedCurrentPrice.toFixed(2)} sits above the expected range for this page count. A stronger minimum target would be $1.00.`
      };
    }

    return {
      id: "product-pricing",
      label: "Product pricing",
      passed: false,
      message: `The current price of $${roundedCurrentPrice.toFixed(2)} appears higher than the expected market range for a ${pageCount}-page product. A suggested price is $${roundedRecommendedPrice.toFixed(2)}.`
    };
  }

  return {
    id: "product-pricing",
    label: "Product pricing",
    passed: false,
    message: `The current price of $${roundedCurrentPrice.toFixed(2)} appears lower than the expected value for a ${pageCount}-page product. A suggested price is $${roundedRecommendedPrice.toFixed(2)}.`
  };
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

function firstWords(text: string, limit: number) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
    .join(" ")
    .trim();
}

type TitleToken = {
  raw: string;
  normalized: string;
  start: number;
  end: number;
};

function tokenizeWithPositions(value: string): TitleToken[] {
  const tokens: TitleToken[] = [];
  const pattern = /[A-Za-z0-9]+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const raw = match[0];
    tokens.push({
      raw,
      normalized: normalizeText(raw),
      start: match.index,
      end: match.index + raw.length
    });
  }

  return tokens.filter((token) => token.normalized);
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function containsSequence(tokens: TitleToken[], phraseTokens: string[]) {
  if (!tokens.length || !phraseTokens.length || phraseTokens.length > tokens.length) {
    return false;
  }

  for (let index = 0; index <= tokens.length - phraseTokens.length; index += 1) {
    const matches = phraseTokens.every((token, offset) => tokens[index + offset]?.normalized === token);
    if (matches) {
      return true;
    }
  }

  return false;
}

function isUsefulToken(token: string | undefined) {
  return Boolean(token && token.length > 1 && !NOISE_WORDS.has(token));
}

function hasPunctuationBetween(title: string, left: TitleToken, right: TitleToken) {
  const segment = title.slice(left.end, right.start);
  return /[^\w\s]/.test(segment);
}

function collectPhraseCandidates(title: string, keyword: string) {
  const titleTokens = tokenizeWithPositions(title);
  const keywordTokens = tokenize(keyword);
  const phrases = new Set<string>();

  if (!containsSequence(titleTokens, keywordTokens)) {
    return [];
  }

  for (let index = 0; index <= titleTokens.length - keywordTokens.length; index += 1) {
    const matches = keywordTokens.every((token, offset) => titleTokens[index + offset]?.normalized === token);
    if (!matches) {
      continue;
    }

    const keywordEnd = titleTokens[index + keywordTokens.length - 1];
    const after = titleTokens[index + keywordTokens.length];
    const afterTwo = titleTokens[index + keywordTokens.length + 1];
    const canUseAfter = Boolean(after && keywordEnd && !hasPunctuationBetween(title, keywordEnd, after));
    const canUseAfterTwo = Boolean(
      after &&
      afterTwo &&
      !hasPunctuationBetween(title, keywordEnd, after) &&
      !hasPunctuationBetween(title, after, afterTwo)
    );

    if (canUseAfter && isUsefulToken(after?.normalized)) {
      phrases.add([...keywordTokens, after!.normalized].join(" "));
    }

    if (canUseAfterTwo && isUsefulToken(after?.normalized) && isUsefulToken(afterTwo?.normalized)) {
      phrases.add([...keywordTokens, after!.normalized, afterTwo!.normalized].join(" "));
    }
  }

  return [...phrases].filter((phrase) => normalizeText(phrase) !== normalizeText(keyword));
}

function collectRelatedSuggestionsFromTitles(keyword: string, titles: string[]) {
  const frequency = new Map<string, number>();
  titles.forEach((title) => {
    const candidates = collectPhraseCandidates(title, keyword);
    candidates.forEach((candidate) => {
      const normalized = normalizeText(candidate);
      if (!normalized || normalized === normalizeText(keyword)) {
        return;
      }

      frequency.set(candidate, (frequency.get(candidate) ?? 0) + 1);
    });
  });

  return [...frequency.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].length - right[0].length)
    .map(([phrase]) => phrase)
    .slice(0, 8);
}

function buildActionItems(input: {
  keyword: string;
  checks: ProductSeoAudit["audit"]["checks"];
  counts: ProductSeoAudit["audit"]["counts"];
}) {
  const issues: Array<{ weight: number; text: string }> = [];

  if (!input.checks.titleContainsKeyword) {
    issues.push({ weight: 18, text: `Add "${input.keyword}" to the title at least once.` });
  }

  if (!input.checks.titleLengthOk) {
    issues.push({ weight: 12, text: `Expand the title. It is only ${input.counts.titleLength} characters, while TPT allows up to 75.` });
  }

  if (input.checks.titleKeywordRepeated) {
    issues.push({ weight: 12, text: `Reduce title repetition. "${input.keyword}" should appear only once in the title.` });
  }

  if (!input.checks.subjectsComplete) {
    issues.push({ weight: 9, text: `Fill all 3 Subjects to improve discoverability.` });
  }

  if (!input.checks.tagsComplete) {
    issues.push({ weight: 9, text: `Fill all 6 Tags to maximize filtering and search coverage.` });
  }

  if (!input.checks.pagesFilled) {
    issues.push({ weight: 8, text: `Add the Pages count to the product.` });
  }

  if (!input.checks.mediaComplete) {
    issues.push({ weight: 8, text: `Add at least 4 product images, a review section, and 1 video if possible.` });
  }

  if (!input.checks.discountEnabled) {
    issues.push({ weight: 5, text: `Turn on the new-user 10% seller discount if it fits your pricing strategy.` });
  }

  if (!input.checks.bundleEnabled) {
    issues.push({ weight: 5, text: `Consider adding this product into a bundle so the product can show bundle savings.` });
  }

  if (!input.checks.hasInternalProductLink) {
    issues.push({ weight: 5, text: `Add a link in the description to another relevant product or bundle in your store.` });
  }

  if (issues.length < 5) {
    issues.push({ weight: 1, text: `Keep "${input.keyword}" aligned across title, description, preview, and tags.` });
  }

  return issues
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 5)
    .map((item) => item.text);
}

function computeRankScore(liveRank: ProductSeoAuditSnapshot["liveRank"]) {
  if (liveRank?.status !== "ranked" || !liveRank?.resultPage || !liveRank?.pagePosition) {
    return 0;
  }

  const position = Math.max(1, Number(liveRank.pagePosition) || 1);

  if (liveRank.resultPage === 1) {
    return Math.max(4, 80 - (position - 1) * 4);
  }

  if (liveRank.resultPage === 2) {
    return Math.max(2, Math.round(40 - (position - 1) * 1.5));
  }

  if (liveRank.resultPage === 3) {
    return Math.max(1, Math.round(15 - (position - 1) * 0.5));
  }

  return 0;
}

function computeKeywordScore(input: {
  liveRank: ProductSeoAuditSnapshot["liveRank"];
  titleKeywordMentions: number;
  descriptionStatus: "good" | "missing" | "stuffed";
}) {
  const rankScore = computeRankScore(input.liveRank);
  const titleScore = input.titleKeywordMentions === 1 ? 10 : 0;
  const descriptionScore = input.descriptionStatus === "good" ? 10 : 0;

  return Math.max(0, Math.min(100, rankScore + titleScore + descriptionScore));
}

export async function findRecentSeoAudit() {
  return null;
}

export async function analyzeProductSeoAudit(snapshot: ProductSeoAuditSnapshot, options: AuditOptions): Promise<ProductSeoAudit> {
  void options;
  const keyword = normalizeText(snapshot.auditKeyword);
  const titleLength = snapshot.title.trim().length;
  const titleKeywordMentions = countPhraseOccurrences(snapshot.title, keyword);
  const relatedSuggestions = collectRelatedSuggestionsFromTitles(
    keyword,
    Array.isArray(snapshot.serpTitles) ? snapshot.serpTitles.filter(Boolean).slice(0, 48) : []
  );
  const titlePlacement =
    titleKeywordMentions === 0
      ? {
          mentionCount: 0,
          status: "missing" as const,
          message: `The title does not currently reference "${snapshot.auditKeyword.trim()}". Adding it would strengthen keyword alignment.`
        }
      : titleKeywordMentions === 1
        ? {
            mentionCount: 1,
            status: "good" as const,
            message: `The title includes "${snapshot.auditKeyword.trim()}" in a clean, focused way.`
          }
        : {
            mentionCount: titleKeywordMentions,
            status: "stuffed" as const,
            message: `The title repeats "${snapshot.auditKeyword.trim()}" too often. A cleaner title would feel more natural and focused.`
          };
  const descriptionPlacement = snapshot.descriptionAudit
    ? {
        mentionCount: snapshot.descriptionAudit.mentionCount,
        status: snapshot.descriptionAudit.status,
        message: snapshot.descriptionAudit.message
      }
    : {
        mentionCount: 0,
        status: "missing" as const,
        message: "Knowlense checks whether the target keyword appears at the beginning of the description directly in the extension."
      };
  const checks = {
    titleContainsKeyword: titleKeywordMentions >= 1,
    descriptionContainsKeyword: Boolean(snapshot.descriptionAudit?.containsKeyword),
    titleLengthOk: titleLength >= 55 && titleLength <= 75,
    titleKeywordRepeated: titleKeywordMentions >= 2,
    descriptionKeywordOverused: Boolean(snapshot.descriptionAudit?.overused),
    subjectsComplete: (snapshot.subjects?.length ?? 0) >= 3,
    tagsComplete: snapshot.tags.length >= 6,
    pagesFilled: Boolean((snapshot.pagesValue ?? "").trim() && !/n\/a/i.test(snapshot.pagesValue ?? "")),
    mediaComplete:
      (snapshot.media?.imageCount ?? 0) >= 4 &&
      Boolean(snapshot.media?.hasReviewSection) &&
      Boolean(snapshot.media?.hasVideo),
    discountEnabled: Boolean(snapshot.discountOfferVisible),
    bundleEnabled: Boolean(snapshot.bundleOfferVisible),
    hasInternalProductLink: (snapshot.descriptionProductLinks?.length ?? 0) > 0
  };

  const counts = {
    titleLength,
    titleKeywordMentions,
    descriptionKeywordMentions: snapshot.descriptionAudit?.mentionCount ?? 0,
    subjectsCount: snapshot.subjects?.length ?? 0,
    tagsCount: snapshot.tags.length,
    imageCount: snapshot.media?.imageCount ?? 0,
    hasVideo: Boolean(snapshot.media?.hasVideo),
    hasReviewSection: Boolean(snapshot.media?.hasReviewSection)
  };
  const score = computeKeywordScore({
    liveRank: snapshot.liveRank,
    titleKeywordMentions,
    descriptionStatus: descriptionPlacement.status
  });

  return {
    product: {
      id: snapshot.productId ?? null,
      url: snapshot.productUrl,
      sellerName: snapshot.sellerName ?? null,
      title: snapshot.title
    },
    audit: {
      keyword: snapshot.auditKeyword.trim(),
      seoScore: Math.max(0, Math.min(100, score)),
      relatedSuggestions,
      titlePlacement,
      descriptionPlacement,
      checks,
      counts,
      actionItems: buildActionItems({
        keyword: snapshot.auditKeyword.trim(),
        checks,
        counts
      }),
      analyzedAt: new Date().toISOString(),
      note: "Knowlense calculates the keyword score from live rank, title match, and keyword placement at the beginning of the description. The extension extracts live rank and description data directly from the TPT product page."
    }
  };
}

const SEO_HEALTH_GROUP_WEIGHTS: Record<SeoHealthGroupId, number> = {
  search_visibility: 25,
  product_completeness: 20,
  media_buyer_experience: 25,
  conversion_store_growth: 30
};

const SEO_HEALTH_CRITERION_CONFIG: Record<
  string,
  { group: SeoHealthGroupId; weight: number }
> = {
  "title-length": { group: "search_visibility", weight: 9 },
  subjects: { group: "search_visibility", weight: 8 },
  tags: { group: "search_visibility", weight: 8 },
  grades: { group: "product_completeness", weight: 6 },
  pages: { group: "product_completeness", weight: 7 },
  "description-length": { group: "product_completeness", weight: 7 },
  "product-images": { group: "media_buyer_experience", weight: 8 },
  preview: { group: "media_buyer_experience", weight: 9 },
  video: { group: "media_buyer_experience", weight: 8 },
  discount: { group: "conversion_store_growth", weight: 4 },
  "internal-links": { group: "conversion_store_growth", weight: 8 },
  "bundle-inclusion": { group: "conversion_store_growth", weight: 4 },
  "product-pricing": { group: "conversion_store_growth", weight: 6 },
  "recent-reviews": { group: "conversion_store_growth", weight: 3 },
  "recent-review-frequency": { group: "conversion_store_growth", weight: 2 },
  "review-score": { group: "conversion_store_growth", weight: 3 }
};

function createSeoHealthCriterion(input: {
  id: string;
  label: string;
  passed: boolean;
  message: string;
  status?: SeoHealthCriterionStatus;
}): SeoHealthCriterion {
  const config = SEO_HEALTH_CRITERION_CONFIG[input.id];
  if (!config) {
    throw new Error(`Missing SEO Health config for criterion "${input.id}".`);
  }

  const status = input.status ?? (input.passed ? "pass" : "fail");

  return {
    id: input.id,
    label: input.label,
    passed: input.passed,
    status,
    group: config.group,
    message: input.message,
    weight: config.weight
  };
}

function getSeoHealthStatusScore(status: SeoHealthCriterionStatus) {
  switch (status) {
    case "pass":
      return 1;
    case "warning":
      return 0.6;
    case "fail":
      return 0;
    case "na":
      return null;
    default:
      return 0;
  }
}

function calculateSeoHealthScore(criteria: SeoHealthCriterion[]) {
  let finalScore = 0;

  for (const [groupId, groupWeight] of Object.entries(SEO_HEALTH_GROUP_WEIGHTS) as Array<[SeoHealthGroupId, number]>) {
    const groupCriteria = criteria.filter((criterion) => criterion.group === groupId);
    const applicableCriteria = groupCriteria.filter((criterion) => getSeoHealthStatusScore(criterion.status ?? "fail") !== null);
    const applicableWeight = applicableCriteria.reduce((sum, criterion) => sum + criterion.weight, 0);

    if (!applicableWeight) {
      continue;
    }

    const earnedWeight = applicableCriteria.reduce((sum, criterion) => {
      const statusScore = getSeoHealthStatusScore(criterion.status ?? "fail");
      return sum + criterion.weight * (statusScore ?? 0);
    }, 0);

    finalScore += (earnedWeight / applicableWeight) * groupWeight;
  }

  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

export async function analyzeProductSeoHealth(snapshot: ProductSeoAuditSnapshot, options: AuditOptions): Promise<ProductSeoHealth> {
  void options;

  const isBundleProduct = Boolean(snapshot.isBundleProduct);
  const criteria: SeoHealthCriterion[] = [];

  const titleLength = snapshot.title.trim().length;
  criteria.push(createSeoHealthCriterion({
    id: "title-length",
    label: "Title length",
    passed: titleLength >= 60 && titleLength <= 80,
    message:
      titleLength >= 60 && titleLength <= 80
        ? "The title length is in the recommended SEO range."
        : `The title is ${titleLength} characters long. Expand it past 60 characters while staying within TPT's 80-character limit.`
  }));

  const imageCount = snapshot.media?.imageCount ?? 0;
  criteria.push(createSeoHealthCriterion({
    id: "product-images",
    label: "Product images",
    passed: imageCount >= 4,
    message:
      imageCount >= 4
        ? "The product includes the full set of 4 product images."
        : `Only ${imageCount} product image(s) were found. Add up to 4 product images to strengthen the product page.`
  }));

  criteria.push(createSeoHealthCriterion({
    id: "preview",
    label: "Preview file",
    passed: Boolean(snapshot.hasPreview),
    message: snapshot.hasPreview
      ? "A preview file is available, which gives buyers a clearer look at the resource."
      : "No preview file was found. Add one so buyers can inspect the resource before purchasing."
  }));

  criteria.push(createSeoHealthCriterion({
    id: "video",
    label: "Product video",
    passed: Boolean(snapshot.media?.hasVideo),
    message: snapshot.media?.hasVideo
      ? "A product video is present."
      : "No product video was found. Add one preview video to explain the resource more clearly."
  }));

  const hasFirstPurchaseDiscount = Boolean(snapshot.discountOfferHasFirstPurchase);
  const hasFollowerDiscount = Boolean(snapshot.discountOfferHasFollower);
  let discountMessage = 'No discount box was found. Add one in "Promotions > Discounts".';

  if (hasFirstPurchaseDiscount && hasFollowerDiscount) {
    discountMessage = "The product includes both available discount offers, giving buyers more than one way to save.";
  } else if (hasFirstPurchaseDiscount) {
    discountMessage = "The product includes the first-purchase discount offer, which is a strong incentive for new buyers.";
  } else if (hasFollowerDiscount) {
    discountMessage = "The product includes the follower discount offer, which adds an extra incentive for engaged buyers.";
  }

  criteria.push(createSeoHealthCriterion({
    id: "discount",
    label: "Discount box",
    passed: Boolean(snapshot.discountOfferVisible),
    message: discountMessage,
    status: Boolean(snapshot.discountOfferVisible) ? "pass" : "fail"
  }));

  criteria.push(createSeoHealthCriterion({
    id: "grades",
    label: "Grades field",
    passed: (snapshot.grades?.length ?? 0) > 0,
    message: (snapshot.grades?.length ?? 0) > 0
      ? 'The product includes grade data in "Grades".'
      : 'No grade levels were found in "Grades". Add at least one grade level.'
  }));

  criteria.push(createSeoHealthCriterion({
    id: "subjects",
    label: "Subjects field",
    passed: (snapshot.subjects?.length ?? 0) >= 3,
    message: (snapshot.subjects?.length ?? 0) >= 3
      ? 'The product includes all 3 Subjects.'
      : `Only ${snapshot.subjects?.length ?? 0} Subject(s) were found. Add up to 3 Subjects for stronger discoverability.`
  }));

  criteria.push(createSeoHealthCriterion({
    id: "tags",
    label: "Tags field",
    passed: snapshot.tags.length >= 6,
    message: snapshot.tags.length >= 6
      ? "The product includes all 6 Tags."
      : `Only ${snapshot.tags.length} Tag(s) were found. Add up to 6 Tags to improve search coverage.`
  }));

  criteria.push(createSeoHealthCriterion({
    id: "pages",
    label: "Pages field",
    passed: Boolean((snapshot.pagesValue ?? "").trim() && !/n\/a/i.test(snapshot.pagesValue ?? "")),
    message:
      (snapshot.pagesValue ?? "").trim() && !/n\/a/i.test(snapshot.pagesValue ?? "")
        ? "The product includes the page count."
        : 'The "Pages" field is empty. Add the page count for the resource.'
  }));

  const descriptionWordCount = snapshot.descriptionWordCount ?? 0;
  criteria.push(createSeoHealthCriterion({
    id: "description-length",
    label: "Description length",
    passed: descriptionWordCount >= 300,
    message:
      descriptionWordCount >= 300
        ? "The description length is strong."
        : `The description is only ${descriptionWordCount} words. Expand it to at least 300 words with more detail about the resource.`
  }));

  const currentStorePath = extractStorePath(snapshot.sellerStorePath ?? "");
  const linkSummary = await summarizeDescriptionLinks(
    snapshot.descriptionProductLinks ?? [],
    currentStorePath,
    snapshot.descriptionLinkDetails
  );
  const flags = {
    sameStoreProduct: linkSummary.sameStoreProductLinks > 0,
    currentStore: linkSummary.currentStoreLinks > 0,
    otherStoreProduct: linkSummary.otherStoreProductLinks > 0,
    external: linkSummary.externalLinks > 0
  };
  const passedInternalLinks = (flags.sameStoreProduct || flags.currentStore) && !flags.otherStoreProduct && !flags.external;
  const internalLinksMessage = buildInternalLinksMessage(linkSummary);

  criteria.push(createSeoHealthCriterion({
    id: "internal-links",
    label: "Description product links",
    passed: passedInternalLinks,
    message: internalLinksMessage
  }));

  if (!isBundleProduct) {
    criteria.push(createSeoHealthCriterion({
      id: "bundle-inclusion",
      label: "Bundle inclusion",
      passed: Boolean(snapshot.bundleOfferVisible),
      message: snapshot.bundleOfferVisible
        ? "This product is included in at least one bundle."
        : "This product is not included in any bundle yet. Add it to at least one bundle to increase sales opportunities."
    }));
  }

  const productPricingCriterion = buildProductPricingCriterion({
    pagesValue: snapshot.pagesValue,
    currentPrice: snapshot.currentPrice
  });
  criteria.push(createSeoHealthCriterion(productPricingCriterion));

  const reviewCount = snapshot.reviewData?.count ?? 0;
  const recentReviewDates = snapshot.reviewData?.recentDates ?? [];
  if (reviewCount > 0) {
    const recentReviewsCriterion = buildRecentReviewsCriterion(recentReviewDates);
    criteria.push(createSeoHealthCriterion(recentReviewsCriterion));

    if (recentReviewDates.length >= 3) {
      const recentReviewFrequencyCriterion = buildRecentReviewFrequencyCriterion(recentReviewDates);
      criteria.push(createSeoHealthCriterion(recentReviewFrequencyCriterion));
    }
  }

  const averageRating = snapshot.reviewData?.average ?? null;
  criteria.push(createSeoHealthCriterion({
    id: "review-score",
    label: "Review score",
    passed: averageRating !== null && averageRating >= 4,
    message:
      averageRating === null
      ? "No review score is available yet."
      : averageRating >= 4
        ? "This product is receiving positive buyer ratings."
        : averageRating >= 2
          ? "This product is receiving below-target ratings from buyers."
          : "This product is receiving very weak ratings from buyers."
  }));

  return {
    product: {
      id: snapshot.productId ?? null,
      url: snapshot.productUrl,
      sellerName: snapshot.sellerName ?? null,
      title: snapshot.title,
      isBundleProduct
    },
    health: {
      seoHealthScore: calculateSeoHealthScore(criteria),
      criteria,
      analyzedAt: new Date().toISOString(),
      note: "SEO Health uses a weighted scoring model across Search Visibility, Product Completeness, Media & Buyer Experience, and Conversion & Store Growth. Knowlense normalizes the score only across criteria that apply to the current product."
    }
  };
}
