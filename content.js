const FLOATING_BOX_ID = "knowlense-floating-box";
const EXCLUDED_HOST_PATTERNS = [
  /paypal\./i,
  /stripe\./i,
  /bank/i,
  /banking/i,
  /finance/i,
  /payment/i,
  /checkout/i,
  /wallet/i,
  /wise\.com$/i,
  /revolut\./i
];

let latestPointer = { x: 0, y: 0 };
let currentSelection = "";

function isExcludedPage() {
  return EXCLUDED_HOST_PATTERNS.some((pattern) => pattern.test(window.location.hostname));
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
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getSelectionContext() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const anchorNode = selection.anchorNode;
  const baseText =
    anchorNode?.nodeType === Node.TEXT_NODE
      ? anchorNode.textContent || ""
      : anchorNode instanceof Element
        ? anchorNode.textContent || ""
        : "";

  const normalizedBaseText = formatSummary(baseText);
  if (!normalizedBaseText) {
    return "";
  }

  if (!currentSelection) {
    return normalizedBaseText.slice(0, 280);
  }

  const normalizedSelection = formatSummary(currentSelection);
  const selectionIndex = normalizedBaseText.toLowerCase().indexOf(normalizedSelection.toLowerCase());

  if (selectionIndex === -1) {
    return normalizedBaseText.slice(0, 280);
  }

  const contextRadius = 140;
  const start = Math.max(0, selectionIndex - contextRadius);
  const end = Math.min(normalizedBaseText.length, selectionIndex + normalizedSelection.length + contextRadius);
  return normalizedBaseText.slice(start, end).trim();
}

function ensurePopoverStyles() {
  if (document.getElementById("knowlense-popover-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "knowlense-popover-style";
  style.textContent = `
    .knowlense-spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(8, 145, 178, 0.18);
      border-top-color: #0891b2;
      border-radius: 999px;
      animation: knowlense-spin 0.8s linear infinite;
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
  ensurePopoverStyles();

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
  summary.style.marginBottom = "16px";
  summary.style.textAlign = "left";
  summary.style.wordBreak = "normal";
  summary.style.overflowWrap = "break-word";
  summary.style.hyphens = "manual";
  summary.style.lineHeight = "1.65";
  summary.style.letterSpacing = "0";

  if (options.state === "loading") {
    const loadingWrap = document.createElement("div");
    loadingWrap.style.display = "flex";
    loadingWrap.style.alignItems = "center";
    loadingWrap.style.gap = "10px";

    const spinner = document.createElement("div");
    spinner.className = "knowlense-spinner";

    const text = document.createElement("span");
    text.textContent = "Looking up the term...";
    text.style.color = "#475569";

    loadingWrap.append(spinner, text);
    summary.appendChild(loadingWrap);
  } else {
    summary.textContent = formatSummary(options.summary || "No definition found");

    if (options.state === "empty") {
      summary.style.color = "#64748b";
    }
  }

  const hasValidSource = isValidSourceUrl(options.source);
  const source = hasValidSource ? document.createElement("a") : document.createElement("span");
  source.textContent = hasValidSource ? "Source" : options.state === "empty" ? "Try another term" : "Wikipedia source unavailable";
  source.style.fontSize = "12px";
  source.style.fontWeight = "600";
  source.style.color = hasValidSource ? "#2563eb" : "#6b7280";
  source.style.textDecoration = "none";

  if (hasValidSource) {
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

async function lookupSelectedTerm() {
  if (!currentSelection) {
    return;
  }

  const context = getSelectionContext();

  createFloatingBox(latestPointer.x, latestPointer.y, {
    state: "loading"
  });

  chrome.runtime.sendMessage(
    {
      type: "ANALYZE_SELECTED_TERM",
      keyword: currentSelection,
      context
    },
    (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        createFloatingBox(latestPointer.x, latestPointer.y, {
          state: "empty",
          summary: "No information found for this term.",
          source: ""
        });
        return;
      }

      if (response.data?.type !== "entity" || !response.data?.extract) {
        createFloatingBox(latestPointer.x, latestPointer.y, {
          state: "empty",
          summary: response.data?.extract || "No information found for this term.",
          source: ""
        });
        return;
      }

      createFloatingBox(latestPointer.x, latestPointer.y, {
        state: "success",
        summary: response.data.extract,
        source: response.data?.source || ""
      });
    }
  );
}

function handleSelection(event) {
  if (isExcludedPage()) {
    return;
  }

  if (event.target instanceof Element && event.target.closest(`#${FLOATING_BOX_ID}`)) {
    return;
  }

  currentSelection = window.getSelection()?.toString().trim() || "";
  latestPointer = { x: event.clientX, y: event.clientY };

  if (!currentSelection) {
    removeFloatingBox();
    return;
  }

  void lookupSelectedTerm();
}

document.addEventListener("mouseup", (event) => {
  window.setTimeout(() => {
    handleSelection(event);
  }, 0);
});

document.addEventListener("mousedown", (event) => {
  const box = document.getElementById(FLOATING_BOX_ID);

  if (box && event.target instanceof Node && !box.contains(event.target)) {
    removeFloatingBox();
  }
});

window.addEventListener("resize", () => {
  removeFloatingBox();
});

window.addEventListener(
  "scroll",
  () => {
    removeFloatingBox();
  },
  true
);

function isValidSourceUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}
