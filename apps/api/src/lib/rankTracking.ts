const TPT_BASE_URL = "https://www.teacherspayteachers.com";
const MAX_SEARCH_PAGES = 3;
const DEFAULT_FALLBACK_POSITION = 74;
const SEARCH_RESULTS_PER_PAGE = 18;
const TARGET_BATCH_LIMIT = 48;

export type RankTrackingStatus = "ranked" | "beyond_page_3";

export type RankTrackingCheckInput = {
  checkedAt?: string;
  source: "manual" | "scheduled";
  status: RankTrackingStatus;
  resultPage: number | null;
  pagePosition: number | null;
  searchUrl?: string | null;
};

export type CreateRankTrackingTargetInput = {
  userId: string;
  productId?: string | null;
  productUrl: string;
  productTitle: string;
  sellerName?: string | null;
  keyword: string;
  initialCheck: RankTrackingCheckInput;
};

type RankTrackingTargetRow = {
  id: string;
  user_id: string;
  product_id: string | null;
  product_url: string;
  product_title: string;
  seller_name: string | null;
  keyword_text: string;
  normalized_keyword: string;
  is_active: number;
  started_at: string;
  last_checked_at: string | null;
  last_status: RankTrackingStatus | null;
  last_result_page: number | null;
  last_page_position: number | null;
  last_absolute_position: number | null;
  last_search_url: string | null;
  best_absolute_position: number | null;
  best_result_page: number | null;
  best_page_position: number | null;
  best_checked_at: string | null;
  next_check_after: string | null;
};

type RankTrackingCheckRow = {
  target_id: string;
  checked_at: string;
  rank_status: RankTrackingStatus;
  result_page: number | null;
  page_position: number | null;
  absolute_position: number | null;
};

export type RankTrackingTarget = {
  id: string;
  productId: string | null;
  productUrl: string;
  productTitle: string;
  sellerName: string | null;
  keyword: string;
  normalizedKeyword: string;
  isActive: boolean;
  startedAt: string;
  lastCheckedAt: string | null;
  lastStatus: RankTrackingStatus | null;
  lastResultPage: number | null;
  lastPagePosition: number | null;
  lastAbsolutePosition: number | null;
  lastSearchUrl: string | null;
  currentRankLabel: string;
};

