export type ProductSeoAuditSnapshot = {
  productId?: string | null;
  productUrl: string;
  sellerName?: string | null;
  title: string;
  descriptionExcerpt: string;
  grades: string[];
  tags: string[];
  subjects?: string[];
  resourceType?: string | null;
  preview?: {
    buttonVisible: boolean;
    thumbCount: number;
    textHints: string[];
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
    seoScore: number;
    primaryKeyword: string | null;
    placements: {
      title: boolean;
      snippet: boolean;
      description: boolean;
      preview: boolean;
    };
    tagCompleteness: {
      score: number;
      totalTags: number;
      matchedTags: string[];
      status: "strong" | "needs_work";
    };
    cannibalization: {
      status: "none" | "possible";
      similarListings: Array<{
        productId: string | null;
        productUrl: string;
        title: string;
        primaryKeyword: string;
      }>;
    };
    actionItems: string[];
    analyzedAt: string;
    cooldownMinutes: number;
    note: string;
  };
};

type AuditOptions = {
  db: D1Database;
  userId: string;
  cooldownMinutes?: number;
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

const DEFAULT_COOLDOWN_MINUTES = 30;
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
  "book",
  "craft",
  "for",
  "from",
  "in",
  "interactive",
  "is",
  "it",
  "kindergarten",
  "of",
  "on",
  "or",
  "planting",
  "printable",
  "the",
  "this",
  "to",
  "with",
  "worksheet",
  "worksheets"
]);
const FORMAT_HINTS = [
  "activities",
  "activity",
  "book",
  "booklet",
  "center",
  "centers",
  "craft",
  "craftivity",
  "cut and paste activity",
  "flipbook",
  "interactive book",
  "poster",
  "printable",
  "spinner",
  "spinner craft",
  "task cards",
  "template",
  "worksheet",
  "worksheets",
  "writing activity"
];
const GENERIC_TAILS = new Set(["animal", "animals", "plant", "plants", "resource", "resources"]);
const ACADEMIC_PATTERNS = [
  "compare and contrast",
  "cause and effect",
  "life cycle",
  "main idea",
  "text evidence",
  "reading comprehension",
  "close reading",
  "opinion writing",
  "informational writing",
  "narrative writing",
  "parts of speech",
  "states of matter",
  "water cycle"
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function stripFormatHints(value: string) {
  let text = ` ${normalizeText(value)} `;

  [...FORMAT_HINTS].sort((left, right) => right.length - left.length).forEach((hint) => {
    text = text.replace(new RegExp(`\\b${escapeRegExp(hint)}\\b`, "g"), " ");
  });

  return text.replace(/\s+/g, " ").trim();
}

function cleanEntity(value: string) {
  const tokens = tokenize(value);
  if (tokens.length > 1 && GENERIC_TAILS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ").trim();
}

function dedupe<T>(items: T[]) {
  return [...new Set(items)];
}

function extractPrimaryKeyword(snapshot: ProductSeoAuditSnapshot) {
  const title = normalizeText(snapshot.title);
  const description = normalizeText(snapshot.descriptionExcerpt);
  const topicCandidates = new Set<string>();

  const titleCycleMatch = title.match(/\blife cycle of (?:a |an |the )?([a-z0-9\s-]{2,40})/);
  if (titleCycleMatch?.[1]) {
    const entity = cleanEntity(titleCycleMatch[1]);
    if (entity) {
      topicCandidates.add(`${entity} life cycle`);
    }
  }

  const directCycleMatch = title.match(/\b([a-z0-9\s-]{2,40}?) life cycle\b/);
  if (directCycleMatch?.[1]) {
    const entity = cleanEntity(directCycleMatch[1]);
    if (entity) {
      topicCandidates.add(`${entity} life cycle`);
    }
  }

  const descriptionCycleMatch = description.match(/\blife cycle of (?:a |an |the )?([a-z0-9\s-]{2,40})/);
  if (descriptionCycleMatch?.[1]) {
    const entity = cleanEntity(descriptionCycleMatch[1]);
    if (entity) {
      topicCandidates.add(`${entity} life cycle`);
    }
  }

  ACADEMIC_PATTERNS.forEach((pattern) => {
    if (title.includes(pattern) || description.includes(pattern)) {
      topicCandidates.add(pattern);
    }
  });

  const titleWithoutFormats = stripFormatHints(title);
  const titleNgrams = buildNgrams(tokenize(titleWithoutFormats), 2, 4);
  const descriptionText = stripFormatHints(description);
  titleNgrams
    .map((phrase) => ({
      phrase,
      score:
        (titleWithoutFormats.includes(phrase) ? 45 : 0) +
        (descriptionText.includes(phrase) ? 30 : 0) +
        (phrase.split(" ").length === 2 ? 8 : phrase.split(" ").length === 3 ? 12 : 10)
    }))
    .filter((item) => item.score >= 45)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)
    .forEach((item) => topicCandidates.add(item.phrase));

  const sorted = [...topicCandidates]
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= 6 && item.split(" ").length <= 4)
    .sort((left, right) => left.split(" ").length - right.split(" ").length || left.length - right.length);

  return sorted[0] ?? null;
}

