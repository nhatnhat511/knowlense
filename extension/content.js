const DEFAULT_API_URL = "https://api.knowlense.com";
const PANEL_ID = "knowlense-product-panel";
const STYLE_ID = "knowlense-product-panel-style";
const PANEL_STATE = {
  mountedUrl: null,
  panel: null,
  status: null,
  meta: null,
  body: null,
  action: null,
  results: null
};

function textFromNode(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeText(value) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function splitList(value) {
  return value
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

  return chunks.join(" ").slice(0, 300).trim();
}

function extractProductSnapshot() {
  const title = textFromNode(document.querySelector("h1"));
  const descriptionExcerpt = extractDescriptionExcerpt();
  const gradesValue = findLabelValue("Grades");
  const tagsValue = findLabelValue("Tags");
  const subjectsValue = findLabelValue("Subjects");
  const resourceTypeValue = findLabelValue("Resource type");

  if (!title || !descriptionExcerpt) {
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
      title,
      descriptionExcerpt,
      grades: splitList(gradesValue),
      tags: splitList(tagsValue),
      subjects: splitList(subjectsValue),
      resourceType: resourceTypeValue || null
    }
  };
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
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
        <h3 class="knowlense-panel-title">Keyword rankings</h3>
        <p class="knowlense-panel-subtitle">Generate ranked keyword candidates from this product and check where it appears in TPT search.</p>
      </div>
      <div class="knowlense-panel-body">
        <section class="knowlense-panel-section knowlense-panel-meta"></section>
        <section class="knowlense-panel-section">
          <button class="knowlense-panel-action" type="button">Analyze this product</button>
          <div class="knowlense-panel-status">Connect the extension through the website, then run the analysis.</div>
        </section>
        <section class="knowlense-panel-section">
          <div class="knowlense-panel-empty">No product keyword analysis yet. Run the check to generate the top keyword set and current TPT rank positions.</div>
          <ul class="knowlense-keyword-list" hidden></ul>
        </section>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  PANEL_STATE.panel = panel;
  PANEL_STATE.meta = panel.querySelector(".knowlense-panel-meta");
  PANEL_STATE.status = panel.querySelector(".knowlense-panel-status");
  PANEL_STATE.action = panel.querySelector(".knowlense-panel-action");
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
        <span>Grades</span>
        <strong>${snapshot.grades.length ? snapshot.grades.join(", ") : "Not found"}</strong>
      </div>
      <div style="text-align:right">
        <span>Tags</span>
        <strong>${snapshot.tags.length ? `${snapshot.tags.length} found` : "None"}</strong>
      </div>
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

  const keywords = payload?.analysis?.keywords ?? [];
  const summary = payload?.analysis?.summary;
  PANEL_STATE.results.innerHTML = "";

  if (!keywords.length) {
    PANEL_STATE.body.hidden = false;
    PANEL_STATE.results.hidden = true;
    PANEL_STATE.body.textContent = "No stable keyword candidates were generated for this product yet.";
    return;
  }

  PANEL_STATE.body.hidden = false;
  PANEL_STATE.results.hidden = false;
  PANEL_STATE.body.textContent = `${summary.rankedKeywords} of ${summary.generatedKeywords} keywords found in the sampled TPT search results. Best rank: ${summary.bestRank ?? "not found"}.`;

  keywords.forEach((item) => {
    const element = document.createElement("li");
    element.className = "knowlense-keyword-item";
    element.innerHTML = `
      <div class="knowlense-keyword-top">
        <div class="knowlense-keyword-name">${item.keyword}</div>
        <div class="knowlense-keyword-rank ${item.status === "ranked" ? "ranked" : "missing"}">${item.status === "ranked" ? `#${item.rankPosition}` : "Not found"}</div>
      </div>
      <div class="knowlense-keyword-meta">
        <span class="knowlense-chip">Score ${item.score}</span>
        <span class="knowlense-chip">${item.sourceCount} sources</span>
        <span class="knowlense-chip">${item.resultPage ? `Page ${item.resultPage}` : "Top 3 pages checked"}</span>
      </div>
      <a class="knowlense-keyword-link" href="${item.searchUrl}" target="_blank" rel="noreferrer">Open TPT search</a>
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
    throw new Error("Connect the extension through the website before running product ranking analysis.");
  }

  const extracted = extractProductSnapshot();
  if (!extracted.ok) {
    throw new Error(extracted.error);
  }

  const response = await fetch(`${sessionState.apiUrl.replace(/\/$/, "")}/v1/product-keywords/analyze`, {
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
    throw new Error(payload?.error || "Knowlense could not complete the product keyword analysis.");
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
  setPanelStatus("Generating the top keyword set and checking TPT rank positions...", "");

  try {
    const result = await analyzeCurrentProduct();
    renderMeta(result.snapshot);
    renderResults(result.payload);
    setPanelStatus(result.payload.warning || "Product keyword analysis completed.", result.payload.warning ? "error" : "success");
  } catch (error) {
    setPanelStatus(error.message, "error");
  } finally {
    PANEL_STATE.action.disabled = false;
    PANEL_STATE.action.textContent = "Analyze this product";
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
