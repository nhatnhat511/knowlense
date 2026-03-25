const FLOATING_BOX_ID = "knowlense-floating-box";
const LOOKUP_ICON_ID = "knowlense-lookup-icon";
const AUTO_HIGHLIGHT_STYLE_ID = "knowlense-auto-highlight-style";
const SUBSCRIPTION_STORAGE_KEY = "knowlenseSubscription";

let latestPointer = { x: 0, y: 0 };
let currentSelection = "";
let subscriptionSnapshot = {
  isPremium: false,
  plan: "free",
  expiresAt: null
};
let apiServicePromise = null;

const STOP_WORDS = new Set([
  "about",
  "after",
  "before",
  "being",
  "browser",
  "chrome",
  "could",
  "extension",
  "first",
  "found",
  "highlight",
  "however",
  "knowlense",
  "other",
  "their",
  "there",
  "these",
  "those",
  "through",
  "using",
  "which",
  "without"
]);

function loadApiService() {
  if (!apiServicePromise) {
    apiServicePromise = import(chrome.runtime.getURL("apiService.js"));
  }

  return apiServicePromise;
}

function removeElementById(id) {
  const node = document.getElementById(id);
  if (node) {
    node.remove();
  }
}

function removeFloatingBox() {
  removeElementById(FLOATING_BOX_ID);
}

function removeLookupIcon() {
  removeElementById(LOOKUP_ICON_ID);
}

function getSafePosition(pointerX, pointerY, boxWidth, boxHeight) {
  const gap = 14;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = pointerX + gap;
  let top = pointerY + gap;

  if (left + boxWidth > viewportWidth - gap) {
    left = Math.max(gap, pointerX - boxWidth - gap);
  }

  if (top + boxHeight > viewportHeight - gap) {
    top = Math.max(gap, pointerY - boxHeight - gap);
  }

  left = Math.max(gap, Math.min(left, viewportWidth - boxWidth - gap));
  top = Math.max(gap, Math.min(top, viewportHeight - boxHeight - gap));

  return { left, top };
}

function formatSummary(text) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > 420 ? `${normalized.slice(0, 417)}...` : normalized;
}

