const DEFAULT_API_URL = "https://api.knowlense.com";
const PANEL_ID = "knowlense-product-panel";
const STYLE_ID = "knowlense-product-panel-style";
const PANEL_STATE = {
  mountedUrl: null,
  panel: null,
  status: null,
  meta: null,
  intent: null,
  body: null,
  action: null,
  keywordInput: null,
  results: null
};

function textFromNode(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupe(items) {
  return [...new Set(items)];
}

function cleanGradeText(value) {
  return value
    .replace(/\bMostly used with\b.*$/i, "")
    .replace(/\bGrades?\b/i, "")
    .trim();
}

function splitList(value, kind = "default") {
  const source = kind === "grades" ? cleanGradeText(value) : value;
  return source
    .split(/,|\/|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractSearchQuery() {
  const url = new URL(window.location.href);
  const directQuery =
    url.searchParams.get("q") ||
    url.searchParams.get("search") ||
    url.searchParams.get("query") ||
    document.querySelector("input[type='search']")?.value ||
    document.querySelector("input[name='search']")?.value;

  return (directQuery || "").trim();
}

function extractResults() {
  const productLinks = [...document.querySelectorAll("a[href*='/Product/']")];
  const seen = new Set();

  return productLinks
    .map((link, index) => {
      const href = link.href;
      if (!href || seen.has(href)) {
        return null;
      }

      seen.add(href);

      const container =
        link.closest("article, li, [data-resource-id], [data-product-id], .SearchResultsPage__result, .product-list-item") ||
        link.parentElement;

      if (!container) {
        return null;
      }

      const title = textFromNode(link);
      if (!title) {
        return null;
      }

      const containerText = textFromNode(container);
      const lines = containerText
        .split(/\s{2,}|\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const snippet = lines.find((line) => line !== title && line.length > 24) || "";
      const priceText = containerText.match(/\$\d+(?:\.\d{2})?/)?.[0] || "";

      const shopLink = [...container.querySelectorAll("a")]
        .map((anchor) => textFromNode(anchor))
        .find((value) => value && value !== title && !value.includes("$"));

      return {
        position: index + 1,
        title,
        productUrl: href,
        shopName: shopLink || "",
        priceText,
        snippet
      };
    })
    .filter(Boolean)
    .slice(0, 18);
}

function extractSearchSnapshot() {
  const query = extractSearchQuery();
  const results = extractResults();

  if (!query) {
    return {
      ok: false,
      error: "No search query was detected on this page."
    };
  }

  if (results.length === 0) {
    return {
      ok: false,
      error: "No TPT product results were detected on this page."
    };
  }

  return {
    ok: true,
    snapshot: {
      query,
      pageUrl: window.location.href,
      capturedAt: new Date().toISOString(),
      results
    }
  };
}

function isProductPage() {
  return /teacherspayteachers\.com\/Product\//.test(window.location.href);
}

function extractProductId(value) {
  return value.match(/\/(\d+)(?:[/?#]|$)/)?.[1] ?? null;
}

function findLabelValue(label) {
  const candidates = [...document.querySelectorAll("div, span, p, li, dt, strong")];
  const normalizedLabel = normalizeText(label);

  for (const node of candidates) {
    const text = normalizeText(textFromNode(node));
    if (text !== normalizedLabel && text !== `${normalizedLabel}:`) {
      continue;
    }

    const parent = node.parentElement;
    const sibling = node.nextElementSibling;

    if (sibling) {
      const siblingText = textFromNode(sibling);
      if (siblingText) {
        return siblingText;
      }
    }

    if (parent) {
      const parentText = textFromNode(parent);
      if (parentText) {
        return parentText.replace(textFromNode(node), "").trim().replace(/^[:\-]\s*/, "");
      }
    }
  }

  return "";
}

function extractDescriptionExcerpt() {
  const headings = [...document.querySelectorAll("h2, h3, [role='heading']")];
  const heading = headings.find((item) => normalizeText(textFromNode(item)) === "description");

  if (!heading) {
    return "";
  }

  const chunks = [];
  let cursor = heading.parentElement?.nextElementSibling || heading.nextElementSibling;

  while (cursor && chunks.join(" ").length < 320) {
    const text = textFromNode(cursor);
    if (text) {
      chunks.push(text);
    }

    if (cursor.querySelector("h2, h3")) {
      break;
    }

    cursor = cursor.nextElementSibling;
  }

  return chunks.join(" ").split(/\s+/).slice(0, 300).join(" ").trim();
}

function extractSellerName() {
  const sellerLink = [...document.querySelectorAll("a")]
    .find((anchor) => /seller|store/i.test(anchor.href || "") || /followers?/i.test(textFromNode(anchor.parentElement || null)));

  return textFromNode(sellerLink) || "";
}

function extractPreviewData() {
  const previewButton = [...document.querySelectorAll("button, a")]
    .find((node) => /view preview/i.test(textFromNode(node)));
  const thumbs = [...document.querySelectorAll("img")]
    .filter((image) => {
      const alt = textFromNode(image);
      const src = image.getAttribute("src") || "";
      return /preview|page|thumbnail|product/i.test(`${alt} ${src}`);
    })
    .slice(0, 8);

  return {
    buttonVisible: Boolean(previewButton),
    thumbCount: thumbs.length,
    textHints: dedupe([
      ...(previewButton ? [textFromNode(previewButton)] : []),
      ...thumbs.map((image) => image.getAttribute("alt") || "")
    ]).filter(Boolean)
  };
}

function extractMediaData() {
  const thumbs = [...document.querySelectorAll("img")]
    .filter((image) => {
      const src = image.getAttribute("src") || "";
      return /product|preview|thumbnail|page/i.test(src);
    })
    .slice(0, 12);
  const hasVideo = Boolean(
    document.querySelector("video, iframe[src*='youtube'], iframe[src*='vimeo'], [class*='play'], [aria-label*='video']")
  );
  const hasReviewSection = /what others say|ratings|reviews/i.test(document.body.innerText || "");

  return {
    imageCount: thumbs.length,
    hasVideo,
    hasReviewSection
  };
}

function extractDescriptionProductLinks() {
  const headings = [...document.querySelectorAll("h2, h3, [role='heading']")];
  const heading = headings.find((item) => normalizeText(textFromNode(item)) === "description");

  if (!heading) {
    return [];
  }

  const links = new Set();
  let cursor = heading.parentElement?.nextElementSibling || heading.nextElementSibling;

  while (cursor) {
    cursor.querySelectorAll("a[href*='/Product/']").forEach((anchor) => links.add(anchor.href));
    if (cursor.querySelector("h2, h3")) {
      break;
    }

    cursor = cursor.nextElementSibling;
  }

  return [...links];
}

function extractUnansweredQuestions() {
  const pageText = document.body.innerText || "";
  if (/be the first to ask a question/i.test(pageText)) {
    return 0;
  }

  const qaSection = [...document.querySelectorAll("h2, h3, [role='heading']")]
    .find((node) => /questions?\s*&\s*answers?/i.test(textFromNode(node)));

  if (!qaSection) {
    return 0;
  }

  let sectionText = "";
  let cursor = qaSection.parentElement?.nextElementSibling || qaSection.nextElementSibling;
  let hops = 0;

  while (cursor && hops < 6) {
    sectionText += ` ${textFromNode(cursor)}`;
    if (cursor.querySelector("h2, h3")) {
      break;
    }
    cursor = cursor.nextElementSibling;
    hops += 1;
  }

  const questionCount = (sectionText.match(/\?/g) || []).length;
  const answeredCount = (sectionText.match(/answered|seller responded|reply/gi) || []).length;
  return Math.max(0, questionCount - answeredCount);
}

function extractProductSnapshot() {
  const title = textFromNode(document.querySelector("h1"));
  const descriptionExcerpt = extractDescriptionExcerpt();
  const gradesValue = findLabelValue("Grades");
  const tagsValue = findLabelValue("Tags");
  const subjectsValue = findLabelValue("Subjects");
  const resourceTypeValue = findLabelValue("Resource type");
  const pagesValue = findLabelValue("Pages");

  if (!title) {
    return {
      ok: false,
      error: "Knowlense could not read the core product details on this page."
    };
  }

  return {
    ok: true,
    snapshot: {
      productId: extractProductId(window.location.href),
      productUrl: window.location.href,
      sellerName: extractSellerName(),
      title,
      descriptionExcerpt,
      grades: splitList(gradesValue, "grades"),
      tags: splitList(tagsValue),
      subjects: splitList(subjectsValue),
      resourceType: resourceTypeValue || null,
      pagesValue: pagesValue || null,
      preview: extractPreviewData(),
      media: extractMediaData(),
      discountOfferVisible: /new users can receive 10% off their first purchase from this seller/i.test(document.body.innerText || ""),
      bundleOfferVisible: /save even more with bundles/i.test(document.body.innerText || ""),
      descriptionProductLinks: extractDescriptionProductLinks(),
      unansweredQuestions: extractUnansweredQuestions()
    }
  };
}

const FORMAT_HINTS = [
  "sequence and fold activity",
  "cut and paste activity",
  "spinner craft",
  "writing craft",
  "writing activity",
  "fold activity",
  "sequence activity",
  "craftivity",
  "activity",
  "activities",
  "centers",
  "craft",
  "spinner",
  "template",
  "printable",
  "worksheet",
  "worksheets"
];
const GENERIC_TAILS = new Set(["animal", "animals", "plant", "plants", "resource", "resources"]);
const TITLE_NOISE = new Set(["mostly", "used", "with", "grade", "grades"]);
const TOPIC_ARTICLES = new Set(["a", "an", "the"]);
const CANONICAL_TOPIC_PATTERNS = [
  "compare and contrast",
  "cause and effect",
  "main idea",
  "text evidence",
  "reading comprehension",
  "close reading",
  "opinion writing",
  "informational writing",
  "narrative writing",
  "parts of speech",
  "states of matter",
  "water cycle",
  "plant life cycle",
  "frog life cycle",
  "butterfly life cycle",
  "sunflower life cycle"
];

function tokenize(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !TITLE_NOISE.has(token));
}

function stripFormatHints(value) {
  let text = ` ${normalizeText(value)} `;
  [...FORMAT_HINTS].sort((left, right) => right.length - left.length).forEach((hint) => {
    text = text.replace(new RegExp(`\\b${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), " ");
  });

  return text.replace(/\s+/g, " ").trim();
}

function cleanEntity(value) {
  const tokens = tokenize(value);
  if (tokens.length > 1 && GENERIC_TAILS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ").trim();
}

function stripLeadingArticles(value) {
  return normalizeText(value)
    .split(" ")
    .filter(Boolean)
    .filter((token, index) => !(index === 0 && TOPIC_ARTICLES.has(token)))
    .join(" ")
    .trim();
}

function extractPatternTopicsFromText(value) {
  const topics = new Set();
  const normalized = normalizeText(value);
  const patterns = [
    { regex: /\blife cycle of (?:a |an |the )?([a-z0-9\s-]{2,40})/g, build: (entity) => `${entity} life cycle` },
    { regex: /\bparts of (?:a |an |the )?([a-z0-9\s-]{2,40})/g, build: (entity) => `parts of ${entity}` },
    { regex: /\btypes of (?:a |an |the )?([a-z0-9\s-]{2,40})/g, build: (entity) => `types of ${entity}` },
    { regex: /\bstages of (?:a |an |the )?([a-z0-9\s-]{2,40})/g, build: (entity) => `stages of ${entity}` }
  ];

  patterns.forEach(({ regex, build }) => {
    for (const match of normalized.matchAll(regex)) {
      const entity = cleanEntity(stripLeadingArticles(match[1] || ""));
      if (entity) {
        topics.add(build(entity));
      }
    }
  });

  CANONICAL_TOPIC_PATTERNS.forEach((pattern) => {
    if (normalized.includes(pattern)) {
      topics.add(pattern);
    }
  });

  return [...topics];
}

function buildCoreTopic(title, descriptionExcerpt = "") {
  const normalized = normalizeText(cleanGradeText(title));
  const patternTopic = extractPatternTopicsFromText(normalized)[0] || extractPatternTopicsFromText(descriptionExcerpt)[0];
  if (patternTopic) {
    return patternTopic;
  }

  const formatIndex = FORMAT_HINTS.reduce((lowest, hint) => {
    const index = normalized.indexOf(hint);
    if (index === -1) {
      return lowest;
    }

    return lowest === -1 ? index : Math.min(lowest, index);
  }, -1);

  const topicChunk = formatIndex > 0 ? normalized.slice(0, formatIndex).trim() : normalized;
  const cycleMatch = topicChunk.match(/\blife cycle of (?:a |an |the )?([a-z0-9\s-]+)/);
  if (cycleMatch?.[1]) {
    const entity = cleanEntity(stripLeadingArticles(cycleMatch[1]));
    if (entity) {
      return `${entity} life cycle`;
    }
  }

  const directMatch = topicChunk.match(/\b([a-z0-9\s-]{2,40}?) life cycle\b/);
  if (directMatch?.[1]) {
    const entity = cleanEntity(stripLeadingArticles(directMatch[1]));
    if (entity) {
      return `${entity} life cycle`;
    }
  }

  const normalizedDescription = normalizeText(descriptionExcerpt || "");
  const descriptionCycleMatch = normalizedDescription.match(/\blife cycle of (?:a |an |the )?([a-z0-9\s-]{2,40})/);
  if (descriptionCycleMatch?.[1]) {
    const entity = cleanEntity(stripLeadingArticles(descriptionCycleMatch[1]));
    if (entity) {
      return `${entity} life cycle`;
    }
  }

  return stripFormatHints(topicChunk);
}

function buildNgrams(tokens, minSize, maxSize) {
  const phrases = [];

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

function buildCoreTopics(snapshot) {
  const topics = new Set();
  const mainTopic = buildCoreTopic(snapshot.title, snapshot.descriptionExcerpt);
  if (mainTopic) {
    topics.add(mainTopic);
  }

  const descriptionBase = stripFormatHints(snapshot.descriptionExcerpt || "");
  const descriptionTokens = tokenize(descriptionBase)
    .filter((token) => !GENERIC_TAILS.has(token))
    .slice(0, 28);

  buildNgrams(descriptionTokens, 2, 4)
    .filter((phrase) => phrase.length >= 8 && phrase.split(" ").length <= 4)
    .filter((phrase) => {
      if (mainTopic && phrase.includes(mainTopic)) {
        return false;
      }

      const overlap = mainTopic
        ? mainTopic.split(" ").filter((token) => phrase.split(" ").includes(token)).length
        : phrase.split(" ").length;
      return overlap >= 2;
    })
    .slice(0, 8)
    .forEach((phrase) => topics.add(phrase));

  return [...topics]
    .map((item) => normalizeText(item))
    .filter((item) => item.length >= 6 && item.split(" ").length <= 4)
    .sort((left, right) => left.split(" ").length - right.split(" ").length || left.length - right.length)
    .slice(0, 3);
}

function findSearchInput() {
  return document.querySelector("input[type='search'], input[name='search'], input[placeholder*='Search']");
}

function collectSuggestionTexts(seed) {
  const selectors = [
    "[role='listbox'] [role='option']",
    "[role='listbox'] li",
    "[data-testid*='search'] li",
    "[data-testid*='autocomplete'] li",
    "[class*='autocomplete'] li",
    "[class*='Autocomplete'] li",
    "[class*='suggest'] li",
    "[class*='search'] [role='option']"
  ];
  const texts = new Set();

  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      const text = textFromNode(node);
      if (!text || text.length < 4 || text.length > 90 || /\$\d/.test(text)) {
        return;
      }

      if (/^see all results for\b/i.test(text)) {
        return;
      }

      if (normalizeText(text).includes(normalizeText(seed))) {
        texts.add(text);
      }
    });
  });

  return [...texts];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function collectTptSuggestions(snapshot) {
  const input = findSearchInput();
  const seeds = buildCoreTopics(snapshot);

  if (!input || seeds.length === 0) {
    return [];
  }

  const originalValue = input.value;
  const suggestions = new Set();

  for (const seed of seeds) {
    input.focus();
    input.value = seed;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
    await wait(650);

    collectSuggestionTexts(seed).forEach((item) => suggestions.add(item));
  }

  input.value = originalValue;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.blur();

  return [...suggestions].slice(0, 20);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      top: 132px;
      right: 24px;
      z-index: 99999;
      width: 340px;
      max-height: calc(100vh - 156px);
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 24px;
      background: rgba(255, 255, 255, 0.98);
      box-shadow: 0 30px 80px rgba(15, 23, 42, 0.16);
      backdrop-filter: blur(14px);
      font-family: Plus Jakarta Sans, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
    }

    #${PANEL_ID} * {
      box-sizing: border-box;
    }

    .knowlense-panel-shell {
      display: flex;
      max-height: calc(100vh - 156px);
      flex-direction: column;
    }

    .knowlense-panel-header {
      padding: 18px 18px 14px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    }

    .knowlense-panel-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #6d5efc;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .knowlense-panel-title {
      margin: 12px 0 0;
      font-size: 21px;
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .knowlense-panel-subtitle {
      margin: 8px 0 0;
      font-size: 13px;
      line-height: 1.55;
      color: #64748b;
    }

    .knowlense-panel-body {
      overflow: auto;
      padding: 16px 18px 18px;
    }

    .knowlense-panel-section {
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 18px;
      background: #ffffff;
      padding: 14px;
    }

    .knowlense-panel-section + .knowlense-panel-section {
      margin-top: 12px;
    }

    .knowlense-meta-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: #64748b;
    }

    .knowlense-meta-row strong {
      display: block;
      color: #111827;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .knowlense-panel-action {
      width: 100%;
      height: 44px;
      border: 0;
      border-radius: 999px;
      background: #111827;
      color: #ffffff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: transform 160ms ease, opacity 160ms ease, background 160ms ease;
    }

    .knowlense-panel-action:hover:not(:disabled) {
      transform: translateY(-1px);
      background: #000000;
    }

    .knowlense-panel-action:disabled {
      opacity: 0.65;
      cursor: wait;
    }

    .knowlense-panel-input {
      width: 100%;
      margin-bottom: 10px;
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 14px;
      background: #ffffff;
      padding: 12px 14px;
      font-size: 14px;
      color: #0f172a;
      outline: none;
    }

    .knowlense-panel-input:focus {
      border-color: rgba(109, 94, 252, 0.45);
      box-shadow: 0 0 0 4px rgba(109, 94, 252, 0.12);
    }

    .knowlense-panel-status {
      margin-top: 10px;
      font-size: 12px;
      line-height: 1.5;
      color: #64748b;
    }

    .knowlense-panel-status.error {
      color: #dc2626;
    }

    .knowlense-panel-status.success {
      color: #059669;
    }

    .knowlense-keyword-list {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .knowlense-keyword-item {
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 16px;
      background: #ffffff;
      padding: 12px;
    }

    .knowlense-keyword-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }

    .knowlense-keyword-name {
      font-size: 14px;
      line-height: 1.45;
      font-weight: 700;
      color: #111827;
    }

    .knowlense-keyword-rank {
      white-space: nowrap;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .knowlense-keyword-rank.ranked {
      background: #ecfdf5;
      color: #047857;
    }

    .knowlense-keyword-rank.missing {
      background: #fff7ed;
      color: #c2410c;
    }

    .knowlense-keyword-meta {
      margin-top: 8px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .knowlense-chip {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      background: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.18);
      padding: 4px 8px;
      font-size: 11px;
      color: #475569;
    }

    .knowlense-keyword-link {
      margin-top: 8px;
      display: inline-flex;
      font-size: 12px;
      color: #6d5efc;
      text-decoration: none;
      font-weight: 600;
    }

    .knowlense-keyword-link:hover {
      text-decoration: underline;
    }

    .knowlense-score {
      display: flex;
      align-items: baseline;
      gap: 10px;
    }

    .knowlense-score strong {
      font-size: 34px;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.04em;
      color: #111827;
    }

    .knowlense-score span {
      font-size: 12px;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .knowlense-panel-empty {
      font-size: 13px;
      line-height: 1.55;
      color: #64748b;
    }

    @media (max-width: 1500px) {
      #${PANEL_ID} {
        top: auto;
        right: 16px;
        bottom: 16px;
        width: min(360px, calc(100vw - 32px));
        max-height: min(72vh, 560px);
      }
    }
  `;

  document.head.appendChild(style);
}

function createPanel() {
  injectStyles();

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="knowlense-panel-shell">
      <div class="knowlense-panel-header">
        <div class="knowlense-panel-eyebrow">Knowlense SEO</div>
        <h3 class="knowlense-panel-title">TPT Listing SEO Auditor</h3>
        <p class="knowlense-panel-subtitle">Enter one target keyword to audit ranking, keyword placement, metadata coverage, media completeness, and listing SEO basics.</p>
      </div>
      <div class="knowlense-panel-body">
        <section class="knowlense-panel-section knowlense-panel-meta"></section>
        <section class="knowlense-panel-section knowlense-panel-intent"></section>
        <section class="knowlense-panel-section">
          <input class="knowlense-panel-input" type="text" placeholder="Enter one target keyword" />
          <button class="knowlense-panel-action" type="button">Run SEO audit</button>
          <div class="knowlense-panel-status">Connect the extension through the website, then run the SEO audit.</div>
        </section>
        <section class="knowlense-panel-section">
          <div class="knowlense-panel-empty">No SEO audit yet. Enter one keyword, then run the check to score this listing and generate 5 clear action items.</div>
          <ul class="knowlense-keyword-list" hidden></ul>
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  PANEL_STATE.panel = panel;
  PANEL_STATE.meta = panel.querySelector(".knowlense-panel-meta");
  PANEL_STATE.intent = panel.querySelector(".knowlense-panel-intent");
  PANEL_STATE.status = panel.querySelector(".knowlense-panel-status");
  PANEL_STATE.action = panel.querySelector(".knowlense-panel-action");
  PANEL_STATE.keywordInput = panel.querySelector(".knowlense-panel-input");
  PANEL_STATE.results = panel.querySelector(".knowlense-keyword-list");
  PANEL_STATE.body = panel.querySelector(".knowlense-panel-empty");
}

function renderMeta(snapshot) {
  if (!PANEL_STATE.meta) {
    return;
  }

  PANEL_STATE.meta.innerHTML = `
    <div class="knowlense-meta-row">
      <div>
        <span>Product</span>
        <strong>${snapshot.title}</strong>
      </div>
      <div style="text-align:right">
        <span>ID</span>
        <strong>${snapshot.productId || "N/A"}</strong>
      </div>
    </div>
    <div class="knowlense-meta-row" style="margin-top:10px">
      <div>
        <span>Store</span>
        <strong>${snapshot.sellerName || "Unknown"}</strong>
      </div>
      <div style="text-align:right">
        <span>Pages</span>
        <strong>${snapshot.pagesValue || "Not set"}</strong>
      </div>
    </div>
  `;
}

function renderIntent(analysis) {
  if (!PANEL_STATE.intent) {
    return;
  }

  const audit = analysis?.audit;
  if (!audit) {
    PANEL_STATE.intent.innerHTML = "";
    return;
  }

  const chipMarkup = (items) =>
    items.length
      ? items.map((item) => `<span class="knowlense-chip">${item}</span>`).join("")
      : '<span class="knowlense-chip">None</span>';

  PANEL_STATE.intent.innerHTML = `
    <div class="knowlense-score">
      <strong>${audit.seoScore}</strong>
      <span>SEO score</span>
    </div>
    <div style="font-size:12px;color:#64748b;margin:14px 0 8px">Keyword and rank</div>
    <div class="knowlense-keyword-meta">
      ${chipMarkup([
        audit.keyword,
        audit.rank.status === "ranked" ? `Page ${audit.rank.resultPage} · #${audit.rank.position}` : "Outside top 3 pages (>73)"
      ])}
    </div>
    <div style="font-size:12px;color:#64748b;margin:12px 0 8px">Checks</div>
    <div class="knowlense-keyword-meta">
      ${chipMarkup([
        audit.checks.titleContainsKeyword ? "Title keyword: yes" : "Title keyword: missing",
        audit.checks.descriptionContainsKeyword ? "Description keyword: yes" : "Description keyword: missing",
        audit.checks.tagsComplete ? "6 tags: yes" : `${audit.counts.tagsCount}/6 tags`,
        audit.checks.subjectsComplete ? "3 subjects: yes" : `${audit.counts.subjectsCount}/3 subjects`
      ])}
    </div>
  `;
}

function setPanelStatus(message, kind) {
  if (!PANEL_STATE.status) {
    return;
  }

  PANEL_STATE.status.textContent = message;
  PANEL_STATE.status.className = `knowlense-panel-status${kind ? ` ${kind}` : ""}`;
}

function renderResults(payload) {
  if (!PANEL_STATE.results || !PANEL_STATE.body) {
    return;
  }

  const audit = payload?.analysis?.audit;
  const actions = audit?.actionItems ?? [];
  PANEL_STATE.results.innerHTML = "";

  if (!audit || !actions.length) {
    PANEL_STATE.body.hidden = false;
    PANEL_STATE.results.hidden = true;
    PANEL_STATE.body.textContent = "No SEO action items were generated for this product yet.";
    return;
  }

  PANEL_STATE.body.hidden = false;
  PANEL_STATE.results.hidden = false;
  PANEL_STATE.body.textContent = `${audit.note} Title mentions: ${audit.counts.titleKeywordMentions}. Description mentions: ${audit.counts.descriptionKeywordMentions}.`;

  actions.forEach((item, index) => {
    const element = document.createElement("li");
    element.className = "knowlense-keyword-item";
    element.innerHTML = `
      <div class="knowlense-keyword-top">
        <div class="knowlense-keyword-name">${item}</div>
        <div class="knowlense-keyword-rank ranked">Step ${index + 1}</div>
      </div>
    `;
    PANEL_STATE.results.appendChild(element);
  });
}

async function loadExtensionSession() {
  const stored = await chrome.storage.local.get(["knowlense_extension_session", "knowlense_settings"]);
  return {
    session: stored.knowlense_extension_session ?? null,
    apiUrl: stored.knowlense_settings?.apiUrl || DEFAULT_API_URL
  };
}

async function analyzeCurrentProduct() {
  const sessionState = await loadExtensionSession();

  if (!sessionState.session?.sessionToken) {
    throw new Error("Connect the extension through the website before running the SEO audit.");
  }

  const extracted = extractProductSnapshot();
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }

  const keyword = PANEL_STATE.keywordInput?.value?.trim();
  if (!keyword) {
    throw new Error("Enter one keyword before running the SEO audit.");
  }

  extracted.snapshot.auditKeyword = keyword;

  const response = await fetch(`${sessionState.apiUrl.replace(/\/$/, "")}/v1/product-seo-audit/analyze`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionState.session.sessionToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(extracted.snapshot)
  });

  const payload = await response.json().catch(() => null);

  if (response.status === 401) {
    await chrome.storage.local.remove("knowlense_extension_session");
    throw new Error("Your extension session expired. Reconnect it from the website and try again.");
  }

  if (!response.ok || !payload?.analysis) {
    throw new Error(payload?.error || "Knowlense could not complete the SEO audit.");
  }

  return {
    snapshot: extracted.snapshot,
    payload
  };
}

async function handleAnalyzeClick() {
  if (!PANEL_STATE.action) {
    return;
  }

  PANEL_STATE.action.disabled = true;
  PANEL_STATE.action.textContent = "Analyzing...";
  setPanelStatus("Checking rank, keyword placement, metadata coverage, media completeness, and action items...", "");

  try {
    const result = await analyzeCurrentProduct();
    renderMeta(result.snapshot);
    renderIntent(result.payload.analysis);
    renderResults(result.payload);
    setPanelStatus(result.payload.warning || "SEO audit completed.", result.payload.warning ? "error" : "success");
  } catch (error) {
    setPanelStatus(error.message, "error");
  } finally {
    PANEL_STATE.action.disabled = false;
    PANEL_STATE.action.textContent = "Run SEO audit";
  }
}

function mountProductPanel() {
  if (!isProductPage()) {
    if (PANEL_STATE.panel) {
      PANEL_STATE.panel.remove();
      PANEL_STATE.panel = null;
      PANEL_STATE.mountedUrl = null;
    }
    return;
  }

  if (PANEL_STATE.mountedUrl === window.location.href && PANEL_STATE.panel) {
    return;
  }

  if (PANEL_STATE.panel) {
    PANEL_STATE.panel.remove();
  }

  const snapshotResult = extractProductSnapshot();
  if (!snapshotResult.ok) {
    return;
  }

  createPanel();
  renderMeta(snapshotResult.snapshot);
  PANEL_STATE.action.addEventListener("click", () => {
    void handleAnalyzeClick();
  });
  PANEL_STATE.mountedUrl = window.location.href;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "knowlense.extractSearchSnapshot") {
    return;
  }

  sendResponse(extractSearchSnapshot());
});

mountProductPanel();
setInterval(mountProductPanel, 1500);