function buildSnippet(descriptionExcerpt: string) {
  return descriptionExcerpt.trim().slice(0, 180);
}

function hasKeywordPlacement(text: string | null | undefined, keyword: string | null) {
  if (!text || !keyword) {
    return false;
  }

  return normalizeText(text).includes(normalizeText(keyword));
}

function computeTagCompleteness(tags: string[], primaryKeyword: string | null) {
  const normalizedTags = tags.map(normalizeText).filter(Boolean);
  const keywordTokens = new Set(tokenize(primaryKeyword ?? ""));
  const matchedTags = normalizedTags.filter((tag) => {
    const tagTokens = tokenize(tag);
    return tagTokens.some((token) => keywordTokens.has(token));
  });

  const scoreBase = Math.min(normalizedTags.length * 12, 60);
  const alignmentBonus = Math.min(matchedTags.length * 10, 40);
  const score = Math.max(0, Math.min(100, scoreBase + alignmentBonus));
  const status: "strong" | "needs_work" = score >= 70 ? "strong" : "needs_work";

  return {
    score,
    totalTags: normalizedTags.length,
    matchedTags: matchedTags.map((tag) => tag),
    status
  };
}

function compareKeywordSimilarity(left: string, right: string) {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;

  return overlap / union;
}

async function findCannibalization(db: D1Database, userId: string, sellerName: string | null, productId: string | null, primaryKeyword: string | null) {
  if (!primaryKeyword) {
    return [];
  }

  const result = await db
    .prepare(
      `SELECT product_id, product_url, title_text, primary_keyword
       FROM product_seo_audits
       WHERE user_id = ?1
         AND (?2 IS NULL OR seller_name = ?2)
         AND (?3 IS NULL OR product_id != ?3)
         AND primary_keyword IS NOT NULL
       ORDER BY datetime(created_at) DESC
       LIMIT 25`
    )
    .bind(userId, sellerName, productId)
    .all<{ product_id: string | null; product_url: string; title_text: string; primary_keyword: string }>();

  return (result.results ?? [])
    .filter((row) => compareKeywordSimilarity(primaryKeyword, row.primary_keyword) >= 0.6)
    .slice(0, 3)
    .map((row) => ({
      productId: row.product_id,
      productUrl: row.product_url,
      title: row.title_text,
      primaryKeyword: row.primary_keyword
    }));
}