export type RankTrackingDashboardData = {
  summary: {
    activeTargets: number;
    baselinePending: number;
    improving: number;
    declining: number;
    stable: number;
  };
  filters: {
    selectedRange: "7d" | "30d" | "90d" | "all";
    selectedTargetId: string | null;
    targets: Array<{
      id: string;
      label: string;
      productTitle: string;
      keyword: string;
    }>;
  };
  chart: {
    targetId: string | null;
    title: string;
    keyword: string;
    baselineReady: boolean;
    baselineProgress: number;
    rangeLabel: string;
    insight: string;
    currentRankLabel: string;
    bestRankLabel: string;
    points: Array<{
      checkedAt: string;
      dayLabel: string;
      rankValue: number;
      rankLabel: string;
      status: RankTrackingStatus;
      resultPage: number | null;
      pagePosition: number | null;
    }>;
  };
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeKeyword(value: string) {
  return normalizeText(value);
}

function normalizeProductUrl(value: string) {
  try {
    const url = new URL(value, TPT_BASE_URL);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function extractProductId(value: string) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
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

function toAbsolutePosition(resultPage: number | null, pagePosition: number | null, status: RankTrackingStatus) {
  if (status !== "ranked" || !resultPage || !pagePosition) {
    return DEFAULT_FALLBACK_POSITION;
  }

  return (resultPage - 1) * SEARCH_RESULTS_PER_PAGE + pagePosition;
}

function formatRankLabel(status: RankTrackingStatus | null, resultPage: number | null, pagePosition: number | null) {
  if (!status || status !== "ranked" || !resultPage || !pagePosition) {
    return "Outside the first 3 pages";
  }

  return `Page ${resultPage}, position ${pagePosition}`;
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function buildNextCheckAfter(targetId: string, from = new Date()) {
  const seed = hashString(targetId);
  const hour = seed % 24;
  const minute = Math.floor(seed / 24) % 60;
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(hour, minute, 0, 0);
  return next.toISOString();
}

function getRangeStart(range: "7d" | "30d" | "90d" | "all") {
  if (range === "all") {
    return null;
  }

  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - (days - 1));
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function mapTarget(row: RankTrackingTargetRow): RankTrackingTarget {
  return {
    id: row.id,
    productId: row.product_id,
    productUrl: row.product_url,
    productTitle: row.product_title,
    sellerName: row.seller_name,
    keyword: row.keyword_text,
    normalizedKeyword: row.normalized_keyword,
    isActive: Boolean(row.is_active),
    startedAt: row.started_at,
    lastCheckedAt: row.last_checked_at,
    lastStatus: row.last_status,
    lastResultPage: row.last_result_page,
    lastPagePosition: row.last_page_position,
    lastAbsolutePosition: row.last_absolute_position,
    lastSearchUrl: row.last_search_url,
    currentRankLabel: formatRankLabel(row.last_status, row.last_result_page, row.last_page_position)
  };
}

async function insertCheck(
  db: D1Database,
  target: RankTrackingTargetRow,
  input: RankTrackingCheckInput
) {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const absolutePosition = toAbsolutePosition(input.resultPage, input.pagePosition, input.status);

  await db
    .prepare(
      `INSERT INTO rank_tracking_checks (
         id, target_id, user_id, product_id, product_url, keyword_text, normalized_keyword, source, checked_at,
         rank_status, result_page, page_position, absolute_position, search_url
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`
    )
    .bind(
      crypto.randomUUID(),
      target.id,
      target.user_id,
      target.product_id,
      target.product_url,
      target.keyword_text,
      target.normalized_keyword,
      input.source,
      checkedAt,
      input.status,
      input.resultPage,
      input.pagePosition,
      absolutePosition,
      input.searchUrl ?? null
    )
    .run();

  const bestAbsolutePosition =
    input.status === "ranked" && (!target.best_absolute_position || absolutePosition < target.best_absolute_position)
      ? absolutePosition
      : target.best_absolute_position;
  const bestResultPage =
    input.status === "ranked" && (!target.best_absolute_position || absolutePosition < (target.best_absolute_position ?? DEFAULT_FALLBACK_POSITION))
      ? input.resultPage
      : target.best_result_page;
  const bestPagePosition =
    input.status === "ranked" && (!target.best_absolute_position || absolutePosition < (target.best_absolute_position ?? DEFAULT_FALLBACK_POSITION))
      ? input.pagePosition
      : target.best_page_position;
  const bestCheckedAt =
    input.status === "ranked" && (!target.best_absolute_position || absolutePosition < (target.best_absolute_position ?? DEFAULT_FALLBACK_POSITION))
      ? checkedAt
      : target.best_checked_at;

  await db
    .prepare(
      `UPDATE rank_tracking_targets
       SET is_active = 1,
           updated_at = CURRENT_TIMESTAMP,
           last_checked_at = ?2,
           last_status = ?3,
           last_result_page = ?4,
           last_page_position = ?5,
           last_absolute_position = ?6,
           last_search_url = ?7,
           best_absolute_position = ?8,
           best_result_page = ?9,
           best_page_position = ?10,
           best_checked_at = ?11,
           next_check_after = ?12
       WHERE id = ?1`
    )
    .bind(
      target.id,
      checkedAt,
      input.status,
      input.resultPage,
      input.pagePosition,
      absolutePosition,
      input.searchUrl ?? null,
      bestAbsolutePosition,
      bestResultPage,
      bestPagePosition,
      bestCheckedAt,
      buildNextCheckAfter(target.id, new Date(checkedAt))
    )
    .run();
}

async function findTarget(db: D1Database, userId: string, productUrl: string, keyword: string) {
  return db
    .prepare(
      `SELECT *
       FROM rank_tracking_targets
       WHERE user_id = ?1
         AND product_url = ?2
         AND normalized_keyword = ?3
       LIMIT 1`
    )
    .bind(userId, normalizeProductUrl(productUrl), normalizeKeyword(keyword))
    .first<RankTrackingTargetRow>();
}

export async function createOrUpdateRankTrackingTarget(db: D1Database, input: CreateRankTrackingTargetInput) {
  const normalizedProductUrl = normalizeProductUrl(input.productUrl);
  const normalized = normalizeKeyword(input.keyword);
  let target = await findTarget(db, input.userId, normalizedProductUrl, input.keyword);

  if (!target) {
    const targetId = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO rank_tracking_targets (
           id, user_id, product_id, product_url, product_title, seller_name, keyword_text, normalized_keyword,
           is_active, started_at, next_check_after
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 1, ?9, ?10)`
      )
      .bind(
        targetId,
        input.userId,
        input.productId ?? extractProductId(normalizedProductUrl),
        normalizedProductUrl,
        input.productTitle,
        input.sellerName ?? null,
        input.keyword.trim(),
        normalized,
        input.initialCheck.checkedAt ?? new Date().toISOString(),
        buildNextCheckAfter(targetId)
      )
      .run();

    target = await db
      .prepare(`SELECT * FROM rank_tracking_targets WHERE id = ?1 LIMIT 1`)
      .bind(targetId)
      .first<RankTrackingTargetRow>();
  } else {
    await db
      .prepare(
        `UPDATE rank_tracking_targets
         SET product_id = ?2,
             product_title = ?3,
             seller_name = ?4,
             keyword_text = ?5,
             is_active = 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1`
      )
      .bind(
        target.id,
        input.productId ?? target.product_id ?? extractProductId(normalizedProductUrl),
        input.productTitle,
        input.sellerName ?? null,
        input.keyword.trim()
      )
      .run();

    target = await db
      .prepare(`SELECT * FROM rank_tracking_targets WHERE id = ?1 LIMIT 1`)
      .bind(target.id)
      .first<RankTrackingTargetRow>();
  }

  if (!target) {
    throw new Error("Unable to create rank tracking target.");
  }

  await insertCheck(db, target, input.initialCheck);
  const refreshed = await db
    .prepare(`SELECT * FROM rank_tracking_targets WHERE id = ?1 LIMIT 1`)
    .bind(target.id)
    .first<RankTrackingTargetRow>();

  return refreshed ? mapTarget(refreshed) : mapTarget(target);
}

export async function deactivateRankTrackingTarget(db: D1Database, userId: string, targetId: string) {
  await db
    .prepare(
      `UPDATE rank_tracking_targets
       SET is_active = 0,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?1
         AND user_id = ?2`
    )
    .bind(targetId, userId)
    .run();
}

export async function listRankTrackingTargets(
  db: D1Database,
  userId: string,
  filters?: { productId?: string | null; productUrl?: string | null; activeOnly?: boolean }
) {
  const clauses = ["user_id = ?1"];
  const values: Array<string | number | null> = [userId];

  if (filters?.activeOnly) {
    clauses.push("is_active = 1");
  }

  if (filters?.productId) {
    clauses.push("product_id = ?2");
    values.push(filters.productId);
  } else if (filters?.productUrl) {
    clauses.push(`product_url = ?${values.length + 1}`);
    values.push(normalizeProductUrl(filters.productUrl));
  }

  const query = `SELECT *
    FROM rank_tracking_targets
    WHERE ${clauses.join(" AND ")}
    ORDER BY datetime(updated_at) DESC`;

  const result = await db.prepare(query).bind(...values).all<RankTrackingTargetRow>();
  return (result.results ?? []).map(mapTarget);
}

async function fetchDailyRank(productUrl: string, keyword: string) {
  const normalizedProductUrl = normalizeProductUrl(productUrl);
  const searchUrl = `${TPT_BASE_URL}/browse?search=${encodeURIComponent(keyword)}`;
  const productId = extractProductId(normalizedProductUrl);

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
      const candidateUrl = normalizeProductUrl(urls[index]);
      const candidateId = extractProductId(candidateUrl);
      if (candidateUrl === normalizedProductUrl || (productId && candidateId && candidateId === productId)) {
        return {
          status: "ranked" as const,
          resultPage: page,
          pagePosition: index + 1,
          searchUrl
        };
      }
    }
  }

  return {
    status: "beyond_page_3" as const,
    resultPage: null,
    pagePosition: null,
    searchUrl
  };
}

export async function runScheduledRankTracking(db: D1Database) {
  const due = await db
    .prepare(
      `SELECT *
       FROM rank_tracking_targets
       WHERE is_active = 1
         AND next_check_after IS NOT NULL
         AND datetime(next_check_after) <= datetime('now')
       ORDER BY datetime(next_check_after) ASC
       LIMIT ?1`
    )
    .bind(TARGET_BATCH_LIMIT)
    .all<RankTrackingTargetRow>();

  const targets = due.results ?? [];
  let processed = 0;

  for (const target of targets) {
    const today = new Date().toISOString().slice(0, 10);
    const alreadyChecked = await db
      .prepare(
        `SELECT id
         FROM rank_tracking_checks
         WHERE target_id = ?1
           AND substr(checked_at, 1, 10) = ?2
         LIMIT 1`
      )
      .bind(target.id, today)
      .first<{ id: string }>();

    if (alreadyChecked) {
      await db
        .prepare(`UPDATE rank_tracking_targets SET next_check_after = ?2 WHERE id = ?1`)
        .bind(target.id, buildNextCheckAfter(target.id))
        .run();
      continue;
    }

    try {
      const fetched = await fetchDailyRank(target.product_url, target.keyword_text);
      await insertCheck(db, target, {
        checkedAt: new Date().toISOString(),
        source: "scheduled",
        status: fetched.status,
        resultPage: fetched.resultPage,
        pagePosition: fetched.pagePosition,
        searchUrl: fetched.searchUrl
      });
      processed += 1;
    } catch {
      await db
        .prepare(`UPDATE rank_tracking_targets SET next_check_after = ?2 WHERE id = ?1`)
        .bind(target.id, buildNextCheckAfter(target.id))
        .run();
    }
  }

  return { processed, queued: targets.length };
}

function classifyTrend(points: RankTrackingCheckRow[]) {
  if (points.length < 2) {
    return "stable" as const;
  }

  const first = points[0].absolute_position ?? DEFAULT_FALLBACK_POSITION;
  const latest = points[points.length - 1].absolute_position ?? DEFAULT_FALLBACK_POSITION;
  const delta = first - latest;

  if (delta >= 3) {
    return "improving" as const;
  }

  if (delta <= -3) {
    return "declining" as const;
  }

  return "stable" as const;
}

function buildInsight(target: RankTrackingTargetRow | null, points: RankTrackingCheckRow[], totalChecks: number, rangeLabel: string) {
  if (!target) {
    return "Start tracking a keyword from the extension to unlock daily rank history.";
  }

  if (totalChecks < 7) {
    return `Baseline data is still being collected for this keyword. ${totalChecks} of 7 daily checks are complete.`;
  }

  if (points.length < 2) {
    return `There is not enough rank movement data in the selected ${rangeLabel} range yet.`;
  }

  const first = points[0].absolute_position ?? DEFAULT_FALLBACK_POSITION;
  const latest = points[points.length - 1].absolute_position ?? DEFAULT_FALLBACK_POSITION;
  const change = first - latest;
  const outsideCount = points.filter((point) => point.rank_status === "beyond_page_3").length;

  if (change >= 3) {
    return `This tracked keyword improved by ${change} positions over the selected ${rangeLabel} range.`;
  }

  if (change <= -3) {
    return `This tracked keyword declined by ${Math.abs(change)} positions over the selected ${rangeLabel} range.`;
  }

  if (outsideCount > 0) {
    return `This tracked keyword has been unstable in the selected ${rangeLabel} range, with ${outsideCount} check${outsideCount === 1 ? "" : "s"} outside the first 3 pages.`;
  }

  return `This tracked keyword has remained relatively stable over the selected ${rangeLabel} range.`;
}

export async function readRankTrackingDashboard(
  db: D1Database,
  userId: string,
  filters?: { range?: "7d" | "30d" | "90d" | "all"; targetId?: string | null }
): Promise<RankTrackingDashboardData> {
  const range = filters?.range ?? "30d";
  const targetsResult = await db
    .prepare(
      `SELECT *
       FROM rank_tracking_targets
       WHERE user_id = ?1
         AND is_active = 1
       ORDER BY datetime(updated_at) DESC`
    )
    .bind(userId)
    .all<RankTrackingTargetRow>();
  const targets = targetsResult.results ?? [];
  const selectedTarget = targets.find((target) => target.id === filters?.targetId) ?? targets[0] ?? null;

  const rangeStart = getRangeStart(range);
  const checkRowsResult = targets.length
    ? await db
        .prepare(
          `SELECT target_id, checked_at, rank_status, result_page, page_position, absolute_position
           FROM rank_tracking_checks
           WHERE user_id = ?1
             ${rangeStart ? "AND datetime(checked_at) >= datetime(?2)" : ""}
           ORDER BY datetime(checked_at) ASC`
        )
        .bind(...(rangeStart ? [userId, rangeStart] : [userId]))
        .all<RankTrackingCheckRow>()
    : { results: [] as RankTrackingCheckRow[] };
  const rangeChecks = checkRowsResult.results ?? [];
  const checksByTarget = new Map<string, RankTrackingCheckRow[]>();
  rangeChecks.forEach((row) => {
    const current = checksByTarget.get(row.target_id) ?? [];
    current.push(row);
    checksByTarget.set(row.target_id, current);
  });

  let improving = 0;
  let declining = 0;
  let stable = 0;
  let baselinePending = 0;

  for (const target of targets) {
    const totalChecksRow = await db
      .prepare(`SELECT COUNT(*) as total FROM rank_tracking_checks WHERE target_id = ?1`)
      .bind(target.id)
      .first<{ total: number | string }>();
    const totalChecks = Number(totalChecksRow?.total ?? 0);
    if (totalChecks < 7) {
      baselinePending += 1;
      continue;
    }

    const trend = classifyTrend(checksByTarget.get(target.id) ?? []);
    if (trend === "improving") {
      improving += 1;
    } else if (trend === "declining") {
      declining += 1;
    } else {
      stable += 1;
    }
  }

  let chartChecks: RankTrackingCheckRow[] = [];
  let totalChecksForSelected = 0;
  if (selectedTarget) {
    const selectedChecksResult = await db
      .prepare(
        `SELECT target_id, checked_at, rank_status, result_page, page_position, absolute_position
         FROM rank_tracking_checks
         WHERE target_id = ?1
           ${rangeStart ? "AND datetime(checked_at) >= datetime(?2)" : ""}
         ORDER BY datetime(checked_at) ASC`
      )
      .bind(...(rangeStart ? [selectedTarget.id, rangeStart] : [selectedTarget.id]))
      .all<RankTrackingCheckRow>();
    chartChecks = selectedChecksResult.results ?? [];

    const totalChecksRow = await db
      .prepare(`SELECT COUNT(*) as total FROM rank_tracking_checks WHERE target_id = ?1`)
      .bind(selectedTarget.id)
      .first<{ total: number | string }>();
    totalChecksForSelected = Number(totalChecksRow?.total ?? 0);
  }

  const rangeLabel = range === "7d" ? "7-day" : range === "30d" ? "30-day" : range === "90d" ? "90-day" : "full-history";

  return {
    summary: {
      activeTargets: targets.length,
      baselinePending,
      improving,
      declining,
      stable
    },
    filters: {
      selectedRange: range,
      selectedTargetId: selectedTarget?.id ?? null,
      targets: targets.map((target) => ({
        id: target.id,
        label: `${target.keyword_text} - ${target.product_title}`,
        productTitle: target.product_title,
        keyword: target.keyword_text
      }))
    },
    chart: {
      targetId: selectedTarget?.id ?? null,
      title: selectedTarget?.product_title ?? "No tracked keyword selected",
      keyword: selectedTarget?.keyword_text ?? "",
      baselineReady: totalChecksForSelected >= 7,
      baselineProgress: Math.min(totalChecksForSelected, 7),
      rangeLabel,
      insight: buildInsight(selectedTarget, chartChecks, totalChecksForSelected, rangeLabel),
      currentRankLabel: selectedTarget
        ? formatRankLabel(selectedTarget.last_status, selectedTarget.last_result_page, selectedTarget.last_page_position)
        : "No rank data yet",
      bestRankLabel: selectedTarget?.best_absolute_position
        ? formatRankLabel("ranked", selectedTarget.best_result_page, selectedTarget.best_page_position)
        : "No ranked result yet",
      points: chartChecks.map((point) => ({
        checkedAt: point.checked_at,
        dayLabel: new Date(point.checked_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        rankValue: point.absolute_position ?? DEFAULT_FALLBACK_POSITION,
        rankLabel: formatRankLabel(point.rank_status, point.result_page, point.page_position),
        status: point.rank_status,
        resultPage: point.result_page,
        pagePosition: point.page_position
      }))
    }
  };
}