function ensureAutoHighlightStyle() {
  if (document.getElementById(AUTO_HIGHLIGHT_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = AUTO_HIGHLIGHT_STYLE_ID;
  style.textContent = `
    .knowlense-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(8, 145, 178, 0.18);
      border-top-color: #0891b2;
      border-radius: 999px;
      animation: knowlense-spin 0.8s linear infinite;
    }

    .knowlense-auto-highlight {
      background: linear-gradient(180deg, rgba(8, 145, 178, 0.05) 0%, rgba(8, 145, 178, 0.22) 100%);
      border-radius: 4px;
      padding: 0 2px;
      box-shadow: inset 0 -1px 0 rgba(8, 145, 178, 0.18);
    }

    @keyframes knowlense-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  document.documentElement.appendChild(style);
}

function createFloatingBox(pointerX, pointerY, options) {
  removeFloatingBox();
  ensureAutoHighlightStyle();

  const box = document.createElement("div");
  box.id = FLOATING_BOX_ID;
  box.setAttribute("role", "dialog");
  box.style.position = "fixed";
  box.style.zIndex = "2147483647";
  box.style.width = "340px";
  box.style.maxWidth = "calc(100vw - 28px)";
  box.style.padding = "16px";
  box.style.borderRadius = "12px";
  box.style.border = "1px solid rgba(203, 213, 225, 0.9)";
  box.style.background = "#ffffff";
  box.style.boxShadow = "0 18px 38px rgba(15, 23, 42, 0.12)";
  box.style.color = "#0f172a";
  box.style.fontFamily = "Inter, \"Segoe UI\", sans-serif";
  box.style.lineHeight = "1.55";

  const title = document.createElement("div");
  title.textContent = "KNOWLENSE";
  title.style.fontSize = "12px";
  title.style.fontWeight = "700";
  title.style.letterSpacing = "0.08em";
  title.style.color = "#374151";
  title.style.marginBottom = "10px";

  const summary = document.createElement("div");
  summary.style.fontSize = "13px";
  summary.style.color = "#111827";
  summary.style.maxHeight = "300px";
  summary.style.overflowY = "auto";
  summary.style.marginBottom = "12px";

  if (options.state === "loading") {
    const loadingWrap = document.createElement("div");
    loadingWrap.style.display = "flex";
    loadingWrap.style.alignItems = "center";
    loadingWrap.style.gap = "10px";

    const spinner = document.createElement("div");
    spinner.className = "knowlense-spinner";

    const text = document.createElement("span");
    text.textContent = "Searching Wikipedia...";
    text.style.color = "#475569";

    loadingWrap.append(spinner, text);
    summary.appendChild(loadingWrap);
  } else {
    summary.textContent = formatSummary(options.summary || "No definition found");

    if (options.state === "empty") {
      summary.style.color = "#64748b";
    }
  }

  const source = options.source
    ? document.createElement("a")
    : document.createElement("span");

  source.textContent = options.source ? "Source" : options.state === "empty" ? "Try another term" : "No source available";
  source.style.fontSize = "12px";
  source.style.fontWeight = "600";
  source.style.color = options.source ? "#2563eb" : "#6b7280";
  source.style.textDecoration = "none";

  if (options.source) {
    source.href = options.source;
    source.target = "_blank";
    source.rel = "noreferrer noopener";
  }

  box.append(title, summary, source);
  document.body.appendChild(box);

  const { width, height } = box.getBoundingClientRect();
  const { left, top } = getSafePosition(pointerX, pointerY, width, height);
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
}

function createLookupIcon(pointerX, pointerY) {
  removeLookupIcon();

  const button = document.createElement("button");
  button.id = LOOKUP_ICON_ID;
  button.type = "button";
  button.textContent = "K";
  button.setAttribute("aria-label", "Look up with Knowlense");
  button.style.position = "fixed";
  button.style.left = `${pointerX + 8}px`;
  button.style.top = `${pointerY + 8}px`;
  button.style.zIndex = "2147483647";
  button.style.width = "28px";
  button.style.height = "28px";
  button.style.border = "0";
  button.style.borderRadius = "999px";
  button.style.background = "#0891b2";
  button.style.boxShadow = "0 10px 24px rgba(8, 145, 178, 0.35)";
  button.style.color = "#ffffff";
  button.style.fontFamily = "Inter, \"Segoe UI\", sans-serif";
  button.style.fontSize = "13px";
  button.style.fontWeight = "700";

  button.addEventListener("click", () => {
    void lookupSelectedTerm();
  });

  document.body.appendChild(button);
}

function getStoredSubscriptionState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      {
        [SUBSCRIPTION_STORAGE_KEY]: {
          isPremium: false,
          plan: "free",
          expiresAt: null
        }
      },
      (result) => resolve(result[SUBSCRIPTION_STORAGE_KEY])
    );
  });
}

async function updateSubscriptionState() {
  const nextState = await getStoredSubscriptionState();
  subscriptionSnapshot = {
    isPremium: Boolean(nextState?.isPremium),
    plan: nextState?.plan || "free",
    expiresAt: nextState?.expiresAt || null
  };

  if (subscriptionSnapshot.isPremium) {
    runAutoHighlight();
    return;
  }

  clearAutoHighlights();
}

async function lookupSelectedTerm() {
  if (!currentSelection) {
    return;
  }

  removeLookupIcon();
  createFloatingBox(latestPointer.x, latestPointer.y, {
    state: "loading"
  });

  try {
    const api = await loadApiService();
    const result = await api.getTermDefinition(currentSelection);

    if (!result?.ok) {
      createFloatingBox(latestPointer.x, latestPointer.y, {
        state: "empty",
        summary: result?.error?.includes("No Wikipedia result") ? "No definition found" : result?.error || "No definition found",
        source: ""
      });
      return;
    }

    const summary = result.summary || result.extract || "";
    createFloatingBox(latestPointer.x, latestPointer.y, {
      state: summary ? "success" : "empty",
      summary: summary || "No definition found",
      source: result.source || result.sourceUrl || ""
    });
  } catch (error) {
    createFloatingBox(latestPointer.x, latestPointer.y, {
      state: "empty",
      summary: "No definition found",
      source: ""
    });
  }
}

function handleSelection(event) {
  currentSelection = window.getSelection()?.toString().trim() || "";
  latestPointer = { x: event.clientX, y: event.clientY };

  if (!currentSelection) {
    removeLookupIcon();
    removeFloatingBox();
    return;
  }

  console.log("Knowlense selected text:", currentSelection);
  createLookupIcon(event.clientX, event.clientY);

  if (subscriptionSnapshot.isPremium) {
    void lookupSelectedTerm();
  }
}

function extractImportantKeywords() {
  const paragraphs = Array.from(document.querySelectorAll("p"));
  const counts = new Map();

  for (const paragraph of paragraphs) {
    const words = paragraph.textContent?.match(/[A-Za-z][A-Za-z-]{5,}/g) || [];

    for (const word of words) {
      const normalized = word.toLowerCase();

      if (STOP_WORDS.has(normalized)) {
        continue;
      }

      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

function replaceMatchesInTextNode(textNode, regex) {
  const text = textNode.nodeValue || "";
  const match = regex.exec(text);

  if (!match) {
    return false;
  }

  const matchedText = match[0];
  const before = text.slice(0, match.index);
  const after = text.slice(match.index + matchedText.length);
  const mark = document.createElement("mark");
  mark.className = "knowlense-auto-highlight";
  mark.textContent = matchedText;

  const fragment = document.createDocumentFragment();

  if (before) {
    fragment.appendChild(document.createTextNode(before));
  }

  fragment.appendChild(mark);

  if (after) {
    fragment.appendChild(document.createTextNode(after));
  }

  textNode.parentNode?.replaceChild(fragment, textNode);
  return true;
}

function highlightKeywordInParagraph(paragraph, keyword, budget) {
  const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  let textNode = walker.nextNode();

  while (textNode && budget.count < budget.max) {
    const parentElement = textNode.parentElement;
    if (parentElement && !parentElement.closest("mark.knowlense-auto-highlight")) {
      if (replaceMatchesInTextNode(textNode, regex)) {
        budget.count += 1;
        return;
      }
    }

    textNode = walker.nextNode();
  }
}

function clearAutoHighlights() {
  document.querySelectorAll("mark.knowlense-auto-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }

    parent.replaceChild(document.createTextNode(mark.textContent || ""), mark);
    parent.normalize();
  });
}

function runAutoHighlight() {
  if (!subscriptionSnapshot.isPremium) {
    return;
  }

  ensureAutoHighlightStyle();
  clearAutoHighlights();

  const keywords = extractImportantKeywords();
  if (!keywords.length) {
    return;
  }

  const paragraphs = Array.from(document.querySelectorAll("p"));
  const budget = { count: 0, max: 24 };

  for (const paragraph of paragraphs) {
    for (const keyword of keywords) {
      if (budget.count >= budget.max) {
        return;
      }

      highlightKeywordInParagraph(paragraph, keyword, budget);
    }
  }
}

document.addEventListener("mouseup", (event) => {
  window.setTimeout(() => {
    handleSelection(event);
  }, 0);
});

document.addEventListener("mousedown", (event) => {
  const box = document.getElementById(FLOATING_BOX_ID);
  const icon = document.getElementById(LOOKUP_ICON_ID);

  if (box && !box.contains(event.target)) {
    removeFloatingBox();
  }

  if (icon && !icon.contains(event.target)) {
    removeLookupIcon();
  }
});

window.addEventListener("resize", () => {
  removeLookupIcon();
  removeFloatingBox();
});

window.addEventListener(
  "scroll",
  () => {
    removeLookupIcon();
    removeFloatingBox();
  },
  true
);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[SUBSCRIPTION_STORAGE_KEY]) {
    void updateSubscriptionState();
  }
});

void updateSubscriptionState();