function buildActionItems(input: {
  primaryKeyword: string | null;
  placements: { title: boolean; snippet: boolean; description: boolean; preview: boolean };
  tagCompleteness: { totalTags: number; matchedTags: string[]; status: "strong" | "needs_work" };
  cannibalizationCount: number;
}) {
  const actions: string[] = [];
  const keyword = input.primaryKeyword ?? "your main keyword";

  if (!input.placements.title) {
    actions.push(`Add "${keyword}" to the product title, ideally near the front.`);
  } else {
    actions.push(`Keep "${keyword}" visible in the title and avoid replacing it with format-heavy wording.`);
  }

  if (!input.placements.snippet) {
    actions.push(`Mention "${keyword}" in the first 160 characters of the description snippet.`);
  } else {
    actions.push(`Keep the description opening focused on "${keyword}" and the buyer outcome.`);
  }

  if (!input.placements.description) {
    actions.push(`Repeat "${keyword}" naturally in the description body with buyer-facing context.`);
  } else {
    actions.push(`Strengthen the description with one more natural mention of "${keyword}" if it still feels light.`);
  }

  if (!input.placements.preview) {
    actions.push(`Add "${keyword}" or a close variation into the preview pages or preview cover text.`);
  } else {
    actions.push(`Keep the preview aligned with "${keyword}" so buyers see the topic immediately.`);
  }

  if (input.cannibalizationCount > 0) {
    actions.push(`Differentiate this listing from similar products in your store using a clearer angle than "${keyword}".`);
  } else if (input.tagCompleteness.status === "needs_work") {
    actions.push(`Improve tag coverage by adding more tags aligned with "${keyword}" and the product format.`);
  } else {
    actions.push(`Review competing listings for "${keyword}" and tighten the title-preview-tag alignment.`);
  }

  return actions.slice(0, 5);
}

export async function findRecentSeoAudit(db: D1Database, userId: string, productId: string | null, productUrl: string, cooldownMinutes = DEFAULT_COOLDOWN_MINUTES) {
  const row = await db
    .prepare(
      `SELECT id, product_id, product_url, title_text, primary_keyword, audit_json, created_at
       FROM product_seo_audits
       WHERE user_id = ?1
         AND ((?2 IS NOT NULL AND product_id = ?2) OR product_url = ?3)
         AND datetime(created_at) >= datetime('now', ?4)
       ORDER BY datetime(created_at) DESC
       LIMIT 1`
    )
    .bind(userId, productId, productUrl, `-${cooldownMinutes} minutes`)
    .first<StoredAuditRow>();

  if (!row) {
    return null;
  }

  return {
    runId: row.id,
    analysis: JSON.parse(row.audit_json) as ProductSeoAudit,
    createdAt: row.created_at
  };
}

export async function analyzeProductSeoAudit(snapshot: ProductSeoAuditSnapshot, options: AuditOptions): Promise<ProductSeoAudit> {
  const productId = snapshot.productId ?? snapshot.productUrl.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
  const cooldownMinutes = options.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;
  const primaryKeyword = extractPrimaryKeyword(snapshot);
  const snippet = buildSnippet(snapshot.descriptionExcerpt);
  const previewText = snapshot.preview?.textHints?.join(" ") ?? "";
  const placements = {
    title: hasKeywordPlacement(snapshot.title, primaryKeyword),
    snippet: hasKeywordPlacement(snippet, primaryKeyword),
    description: hasKeywordPlacement(snapshot.descriptionExcerpt, primaryKeyword),
    preview: hasKeywordPlacement(previewText, primaryKeyword)
  };
  const tagCompleteness = computeTagCompleteness(snapshot.tags, primaryKeyword);
  const similarListings = await findCannibalization(
    options.db,
    options.userId,
    snapshot.sellerName ?? null,
    productId,
    primaryKeyword
  ).catch(() => []);

  const score =
    (primaryKeyword ? 25 : 0) +
    (placements.title ? 20 : 0) +
    (placements.snippet ? 15 : 0) +
    (placements.description ? 15 : 0) +
    (placements.preview ? 10 : 0) +
    Math.round(tagCompleteness.score * 0.15) -
    (similarListings.length > 0 ? 8 : 0);

  return {
    product: {
      id: productId,
      url: snapshot.productUrl,
      sellerName: snapshot.sellerName ?? null,
      title: snapshot.title
    },
    audit: {
      seoScore: Math.max(0, Math.min(100, score)),
      primaryKeyword,
      placements,
      tagCompleteness,
      cannibalization: {
        status: similarListings.length ? "possible" : "none",
        similarListings
      },
      actionItems: buildActionItems({
        primaryKeyword,
        placements,
        tagCompleteness,
        cannibalizationCount: similarListings.length
      }),
      analyzedAt: new Date().toISOString(),
      cooldownMinutes,
      note: "This SEO audit follows TPT listing basics: keyword focus, placement, preview alignment, tag coverage, and overlap within the analyzed store."
    }
  };
}
